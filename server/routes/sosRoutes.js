const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
  startSOS,
  resolveSOS,
  getActiveSOS,
  getSOSHistory,
} = require("../controllers/sosController");

const router = express.Router();

router.use(protect);

router.post("/start", startSOS);
router.post("/:id/resolve", resolveSOS);
router.get("/active", getActiveSOS);
router.get("/history", getSOSHistory);

module.exports = router;