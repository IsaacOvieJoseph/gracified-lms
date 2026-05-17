# Gracified LMS — Product Guide

> **Version:** 1.0 | **Stack:** React 18 + Node.js/Express + MongoDB

---

## 1. What Is Gracified LMS?

Gracified LMS is a full-stack, multi-tenant Learning Management System built for schools and independent teachers. It covers the complete teaching lifecycle — from student onboarding and class creation to live collaboration, assignments, exams, payments, and marketing — all under one roof.

---

## 2. Who Is It For?

The platform uses a five-tier role system. Every user belongs to exactly one role, and the UI and API permissions adapt accordingly.

| Role | Who They Are | Core Capability |
|---|---|---|
| **Root Admin** | Platform owner/operator | Full system access, platform settings, subscription plans, global disbursements |
| **School Admin** | Principal / institution manager | Manages one or more schools, onboards teachers, views school revenue |
| **Teacher** | Subject teacher under a school | Manages classrooms and curriculum assigned to them |
| **Personal Teacher** | Independent tutor | Full end-to-end control — teaching, billing, student management |
| **Student** | Learner | Browses, pays, enrolls, and learns |

> A School Admin can belong to **multiple schools** simultaneously. Teachers are invited by admins via a token-based invite link.

---

## 3. Authentication & Onboarding

### 3.1 Registration Paths
Three distinct self-registration flows:
- `/register/student` — Standard student signup
- `/register/school-admin` — School institution registration
- `/register/personal-teacher` — Independent teacher registration

Teachers under a school are **not self-registered**. They receive an email invite with a token and land on `/set-password` to complete their account.

### 3.2 Email Verification
All self-registered users must verify their email via an OTP before accessing the platform. Unverified users are redirected to `/verify-email` on every protected route attempt.

### 3.3 Security Features
- **Password Hashing:** bcrypt with a salt round of 10.
- **JWT Sessions:** Stateless tokens for all API calls.
- **2FA (Two-Factor Authentication):** Mandatory for Root Admin. Optional for others. Implemented with OTP codes and backup codes.
- **Password Reset:** OTP-based reset flow via `/forgot-password`.
- **Subscription Gate:** School Admins and Personal Teachers whose trial has expired are automatically redirected to `/subscription-management` until they upgrade.

---

## 4. Schools

A **School** is the institutional container for School Admins and their Teachers.

**Key fields:**
- `name` — Unique school name
- `adminId` — The School Admin who owns it
- `classes[]` — Array of Classroom references
- `logoUrl` — Branding logo
- `shortCode` — Auto-generated 8-character hex code used in public URLs (`/s/:shortCode`)

**Public School Page (`/s/:identifier`):** A branded public-facing page where prospective students can discover the school's classrooms and enroll.

---

## 5. Classrooms

Classrooms are the primary learning container. Each classroom belongs to a teacher and optionally to a school.

### 5.1 Classroom Configuration
| Field | Description |
|---|---|
| `name` | Class title |
| `subject` | Subject area |
| `level` | Education level (Pre-Primary → Postgraduate → Vocational) |
| `description` | What students will learn |
| `learningOutcomes` | Key takeaways |
| `introVideo` | YouTube/Vimeo URL for a preview |
| `schedule[]` | Weekly schedule: day + start/end time |
| `capacity` | Max students (default: 30) |
| `pricing` | Type + amount (see section 8) |
| `isPaid` | Whether enrollment requires payment |
| `isPrivate` | Hidden from public discovery |
| `published` | Visible to students |
| `shortCode` | Auto-generated public link code (`/c/:shortCode`) |
| `currentTopicId` | Pointer to the currently active topic |
| `whiteboardUrl` | Link to the active whiteboard session |

### 5.2 Classroom Filtering
Students can filter classrooms by **education level** and **price range** before enrolling.

---

## 6. Topics & Curriculum

Topics are the building blocks of a classroom's curriculum. They represent individual lessons, units, or chapters.

### 6.1 Topic Fields
| Field | Description |
|---|---|
| `name` | Topic title |
| `description` | Summary of the topic |
| `lessonsOutline` | Detailed lesson breakdown |
| `order` | Sequence number in the curriculum |
| `materials[]` | Attached resources (video, document, link, text) |
| `recordedVideos[]` | Lecture recordings (file upload or URL, with labels) |
| `isPaid` / `price` | Per-topic pricing override |
| `duration` | `mode` (day/week/month/year/not_sure) + `value` |
| `status` | `pending` → `active` → `completed` |
| `startedAt` / `completedAt` | Timestamps for progression tracking |
| `expectedEndDate` | Auto-calculated from `startedAt` + `duration` |
| `nextTopicId` | Manual override for next topic in sequence |
| `completedBy` | Who marked the topic as done |

