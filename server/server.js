const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors=require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const connectDB=require("./config/db");
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const profileRoutes = require("./routes/profileRoutes");
const sosRoutes = require("./routes/sosRoutes");
const locationRoutes = require("./routes/locationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { initializeSocket } = require("./sockets/socketManager");

connectDB();

const app=express();
app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));
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

app.get("/",(req,res)=>{
    res.json({
        success: true,
        message: "Silent SOS Backend Running 🚀"
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

const PORT=process.env.PORT || 5000;

const server = http.createServer(app);
initializeSocket(server);

server.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`);
})