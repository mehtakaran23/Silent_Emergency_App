const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getMyNotificationLogs } = require("../controllers/notificationController");

const router = express.Router();
router.get("/", protect, getMyNotificationLogs);

module.exports = router;
