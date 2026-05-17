const jwt = require("jsonwebtoken");
const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URI,
});

redisClient.on("error", (err) => {
  console.log("Redis Client Error:", err);
});

(async () => {
  try {
    await redisClient.connect();
    console.log("Redis connected successfully");
  } catch (err) {
    console.log("Redis connection failed:", err);
  }
})();

const extractToken = (authorization = "") => {
  return authorization.replace(/^Bearer\s+/i, "").trim();
};

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
        .then((user) => user[0]);
    });
};

const getAuthTokenId = async (req, res) => {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(401).json("Unauthorized: no token provided");
    }

    const token = extractToken(authorization);

    let reply = await redisClient.get(token);

    if (!reply) {
      reply = await redisClient.get(authorization);
    }

    if (!reply) {
      return res.status(401).json("Unauthorized: token not found in Redis");
    }

    return res.json({ id: reply });
  } catch (err) {
    console.error("getAuthTokenId error:", err);
    return res.status(400).json("Unauthorized: Redis error");
  }
};

const signToken = (email) => {
  const jwtPayload = { email };

  return jwt.sign(jwtPayload, "JWT_SECRET", { expiresIn: "2 days" });
};

const setToken = async (key, value) => {
  try {
    if (!redisClient.isOpen) {
      throw new Error("Redis client is not open");
    }

    await redisClient.set(key, String(value), {
      EX: 60 * 60 * 24 * 2,
    });

    const savedValue = await redisClient.get(key);

    console.log("Redis token saved:", {
      tokenSaved: Boolean(savedValue),
      userId: savedValue,
    });

    if (!savedValue) {
      throw new Error("Token was not saved in Redis");
    }

    return Promise.resolve(savedValue);
  } catch (err) {
    console.log("Error setting token in redis:", err);
    return Promise.reject(err);
  }
};

const createSessions = async (user) => {
  const { email, id } = user;

  const token = signToken(email);

  await setToken(token, id);

  return {
    success: "true",
    userId: id,
    token,
  };
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
          console.log("session created:", {
            userId: session.userId,
            hasToken: Boolean(session.token),
          });

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
