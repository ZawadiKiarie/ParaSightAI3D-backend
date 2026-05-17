const jwt = require("jsonwebtoken");
const redisClient = require("./signin").redisClient;

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

const extractToken = (authorization = "") => {
  return authorization.replace(/^Bearer\s+/i, "").trim();
};

const requireAuth = async (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json("Unauthorized: no token provided");
  }

  const token = extractToken(authorization);

  try {
    // Main auth method: verify JWT directly.
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).json("Unauthorized: invalid token payload");
    }

    req.userId = Number(decoded.id);
    req.userEmail = decoded.email;

    // Optional Redis check for debugging/session tracking.
    // Do not fail auth if Redis misses the token.
    try {
      if (redisClient.isOpen) {
        const redisUserId = await redisClient.get(token);
        console.log("Redis session user id:", redisUserId);
      }
    } catch (redisError) {
      console.log("Redis lookup skipped/failed:", redisError.message);
    }

    return next();
  } catch (err) {
    console.error("JWT auth error:", err.message);
    return res.status(401).json("Unauthorized: invalid or expired token");
  }
};

module.exports = {
  requireAuth,
};
