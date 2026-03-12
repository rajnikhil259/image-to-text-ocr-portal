const express = require("express");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

/* ------------------ Multer Config ------------------ */
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

/* ------------------ Middleware ------------------ */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ------------------ OCR API ------------------ */
app.post("/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const imagePath = req.file.path;

    const {
      data: { text }
    } = await Tesseract.recognize(
      imagePath,
      "pan", // Punjabi (Gurmukhi)
      {
        logger: m => console.log(m)
      }
    );

    /* Cleanup uploaded file */
    fs.unlink(imagePath, err => {
      if (err) console.error("File cleanup error:", err);
    });

    res.json({ text });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "OCR processing failed" });
  }
});

/* ------------------ Server Start ------------------ */
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
