const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const { sanitizeText, sanitizeUsername } = require('../middleware/forceTextDirection');

const db = new sqlite3.Database('./database.db');

const router = express.Router();

router.post('/create-place', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    if(!req.body.name) return res.status(401).json({ error: 'No board name' });

    const userId = req.session.user.id;
    const name = req.body.name;
    const description = 'This Place has no description :(';
    if(!req.body.description) {
        db.run(
        `INSERT INTO boards (name, icon, owner, description, indexable, language) VALUES (?, ?, ?, ?, ?, ?)`, [name, '/icons/StarPlace-Logo-1.png', userId, description, 1, 'english'], function (err) {
            if (err) return res.status(500).send("Database error for no description");
            res.redirect(`/star/${name}`);
        });
    } else {
        db.run(
        `INSERT INTO boards (name, icon, owner, description, indexable, language) VALUES (?, ?, ?, ?, ?, ?)`, [name, '/icons/StarPlace-Logo-1.png', userId, req.body.description, 1, 'english'], function (err) {
            if (err) return res.status(500).send("Database error with description");
            res.redirect(`/star/${name}`);
        });
    }
    
})

module.exports = router;