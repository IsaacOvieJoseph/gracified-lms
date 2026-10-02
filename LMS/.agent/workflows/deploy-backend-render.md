---
description: How to deploy the backend to Render with an active cron job
---

### 1. Create a Web Service on Render
1. Log in to [Render](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Set the **Root Directory** to `backend`.

### 2. Configure Environment Variables
In the **Environment** tab of your Render service, add the following variables:
- `MONGODB_URI`: Your MongoDB Atlas connection string.
- `JWT_SECRET`: A long random string for authentication.
- `BREVO_API_KEY`: Your Brevo API key for emails.
- `BREVO_SENDER_EMAIL`: The email address verified in Brevo.
- `FRONTEND_URL`: The URL of your deployed frontend (e.g., `https://your-app.onrender.com`).
- `NODE_ENV`: `production`

### 3. Build & Start Commands
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### 4. Critical: Keeping the Cron Job Alive
Render's **Free Tier** spins down services after 15 minutes of inactivity. When the server sleeps, the internal cron job (15-min reminders) **will not run**.

**Option A (Recommended): Paid Tier**
- Upgrade to the **Starter** instance class. This ensures the server never sleeps and the cron job runs reliably 24/7.

**Option B (Workaround for Free Tier): Stay Awake Service**
1. Copy your Render service URL (e.g., `https://lms-backend.onrender.com/api/health`).
2. Go to [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).
3. Create a "job" that pings your health check URL every **10 minutes**.
4. This prevent's Render's 15-minute inactivity timer from firing, keeping the server (and your reminders) active.
