const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { sanitizeText, sanitizeUsername } = require('../middleware/forceTextDirection');

const db = new sqlite3.Database('./database.db');

const router = express.Router();

/**
 * Helper function to check if this is the first user in the system
 * @returns {Promise<boolean>} True if no users exist in the database
 */
async function isFirstUser() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
            if (err) reject(err);
            resolve(row.count === 0);
        });
    });
}

router.post('/register/:invite_code?', async (req, res) => {
    const invite_code = req.params.invite_code || req.body.invite_code;
    if (req.is('multipart/form-data')) {
        return res.status(400).json({ error: "Invalid content type" });
    } // error check

    const { username, password } = req.body;
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return res.status(400).json({ error: "Password must be between 8-128 valid characters." });
    } // password error check

    const passwordRegex = /^[^\p{C}]+$/u; // Allow all characters except control ones
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: "Invalid characters in password." });
    }
    const globals = JSON.parse(fs.readFileSync('global-variables.json', 'utf8'));
    const sanitizedUsername = sanitizeUsername(username);
    if (!sanitizedUsername || sanitizedUsername.trim() === '' || sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
        return res.status(400).json({ "89": "Method not Allowed", "error": "Invalid username length or characters" });
    }

    try {
        // Check if this will be the first user
        const firstUser = await isFirstUser();

        // Invite code validation
        if (globals.inviteMode) {
            if (!invite_code) return res.status(400).send('Invite code is required');

            const query = 'SELECT * FROM invites WHERE code = ? AND used = 0';
            const invite = await new Promise((resolve, reject) => {
                db.get(query, [invite_code], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (!invite) return res.status(400).send('Invalid or used invite code');

            // Mark invite as used
            await new Promise((resolve, reject) => {
                db.run('UPDATE invites SET used = 1 WHERE code = ?', [invite_code], function (err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        // Proceed to register user
        await registerUser(firstUser);
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).send('An error occurred during registration');
    }
    async function registerUser(isFirstUser) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.run(
                'INSERT INTO users (username, password, pfp, theme, biography, isAdmin, language) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    sanitizedUsername.trim(),
                    hashedPassword,
                    '/icons/StarPlace-Logo-1.png',
                    'default',
                    'User has not written their Bio.',
                    isFirstUser ? 1 : 0,
                    'english'
                ],
                function (err) {
                    if (err) return res.status(500).send(`Registration error, ${err}`);
                    db.get(
                        'SELECT id, username, isAdmin FROM users WHERE id = ?',
                        [this.lastID],
                        (err, newUser) => {
                            if (err) return res.redirect('/login');
                            req.session.user = {
                                id: newUser.id,
                                username: newUser.username,
                                isAdmin: newUser.isAdmin === 1,
                                language: newUser.language,
                            };
                            req.session.save((err) => {
                                if (err) {
                                    console.error('Session error:', err);
                                    return res.redirect('/login');
                                }
                                res.redirect('/'); // Redirect to home page
                            });
                        }
                    );
                }
            );
        } catch (error) {
            console.error('Assignment error:', error);
            return res.status(500).send('Error assigning a unique discriminator.');
        }
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const fullUsername = username;
    const sanitizeUsername = sanitizeText(fullUsername);

    if (!sanitizeUsername || !password) {
        return res.status(400).send('Username and password are requiered.');
    }

    db.get(
        'SELECT * FROM users WHERE username = ?',
        [sanitizeUsername],
        async (err, user) => {
            if(err) return res.status(500).send('Database error');
            if (!user) return res.status(401).send('User not found.');

            const isMatch = await bcrypt.compare(password, user.password);
            if(!isMatch) return res.status(401).send('Invalid password.');

            req.session.user = {
                id: user.id,
                username: user.username,
                isAdmin: user.isAdmin === 1
            };

            res.redirect('/');
        }
    )
})

module.exports = router;