# Gracified LMS Product Specification

**Product:** Gracified LMS  
**Document status:** Living product and engineering specification  
**Surfaces:** Web application, Expo/React Native mobile application, Express/MongoDB API  
**Primary audience:** Schools, teachers, independent tutors, and students

## 1. Product overview

Gracified LMS is a multi-tenant learning platform for managing the complete teaching lifecycle: onboarding, school and classroom administration, curriculum delivery, live lessons, assessments, payments, notifications, and learning analytics. The web application is the full administration and teaching workspace. The mobile application gives learners and teaching staff a focused experience for classroom access, content, assessments, payments, collaboration, and AI-assisted authoring.

The platform supports both institutional schools and independent teachers. A school can have multiple administrators, assigned teachers, classrooms, pricing rules, and public discovery links. Students can discover or receive links to classes, enroll, pay where required, learn from topics, join live sessions, submit work, and receive results.

## 2. Product goals

1. Make it simple for a teacher to create and run a class from one workspace.
2. Give students a reliable, accessible learning experience on web and mobile.
3. Support paid and free education products with auditable payment records.
4. Provide strong role-based access across platform, school, classroom, and student data.
5. Reduce authoring effort through AI-generated classes, topics, syllabi, assignments, exams, slides, and Q&A content.
6. Keep web and mobile behavior consistent, especially for authentication, publishing, assessments, payments, and collaboration.

## 3. Personas and roles

| Role | Responsibilities | Typical access |
|---|---|---|
| Root admin | Operates the platform, manages users, settings, plans, payments, and payouts | Global administration |
| School admin | Runs one or more schools, teachers, classrooms, pricing, and school finances | Assigned schools and their data |
| Teacher | Delivers classes under a school | Assigned classrooms, topics, assessments, learners |
| Personal teacher | Independent tutor who owns the teaching business | Own classrooms, students, content, payments |
| Student | Learns, enrolls, pays, joins sessions, and submits work | Enrolled or publicly available content |

Authorization is enforced in both the API and UI. A user may only manage a classroom when they own it, are assigned to it, or administer its school. Students must not receive unpublished assessments or private management data.

## 4. Core product modules

### 4.1 Authentication and onboarding

- Student, school-admin, and personal-teacher registration paths.
- Teacher invitation and password setup.
- JWT-based sessions with persisted mobile sessions.
- Email verification by OTP.
- Pending-verification handling for users who leave onboarding before verifying email.
- Forgot-password flow: request OTP, verify OTP, set and confirm a new password, resend OTP, and change email.
- Optional two-factor authentication and backup codes; mandatory for root administration where configured.
- Subscription/trial checks for school-admin and personal-teacher accounts.
- Secure password hashing, request validation, rate limiting, and security headers.

### 4.2 Schools and multi-school administration

- Create and update school profile, logo, branding, and contact information.
- Support school administrators who belong to multiple schools.
- Invite teachers with tokenized links.
- Show school-specific classrooms, users, payments, and public portal links.
- Provide a shareable school portal link for public class discovery.

### 4.3 Classroom management

Classrooms are the primary learning container. A classroom supports:

- Name, description, subject, academic level, learning outcomes, and intro media.
- Assigned teacher, school, capacity, and enrolled students.
- Free or paid access, pricing type, amount, private/public visibility, and published/draft state.
- Weekly schedule with day, start time, and end time.
- Public classroom short code and share link.
- Current topic and progression state.
- Links to live call, whiteboard, Q&A, assignments, and exams.

Admins and teachers can create, edit, publish, unpublish, and delete classrooms subject to authorization. Students can discover, view, enroll, and access only classrooms permitted by visibility, enrollment, payment, and capacity rules.

### 4.4 Topics, syllabus, and curriculum progression

Topics represent lessons or units within a classroom. The product supports:

- Create, edit, reorder, and delete topics.
- Topic descriptions, lesson outlines, materials, recorded videos, and resource links.
- Per-topic paid access and price overrides.
- Topic duration and expected end date.
- Topic states: pending, active, and completed.
- Activate, complete, and select the next topic.
- Automatic progression to the next ordered topic.
- Scheduled progression checks for overdue active topics.
- Student progress and access checks based on enrollment and payment.

