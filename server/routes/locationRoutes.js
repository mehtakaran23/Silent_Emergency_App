const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
  updateLocation,
  getAlertLocations,
} = require("../controllers/locationController");

const router = express.Router();

router.use(protect);

router.post("/update", updateLocation);
router.post("/", updateLocation);
router.get("/:alertId", getAlertLocations);

module.exports = router;