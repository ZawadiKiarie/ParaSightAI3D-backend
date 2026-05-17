const redisClient = require("./signin").redisClient;

const extractToken = (authorization = "") => {
  return authorization.replace(/^Bearer\s+/i, "").trim();
};

const requireAuth = async (req, res, next) => {
  const { authorization } = req.headers;

  console.log("Auth header received:", authorization ? "YES" : "NO");

  if (!authorization) {
    return res.status(401).json("Unauthorized: no token provided");
  }

  const token = extractToken(authorization);

  try {
    // Try the normalized token first.
    let userId = await redisClient.get(token);

    // Fallback: try the exact header value in case old sessions used it.
    if (!userId) {
      userId = await redisClient.get(authorization);
    }

    console.log("Redis user id:", userId);

    if (!userId) {
      return res.status(401).json("Unauthorized: token not found in Redis");
    }

    req.userId = Number(userId);

    return next();
  } catch (err) {
    console.error("Auth Redis error:", err);
    return res.status(400).json("Unauthorized: Redis error");
  }
};

module.exports = {
  requireAuth,
};
