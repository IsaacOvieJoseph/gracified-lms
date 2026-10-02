# Quick Setup Guide

## Prerequisites
- Node.js v16+ installed
- MongoDB installed and running (or MongoDB Atlas account)
- Stripe account (for payments - optional for testing)
- Email account (for notifications - optional for testing)

## Step-by-Step Setup

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create .env file
# Option 1: Use the setup script (recommended)
# Windows: run setup-env.bat
# Mac/Linux: run ./setup-env.sh

# Option 2: Copy from env.example
# Windows: copy backend\env.example backend\.env
# Mac/Linux: cp backend/env.example backend/.env

# Option 3: Create manually (see env.example file for template)

# Edit .env file with your configuration
# Minimum required:
# - MONGODB_URI (e.g., mongodb://localhost:27017/lms)
# - JWT_SECRET (any random string)
```

### 2. Seed Database

```bash
# Still in backend directory
node seed.js
```

This creates demo accounts you can use to test the system.

### 3. Start Backend Server

```bash
# Still in backend directory
npm run dev
```

Backend will run on http://localhost:5000

### 4. Frontend Setup

```bash
# Open new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file
# Option 1: Use the setup script
# Windows: run setup-env.bat (from root)
# Mac/Linux: run ./setup-env.sh (from root)

# Option 2: Copy from env.example
# Windows: copy frontend\env.example frontend\.env
# Mac/Linux: cp frontend/env.example frontend/.env

# Option 3: Create manually
# Create frontend/.env with: VITE_API_URL=http://localhost:5000/api
```

### 5. Start Frontend Server

```bash
# Still in frontend directory
npm run dev
```

Frontend will run on http://localhost:3000

### 6. Access the Application

1. Open browser to http://localhost:3000
2. Login with one of the demo accounts:
   - Root Admin: admin@lms.com / admin123
   - School Admin: schooladmin@lms.com / admin123
   - Teacher: teacher@lms.com / teacher123
   - Personal Teacher: personalteacher@lms.com / teacher123
   - Student: student@lms.com / student123

## Optional: Configure Payments (Stripe)

1. Sign up at https://stripe.com
2. Get your test API keys from the dashboard
3. Add to backend/.env:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

## Optional: Configure Email Notifications

1. For Gmail, create an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
2. Add to backend/.env:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

## Optional: Configure WebRTC (Voice/Video)

For production environments where users are on different networks (hotspots, firewalls), you should configure a TURN server to ensure voice and video connection stability.

1. Get TURN server credentials (e.g., from [Twilio](https://www.twilio.com/en-us/stun-turn), [Metered.ca](https://www.metered.ca/stun-turn), or your own [Coturn](https://github.com/coturn/coturn) server).
2. Add to `frontend/.env`:
   ```env
   VITE_TURN_SERVER_URL=turn:your-turn-server.com:3478
   VITE_TURN_SERVER_USERNAME=your-username
   VITE_TURN_SERVER_PASSWORD=your-password
   ```

Note: STUN servers are already hardcoded for basic NAT traversal, but TURN is required for about 20% of network conditions (symmetric NATs).

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running: `mongod` or check MongoDB Atlas connection string
- Verify MONGODB_URI in .env is correct

### Port Already in Use
- Change PORT in backend/.env
- Update VITE_API_URL in frontend/.env accordingly

### CORS Errors
- Make sure backend is running before frontend
- Check that API URL in frontend/.env matches backend URL

## Next Steps

- Create your first classroom
- Add topics and assignments
- Test enrollment and payments
- Explore different user roles

