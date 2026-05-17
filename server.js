const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const knex = require("knex");
const morgan = require("morgan");
const fs = require("fs");
const multer = require("multer");
const path = require("path");

const reports = require("./controllers/reports");
const image = require("./controllers/image");
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
const allowedOrigins = [
  "http://localhost:5173",
  "https://parasightai3d.onrender.com",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

app.use(
  "/report-images",
  express.static(path.join(__dirname, "uploads", "reports")),
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

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

app.post(
  "/upload",
  auth.requireAuth,
  upload.single("image"),
  async (req, res) => {
    console.time("BACKEND_TOTAL_UPLOAD");

    const startedAt = Date.now();

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      console.log("Backend received file:", {
        path: req.file.path,
        sizeMB: (req.file.size / 1024 / 1024).toFixed(2),
        mimetype: req.file.mimetype,
      });

      console.time("BACKEND_TO_DETECTION_API");

      const detectionResponse = await image.uploadImage(req.file.path);

      console.timeEnd("BACKEND_TO_DETECTION_API");

      const processingTimeMs = Date.now() - startedAt;

      const report = await reports.createReportFromDetection({
        db,
        uploadedFile: req.file,
        detectionResponse,
        userId: req.userId,
        processingTimeMs,
      });

      res.status(200).json({
        message: "Upload, detection, and report creation successful",
        ...detectionResponse,
        report,
      });
    } catch (error) {
      console.error("Upload route error:", error.message);

      res.status(500).json({
        error: "Error processing image",
        details: error.message,
      });
    } finally {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.timeEnd("BACKEND_TOTAL_UPLOAD");
    }
  },
);

app.get("/reports", auth.requireAuth, (req, res) => {
  reports.getReports(req, res, db);
});

app.get("/reports/recent", auth.requireAuth, (req, res) => {
  reports.getRecentReports(req, res, db);
});

app.get("/reports/:id", auth.requireAuth, (req, res) => {
  reports.getReportById(req, res, db);
});

app.patch("/reports/:id/notes", auth.requireAuth, (req, res) => {
  reports.updateReportNotes(req, res, db);
});

app.patch("/reports/:id/confirm", auth.requireAuth, (req, res) => {
  reports.confirmReport(req, res, db);
});

app.get("/reports/:id/export", auth.requireAuth, (req, res) => {
  reports.exportReportPdf(req, res, db);
});

app.get("/redis-test", async (req, res) => {
  try {
    const key = `test:${Date.now()}`;

    await signin.redisClient.set(key, "redis is working", {
      EX: 60,
    });

    const value = await signin.redisClient.get(key);

    res.json({
      success: true,
      value,
      redisUrlExists: Boolean(process.env.REDIS_URI),
    });
  } catch (error) {
    console.error("Redis test failed:", error);

    res.status(500).json({
      success: false,
      message: error.message,
      redisUrlExists: Boolean(process.env.REDIS_URI),
    });
  }
});

app.get("/", (req, res) => {
  res.send("ITS WORKING!!!");
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
});
