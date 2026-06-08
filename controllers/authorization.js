/**
 * authorization.js
 *
 * Authentication middleware for protected backend routes.
 * It checks whether an authorization token was sent in the request headers,
 * verifies the token against Redis, and retrieves the logged-in user's ID.
 *
 * If the token is valid, the user ID is attached to req.userId so controllers
 * can access only the data that belongs to that authenticated user.
 */

const redisClient = require("./signin").redisClient;

const requireAuth = async (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization) {
    return res.status(401).json("Unauthorized");
  }

  try {
    const userId = await redisClient.get(authorization);

    if (!userId) {
      return res.status(401).json("Unauthorized");
    }

    req.userId = Number(userId);

    return next();
  } catch (err) {
    return res.status(400).json("Unauthorized");
  }
};

module.exports = {
  requireAuth,
};
