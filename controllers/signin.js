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
    return res.status(400).json("Unauthorized");
  }
};

const signToken = (email) => {
  const jwtPayload = { email };
  return jwt.sign(jwtPayload, "JWT_SECRET", { expiresIn: "2 days" });
};

const setToken = async (key, value) => {
  try {
    await redisClient.set(key, value, {
      EX: 60 * 60 * 24 * 2, // 2 days
    });

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
