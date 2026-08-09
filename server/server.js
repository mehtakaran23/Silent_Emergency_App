const express = require("express");
const dotenv = require("dotenv");
const cors=require("cors");
const http = require("http");
const connectDB=require("./config/db");
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const profileRoutes = require("./routes/profileRoutes");
const sosRoutes = require("./routes/sosRoutes");
const locationRoutes = require("./routes/locationRoutes");
const { initializeSocket } = require("./sockets/socketManager");

dotenv.config();
connectDB();

const app=express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/contacts", contactRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/location", locationRoutes);

app.get("/",(req,res)=>{
    res.json({
        success: true,
        message: "Silent SOS Backend Running 🚀"
    });
});

const PORT=process.env.PORT || 5000;

const server = http.createServer(app);
initializeSocket(server);

server.listen(PORT,()=>{
    console.log(`Server running on port ${PORT}`);
})