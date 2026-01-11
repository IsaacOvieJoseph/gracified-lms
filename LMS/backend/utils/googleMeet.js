const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

// googleMeet util
// Supports two modes (prefer OAuth2 refresh token):
// 1) OAuth2 refresh token flow: set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
// 2) Service account + domain-wide delegation: set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_IMPERSONATED_USER
// OAuth2 refresh token is attempted first; if neither is available the caller should handle the error.

function createOAuth2ClientFromEnv(refreshToken) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  if (!clientId || !clientSecret || !refreshToken) return null;

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
}

function createJwtClientFromEnv() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const subject = process.env.GOOGLE_IMPERSONATED_USER;
  if (!raw) return null;

  let key;
  try {
    key = JSON.parse(raw);
  } catch (err) {
    console.error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
    return null;
  }

  const clientEmail = key.client_email;
  const privateKey = key.private_key;
  if (!clientEmail || !privateKey) return null;

  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const jwtOptions = {
    email: clientEmail,
    key: privateKey,
    scopes,
  };
  if (subject) jwtOptions.subject = subject;

  const jwtClient = new google.auth.JWT(jwtOptions);
  return jwtClient;
}

/**
 * Create a Google Meet (Calendar event with conferenceData) and return metadata.
 * Options:
 *  - summary: event title
 *  - description
 *  - startTime: Date or ISO string
 *  - endTime: Date or ISO string
 *  - attendees: array of email strings
 */
async function createGoogleMeet({ summary = 'Class Lecture', description = '', startTime = new Date(), endTime = null, attendees = [], refreshToken = null } = {}) {
  const oAuth2Client = createOAuth2ClientFromEnv(refreshToken);
  let authClient = null;

  if (oAuth2Client) {
    authClient = oAuth2Client;
  } else {
    const jwtClient = createJwtClientFromEnv();
    if (!jwtClient) {
      throw new Error('No Google credentials configured. Set GOOGLE_OAUTH_* env vars or GOOGLE_SERVICE_ACCOUNT_JSON & GOOGLE_IMPERSONATED_USER.');
    }
    authClient = jwtClient;
  }

  // jwtClient has authorize(); OAuth2 client will refresh token automatically on request
  if (typeof authClient.authorize === 'function') {
    await authClient.authorize();
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const start = (startTime instanceof Date) ? startTime.toISOString() : new Date(startTime).toISOString();
  const end = endTime ? ((endTime instanceof Date) ? endTime.toISOString() : new Date(endTime).toISOString()) : new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();

  const event = {
    summary,
    description,
    start: { dateTime: start },
    end: { dateTime: end },
    attendees: Array.isArray(attendees) ? attendees.map(email => ({ email })) : [],
    conferenceData: {
      createRequest: {
        requestId: uuidv4(),
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    }
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
  });

  const conf = res.data.conferenceData;
  let meetUrl = null;
  if (conf && conf.entryPoints && conf.entryPoints.length > 0) {
    const ep = conf.entryPoints.find(e => e.entryPointType === 'video');
    meetUrl = ep ? ep.uri : conf.entryPoints[0].uri;
  }

  return {
    meetUrl,
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
    start: res.data.start,
    end: res.data.end,
    raw: res.data,
  };
}

module.exports = { createGoogleMeet };
