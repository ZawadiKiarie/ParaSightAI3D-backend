/**
 * signout.js
 *
 * Handles user sign-out for the backend.
 * It reads the authorization token from the request headers and deletes
 * that token from Redis.
 *
 * Once the token is removed, the session becomes invalid and the user can no
 * longer access protected routes using that token.
 */

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
