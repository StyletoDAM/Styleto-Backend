// server.js – VERSION FINALE QUI MARCHE À 100%
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const app = express();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ON GARDE L'EXTENSION DU FICHIER
const storage = multer.diskStorage({
  destination: 'temp_uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + ext;
    cb(null, name);
  }
});
const upload = multer({ storage });

app.post('/detect', upload.single('photo'), async (req, res) => {
  const tempPath = req.file.path;

  try {
    // 1. Upload sur Cloudinary
    const cloudResult = await cloudinary.uploader.upload(tempPath, {
      folder: 'labasni',
    });

    // 2. Détection Python (maintenant le fichier a une extension)
    exec(`python3 detect.py --image "${tempPath}"`, (error, stdout, stderr) => {
      fs.unlinkSync(tempPath); // Nettoyage

      if (error || stderr) {
        return res.status(500).json({ error: 'Détection échouée', details: stderr || error.message });
      }

      // 3. Résultat final parfait
      res.json({
        success: true,
        image_url: cloudResult.secure_url,
        public_id: cloudResult.public_id,
        detection_result: stdout.trim()
      });
    });

  } catch (err) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    res.status(500).json({ error: "Cloudinary upload failed", details: err.message });
  }
});

app.listen(3000, () => {
  console.log('Backend Labasni FINAL → http://localhost:3000/detect');
});