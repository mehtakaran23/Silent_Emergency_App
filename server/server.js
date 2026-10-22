const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const profileRoutes = require("./routes/profileRoutes");
const sosRoutes = require("./routes/sosRoutes");
const locationRoutes = require("./routes/locationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { initializeSocket } = require("./sockets/socketManager");
const { getSMTPStatusMessage } = require("./services/emailService");

const getAllowedOrigins = () => {
  const origins = [
    "https://silent-emergency-app-six.vercel.app",
    "https://silent-emergency-ll5cz5yz1-mehtakaran23s-projects.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    ...(process.env.CLIENT_URL || "").split(","),
    ...(process.env.SOCKET_CORS_ORIGIN || "").split(","),
  ].filter(Boolean);

  return [...new Set(origins.map((origin) => origin.trim()).filter(Boolean))];
};

const app = express();
// Render places one trusted reverse proxy in front of the application.
// Trusting exactly one hop lets express-rate-limit use X-Forwarded-For
// without accepting an arbitrary client-supplied proxy chain.
app.set("trust proxy", 1);

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(helmet());
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

app.use(morgan((tokens, req, res) => {
  const safeUrl = req.originalUrl.replace(
    /(\/api\/sos\/respond\/)[^/?]+/g,
    "$1[redacted]"
  );
  return [
    tokens.method(req, res),
    safeUrl,
    tokens.status(req, res),
    tokens.res(req, res, "content-length"),
    "-",
    tokens["response-time"](req, res),
    "ms",
  ].join(" ");
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api/auth", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Silent SOS Backend Running 🚀",
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Request body contains invalid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large." });
  }
  console.error(error);
  return res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error." : error.message,
  });
});

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await connectDB();
    console.log(getSMTPStatusMessage());

    const server = http.createServer(app);
    initializeSocket(server);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server. Please verify environment configuration.", error.message);
    process.exit(1);
  }
};

startServer();