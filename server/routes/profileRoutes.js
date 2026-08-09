const express = require("express");
const protect = require("../middleware/authMiddleware");

const {
    getMyProfile,
    updateMyProfile
} = require("../controllers/profileController");

const router = express.Router();

console.log("✅ profileRoutes.js loaded");

router.get("/me", protect, getMyProfile);

router.put("/me", protect, updateMyProfile);

module.exports = router;