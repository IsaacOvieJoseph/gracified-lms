# Learning Management System (LMS)

A comprehensive full-stack Learning Management System with authentication, payments, classrooms, assignments, and integrations.

## Features

### 1. Authentication System
- **Role Types:**
  - **Root Admin** - Full system access, user management, payment management
  - **School Admin** - Manage teachers, classes, students, pricing and payments
  - **Teacher (under a school)** - Create classes, add topics, manage content, manage assignments
  - **Personal Teacher** - Create classes, add topics, manage content, manage assignments, manage students, payment and pricing management
  - **Student** - Enroll in classes, access content, submit assignments, receive email notifications, make payments

### 2. Payment Integration
- Pay-per-class / Pay-per-topic / Pay-per-subject enrollment system
- Payment history tracking
- Secure transaction records (Stripe integration)
- Instant enrollment after payment

### 3. Classroom Management
- Create multiple classrooms
- Assign teachers to classes
- Set schedules and pricing
- Track student enrollment
- Student capacity management

### 4. Topics System
- Add topics/lessons to each class
- Organize course content
- Topic descriptions and materials
- Easy content management
- Class work management

### 5. Zoom Integration
- One-click Zoom meeting launch
- Auto-generated meeting IDs
- Password-protected sessions
- Direct access from classroom

### 6. Whiteboard Integration
- Interactive board access
- Real-time collaboration
- Direct launch from classes
- Unique board URLs per class

### 7. Email Notifications
- Class reminders (Teacher and Students)
- Assignment reminders (Teacher and Students)
- Assignment results (Teacher and Students)
- Payment/Subscription notifications (Personal Teacher and School Admin)

## Tech Stack

### Backend
- Node.js & Express
- MongoDB with Mongoose
- JWT Authentication
- Stripe for payments
- Nodemailer for emails
- Zoom API integration

### Frontend
- React 18
- React Router
- Vite
- Tailwind CSS
- Axios for API calls
- Lucide React for icons

## Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- Stripe account (for payments)
- Email account (for notifications)

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/lms
JWT_SECRET=your-super-secret-jwt-key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

5. Seed the database with demo accounts:
```bash
node seed.js
```

6. Start the server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Demo Accounts

After seeding the database, you can use these accounts:

- **Root Admin:** admin@lms.com / admin123
- **School Admin:** schooladmin@lms.com / admin123
- **Teacher:** teacher@lms.com / teacher123
- **Personal Teacher:** personalteacher@lms.com / teacher123
- **Student:** student@lms.com / student123

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users (Admin only)
- `POST /api/users` - Create user (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Root Admin only)

### Classrooms
- `GET /api/classrooms` - Get all classrooms
- `GET /api/classrooms/:id` - Get classroom by ID
- `POST /api/classrooms` - Create classroom
- `PUT /api/classrooms/:id` - Update classroom
- `DELETE /api/classrooms/:id` - Delete classroom
- `POST /api/classrooms/:id/enroll` - Enroll in classroom

### Topics
- `GET /api/topics/classroom/:classroomId` - Get topics for classroom
- `GET /api/topics/:id` - Get topic by ID
- `POST /api/topics` - Create topic
- `PUT /api/topics/:id` - Update topic
- `DELETE /api/topics/:id` - Delete topic

### Assignments
- `GET /api/assignments/classroom/:classroomId` - Get assignments for classroom
- `GET /api/assignments/:id` - Get assignment by ID
- `POST /api/assignments` - Create assignment
- `POST /api/assignments/:id/submit` - Submit assignment
- `PUT /api/assignments/:id/grade` - Grade assignment

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `GET /api/payments/history` - Get payment history
- `GET /api/payments/:id` - Get payment by ID
 - `POST /api/payments/paystack/initiate` - Initiate Paystack transaction
 - `GET /api/payments/paystack/verify` - Verify Paystack transaction reference
 - `POST /api/payments/paystack/webhook` - Paystack webhook receiver (server-side)

Frontend callback (optional): `https://<your-domain>/payments/verify`
 - Purpose: user-facing redirect after completing payment. The page reads the `reference` query parameter and calls `GET /api/payments/paystack/verify?reference=...` to finalize verification.

### Zoom
- `POST /api/zoom/create-meeting/:classroomId` - Create Zoom meeting
- `GET /api/zoom/meeting/:classroomId` - Get Zoom meeting details

### Whiteboard
- `GET /api/whiteboard/:classroomId` - Get whiteboard URL
- `POST /api/whiteboard/:classroomId/create` - Create whiteboard session

### Notifications
- `POST /api/notifications/class-reminder/:classroomId` - Send class reminder
- `POST /api/notifications/assignment-reminder/:assignmentId` - Send assignment reminder
- `POST /api/notifications/assignment-result/:assignmentId/:studentId` - Send assignment result
- `POST /api/notifications/payment-notification` - Send payment notification

## Project Structure

