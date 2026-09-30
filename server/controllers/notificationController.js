const Alert = require("../models/Alert");
const NotificationLog = require("../models/NotificationLog");

const getMyNotificationLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const alerts = await Alert.find({ userId }).select("_id").lean();
    const alertIds = alerts.map((alert) => alert._id);
    const logs = await NotificationLog.find({ alertId: { $in: alertIds } })
      .sort({ sentAt: -1 })
      .limit(100)
      .populate("contactId", "name relation")
      .select("-responseTokenHash");

    return res.status(200).json({ success: true, count: logs.length, notifications: logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Unable to fetch notification logs." });
  }
};

module.exports = { getMyNotificationLogs };
