const handleProfileGet = (req, res, db) => {
  const { id } = req.params;

  db.select("id", "name", "email", "joined")
    .from("users")
    .where({ id })
    .then((users) => {
      if (users.length) {
        res.json(users[0]);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    })
    .catch(() => {
      res.status(400).json({ message: "Error getting user" });
    });
};

const handleProfileUpdate = async (req, res, db, bcrypt) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  try {
    const existingUser = await db("users").where({ id }).first();

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    await db.transaction(async (trx) => {
      await trx("users").where({ id }).update({
        name,
        email,
      });

      await trx("login").where({ email: existingUser.email }).update({
        email,
      });

      if (password && password.trim() !== "") {
        const hash = await bcrypt.hash(password, 10);

        await trx("login").where({ email }).update({
          hash,
        });
      }
    });

    const updatedUser = await db("users")
      .select("id", "name", "email", "joined")
      .where({ id })
      .first();

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error updating profile" });
  }
};

module.exports = {
  handleProfileGet,
  handleProfileUpdate,
};
