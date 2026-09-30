const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Alert = require("../models/Alert");

let ioInstance = null;

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const bearerToken = socket.handshake.headers?.authorization;

  if (authToken) {
    return authToken;
  }

  if (bearerToken && bearerToken.startsWith("Bearer ")) {
    return bearerToken.split(" ")[1];
  }

  return null;
};

const authenticateSocket = (socket, next) => {
  try {
    const token = getTokenFromSocket(socket);

    if (!token) {
      return next(new Error("Authentication required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = {
      id: decoded.id,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    return next(new Error("Invalid or expired token."));
  }
};

const canJoinAlertRoom = async (userId, alertId) => {
  if (!alertId || !require("mongoose").Types.ObjectId.isValid(alertId)) {
    return { allowed: false, reason: "Invalid alert id." };
  }
  const alert = await Alert.findById(alertId).select("userId");

  if (!alert) {
    return { allowed: false, reason: "Alert not found." };
  }

  if (String(alert.userId) !== String(userId)) {
    return { allowed: false, reason: "Forbidden." };
  }

  return { allowed: true, alert };
};

const initializeSocket = (server) => {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  ioInstance.use(authenticateSocket);

  ioInstance.on("connection", (socket) => {
    socket.on("alert:join", async (payload, ack) => {
      try {
        const alertId = payload?.alertId;

        if (!alertId) {
          if (typeof ack === "function") {
            ack({ success: false, message: "alertId is required." });
          }
          return;
        }

        const result = await canJoinAlertRoom(socket.user.id, alertId);

        if (!result.allowed) {
          if (typeof ack === "function") {
            ack({ success: false, message: result.reason });
          }
          return;
        }

        const roomName = `alert:${alertId}`;
        socket.join(roomName);

        if (typeof ack === "function") {
          ack({ success: true, room: roomName });
        }
      } catch (error) {
        if (typeof ack === "function") {
          ack({ success: false, message: "Unable to join alert room." });
        }
      }
    });

    socket.on("alert:leave", (payload) => {
      if (payload?.alertId) {
        socket.leave(`alert:${payload.alertId}`);
      }
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

const emitToAlertRoom = (alertId, eventName, payload) => {
  if (!ioInstance || !alertId) {
    return;
  }

  ioInstance.to(`alert:${alertId}`).emit(eventName, payload);
};

module.exports = {
  initializeSocket,
  getIO,
  emitToAlertRoom,
};