```
LMS/
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/      # Auth middleware
│   ├── server.js       # Express server
│   ├── seed.js         # Database seeder
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── context/    # React context
│   │   ├── utils/      # Utility functions
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## Development

### Running in Development Mode

1. Start MongoDB (if running locally)
2. Start backend: `cd backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev`

### Building for Production

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

## Environment Variables

### Backend (.env)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `STRIPE_SECRET_KEY` - Stripe secret key
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `ZOOM_API_KEY` - Zoom API key (optional)
- `ZOOM_API_SECRET` - Zoom API secret (optional)
 - `PAYSTACK_SECRET_KEY` - Paystack secret key (required if using Paystack)
 - `PAYSTACK_CURRENCY` - Currency code for Paystack amounts (e.g., `NGN`)

### Frontend (.env)
- `VITE_API_URL` - Backend API URL
 - `VITE_PAYSTACK_PUBLIC_KEY` - Paystack public key for inline widget (optional)

## AI Assistant & MCP Integration

The platform ships two related features that turn the LMS into an AI assistant hub:

1. **Per-user AI provider connections** — every user can connect their *own* model
   provider (OpenRouter key, or Google/Gemini via OAuth), so AI work is billed to
   them, not the platform. Users without a connection fall back to the
   platform's server-side provider.
2. **MCP (Model Context Protocol) server** — a standards OAuth 2.1 authorization
   server + Streamable HTTP transport, so Claude, ChatGPT, Cursor or any MCP
   client can read a student's classes/topics/progress, draft content in drafts,
   and (after explicit per-action confirmation) create or update content.

### Setup — add these to `backend/.env`

```env
# ── Required ───────────────────────────────────────────────────────────────
# Master key used to encrypt per-user provider secrets (AES-256-GCM, 32 bytes).
# Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# If unset it is derived from JWT_SECRET (fine for dev; if you change JWT_SECRET
# later, already-stored secrets become unreadable, so set this early).
AI_SECRET_ENCRYPTION_KEY=

# Public origin of the BACKEND (no trailing slash), e.g. https://api.yourschool.com
# Used to build the MCP OAuth issuer URL and the default MCP resource URL.
PUBLIC_BASE_URL=

# Public origin of the FRONTEND (no trailing slash). Used for the MCP consent
# redirect, Google OAuth callback and email links. Defaults to http://localhost:3000
FRONTEND_URL=

# ── Platform AI provider (server-side key; used when a user has no connection)
# ── Default platform provider is Groq; switch via Platform Settings UI.
GEMINI_API_KEY=
GROQ_API_KEY=
GEMINI_MODEL=                 # optional, default gemini-2.0-flash
GROQ_MODEL=                   # optional

# ── Bring-your-own Gemini (optional) ─────────────────────────────────────────
# Lets users sign in with their Google account to use their own Gemini quota.
# Google Cloud Console: create an OAuth 2.0 client "Web application" and add an
# authorized redirect URI of <FRONTEND_URL>/profile
#   (dev frontend: http://localhost:5173/profile).
GEMINI_OAUTH_CLIENT_ID=
GEMINI_OAUTH_CLIENT_SECRET=

# ── MCP (optional, with safe defaults) ───────────────────────────────────────
# Canonical MCP endpoint URL a client connects to. Defaults to
# PUBLIC_BASE_URL/mcp, then BASE_URL/mcp, then http://localhost:5000/mcp.
MCP_RESOURCE_URL=

# Allow MCP clients (Claude/ChatGPT/Cursor) to self-register via RFC 7591 DCR.
# OFF by default. DCR-exposed clients get read + draft scopes only.
MCP_ALLOW_DYNAMIC_REGISTRATION=true
# Give DCR-registered clients mcp:write too (otherwise only read/draft).
MCP_ALLOW_DCR_WRITE=true

