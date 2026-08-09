const mongoose = require("mongoose");

const locationHistorySchema = new mongoose.Schema(
  {
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

locationHistorySchema.index({ alertId: 1, timestamp: 1 });
locationHistorySchema.index({ userId: 1, timestamp: 1 });

module.exports = mongoose.model("LocationHistory", locationHistorySchema);