### 4.5 Assignments

Assignments support theory and MCQ assessments.

Teacher/admin capabilities:

- Create, edit, publish/unpublish, and delete assignments.
- Link an assignment to a classroom and optionally a topic.
- Set due date, maximum score, assignment type, and MCQ result release datetime.
- Add questions and per-question scores.
- Select the correct MCQ option directly from the option list.
- Review submissions, grade theory answers, provide feedback, and release results.

Student capabilities:

- See only published assignments available to the student.
- Submit MCQ and theory responses, with optional file attachments where enabled.
- View submission status, scores, feedback, and results once released.

### 4.6 Exams

Exams are timed assessments separate from assignments.

- Create, edit, publish/unpublish, and delete exams.
- Set duration, due date, result release datetime, access mode, and classroom.
- Support mixed MCQ and theory questions.
- Generate a secure share token for open-link exams.
- Allow registered-only or open access modes.
- Track attempts, submissions, grading, result visibility, and release timing.
- Show unpublished exams to authorized staff in class details; hide them from students until published.

### 4.7 AI assistant

The AI assistant helps staff generate structured educational content. The primary tabs are:

1. Class
2. Topic
3. Syllabus
4. Assignment
5. Exam
6. Slides
7. Q&A

AI output must be actionable, not just text. Staff can apply results to create or edit a classroom, topic, syllabus, assignment, exam, or Q&A board. Generated slides provide a download action. Students do not see the AI assistant feature.

AI output is treated as a draft until the user reviews and saves it. The backend should validate generated structures, enforce user permissions, and record provider/model errors without exposing secrets.

### 4.8 Live lessons and collaboration

- Zoom and Google Meet launch flows.
- Call sessions linked to classrooms, teachers, students, start time, and attendance.
- Per-lecture payment support where configured.
- Collaborative whiteboard with shareable classroom context.
- Socket-based real-time drawing/presentation updates.
- WebRTC voice signaling for supported whiteboard sessions.
- Mobile deep-link/WebView return paths that restore the user to the mobile app UI after Q&A or whiteboard use.

### 4.9 Q&A board

- Create a Q&A board linked to a classroom and optional topic.
- Generate a shareable token.
- Accept authenticated or anonymous questions when enabled.
- Moderate/hide questions before publishing.
- Use question page as the default entry point.
- Allow only authorized management roles to switch to presentation mode.
- Validate presentation access server-side; mobile uses `/qna/:token` as the management entry point and exposes the presentation switch in the UI.

### 4.10 Payments, billing, and enrollment

Supported payment models include free, one-time, weekly, monthly, per-topic, and per-lecture access. The platform integrates Paystack and Stripe where configured.

Payment requirements:

- Initiate and confirm payment securely.
- Verify provider callbacks and webhooks server-side.
- Enroll the student only after successful verification.
- Store immutable references, amount, currency, purpose, payer, class/topic/subscription, status, and timestamps.
- Show searchable billing history by payment reference.
- Clearly identify who paid, what was paid for, and the associated class or subscription.
- Support refunds, fees, tax/VAT fields, disbursements, and payout preferences where enabled.

### 4.11 Notifications

- In-app notifications with read/unread state and entity links.
- Email notifications through configured transactional email providers.
- Push notifications on supported mobile devices.
- Class reminders, assignment reminders, assignment results, payment confirmations, enrollment events, publication events, topic progression, and payout notifications.

## 5. Platform experience

### Web application

The web app is the full-featured workspace for platform operators, school administrators, teachers, personal teachers, and students. It provides responsive dashboards, data tables, rich forms, charts, payment workflows, topic timelines, assessment management, AI authoring, and collaboration launch screens.

### Mobile application