### 6.2 Topic Progression Engine
This is one of the platform's most powerful features — an automated curriculum pipeline.

**How it works:**
1. Teacher creates topics and optionally sets a duration (e.g., "2 weeks").
2. Teacher or admin **activates** a topic (`POST /api/topics/:id/activate`). The system records `startedAt` and calculates `expectedEndDate`.
3. When a topic is done, teacher clicks **Mark Complete** (`POST /api/topics/:id/complete`). The system:
   - Sets the current topic's status to `completed` and records `completedAt`.
   - Finds the next topic (using `nextTopicId` if set, otherwise by `order`).
   - Activates the next topic automatically.
   - Updates the classroom's `currentTopicId`.
4. A **daily cron job at midnight** checks all active topics whose `expectedEndDate` has passed and auto-progresses them — no teacher action needed.

**Manual Controls:**
- `PUT /api/topics/:id/set-next` — Override which topic comes after the current one.
- `POST /api/topics/:id/activate` — Start any topic manually at any time.

**Topic Management UI** (`/classrooms/:id/manage-topics`): A dedicated timeline-based interface for teachers to visualize and control the entire curriculum flow.

---

## 7. Assignments

### 7.1 Assignment Types
- **Theory** — Open-ended questions. Supports both manual and AI-assisted marking.
- **MCQ (Multiple Choice)** — Auto-gradeable. Correct answers are stored server-side and never exposed to students before submission.

### 7.2 Assignment Lifecycle
1. Teacher creates an assignment via the **Create Assignment Modal**, linking it to a classroom and optionally to a specific topic.
2. Assignment is published (default: `published: true`).
3. Students see it on their classroom page and submit via the **Submit Assignment Modal**.
4. Teacher receives a `new_submission` notification.
5. Teacher reviews and grades via the **Grade Assignment Modal**. Supports per-question scoring and written feedback.
6. Student receives an `assignment_graded` notification.
7. Teacher can set a `publishResultsAt` date to delay when MCQ results become visible.

### 7.3 Submission Fields
Each submission contains: `answers` (text or selected option), `files[]` (uploaded attachments), `questionScores[]` (per-question breakdown), `score`, `feedback`, and `status` (`submitted` → `graded` → `returned`).

---

## 8. Exams

Exams are a distinct, more formal assessment tool separate from assignments.

### 8.1 Key Features
- Timed exams with a `duration` field (in minutes).
- Mix of MCQ and theory questions in one exam.
- `accessMode`: `registered` (enrolled students only) or `open` (anyone with the link).
- Each exam generates a unique `linkToken` for shareable access (`/exam-center/:token`).
- `isPublished` / `resultsPublished` / `resultPublishTime` — Full control over exam and result visibility.
- Teachers manage submissions at `/exams/:id/submissions` and review individual attempts at `/exams/submissions/detail/:id`.

### 8.2 Exam Creator
A rich editing interface at `/exams/create` (and `/exams/edit/:id`) with:
- AI-assisted question generation.
- LaTeX rendering support for math/science notation.
- Mixed question type support per exam.

---

## 9. Payments & Enrollment

### 9.1 Payment Gateways
| Gateway | Region | Integration |
|---|---|---|
| **Paystack** | Africa (NGN default) | Inline widget + webhook verification |
| **Stripe** | Global | Payment Intent flow |

### 9.2 Pricing Models
Classrooms and topics support six pricing structures:
- `per_lecture` — Pay for each individual call session
- `per_topic` — Pay to unlock individual topics
- `weekly` — Weekly subscription to a classroom
- `monthly` — Monthly subscription
- `one_time` — Single payment for full access
- `free` — No payment required

### 9.3 Payment Lifecycle
1. Student selects a class/topic → Frontend calls `POST /api/payments/paystack/initiate`.
2. Paystack popup appears. Student completes payment.
3. User is redirected to `/payments/verify?reference=...` (the `PaystackCallback` page).
4. Frontend calls `GET /api/payments/paystack/verify` → Backend validates with Paystack API.
5. On success: student is enrolled, `enrolledClasses[]` is updated, and a `payment_success` notification is sent.
6. Paystack also sends a server-side **webhook** (`POST /api/payments/paystack/webhook`) as a secondary verification.

### 9.4 Payment Record Fields
Each payment stores: `userId`, `type`, `classroomId`, `topicId`, `callSessionId`, `amount`, `currency`, `status` (`pending/completed/failed/refunded`), `paystackReference`, `stripePaymentId`, and detailed financial breakdown: `taxAmount`, `vatAmount`, `serviceFeeAmount`, `payoutAmount`.

