/**
 * reports.js
 *
 * Handles report creation, retrieval, updating, confirmation, and PDF export.
 * It creates a saved report from AI detection results, stores the analyzed
 * microscopy image, maps database rows into frontend-friendly report objects,
 * and fetches only reports belonging to the authenticated user.
 *
 * This controller supports the reports list, recent dashboard activity,
 * report details page, clinical notes editing, result confirmation,
 * and downloadable PDF report generation.
 */

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const REPORT_IMAGE_DIR = path.join(__dirname, "..", "uploads", "reports");

const ensureReportImageDir = () => {
  if (!fs.existsSync(REPORT_IMAGE_DIR)) {
    fs.mkdirSync(REPORT_IMAGE_DIR, { recursive: true });
  }
};

const generateReportId = () => {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `RPT-${stamp}-${random}`;
};

const generateSampleId = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);

  return `SMP-${date}-${random}`;
};

const formatProcessingTime = (ms) => {
  if (!ms && ms !== 0) return "N/A";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} seconds`;
};

const mapReportRow = (row) => ({
  id: row.report_id,
  databaseId: row.id,
  sampleId: row.sample_id,
  date: row.created_at,
  parasiteName: row.parasite_name,
  parasiteId: row.parasite_id,
  stage: row.stage,
  stageSource: row.stage_source,
  confidence: Number(row.confidence || 0),
  status: row.status,
  imageUrl: row.image_url,
  imageResolution: row.image_resolution,
  processingTime: row.processing_time,
  processingTimeMs: row.processing_time_ms,
  userId: row.user_id,
  user: row.user_name || "Unknown user",
  bbox: row.bbox,
  allDetections: row.all_detections || [],
  notes: row.notes,
});

const createReportFromDetection = async ({
  db,
  uploadedFile,
  detectionResponse,
  userId,
  processingTimeMs,
}) => {
  ensureReportImageDir();

  const topDetection = detectionResponse?.results?.topDetection;

  if (!topDetection) {
    return null;
  }

  const reportId = generateReportId();
  const sampleId = generateSampleId();

  const originalExtension =
    path.extname(uploadedFile.originalname || "") || ".png";

  const imageFilename = `${reportId}${originalExtension}`;
  const savedImagePath = path.join(REPORT_IMAGE_DIR, imageFilename);

  fs.copyFileSync(uploadedFile.path, savedImagePath);

  const imageUrl = `/report-images/${imageFilename}`;

  const imageWidth = detectionResponse?.results?.image?.width;
  const imageHeight = detectionResponse?.results?.image?.height;

  const imageResolution =
    imageWidth && imageHeight ? `${imageWidth} x ${imageHeight}` : "Unknown";

  const inserted = await db("reports")
    .insert({
      report_id: reportId,
      sample_id: sampleId,
      user_id: userId || null,

      parasite_name: topDetection.name,
      parasite_id: topDetection.parasiteId,
      stage: topDetection.stage,
      stage_source: topDetection.stageSource || "default_mapping",

      confidence: topDetection.confidence,
      status: "Pending Review",

      image_url: imageUrl,
      image_filename: imageFilename,
      image_resolution: imageResolution,

      processing_time_ms: processingTimeMs,
      processing_time: formatProcessingTime(processingTimeMs),

      bbox: topDetection.bbox
        ? db.raw("?::jsonb", [JSON.stringify(topDetection.bbox)])
        : null,

      all_detections: db.raw("?::jsonb", [
        JSON.stringify(detectionResponse?.results?.detections || []),
      ]),
    })
    .returning("*");

  return mapReportRow(inserted[0]);
};

const getReports = async (req, res, db) => {
  try {
    const rows = await db("reports")
      .leftJoin("users", "reports.user_id", "users.id")
      .select("reports.*", "users.name as user_name")
      .where("reports.user_id", req.userId)
      .orderBy("reports.created_at", "desc");

    res.json(rows.map(mapReportRow));
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

const getRecentReports = async (req, res, db) => {
  try {
    const limit = Number(req.query.limit || 4);

    const rows = await db("reports")
      .leftJoin("users", "reports.user_id", "users.id")
      .select("reports.*", "users.name as user_name")
      .where("reports.user_id", req.userId)
      .orderBy("reports.created_at", "desc")
      .limit(limit);

    res.json(rows.map(mapReportRow));
  } catch (error) {
    console.error("Error fetching recent reports:", error);
    res.status(500).json({ error: "Failed to fetch recent reports" });
  }
};

const getReportById = async (req, res, db) => {
  try {
    const { id } = req.params;

    const row = await db("reports")
      .leftJoin("users", "reports.user_id", "users.id")
      .select("reports.*", "users.name as user_name")
      .where("reports.report_id", id)
      .andWhere("reports.user_id", req.userId)
      .first();

    if (!row) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(mapReportRow(row));
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
};

const updateReportNotes = async (req, res, db) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const updated = await db("reports")
      .where({ report_id: id })
      .andWhere({ user_id: req.userId })
      .update({ notes })
      .returning("*");

    if (!updated.length) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(mapReportRow(updated[0]));
  } catch (error) {
    console.error("Error updating report notes:", error);
    res.status(500).json({ error: "Failed to update report notes" });
  }
};

const confirmReport = async (req, res, db) => {
  try {
    const { id } = req.params;

    const updated = await db("reports")
      .where({ report_id: id })
      .andWhere({ user_id: req.userId })
      .update({ status: "Confirmed" })
      .returning("*");

    if (!updated.length) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(mapReportRow(updated[0]));
  } catch (error) {
    console.error("Error confirming report:", error);
    res.status(500).json({ error: "Failed to confirm report" });
  }
};

const exportReportPdf = async (req, res, db) => {
  try {
    const { id } = req.params;

    const row = await db("reports")
      .leftJoin("users", "reports.user_id", "users.id")
      .select("reports.*", "users.name as user_name")
      .where("reports.report_id", id)
      .andWhere("reports.user_id", req.userId)
      .first();

    if (!row) {
      return res.status(404).json({ error: "Report not found" });
    }

    const report = mapReportRow(row);

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.id}.pdf"`,
    );

    doc.pipe(res);

    doc.fontSize(22).text("ParaSightAI Detection Report", { align: "center" });

    doc.moveDown();
    doc.fontSize(11).fillColor("#555").text(`Report ID: ${report.id}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    doc.moveDown();
    doc.fillColor("#000").fontSize(16).text("Detection Summary");

    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`Parasite Detected: ${report.parasiteName}`);
    doc.text(`Life Stage: ${report.stage || "N/A"}`);
    doc.text(`Confidence Score: ${report.confidence}%`);
    doc.text(`Status: ${report.status}`);
    doc.text(`Sample ID: ${report.sampleId}`);
    doc.text(`Image Resolution: ${report.imageResolution}`);
    doc.text(`Processing Time: ${report.processingTime}`);
    doc.text(`User: ${report.user}`);
    doc.text(`Detection Date: ${new Date(report.date).toLocaleString()}`);

    doc.moveDown();
    doc.fontSize(16).text("Clinical Notes");
    doc.moveDown(0.5);
    doc.fontSize(11).text(report.notes || "No notes recorded.");

    const imagePath = row.image_filename
      ? path.join(REPORT_IMAGE_DIR, row.image_filename)
      : null;

    if (imagePath && fs.existsSync(imagePath)) {
      doc.addPage();
      doc.fontSize(16).text("Microscopy Image");
      doc.moveDown();

      doc.image(imagePath, {
        fit: [480, 360],
        align: "center",
        valign: "center",
      });
    }

    doc.moveDown();
    doc
      .fontSize(9)
      .fillColor("#777")
      .text(
        "Note: AI-assisted detection results should be reviewed by qualified laboratory personnel before clinical interpretation.",
        { align: "center" },
      );

    doc.end();
  } catch (error) {
    console.error("Error exporting PDF:", error);
    res.status(500).json({ error: "Failed to export report PDF" });
  }
};

module.exports = {
  createReportFromDetection,
  getReports,
  getRecentReports,
  getReportById,
  updateReportNotes,
  confirmReport,
  exportReportPdf,
};
