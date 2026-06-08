/**
 * signin.js
 *
 * Handles user sign-in and session creation for the backend.
 * It verifies the submitted email and password against the login table,
 * creates a JWT token for valid users, and stores the token with the user ID
 * in Redis.
 *
 * The stored Redis token is later used by protected routes to identify the
 * authenticated user and allow access to their profile, uploads, and reports.
 */

const jwt = require("jsonwebtoken");
const redis = require("redis");

//setup redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URI,
});
redisClient.on("error", (err) => console.log("Redis Client Error", err));

(async () => {
  await redisClient.connect();
})();

const handleSignIn = (db, bcrypt, req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return Promise.reject("incorrect form submission");
  }
  return db
    .select("email", "hash")
    .from("login")
    .where("email", "=", email)
    .then((data) => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db
          .select("*")
          .from("users")
          .where("email", "=", email)
          .then((user) => user[0])
          .catch(() => Promise.reject("unable to get user"));
      } else {
        return Promise.reject("Wrong credentials");
      }
    });
};

const getAuthTokenId = async (req, res) => {
  try {
    const { authorization } = req.headers;
    const reply = await redisClient.get(authorization);
    return res.json({ id: reply });
  } catch (err) {
    return res.status(400).json("Unauthorized");
  }
};

const signToken = (email) => {
  const jwtPayload = { email };
  return jwt.sign(jwtPayload, "JWT_SECRET", { expiresIn: "2 days" });
};

const setToken = async (key, value) => {
  try {
    await redisClient.set(key, value);
    return Promise.resolve();
  } catch (err) {
    console.log("Error setting token in redis", err);
    return Promise.reject(err);
  }
};

const createSessions = async (user) => {
  try {
    const { email, id } = user;
    const token = signToken(email);
    await setToken(token, id);
    return { success: "true", userId: id, token };
  } catch (err) {
    console.log("error creating session", err);
  }
};

const signInAuthentication = (db, bcrypt) => (req, res) => {
  const { authorization } = req.headers;

  return authorization
    ? getAuthTokenId(req, res)
    : handleSignIn(db, bcrypt, req, res)
        .then((data) => {
          if (data.id && data.email) {
            return createSessions(data);
          }
          throw new Error("Invalid credentials");
        })
        .then((session) => {
          console.log("session created:", session);
          res.json(session);
        })
        .catch((err) => res.status(400).json(err));
};

module.exports = {
  signInAuthentication,
  redisClient,
  createSessions,
};
