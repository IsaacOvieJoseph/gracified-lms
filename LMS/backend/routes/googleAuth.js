const express = require('express');
const { google } = require('googleapis');
const User = require('../models/User');
const router = express.Router();
// Step 0: Start consent flow (redirect user to Google)
/**
 * @swagger
 * /api/google-auth/start-consent:
 *   get:
 *     summary: Redirect to Google OAuth consent screen
 *     tags: [Google Auth]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: classroomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirect to Google
 */
router.get('/start-consent', async (req, res) => {
  const { userId, classroomId, debug } = req.query;
  if (!userId || !classroomId) return res.status(400).send('Missing userId or classroomId');
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Redirect URI should point to backend callback
  const redirectUri = `https://${req.get('host')}/api/google-auth/oauth-callback`;
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify({ userId, classroomId, frontendBase })
  });
  console.log('[Google OAuth] start-consent:', {
    userId,
    classroomId,
    redirectUri,
    url
  });
  if (debug === '1') {
    return res.json({
      userId,
      classroomId,
      redirectUri,
      url
    });
  }
  res.redirect(url);
});

// Step 1: OAuth callback (Google redirects here with code)
router.get('/oauth-callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');
  let parsedState;
  try {
    parsedState = JSON.parse(state);
  } catch {
    return res.status(400).send('Invalid state');
  }
  const { userId, classroomId, frontendBase } = parsedState;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = `https://${req.get('host')}/api/google-auth/oauth-callback`;
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh token received. Try again with prompt=consent.');
    }
    await User.findByIdAndUpdate(userId, { googleOAuthRefreshToken: tokens.refresh_token });
    // Redirect to classroom page
    return res.redirect(`${frontendBase}/classrooms/${classroomId}`);
  } catch (err) {
    return res.status(500).send('Failed to save Google token: ' + err.message);
  }
});
// Duplicate removed
// Duplicate removed
// Duplicate removed
// Duplicate removed

// Step 1: Get Google OAuth URL for user to authorize
/**
 * @swagger
 * /api/google-auth/url:
 *   get:
 *     summary: Get Google OAuth authorization URL
 *     tags: [Google Auth]
 *     responses:
 *       200:
 *         description: OAuth URL
 */
router.get('/url', async (req, res) => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });
  res.json({ url });
});

// Step 2: Exchange code for refresh token and save to user
/**
 * @swagger
 * /api/google-auth/save-token:
 *   post:
 *     summary: Exchange auth code for refresh token and save to user
 *     tags: [Google Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - userId
 *     responses:
 *       200:
 *         description: Token saved
 */
router.post('/save-token', async (req, res) => {
  const { code, userId } = req.body;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).json({ message: 'No refresh token received. Try again with prompt=consent.' });
    }
    await User.findByIdAndUpdate(userId, { googleOAuthRefreshToken: tokens.refresh_token });
    res.json({ message: 'Refresh token saved successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
