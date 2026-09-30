const mongoose = require("mongoose");
const User = require("../models/User");

const isValidPhone = (phone) => /^[0-9+()\-\s]{7,20}$/.test(phone);

const sanitizeProfile = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      profile: sanitizeProfile(user),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch profile.",
    });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, email, phone } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const updates = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();

      if (!trimmedName) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      updates.name = trimmedName;
    }

    if (phone !== undefined) {
      const trimmedPhone = String(phone).trim();

      if (!trimmedPhone || !isValidPhone(trimmedPhone)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid phone number.",
        });
      }

      updates.phone = trimmedPhone;
    }

    if (email !== undefined) {
      const trimmedEmail = String(email).trim().toLowerCase();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid email address.",
        });
      }
      updates.email = trimmedEmail || undefined;
    }

    const currentUser = await User.findById(userId).select("email phone");
    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const resultingEmail = email === undefined ? currentUser.email : updates.email;
    const resultingPhone = phone === undefined ? currentUser.phone : updates.phone;
    if (!resultingEmail && !resultingPhone) {
      return res.status(400).json({
        success: false,
        message: "An email address or phone number must be provided.",
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: sanitizeProfile(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate profile data detected.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update profile.",
    });
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
};