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
