const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema(
  {
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },
    recipient: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["EMAIL"],
      default: "EMAIL",
    },
    status: {
      type: String,
      required: true,
      enum: ["SUCCESS", "FAILED"],
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    error: {
      type: String,
      default: null,
    },
    responseTokenHash: {
      type: String,
      default: null,
      index: true,
      select: false,
    },
    responseTokenExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationLogSchema.index({ alertId: 1, sentAt: -1 });

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
