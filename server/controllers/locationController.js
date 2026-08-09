const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const LocationHistory = require("../models/LocationHistory");
const { emitToAlertRoom } = require("../sockets/socketManager");

const ACTIVE_STATUSES = ["ACTIVE", "ACKNOWLEDGED"];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isValidLatitude = (value) => typeof value === "number" && value >= -90 && value <= 90;

const isValidLongitude = (value) => typeof value === "number" && value >= -180 && value <= 180;

const isValidAccuracy = (value) =>
  value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);

const parseTimestamp = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const updateLocation = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { alertId, latitude, longitude, accuracy, timestamp } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!alertId) {
      return res.status(400).json({
        success: false,
        message: "alertId is required.",
      });
    }

    if (!isValidObjectId(alertId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alertId.",
      });
    }

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedAccuracy = accuracy === undefined || accuracy === null || accuracy === ""
      ? undefined
      : Number(accuracy);
    const parsedTimestamp = parseTimestamp(timestamp);

    if (!isValidLatitude(parsedLatitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude. It must be between -90 and 90.",
      });
    }

    if (!isValidLongitude(parsedLongitude)) {
      return res.status(400).json({
        success: false,
        message: "Invalid longitude. It must be between -180 and 180.",
      });
    }

    if (!isValidAccuracy(parsedAccuracy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid accuracy value.",
      });
    }

    if (!parsedTimestamp) {
      return res.status(400).json({
        success: false,
        message: "Invalid timestamp.",
      });
    }

    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found.",
      });
    }

    if (String(alert.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this alert.",
      });
    }

    if (!ACTIVE_STATUSES.includes(alert.status)) {
      return res.status(400).json({
        success: false,
        message: "Location updates are only allowed for active alerts.",
      });
    }

    const location = await LocationHistory.create({
      alertId: alert._id,
      userId,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      ...(parsedAccuracy !== undefined ? { accuracy: parsedAccuracy } : {}),
      timestamp: parsedTimestamp,
    });

    alert.currentLocation = {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      accuracy: parsedAccuracy ?? null,
      timestamp: parsedTimestamp,
    };

    await alert.save();

    emitToAlertRoom(alert._id, "location:update", {
      alertId: alert._id,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
      },
      alertLocation: alert.currentLocation,
    });

    return res.status(201).json({
      success: true,
      message: "Location updated successfully.",
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
      },
      alertLocation: alert.currentLocation,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to update location.",
    });
  }
};

const getAlertLocations = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { alertId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!isValidObjectId(alertId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alertId.",
      });
    }

    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found.",
      });
    }

    if (String(alert.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this alert's locations.",
      });
    }

    const locations = await LocationHistory.find({ alertId, userId })
      .sort({ timestamp: 1 })
      .select("latitude longitude accuracy timestamp -_id");

    return res.status(200).json({
      success: true,
      locations,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch alert locations.",
    });
  }
};

module.exports = {
  updateLocation,
  getAlertLocations,
};