### 9.5 Disbursements
Personal Teachers and School Admins can configure **bank details** (bank name, code, account number, Paystack recipient code) and a **payout preference** (daily, weekly, or monthly). Root Admin manages and approves payouts on the `/disbursements` page.

---

## 10. Live Session Tools

### 10.1 Whiteboard (`/classrooms/:classId/whiteboard`)
A real-time collaborative canvas powered by **Socket.io**.
- Teachers can draw, write, and present live.
- All participants see changes in real time (socket room keyed by `classroomId`).
- Unique `whiteboardUrl` is stored on the Classroom, with a `whiteboardActiveAt` timestamp.

### 10.2 Voice Communication (WebRTC)
Integrated directly into the Whiteboard:
- **Protocol:** WebRTC (P2P audio).
- **Signaling:** Socket.io exchanges SDP offers/answers and ICE candidates.
- **Controls:** Mute/unmute, enable/disable voice. Only teachers initiate voice sessions.
- **Socket events:** `wb:voice-start`, `wb:sdp-offer`, `wb:sdp-answer`, `wb:ice-candidate`, `wb:mute-status`.

### 10.3 Google Meet / Zoom Integration
- Teachers can start a **Zoom meeting** (`POST /api/zoom/create-meeting/:classroomId`) or a **Google Meet** session.
- Each session is recorded as a **CallSession** with `classroomId`, `startedBy`, `link`, `startedAt`, and optionally `isPaid`/`amount` for per-lecture billing.
- **Attendance** is automatically tracked: a record is created per student per `CallSession`, with a unique index preventing duplicate check-ins.

---

## 11. Q&A Board

A live, interactive Q&A tool for classroom engagement.

- Teachers create a **QnA Board** linked to a classroom (and optionally a topic).
- A unique `shareableLink` is generated for each board.
- Students and guests (if `allowAnonymous: true`) can submit questions.
- Teachers can set `isPublic` (visible to all) or keep it private.
- `hideQuestions` mode lets teachers moderate before questions appear.
- The teacher presents questions in fullscreen mode at `/qna/:token/present`.

---

## 12. Notifications

The platform has a dual-channel notification system.

### 12.1 In-App Notifications
Each notification record contains: `userId`, `message`, `type`, optional `entityId`/`entityRef` (linking to the related Assignment, Classroom, Payment, Topic, or User), and a `read` boolean.

**Notification Types:**
`class_reminder`, `assignment_reminder`, `assignment_result`, `payment_success`, `payment_received`, `payout_received`, `new_assignment`, `new_submission`, `assignment_graded`, `subscription_success`, `student_enrolled`, `topic_activated`, `new_class_created`, `class_published`, `classroom_ended`, `marketing_job`

### 12.2 Email Notifications
Sent via **Brevo (formerly Sendinblue)** (transactional) and **Nodemailer** (SMTP). Email triggers include:
- Class reminders (includes current active topic name and description)
- Assignment due-date reminders
- Assignment graded results
- Payment confirmations
- Subscription and payout events

---

## 13. Subscription System (Teacher Plans)

Personal Teachers and School Admins pay a platform subscription to use Gracified LMS.

### 13.1 Plan Types
| Plan | Description |
|---|---|
| `trial` | 2-week free trial (14 days), auto-enabled on registration |
| `pay_as_you_go` | No flat fee; platform takes a `revenueSharePercentage` |
| `weekly` | Flat weekly fee |
| `monthly` | Flat monthly fee |
| `yearly` | Flat annual fee |

### 13.2 Subscription Status on User
`subscriptionStatus`: `none` → `trial` → `active` → `canceled` → `expired` → `pay_as_you_go`

If a user's trial expires and they haven't subscribed, they are locked out of the app and redirected to `/subscription-management`.

Root Admin manages subscription plans at `/subscription-plans-admin`.

---

## 14. Marketing Engine

A built-in email drip campaign system for teachers and admins to grow their student base.

### 14.1 Components
- **Marketing Lists** — Groups of contacts (e.g., "Prospective Students").
- **Marketing Contacts** — Individual email contacts added to lists.
- **Marketing Templates** — Reusable email templates (Brevo-powered).
- **Marketing Campaigns** — Multi-step drip sequences. Each step references a template and has a `delayDays` value.
- **Marketing Jobs** — Scheduled send jobs triggered by the campaign engine.
- **Marketing Holidays** — Blackout dates to pause sends.
- **Send Logs** — Audit trail of every email sent.

Campaigns have a status lifecycle: `draft` → `active` → `paused` → `completed`.

---

## 15. Feedback System

Teachers can solicit structured feedback from students.

