const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const Contact = require("../models/Contact");
const NotificationLog = require("../models/NotificationLog");
const User = require("../models/User");
const { emitToAlertRoom } = require("../sockets/socketManager");
const { sendSOSNotificationEmails } = require("../services/emailService");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACTIVE_STATUSES = ["TRIGGERED", "ACTIVE", "ACKNOWLEDGED"];
const RESOLVABLE_STATUSES = ["TRIGGERED", "ACTIVE", "ACKNOWLEDGED"];

const buildAlertResponse = (alert) => alert;

const getUserId = (req) => req.user?.id;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parseInitialLocation = (body = {}) => {
  const hasCoordinates = body.latitude !== undefined || body.longitude !== undefined;
  if (!hasCoordinates) return { value: null };
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy =
    body.accuracy === undefined || body.accuracy === null || body.accuracy === ""
      ? null
      : Number(body.accuracy);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0))
  ) {
    return { error: "A valid latitude, longitude, and accuracy are required." };
  }
  return {
    value: {
      latitude,
      longitude,
      accuracy,
      timestamp: reqTimestamp(body.timestamp),
    },
  };
};

const reqTimestamp = (value) => {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now() + 5 * 60 * 1000
    ? null
    : parsed;
};

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

    const initialLocation = parseInitialLocation(req.body);
    if (initialLocation.error || (initialLocation.value && !initialLocation.value.timestamp)) {
      return res.status(400).json({
        success: false,
        message: initialLocation.error || "Invalid location timestamp.",
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
      currentLocation: initialLocation.value || {
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
        message: "Only a triggered, active, or acknowledged alert can be resolved.",
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

const verifyContactResponseToken = (token) => {
  if (!process.env.JWT_SECRET && !process.env.CONTACT_RESPONSE_SECRET) {
    throw new Error("Response token secret is not configured");
  }

  return jwt.verify(
    token,
    process.env.CONTACT_RESPONSE_SECRET || process.env.JWT_SECRET
  );
};

const findResponseContext = async (token) => {
  let decoded;
  try {
    decoded = verifyContactResponseToken(token);
  } catch (error) {
    const tokenError = new Error("This response link is invalid or expired.");
    tokenError.statusCode = error.name === "TokenExpiredError" ? 410 : 401;
    throw tokenError;
  }

  if (!decoded.jti || !isValidObjectId(decoded.alertId) || !isValidObjectId(decoded.contactId)) {
    const tokenError = new Error("This response link is invalid.");
    tokenError.statusCode = 401;
    throw tokenError;
  }

  const tokenHash = crypto.createHash("sha256").update(decoded.jti).digest("hex");
  const log = await NotificationLog.findOne({
    alertId: decoded.alertId,
    contactId: decoded.contactId,
    responseTokenHash: tokenHash,
    status: "SUCCESS",
  }).select("+responseTokenHash");

  if (!log || (log.responseTokenExpiresAt && log.responseTokenExpiresAt < new Date())) {
    const tokenError = new Error("This response link is invalid or expired.");
    tokenError.statusCode = 410;
    throw tokenError;
  }

  const [alert, contact, user] = await Promise.all([
    Alert.findById(decoded.alertId),
    Contact.findById(decoded.contactId).select("name relation"),
    User.findById(decoded.userId).select("name"),
  ]);

  if (!alert || !contact) {
    const tokenError = new Error("The alert or contact no longer exists.");
    tokenError.statusCode = 404;
    throw tokenError;
  }

  return { alert, contact, log };
};

const getContactResponse = async (req, res) => {
  try {
    const { alert, contact, log } = await findResponseContext(req.params.token);
    const acknowledgement = (alert.contactAcknowledgements || []).find(
      (item) => String(item.contactId) === String(contact._id)
    );

    return res.status(200).json({
      success: true,
      alert: {
        _id: alert._id,
        status: alert.status,
        triggeredAt: alert.triggeredAt,
        acknowledgedAt: alert.acknowledgedAt,
        acknowledgedBy: alert.acknowledgedBy,
        currentLocation: alert.currentLocation,
      },
      contact: { _id: contact._id, name: contact.name, relation: contact.relation },
      user: { name: user?.name || "Silent SOS user" },
      acknowledged: Boolean(acknowledgement),
      acknowledgedAt: acknowledgement?.acknowledgedAt || log.acknowledgedAt || null,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to load alert response.",
    });
  }
};

const acknowledgeSOS = async (req, res) => {
  try {
    const { alert, contact, log } = await findResponseContext(req.params.token);
    const existingAcknowledgement = (alert.contactAcknowledgements || []).find(
      (item) => String(item.contactId) === String(contact._id)
    );

    if (["RESOLVED", "CANCELLED"].includes(alert.status)) {
      return res.status(409).json({
        success: false,
        message: "This alert is no longer accepting acknowledgements.",
        alert,
      });
    }

    if (!existingAcknowledgement) {
      const acknowledgedAt = new Date();
      if (!alert.contactAcknowledgements) alert.contactAcknowledgements = [];
      alert.contactAcknowledgements.push({
        contactId: contact._id,
        contactName: contact.name,
        acknowledgedAt,
      });
      if (!alert.acknowledgedAt) {
        alert.acknowledgedAt = acknowledgedAt;
        alert.acknowledgedBy = contact._id;
      }
      if (["TRIGGERED", "ACTIVE"].includes(alert.status)) {
        alert.status = "ACKNOWLEDGED";
      }
      await alert.save();
      log.acknowledgedAt = acknowledgedAt;
      await log.save();

      const payload = {
        alertId: alert._id,
        contactId: contact._id,
        contactName: contact.name,
        acknowledgedAt,
        status: alert.status,
      };
      emitToAlertRoom(alert._id, "contact:acknowledged", payload);
      emitToAlertRoom(alert._id, "sos:acknowledged", {
        alertId: alert._id,
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt,
        acknowledgedBy: alert.acknowledgedBy,
      });
    }

    const acknowledgement = (alert.contactAcknowledgements || []).find(
      (item) => String(item.contactId) === String(contact._id)
    );
    return res.status(200).json({
      success: true,
      message: existingAcknowledgement ? "Alert was already acknowledged." : "Alert acknowledged successfully.",
      acknowledged: true,
      acknowledgedAt: acknowledgement.acknowledgedAt,
      alert: {
        _id: alert._id,
        status: alert.status,
        acknowledgedAt: alert.acknowledgedAt,
        currentLocation: alert.currentLocation,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to acknowledge alert.",
    });
  }
};

const cancelSOS = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized access." });
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid alert id." });
    const alert = await Alert.findOne({ _id: id, userId });
    if (!alert) return res.status(404).json({ success: false, message: "Alert not found." });
    if (!RESOLVABLE_STATUSES.includes(alert.status) && alert.status !== "TRIGGERED") {
      return res.status(400).json({ success: false, message: "Only an active alert can be cancelled." });
    }
    alert.status = "CANCELLED";
    alert.resolvedAt = new Date();
    await alert.save();
    emitToAlertRoom(alert._id, "sos:cancelled", { alertId: alert._id, status: alert.status });
    return res.status(200).json({ success: true, message: "SOS cancelled successfully.", alert });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to cancel SOS." });
  }
};

module.exports = {
  startSOS,
  resolveSOS,
  getActiveSOS,
  getSOSHistory,
  getContactResponse,
  acknowledgeSOS,
  cancelSOS,
};