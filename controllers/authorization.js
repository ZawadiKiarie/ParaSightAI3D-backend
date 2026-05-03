const redisClient = require("./signin").redisClient;

const requireAuth = async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json("Unauthorized");
  }
  try {
    await redisClient.get(authorization);
    console.log("you shall pass");
    return next();
  } catch (err) {
    return res.status(400).json("Unauthorized");
  }
};

module.exports = {
  requireAuth,
};
