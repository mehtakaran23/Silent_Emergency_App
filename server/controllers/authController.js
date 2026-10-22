const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

const publicUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

const issueToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    return jwt.sign(
        { id: user._id.toString(), email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
};

// ============================
// Register User
// ============================

const registerUser = async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        const email = String(req.body?.email || "").trim().toLowerCase();
        const password = String(req.body?.password || "");
        const phone = String(req.body?.phone || "").trim();

        if (!name || !password || (!email && !phone)) {
            return res.status(400).json({
                success: false,
                message: "Name, password, and an email or phone are required."
            });
        }

        if (name.length < 2 || name.length > 100 || /[\r\n]/.test(name)) {
            return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
        }

        if (email && !EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ success: false, message: "Enter a valid email address." });
        }

        if (password.length < 6 || password.length > 128) {
            return res.status(400).json({ success: false, message: "Password must be between 6 and 128 characters." });
        }

        if (phone && !PHONE_PATTERN.test(phone)) {
            return res.status(400).json({ success: false, message: "Enter a valid phone number." });
        }

        const existingUser = await User.findOne({
            $or: [
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : []),
            ],
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            ...(email ? { email } : {}),
            password: hashedPassword,
            ...(phone ? { phone } : {})
        });

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: publicUser(newUser)
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        res.status(500).json({
            success: false,
            message: "Error registering user",
        });
    }
};


// ============================
// Login User
// ============================

const loginUser = async (req, res) => {
    try {

        const identifier = String(req.body?.email || req.body?.phone || req.body?.identifier || "").trim();
        const normalizedIdentifier = identifier.includes("@") ? identifier.toLowerCase() : identifier;
        const password = String(req.body?.password || "");

        // Check required fields
        if (!normalizedIdentifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter email or phone and password"
            });
        }

        // Find user by email
        const user = await User.findOne({
            $or: [{ email: normalizedIdentifier }, { phone: normalizedIdentifier }],
        });

        // User not found
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // Compare password
        const isPasswordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
        }

        // Login successful with JWT token and user details.

        const token = issueToken(user);

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Login failed:", {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
        });

        res.status(500).json({
            success: false,
            message: "Error logging in user",
        });

    }
};

const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user?.id).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        return res.status(200).json({ success: true, user: publicUser(user) });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Unable to fetch current user." });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getCurrentUser
};