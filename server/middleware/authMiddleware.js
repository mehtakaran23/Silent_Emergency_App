const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const [scheme, value] = authorization.split(" ");
    const token = scheme === "Bearer" ? value : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access denied. No token provided."
        });
    }

    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.id) {
            throw new Error("Token does not contain a user id");
        }

        req.user = {
            id: decoded.id,
            email: decoded.email
        };

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });
    }

};

module.exports = protect;