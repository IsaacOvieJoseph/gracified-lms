# SECURITY.md

Security posture review of the Gracified LMS codebase (Express + MongoDB backend, React/Vite web frontend, React Native mobile app).

Date of review: September 2026

## Verdict summary

| # | Finding | Verdict |
|---|---------|---------|
| 1 | Weak authentication: default admin credentials / lack of MFA | Partial |
| 2 | Permission escalation: teachers can modify admin settings | Partial |
| 3 | Unrestricted file uploads could execute malicious scripts | Partial |
| 4 | Insufficient input validation: XSS and SQL injection in forums and grade forms | Partial |
| 5 | Data export without logging: bulk student downloads, no audit trail | True |
| 6 | Session management flaws: session IDs not rotated after login | True |
| 7 | Missing audit logs: course/role changes not recorded | True |
| 8 | API rate limiting absent: denial-of-service exposure | Partial |

Verdicts reflect an audit against `backend/` as found at review time. `True` = the concern is genuinely present; `Partial` = the concern exists in a narrower or mitigated form than stated.

---

## 1. Weak authentication (default admin credentials / missing MFA) — PARTIAL

**What is real:**
- Seeded root admin account with a hardcoded, publicly known weak credential:
  - `backend/seed.js:27-32` — `root_admin` with `admin@lms.com` / `admin123` (credentials printed at `:100`).
  - Identical seeds in `backend/seed-fix.js:30-35/:107` and `backend/fix-db.js:36-41/:112`.
  - These scripts `deleteMany({})` users before seeding, so the weak account is (re)created on every seed run.
- No password length/complexity policy on registration: `backend/routes/auth.js:270-357` accepts any password. A 6-char minimum exists only on reset (`auth.js:1041-1043`) and profile change (`auth.js:1380-1382`).

**Mitigating controls that make it "partial":**
- Email-OTP two-factor authentication **exists** and is enforced for `root_admin`, self-enrollable for others:
  - `backend/routes/auth.js:551-569` (login 2FA check), `:638` (`/verify-2fa-login`), `backend/utils/twoFA.js:7-135`, `backend/models/User.js:124-141`.
