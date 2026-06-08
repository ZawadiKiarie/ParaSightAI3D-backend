/**
 * register.js
 *
 * Handles new user registration for the backend.
 * It validates the submitted name, email, and password, hashes the password,
 * then saves the login details and user profile details in the database.
 *
 * The registration process uses a database transaction so the login and users
 * tables are created together, then returns a new authenticated user session.
 */

const signin = require("./signin");

const handleRegister = (req, res, db, bcrypt) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json("incorrect form submission");
  }
  const hash = bcrypt.hashSync(password);
  db.transaction((trx) => {
    trx
      .insert({
        hash: hash,
        email: email,
      })
      .into("login")
      .returning("email")
      .then((loginEmail) => {
        return trx("users")
          .returning("*")
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date(),
          })
          .then(async (user) => {
            res.json(await signin.createSessions(user[0]));
          });
      })
      .then(trx.commit)
      .catch(trx.rollback);
  }).catch((err) => res.status(400).json("unable to register"));
};

module.exports = {
  handleRegister: handleRegister,
};
