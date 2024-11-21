const multer = require('multer');
const path = require('path');
const express = require('express');
const router = express.Router();
const db = require('../db'); // Ensure this connects to your DB

// Set storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/songs')); // Folder to store songs
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Unique file name
    }
});

// File filter for MP3 only
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.mp3') {
        cb(null, true);
    } else {
        cb(new Error('Only MP3 files are allowed!'));
    }
};

// Multer upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Serve uploaded songs as static files
router.use('/songs', express.static(path.join(__dirname, '../uploads/songs')));

// Upload endpoint
router.post('/upload', upload.single('profile_song'), async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized: Please log in.');
    }

    const userId = req.session.user.user_id;
    const songFile = `/songs/${req.file.filename}`; // Path to serve the song

    try {
        // Update the user's profile in the database
        await db.none(
            `UPDATE buffspace_main.profile
             SET profile_song = $1
             WHERE user_id = $2`,
            [songFile, userId]
        );

        res.redirect('/profile'); // Redirect to the profile page
    } catch (err) {
        console.error('Error updating profile with song:', err);
        res.status(500).send('Error saving your profile song.');
    }
});

module.exports = router;
