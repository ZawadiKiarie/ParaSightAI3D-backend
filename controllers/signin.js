const jwt = require("jsonwebtoken");
const redis = require("redis");

const JWT_SECRET = process.env.JWT_SECRET || "JWT_SECRET";

// setup redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URI,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

(async () => {
  try {
    await redisClient.connect();
    console.log("Redis connected successfully");
  } catch (err) {
    console.log("Redis connection failed:", err);
  }
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
      if (!data.length) {
        return Promise.reject("Wrong credentials");
      }

      const isValid = bcrypt.compareSync(password, data[0].hash);

      if (!isValid) {
        return Promise.reject("Wrong credentials");
      }

      return db
        .select("*")
        .from("users")
        .where("email", "=", email)
        .then((user) => user[0])
        .catch(() => Promise.reject("unable to get user"));
    });
};

const extractToken = (authorization = "") => {
  return authorization.replace(/^Bearer\s+/i, "").trim();
};

const getAuthTokenId = async (req, res) => {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json("Unauthorized: no token provided");
    }

    const token = extractToken(authorization);

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).json("Unauthorized: invalid token payload");
    }

    return res.json({ id: decoded.id });
  } catch (err) {
    console.error("getAuthTokenId error:", err.message);
    return res.status(401).json("Unauthorized: invalid token");
  }
};

const signToken = (user) => {
  const jwtPayload = {
    id: user.id,
    email: user.email,
  };

  return jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "2 days" });
};

const setToken = async (key, value) => {
  try {
    // Redis becomes optional session storage, but JWT is now the main auth method.
    if (redisClient.isOpen) {
      await redisClient.set(key, String(value), {
        EX: 60 * 60 * 24 * 2,
      });
    }

    return Promise.resolve();
  } catch (err) {
    console.log("Error setting token in redis", err);
    return Promise.resolve();
  }
};

const createSessions = async (user) => {
  try {
    const token = signToken(user);

    await setToken(token, user.id);

    return {
      success: "true",
      userId: user.id,
      token,
    };
  } catch (err) {
    console.log("error creating session", err);
    throw err;
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
        .catch((err) => {
          console.error("Signin error:", err);
          res.status(400).json(err.message || err);
        });
};

module.exports = {
  signInAuthentication,
  redisClient,
  createSessions,
};