The mobile app is an Expo/React Native client using the same backend API. It provides role-aware navigation, classroom details, topics, assignments, exams, AI authoring for staff, payments, profiles, notifications, deep links, dark/light themes, and WebView-based access to selected web collaboration experiences.

Mobile-specific requirements:

- Preserve authentication and pending verification state across launches.
- Hide staff-only features from students.
- Respect theme colors in dark and light mode; avoid bright/flashy combinations and white controls in dark mode.
- Keep forms touch-friendly with dropdowns, toggles, selectable options, and clear labels.
- Prevent controlled inputs from unexpectedly restoring default values while typing.
- Support profile image/logo upload where the role and school context permit it.
- Provide graceful offline/network error states and retry actions.

## 6. Technical architecture

### Frontend

- React 18, React Router, Vite, Tailwind CSS.
- Axios for API calls and shared auth/session behavior.
- Socket.io client for real-time collaboration.
- Recharts for analytics, KaTeX for mathematical content, Stripe.js for Stripe flows.

### Mobile

- Expo SDK 54, React Native 0.81, React Navigation.
- AsyncStorage for persisted session data.
- Expo Image Picker, Notifications, File System, Sharing, Status Bar, and WebView integrations.
- Shared role, theme, API, date, and link utilities.

### Backend

- Node.js and Express.
- MongoDB with Mongoose.
- JWT authentication and role/ownership authorization middleware.
- Helmet, CORS, rate limiting, request validation, and Mongo sanitization.
- Multer/Cloudinary for media uploads.
- Socket.io for real-time events.
- Node-cron for scheduled progression/reminder work.
- Stripe and Paystack payment integrations.
- Nodemailer/Brevo/SendGrid-compatible transactional email support.
- Swagger/OpenAPI documentation exposed by the API server.

### Data model

Primary entities include `User`, `School`, `Classroom`, `Topic`, `Assignment`, `Submission`, `Exam`, `ExamSubmission`, `Payment`, `CallSession`, `Attendance`, `Notification`, `QnA`, and settings/subscription/disbursement records.

Relationships are authorization-sensitive. Classroom ownership and school membership determine management access; enrollment and payment determine student access; published flags determine learner visibility.

## 7. API conventions

The API is mounted under `/api` and uses JSON responses with bearer authentication. Common resource patterns include:

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/classrooms
GET    /api/classrooms/:id
POST   /api/classrooms
PUT    /api/classrooms/:id
DELETE /api/classrooms/:id

GET    /api/topics/classroom/:classroomId
POST   /api/topics
PUT    /api/topics/:id
DELETE /api/topics/:id

GET    /api/assignments/classroom/:classroomId
POST   /api/assignments
PUT    /api/assignments/:id
PUT    /api/assignments/:id/publish
DELETE /api/assignments/:id
POST   /api/assignments/:id/submit

GET    /api/exams/class/:classId
POST   /api/exams
PUT    /api/exams/:id
DELETE /api/exams/:id

