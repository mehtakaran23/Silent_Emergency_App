const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
  getMyNotificationLogs,
  getAlertNotificationLogs,
} = require("../controllers/notificationController");

const router = express.Router();
router.get("/", protect, getMyNotificationLogs);
router.get("/alert/:alertId", protect, getAlertNotificationLogs);

module.exports = router;