- 2FA is email-OTP only (no TOTP app). `generateBackupCodes()` (`backend/utils/twoFA.js:14`) is never called, so backup codes are never issued.
- Login endpoints are rate-limited (see #8).

**Recommendations:**
- Require changing the seeded admin password on first login; stop seeding `admin123`.
- Enforce a real password policy at registration.
- Add TOTP (app-based) 2FA and issue backup codes.

---

## 2. Permission escalation — teachers mutating admin settings — PARTIAL

**What is real (over-permissive endpoints):**
- `POST /api/settings/add-subject` (`backend/routes/settings.js:129`) is guarded by `auth` **only** — any verified teacher or student can push arbitrary values into the **global** `Settings.subjects` array (`settings.js:140-144`). This mutates the shared system-settings document.
  - The design is even endorsed in-code: `settings.js:108` "Accessible to teachers/admins".
- Related auth-only mutation patterns (not settings, but same hazard):
  - `PUT /api/topics/reorder` (`backend/routes/topics.js:83`) — any user can reorder topics in any classroom.
  - `GET /api/users/:id` (`backend/routes/users.js:147`) — any user can read any other user's profile (PII exposure).

**What is correctly guarded (no escalation found):**
- `PUT /api/settings` — root_admin-only 403 for others (`backend/routes/settings.js:68-72`).
- User create/update/delete — `authorize('root_admin','school_admin')` (`backend/routes/users.js:196, 501, 602`); creating/self-escalating to `root_admin` blocked (`users.js:201-208, 540-542`); role is not updatable via profile (`auth.js:1343` whitelist).
- Schools routes — teachers 403, school_admin scoped to own school and cannot set `aiTutorAccess` (`backend/routes/schools.js:268-283`).
- Marketing, disbursements, subscription plans — root_admin only.

**Recommendations:**
- Add a role check to `POST /api/settings/add-subject` (or move the capability behind an admin endpoint).
- Audit the remaining `auth`-only mutation routes (topics, users read) for ownership checks.

---

## 3. Unrestricted file uploads — PARTIAL

Four upload surfaces exist; all have whitelists, size caps, and (where configured) Cloudinary format checks:

| Endpoint | Config | Size | Allowed | Notes |
|---|---|---|---|---|
| `POST /api/auth/upload-logo` | `auth.js:32-44` | 2 MB | `jpeg/jpg/png/webp` (MIME + ext) | Cloudinary or local; magic-byte check via `file-type` (`auth.js:74-92`) |
| `POST /api/topics/:id/upload-video` | `topics.js:28-38` | 500 MB | `mp4/webm/ogg/mov/mkv/avi` + `video/*` | Cloudinary or local |
| `POST /api/users/bulk-invite` | `users.js:34-44` | 5 MB | `text/csv` or `.csv` ext | Stored `uploads/`, deleted after parse (`users.js:442`) |
| `POST /api/marketing/contacts/import-csv` | `marketing.js:18-25` | 10 MB | `text/csv` or `.csv` ext | Stored `uploads/`, deleted (`marketing.js:389-401`) |

**Why it is only "partial":**
- No accepted type is script-executable (html/svg/js/php rejected); Cloudinary `allowed_formats` enforces server-side (`config/cloudinary.js:16-17, 27`).
- Static media served under helmet with `X-Content-Type-Options: nosniff` (`backend/server.js:57-60, 96`), so a spoofed file is served as its declared type, not executed.
- **Residual weaknesses:**
  - CSV is accepted on extension **or** MIME with no content validation (spoofable, `users.js:38`, `marketing.js:22`).
  - Video contents are never magic-byte verified; only extension + claimed MIME.
  - `POST /api/auth/upload-logo` has **no auth middleware** — unauthenticated upload surface (`auth.js:68`).
  - If Cloudinary is unconfigured, files land in the publicly served `uploads/` directory (`server.js:96`).

**Recommendations:**
- Authenticate the logo endpoint; require auth on uploads generally.
- Magic-byte validate video and CSV contents; drop the extension-only fallback.
- Keep local uploads out of the public static path, or serve with restrictive headers.

---

## 4. Insufficient input validation — XSS / SQL injection — PARTIAL

**SQL injection: NOT APPLICABLE.** The app uses MongoDB via Mongoose. No SQL driver or raw queries exist; `express-mongo-sanitize` is applied globally (`backend/server.js:61`).

**Insufficient validation: REAL.**
- `express-validator` is a dependency (`backend/package.json`) but is **imported nowhere**; no Joi/celebrate, no `validationResult`, no `body()`/`check()` anywhere.
- Handlers consume raw `req.body` with shallow, ad-hoc checks:
  - Q&A boards: only `title`/`classroomId` required; board update is a mass-assignment `findByIdAndUpdate(id, req.body)` (`backend/routes/qna.js:64-66, 164, 240-242`).
  - Grading: `score`/`feedback` stored unvalidated (`backend/routes/assignments.js:753-765`); exam grading iterates `questionGrades` without verifying it is an array (`backend/routes/exams.js:902-909`).
- **No HTML sanitization anywhere** (no sanitize-html / DOMPurify / xss usage). Grading `feedback` is dropped raw into an HTML email template (`backend/routes/assignments.js:797`), so unsanitized persisted HTML reaches HTML output.

**XSS in the current web UI: mitigated by React escaping.** Forum/Q&A/descriptions render as escaped text nodes (`frontend/src/pages/QnACenter.jsx:274`, `QnAPresentation.jsx:160`). The only `dangerouslySetInnerHTML` uses are static, non-user content (`frontend/src/components/OnboardingTour.jsx:283`, `FeedbackManager.jsx:98`).

**Recommendations:**
- Introduce a validation schema layer (express-validator/Zod) on all mutation endpoints.
- Sanitize HTML on write for user-generated content, and before embedding in emails.

---

## 5. Data export without logging — TRUE

- `GET /api/reports/all-students` (`backend/routes/reports.js:58`) returns name, email, and per-class scores for every student across a teacher's/admin's classrooms. It is protected only by `auth` (role checks in the controller at `backend/controllers/reportController.js:417-495`) and **no audit-log write occurs anywhere in the request path**.
- No `AuditLog` model exists in `backend/models/` (32 models, none audit-related), so no export can be preceded by an audit entry.
- There is no dedicated CSV/gradebook download endpoint; the only `Content-Disposition: attachment` response in the API is an AI-generated PPTX (`backend/routes/ai.js:908`).

**Recommendations:**
- Introduce an audit trail for all bulk data reads/exports (who, what scope, when, how many records).
- Consider a role/ownership gate on the export scope and a record-count cap.

---

## 6. Session management flaws (no rotation/revocation) — TRUE

- Auth is stateless JWT (Bearer token): login mints a fresh 7-day token (`backend/routes/auth.js:575-579`; also OTP verify `:405-409`, 2FA verify `:671-675`).
- **No logout route, no token version (`jti`/`tokenVersion`), no blacklist, no server-side revocation.** Previously issued tokens remain valid until expiry — sessions are never actually rotated.
- Password reset (`auth.js:1036-1073`) and in-profile password change (`auth.js:1343-1385`) do **not** invalidate outstanding tokens.
- Signing secret falls back to a hardcoded `'your-secret-key'` when `JWT_SECRET` is unset (`auth.js:407, 577, 673`); middleware blocks verification when unset (`backend/middleware/auth.js:12-15`), but tokens are still minted.
- 7-day token lifetime (30-day on `set-password`, `auth.js:1247-1251`) means a stolen token stays valid up to a week with no kill switch.

**Recommendations:**
- Add a token-version/`jti` claim and bump it on logout and password change.
- Implement a logout route that invalidates the current token.
- Key rotation: fail hard at startup if `JWT_SECRET` is missing rather than falling back.
- Reduce token lifetime or adopt short-lived access + refresh tokens.

---

## 7. Missing audit logs — TRUE

- No audit/trail mechanism anywhere: no `AuditLog`/`ActivityLog` model, no morgan/winston logger installed (`backend/package.json`), no HTTP request logging.
- Mutation routes perform bare DB writes with no audit entry:
  - Role changes: `PUT /api/users/:id` — `User.findByIdAndUpdate` at `backend/routes/users.js:569`.
  - Settings updates: `backend/routes/settings.js:68-106`.
  - Classrooms/topics/assignments/exams mutations: none write audit entries.
- The only persisted "logs" are domain records (marketing send log `backend/routes/marketing.js:730,746`, payment/disbursement history) and `console.log` statements.

**Recommendations:**
- Add a lightweight audit model and hook key admin/role/content mutations.
- Enable structured HTTP request logging (morgan/winston) in production.

---

## 8. API rate limiting — PARTIAL

- `express-rate-limit` v8.2.1 and `helmet` v8.1.0 are installed (`backend/package.json:21,26`); helmet is applied globally (`backend/server.js:57-60`).
- A single limiter (`100 req / 15 min`) is applied **only** to `/api/auth` and `/api/google-auth` (`backend/server.js:64-70, 100-101`).
- All other API surfaces are unlimited: reports, users, classrooms, exams, topics, and AI-generation endpoints. `/api/reports/all-students` is completely unrestricted.
- `trust proxy` is set (`server.js:34`) but only used by the auth limiter.

**Recommendations:**
- Apply a global rate limiter and stricter per-route limits on expensive endpoints (reports, AI generation, auth).
- Add limits to login/OTP/2FA attempt flows.

---

## Priority order to remediate

1. **Seed admin credential** (#1) — rotate/expire `admin123`.
2. **Bulk student export with no audit** (#5), **no audit logs at all** (#7), **no session revocation** (#6) — the highest-risk trio.
3. **Auth-only mutation endpoints** (#2) — especially `POST /api/settings/add-subject`.
4. **No schema validation / sanitization** (#4) — pervasive input handling gap.
5. **Global rate limiting** (#8) and **upload hardening** (#3).