POST   /api/payments/paystack/initiate
GET    /api/payments/paystack/verify
POST   /api/payments/paystack/webhook
GET    /api/payments/history
```

Responses should use consistent status codes, actionable error messages, and never expose passwords, OTP secrets, payment secrets, or correct answers to unauthorized learners.

## 8. Security and privacy requirements

- Enforce authorization in backend routes; UI hiding is not a security boundary.
- Validate ownership, school membership, classroom assignment, enrollment, and publication state server-side.
- Hash passwords and expire verification/reset tokens.
- Rate-limit login, OTP, reset, payment, and public submission endpoints.
- Verify payment webhooks and protect against replay.
- Keep assessment correct answers out of student-facing responses before submission.
- Sanitize uploaded files and restrict file types and size.
- Store secrets only in environment variables or a managed secret store.
- Log security-sensitive events without logging credentials or payment data.
- Apply least privilege to root, school, teacher, and student operations.

## 9. Non-functional requirements

### Reliability

- API errors must be recoverable with retry where safe.
- Payment confirmation must be idempotent.
- Classroom and assessment publication actions must be idempotent.
- Scheduled jobs must tolerate retries and partial failures.

### Performance

- Paginate large classroom, user, payment, submission, and notification lists.
- Index classroom IDs, school IDs, user IDs, publication flags, payment references, and timestamps.
- Avoid blocking startup on optional notifications or analytics.
- Keep mobile screens responsive while loading parallel classroom resources.

### Accessibility and usability

- Use clear labels, sufficient contrast, touch targets, keyboard support on web, and accessible roles for selectors and actions.
- Prefer dropdowns/toggles/selectors over ambiguous pill controls where a setting has one clear value.
- Show validation near the field and preserve user input on recoverable errors.

### Observability

- Capture structured server errors with correlation/request IDs.
- Track authentication, payment, publication, enrollment, and notification failures.
- Monitor API latency, job failures, websocket connection health, and mobile crash reports.

## 10. Key user journeys

### Teacher creates and publishes a class

1. Teacher signs in and passes email/subscription checks.
2. Teacher creates a classroom, selects level, access/payment settings, capacity, schedule, and assigned teacher if authorized.
3. Teacher adds and orders topics.
4. Teacher optionally activates the first topic and shares the class link.
5. Students discover or receive the link, pay if required, and enroll.

### Teacher creates an MCQ assignment

1. Teacher opens the classroom assignment tab.
2. Teacher adds the question and option text.
3. Teacher taps the check icon beside the correct option.
4. Teacher sets due date and result release datetime.
5. Teacher saves and publishes the assignment.
6. Students see it only after publication and submit their responses.

### Student completes an exam

1. Student opens a published exam available to their account or open link.
2. The app shows due date, duration, and access requirements.
3. Student answers questions and submits before the deadline.
4. The system records the attempt and exposes results according to the configured release time.

### Student pays for a class

1. Student selects a paid classroom or topic.
2. The app initiates Paystack or Stripe payment.
3. Provider callback/webhook is verified by the backend.
4. Payment history is created and enrollment/access is granted.
5. The student receives confirmation and can open the classroom.

## 11. Environment and operations

Required configuration varies by deployment but typically includes:

```env
PORT=5000
MONGODB_URI=<mongodb connection string>
JWT_SECRET=<secret>
STRIPE_SECRET_KEY=<secret>
PAYSTACK_SECRET_KEY=<secret>
SMTP_HOST=<smtp host>
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
EXPO_PUBLIC_API_URL=<api url for mobile>
VITE_API_URL=<api url for web>
```

Local development runs the backend, frontend, and mobile clients independently. The mobile client must use a LAN-reachable API URL when running on a physical device and an emulator-compatible URL when running on Android emulator.

## 12. Release acceptance checklist

- All roles can only see and perform permitted actions.
- Unverified and pending-onboarding users are routed through verification correctly.
- Students never see unpublished classes, assignments, or exams.
- Teachers/admins can manage drafts and publish content.
- MCQ correct answers are selected from options and are not exposed to students before submission.
- Payment records show reference, payer, purpose, class/topic/subscription, status, and date.
- Light and dark themes have readable text, controls, icons, and buttons.
- Mobile deep links return to the appropriate app screen after external/web collaboration.
- Uploads, notifications, payment webhooks, and scheduled jobs are tested in staging.
- API errors, loading states, empty states, and retry flows are present on web and mobile.

## 13. Product roadmap

### Near term

- Finish parity review between web and mobile for every role and module.
- Add automated API authorization tests and mobile smoke tests.
- Improve offline caching and retry behavior on mobile.
- Add richer assessment analytics and teacher dashboards.
- Standardize design tokens and accessibility checks across surfaces.

### Medium term

- Native animated light/dark mobile splash experience.
- Expanded AI action linking with reviewable drafts and audit history.
- More granular subscriptions, coupons, invoices, refunds, and payout reporting.
- Calendar synchronization and richer attendance reporting.

### Long term

- Multi-language support.
- Adaptive learning and personalized recommendations.
- Content marketplace and institution-to-institution sharing.
- Data warehouse/reporting exports and configurable retention policies.

