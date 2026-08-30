import io from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;

export const initializeSocket = () => {
  if (socket && socket.connected) {
    return socket;
  }

  const token = localStorage.getItem("sos_token");
  if (!token) {
    console.warn("No token available for socket connection");
    return null;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => {
  if (!socket || !socket.connected) {
    return initializeSocket();
  }
  return socket;
};

export const joinAlertRoom = (alertId) => {
  const currentSocket = getSocket();
  if (!currentSocket) return;

  currentSocket.emit("alert:join", { alertId }, (response) => {
    if (response?.success) {
      console.log("Joined alert room:", response.room);
    } else {
      console.error("Failed to join alert room:", response?.message);
    }
  });
};

export const onSOSStarted = (callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.on("sos:started", callback);
  }
};

export const onLocationUpdate = (callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.on("location:update", callback);
  }
};

export const onSOSResolved = (callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.on("sos:resolved", callback);
  }
};

export const offSOSStarted = (callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.off("sos:started", callback);
  }
};

export const offLocationUpdate = (callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.off("location:update", callback);
  }
};

export const offSOSResolved = (callback) => {
  const currentSocket = getSocket();
  if (currentSocket) {
    currentSocket.off("sos:resolved", callback);
  }
};
