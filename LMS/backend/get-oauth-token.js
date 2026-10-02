require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Error: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set in .env');
  process.exit(1);
}

async function getRefreshToken() {
  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  
  const SCOPES = ['https://www.googleapis.com/auth/calendar'];
  
  // Generate auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('Opening browser to authorize...');
  console.log('\nAuth URL:', authUrl);
  
  // Try to open browser
  try {
    const open = await import('open');
    await open.default(authUrl);
  } catch (err) {
    console.log('\nCould not open browser. Visit this URL manually:');
    console.log(authUrl);
  }

  // Prompt for auth code
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\nPaste the authorization code here: ', async (code) => {
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      console.log('\n✓ Success! Use these environment variables:\n');
      console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\nAdd these to your .env file in the backend folder.');
    } catch (err) {
      console.error('Error getting token:', err.message);
    }
    rl.close();
  });
}

getRefreshToken();
