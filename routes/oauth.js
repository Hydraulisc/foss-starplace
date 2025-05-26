const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const fs = require('fs');
const globals = JSON.parse(fs.readFileSync('global-variables.json', 'utf8'));

const router = express.Router();

router.get('/login', (req, res) => {
    res.redirect(`https://hydraulisc.net/oauth/authorize?client_id=${globals.hydrauliscAuthClient}&redirect_uri=${globals.hydrauliscCallback}&response_type=code`)
})

router.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
    const tokenRes = await axios.post('https://hydraulisc.net/oauth/token', qs.stringify({
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

router.get('/me', async (req, res) => {
    const accessToken = req.session.accessToken;
    if (!accessToken) return res.redirect('/?utm=oautherror');
    try {
    const userRes = await axios.get('https://hydraulisc.net/oauth/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const user = userRes.data;

    req.session.user = {
      id: user.id,
      username: user.username,
      language: user.language || "english",
      pfp: user.pfp,
      discriminator: user.discriminator
    };

    res.status(200).redirect('/?utm_src=oauth');

  } catch (err) {
    console.error('User info fetch failed:', err.response?.data || err.message);
    res.status(500).send('Failed to fetch user info.');
  }
})

module.exports = router;