- **Types:** `classroom` feedback (rating + comment on a specific class) or `platform` feedback (general product sentiment).
- **Lifecycle:** `pending` → `completed` / `dismissed`
- **Ratings:** 1–5 star scale.
- Root Admin and teachers review all feedback on the `/feedbacks` page.

---

## 16. Reports & Analytics

The `/reports` section provides data insights for admins and teachers, including enrollment trends, revenue summaries, assignment completion rates, and exam performance breakdowns.

---

## 17. Platform Settings

Root Admin controls global platform behaviour from `/platform-settings`:
- Toggle `subscriptionCheckingEnabled` — Enable or disable the subscription gate globally (useful during testing or grace periods).
- Other global configuration keys stored in the `Settings` model.

---

## 18. AI Assistant

The platform has a built-in **AI Assistant Panel** (`AIAssistantPanel.jsx`) exposed within the classroom and exam creator workflows. Capabilities include:
- Generating exam questions from topic descriptions.
- Suggesting syllabus/lesson outlines.
- AI-assisted marking for theory assignments (`markingPreference: 'ai'`).

Backend AI routes are handled under `/api/ai`.

---

## 19. User Profile & Account Management

Each user has a `/profile` page with:
- Profile picture upload.
- Personal details editing.
- Bank account configuration (for payouts).
- 2FA setup and backup code management.
- Login activity tracking (`loginCount`, `lastActiveAt`).
- Google OAuth refresh token storage (for Google Meet).

---

## 20. Application Routes Reference

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Sign in |
| `/register` | Public | Role selection |
| `/register/student` | Public | Student signup |
| `/register/school-admin` | Public | School Admin signup |
| `/register/personal-teacher` | Public | Personal Teacher signup |
| `/verify-email` | Authenticated | Email OTP verification |
| `/forgot-password` | Public | Password reset |
| `/set-password` | Public (token) | Invited teacher password setup |
| `/c/:shortCode` | Public | Public classroom page |
| `/s/:identifier` | Public | Public school page |
| `/dashboard` | Private | Role-adapted home dashboard |
| `/schools` | Private | School list |
| `/schools/:id` | Private | School detail |
| `/classrooms` | Private | Classroom list |
| `/classrooms/:id` | Private | Classroom detail |
| `/classrooms/:id/manage-topics` | Private | Topic progression manager |
| `/classrooms/:classId/whiteboard` | Private | Live collaborative whiteboard |
| `/assignments` | Private | Assignments list |
| `/exams` | Private | Exams list |
| `/exams/create` | Private | Exam builder |
| `/exams/edit/:id` | Private | Exam editor |
| `/exams/:id/submissions` | Private | Exam submissions list |
| `/exams/submissions/detail/:id` | Private | Individual submission review |
| `/exam-center/:token` | Public (token) | Student exam-taking interface |
| `/qna/:token` | Public (token) | Q&A board for students |
| `/qna/:token/present` | Private | Teacher Q&A presentation mode |
| `/payments` | Private | Payment history |
| `/payments/verify` | Private | Paystack callback handler |
| `/users` | Private (Admin) | User management |
| `/disbursements` | Private (Admin) | Payout management |
| `/subscription-management` | Private | Teacher subscription portal |
| `/subscription-plans-admin` | Private (Root Admin) | Manage platform plans |
| `/reports` | Private | Analytics & reports |
| `/marketing` | Private | Email marketing campaigns |
| `/feedbacks` | Private | Feedback viewer |
| `/profile` | Private | User profile & settings |
| `/platform-settings` | Private (Root Admin) | Global platform configuration |

---

## 21. Technology Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Icons | Lucide React |
| Toast Alerts | React Hot Toast |
| Math Rendering | MathText component (LaTeX) |
| State | React Context API (AuthContext, ThemeContext) |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Real-time | Socket.io |
| Scheduling | node-cron |
| Payments | Stripe SDK + Paystack API |
| Email | Brevo (Sendinblue) + Nodemailer |
| File Uploads | Multer |
| Video Meetings | Zoom API + Google OAuth (Google Meet) |

### Infrastructure
| Component | Service |
|---|---|
| Database | MongoDB Atlas |
| Backend Hosting | Render |
| Frontend Hosting | Vercel / Netlify |
| File Storage | Local (`/uploads`) or Cloud CDN |

---

## 22. Environment Variables Reference

### Backend (`.env`)
```
PORT=5000
MONGODB_URI=
JWT_SECRET=
STRIPE_SECRET_KEY=
PAYSTACK_SECRET_KEY=
PAYSTACK_CURRENCY=NGN
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
ZOOM_API_KEY=
ZOOM_API_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
BREVO_API_KEY=
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:5000/api
VITE_PAYSTACK_PUBLIC_KEY=
```
