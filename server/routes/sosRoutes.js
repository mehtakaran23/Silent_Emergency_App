const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
  startSOS,
  resolveSOS,
  getActiveSOS,
  getSOSHistory,
  getContactResponse,
  acknowledgeSOS,
  cancelSOS,
} = require("../controllers/sosController");

const router = express.Router();

// Contact response links are signed and single-purpose; they intentionally do
// not require the sender's account token.
router.get("/respond/:token", getContactResponse);
router.post("/respond/:token", acknowledgeSOS);
router.post("/respond/:token/acknowledge", acknowledgeSOS);
router.post("/respond/:token/ack", acknowledgeSOS);

router.use(protect);

router.post("/start", startSOS);
router.post("/:id/resolve", resolveSOS);
router.post("/:id/cancel", cancelSOS);
router.get("/active", getActiveSOS);
router.get("/history", getSOSHistory);

module.exports = router;