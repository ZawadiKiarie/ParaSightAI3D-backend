const redisClient = require("./signin").redisClient;

const deleteToken = async (key) => {
  try {
    await redisClient.del(key);
    return Promise.resolve();
  } catch (err) {
    console.log("Error deleting token in redis:", err);
    return Promise.reject(err);
  }
};

const handleSignout = async (req, res) => {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json("No token found");
  }
  try {
    await deleteToken(authorization);
    return res.json("success");
  } catch (err) {
    return res.status(400).json("failed to delete token");
  }
};

module.exports = {
  handleSignout,
};