# Overrides for the dev-client seed script (section below).
MCP_DEV_CLIENT_ID=
MCP_DEV_CLIENT_NAME=
MCP_DEV_CLIENT_URI=
MCP_DEV_REDIRECT_URIS=
```

### Seed a development MCP client

The MCP authorization server refuses every token request until a client exists.
For local development, register one:

```bash
cd backend
node scripts/seedMcpDevClient.js
```

This is idempotent. It stores only the SHA-256 of the secret and prints the
plaintext `CLIENT_ID` / `CLIENT_SECRET` once — paste them into your test client.
To control the redirect URIs the client may use:

```bash
MCP_DEV_REDIRECT_URIS="http://127.0.0.1:5173/callback,http://127.0.0.1:3000/callback" node scripts/seedMcpDevClient.js
```

For real third-party clients (Claude Desktop, ChatGPT, Cursor), prefer **dynamic
registration** (`MCP_ALLOW_DYNAMIC_REGISTRATION=true`): the client presents its
own accurate redirect URI and is granted read + draft scopes. A pre-registered
client only works when its exact redirect URI is registered here — matching is
deliberately exact, never prefix-based.

### AI access control (precedence global → school → user)

- Any explicit **"disabled"** at any level wins; explicit "enabled" only counts
  when nothing above it is disabled. Administrators can therefore switch AI off
  and it takes effect immediately.
- **Global (Platform Settings UI):** `activeAIProvider` (groq | gemini),
  `studentAIEnabled` (student access off by default), `studentAIDailyLimit`
  (1-1000, default 20). Staff-wide disable (`staffAIEnabled`) is not yet exposed
  in the UI — set it directly in the `Settings` collection if needed.
- **School:** `School.aiTutorAccess` = `'enabled' | 'disabled'` (per school).
- **User:** user's `aiTutorAccess` on their own account; students additionally
  have a daily interaction meter (`aiTutorUsage`).
- All AI surfaces — the `generate-*` REST routes **and** every MCP tool — go
  through this one gate (`utils/aiAccess.js`).

### User guide — connect your own AI provider (Profile page)

**Profile → AI Connection:**

| Action | What happens |
| --- | --- |
| **Connect Google** | Opens Google OAuth. Google redirects back to your Profile page and the backend stores the refresh token (encrypted, bound to your account ID). AI requests use **your** Gemini quota. |
| **Add OpenRouter key** | Paste a key from openrouter.ai/keys; optional model override. Requests bill your OpenRouter account. |
| **Disconnect** | Deletes the stored secret; requests fall back to the platform provider. |

Editors see key material as `••••1234`; the full key never leaves the server, and
at-rest it is AES-256-GCM sealed with a context bound to your user ID.

### User guide — connect an assistant (Claude / ChatGPT / Cursor)

1. Sign in to the LMS normally (the MCP session binds to your login).
2. In your assistant/MCP client, add the server URL — the **resource URL**
   (e.g. `https://api.yourschool.com/mcp`).
3. The client performs the OAuth 2.1 flow: it opens the browser, you land on
   **Consent** at `FRONTEND_URL/mcp-consent`, and approve a scope set:

   | Scope | Grants |
   | --- | --- |
   | `mcp:read` | Read your classes, topics, assignments and progress. |
   | `mcp:draft` | Draft study material and teaching content using AI. |
   | `mcp:write` | Create and update content in your classes. |

4. Your client stores the token. Every later call is scoped by **what you
   approved** (a client can never self-widen) and by **your role** (students see
   read/draft tools only; write tools are for staff).
5. Write-scoped tools are further protected by a **confirmation gate**: the
   assistant can create content only after you approve a one-time confirmation
   prompt in the profile/consent surface. Every draft and every write is written
   to the MCP audit log.
6. **Manage your connections** at Profile → Connected Assistants: see what has
   access, and revoke any client instantly (revocation kills its refresh token).

### Client configuration examples

```jsonc
// Claude Desktop — claude_desktop_config.json
{
  "mcpServers": {
    "gracy-lms": { "url": "https://api.yourschool.com/mcp" }
  }
}
```

```bash
# Claude Code (CLI)
claude mcp add gracy --transport http https://api.yourschool.com/mcp
```

ChatGPT and Cursor accept the same server URL from their "connect MCP server"
menus. The client discovers everything else via RFC-style metadata — it never
needs redirect URIs or client credentials from you (DCR provides them).

### MCP endpoints (discovery is fully automatic)

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/oauth-protected-resource/mcp` | Protected Resource Metadata (RFC 9728) |
| `GET /.well-known/oauth-authorization-server` | Authorisation Server Metadata (RFC 8414) |
| `GET /api/mcp/oauth/authorize` | Authorization endpoint (PKCE S256 only) |
| `POST /api/mcp/oauth/token` | Token endpoint (audience-bound access tokens, 1 h) |
| `POST /api/mcp/oauth/revoke` | Revocation (RFC 7009) |
| `POST /api/mcp/oauth/register` | Dynamic client registration (RFC 7591, off unless enabled) |
| `POST /api/mcp/oauth/consent-intent` / `GET|POST /api/mcp/oauth/consent` | Consent screen backing |
| `GET|POST /mcp` | Streamable HTTP transport (JSON-RPC `tools/list`, `tools/call`, …) |

### Security invariants (do not weaken)

- PKCE with `S256` is mandatory; the implicit flow does not exist.
- Access tokens are audience-bound to this server's resource URL and verified
  against it — a token minted here is not replayable elsewhere.
- Scope granted = scope shown on consent (a client cannot ask wider later).
- Redirect URIs match **exactly**; unregistered redirects are refused without
  redirecting. Client ID docs (CIMD) are fetched through the SSRF guard.
- Codes are single-use and expire in 10 minutes; refresh tokens last 30 days and
  are invalidated on revoke or disconnect.

### Testing

```bash
cd backend
npm test          # runs node --test tests/ (142 tests, no DB required)
```

## Security Notes

- Change JWT_SECRET in production
- Use environment variables for all sensitive data
- Enable HTTPS in production
- Implement rate limiting
- Add input validation and sanitization
- Use secure password hashing (already implemented with bcrypt)

## License

MIT License

## Support

For issues and questions, please open an issue on the repository.

