const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const knex = require("knex");
const morgan = require("morgan");

const register = require("./controllers/register");
const signin = require("./controllers/signin");
const auth = require("./controllers/authorization");
const signout = require("./controllers/signout");
const profile = require("./controllers/profile");

const app = express();

const db = knex({
  client: "pg",
  connection: process.env.POSTGRES_URI,
});

app.use(morgan("combined"));
app.use(cors());
app.use(express.json());

app.post("/signin", signin.signInAuthentication(db, bcrypt));
app.get("/signout", (req, res) => {
  signout.handleSignout(req, res);
});
app.post("/register", (req, res) => {
  register.handleRegister(req, res, db, bcrypt);
});
app.get("/profile/:id", auth.requireAuth, (req, res) => {
  profile.handleProfileGet(req, res, db);
});
app.post("/profile/:id", auth.requireAuth, (req, res) => {
  profile.handleProfileUpdate(req, res, db, bcrypt);
});

app.get("/", (req, res) => {
  res.send("ITS WORKING!!!");
});
app.listen(3000, () => {
  console.log("app is running on port 3000");
});
