const mongoose = require("mongoose");

const contactAcknowledgementSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    acknowledgedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const alertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["TRIGGERED", "ACTIVE", "ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
      default: "TRIGGERED",
      required: true,
      index: true,
    },
    triggeredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    responseTime: {
      type: Number,
      default: null,
    },
    contactAcknowledgements: {
      type: [contactAcknowledgementSchema],
      default: [],
    },
    currentLocation: {
      latitude: {
        type: Number,
        default: null,
      },
      longitude: {
        type: Number,
        default: null,
      },
      accuracy: {
        type: Number,
        default: null,
      },
      timestamp: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Alert", alertSchema);