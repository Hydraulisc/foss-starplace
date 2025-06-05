const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const globals = JSON.parse(fs.readFileSync('global-variables.json', 'utf8'));

const db = new sqlite3.Database('./database.db');

const router = express.Router();

router.get('/login', (req, res) => {
    res.redirect(`${globals.hydrauliscAuthUrl}/authorize?client_id=${globals.hydrauliscAuthClient}&redirect_uri=${globals.hydrauliscCallback}&response_type=code`)
})

router.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
    const tokenRes = await axios.post(`${globals.hydrauliscAuthUrl}/token`, qs.stringify({
      code,
      client_id: globals.hydrauliscAuthClient,
      client_secret: globals.hydrauliscAuthToken,
      redirect_uri: globals.hydrauliscCallback
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenRes.data.access_token;
    

    // Store the token in session or cookie
    req.session.accessToken = accessToken;

    // Redirect to profile or homepage
    res.redirect('/oauth/me');
  } catch (err) {
    console.error('Token exchange failed:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange code for token.');
  }
});

/*
    At this point, I forgot what the fuck I was doing with this endpoint
    @SleepingAmi#0001
    30/5/25
*/
router.get('/me', async (req, res) => {
    const accessToken = req.session.accessToken;
if (!accessToken) return res.redirect('/?utm=oautherror');

try {
  const userRes = await axios.get(`${globals.hydrauliscAuthUrl}/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const user = userRes.data;

  // Check if user already exists
  db.get(
    'SELECT id, username, isAdmin, language FROM users WHERE hydraulisc_id = ?',
    [user.id],
    (err, existingUser) => {
      if (err) return res.status(500).send(`Database error: ${err}`);

      if (existingUser) {
        // User already exists, just log them in
        req.session.user = {
          id: existingUser.id,
          username: existingUser.username,
          isAdmin: existingUser.isAdmin,
          language: existingUser.language,
        };
        return req.session.save((err) => {
          if (err) {
            console.error('Session error:', err);
            return res.redirect('/login');
          }
          return res.redirect('/?utm_src=oauth'); // Already exists
        });
      }

      // User does not exist, create them
      db.run(
        'INSERT INTO users (hydraulisc_id, username, password, pfp, theme, biography, isAdmin, indexable, language, discriminator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          user.id,
          `${user.username}#${user.discriminator}`, // Added full username as displayed, including discriminator, to prevent UNIQUE constraint issues
          "OAuth2",
          `https://hydraulisc.net${user.pfp}`,
          'default',
          user.biography,
          0,
          1,
          'english',
          user.discriminator
        ],
        function (err) {
          if (err) return res.status(500).send(`Registration error, ${err}`);
          db.get(
            'SELECT id, username, isAdmin, language FROM users WHERE id = ?',
            [this.lastID],
            (err, newUser) => {
              if (err) return res.redirect('/login');
              req.session.user = {
                id: newUser.id,
                username: newUser.username,
                isAdmin: newUser.isAdmin,
                language: newUser.language,
              };
              req.session.save((err) => {
                if (err) {
                  console.error('Session error:', err);
                  return res.redirect('/login');
                }
                res.redirect('/?utm_src=oauth'); // New user created
              });
            }
          );
        }
      );
    }
  );
} catch (err) {
  console.error('User info fetch failed:', err.response?.data || err.message);
  res.status(500).send('Failed to fetch user info.');
}

})

module.exports = router;