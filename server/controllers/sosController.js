const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const { emitToAlertRoom } = require("../sockets/socketManager");
const { sendSOSNotificationEmails } = require("../services/emailService");

const ACTIVE_STATUSES = ["TRIGGERED", "ACTIVE", "ACKNOWLEDGED"];
const RESOLVABLE_STATUSES = ["ACTIVE", "ACKNOWLEDGED"];

const buildAlertResponse = (alert) => alert;

const getUserId = (req) => req.user?.id;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findActiveAlertForUser = (userId) =>
  Alert.findOne({ userId, status: { $in: ACTIVE_STATUSES } }).sort({
    createdAt: -1,
  });

const startSOS = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    const existingActiveAlert = await findActiveAlertForUser(userId);

    if (existingActiveAlert) {
      return res.status(409).json({
        success: false,
        message: "An active SOS already exists.",
        alert: existingActiveAlert,
      });
    }

    const alert = await Alert.create({
      userId,
      status: "ACTIVE",
      triggeredAt: new Date(),
      currentLocation: {
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: null,
      },
    });

    emitToAlertRoom(alert._id, "sos:started", {
      alertId: alert._id,
      userId: alert.userId,
      status: alert.status,
      triggeredAt: alert.triggeredAt,
      currentLocation: alert.currentLocation,
    });

    // Trigger emergency email notifications in the background asynchronously
    sendSOSNotificationEmails(alert).catch((err) => {
      console.error("Failed to run email notification background process:", err);
    });

    return res.status(201).json({
      success: true,
      message: "SOS activated successfully",
      alert: buildAlertResponse(alert),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to start SOS.",
    });
  }
};

const resolveSOS = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert id.",
      });
    }

    const alert = await Alert.findOne({ _id: id, userId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found.",
      });
    }

    if (!RESOLVABLE_STATUSES.includes(alert.status)) {
      return res.status(400).json({
        success: false,
        message: "Only an active or acknowledged alert can be resolved.",
      });
    }

    const resolvedAt = new Date();
    const triggeredAt = alert.triggeredAt || alert.createdAt || resolvedAt;
    const responseTime = Math.max(
      0,
      Math.round((resolvedAt.getTime() - new Date(triggeredAt).getTime()) / 1000)
    );

    alert.status = "RESOLVED";
    alert.resolvedAt = resolvedAt;
    alert.responseTime = responseTime;

    await alert.save();

    emitToAlertRoom(alert._id, "sos:resolved", {
      alertId: alert._id,
      userId: alert.userId,
      status: alert.status,
      resolvedAt: alert.resolvedAt,
      responseTime: alert.responseTime,
    });

    return res.status(200).json({
      success: true,
      message: "SOS resolved successfully",
      alert,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to resolve SOS.",
    });
  }
};

const getActiveSOS = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    const alert = await findActiveAlertForUser(userId);

    return res.status(200).json({
      success: true,
      alert: alert || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch active SOS.",
    });
  }
};

const getSOSHistory = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    const alerts = await Alert.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch SOS history.",
    });
  }
};

module.exports = {
  startSOS,
  resolveSOS,
  getActiveSOS,
  getSOSHistory,
};