import React, { useState } from 'react';
import axios from 'axios';

const GoogleMeetAuth = ({ userId }) => {
  const [authUrl, setAuthUrl] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');

  const getAuthUrl = async () => {
    setStatus('');
    try {
      const res = await axios.get('/api/google-auth/url');
      setAuthUrl(res.data.url);
    } catch (err) {
      setStatus('Failed to get auth URL');
    }
  };

  const saveToken = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      await axios.post('/api/google-auth/save-token', { code, userId });
      setStatus('Refresh token saved!');
    } catch (err) {
      setStatus('Failed to save token: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div>
      <h3>Google Meet Authorization</h3>
      <button onClick={getAuthUrl}>Get Google Auth Link</button>
      {authUrl && (
        <div>
          <p>1. <a href={authUrl} target="_blank" rel="noopener noreferrer">Authorize with Google</a></p>
          <p>2. Paste the code you receive below:</p>
          <form onSubmit={saveToken}>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Paste Google code here"
              required
            />
            <button type="submit">Save Token</button>
          </form>
        </div>
      )}
      {status && <p>{status}</p>}
    </div>
  );
};

export default GoogleMeetAuth;
