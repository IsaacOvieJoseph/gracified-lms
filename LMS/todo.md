# Tutor Request Module — TODO

Closed-loop feature: Student requests a tutor → Root admin communicates → Referral connects student to a real tutor.

## Backend
- [x] `backend/models/TutorRequest.js` — model with status lifecycle (`open`, `in_progress`, `resolved`, `rejected`), message thread, and referral fields
- [x] `backend/models/Notification.js` — added `tutor_request`, `tutor_request_message`, `tutor_request_resolved` types + `TutorRequest` entityRef
- [x] `backend/routes/tutorRequests.js` — endpoints:
  - `GET /suggestions` (student) — AI-style suggestions from active personal tutors + student's class data
  - `POST /` (student) — submit request, notifies all root admins
  - `GET /mine` (student), `GET /` (root admin), `GET /:id` (owner/admin, marks thread read)
  - `POST /:id/messages` — closed-loop chat between student and admin
  - `PUT /:id/status` (admin), `PUT /:id/referral` (admin resolves loop, notifies student)
- [x] `backend/server.js` — register `/api/tutor-requests` route + model

## Backend — Student ↔ Tutor linking
- [x] `backend/models/User.js` — added `personalTeacherId` link field on student
- [x] `backend/models/TutorRequest.js` — thread now 3-party: `senderRole` includes `personal_teacher`, added `readByTutor`
- [x] `backend/routes/tutorRequests.js`:
  - `GET /referred` (personal_teacher) — list students matched to me
  - `GET /:id` + `POST /:id/messages` — referred tutor participates in the thread, notifications go to the right parties
  - `PUT /:id/referral` — platform referral now links `student.personalTeacherId` and pushes a notification to the tutor

## Mobile (Student)
- [x] `mobile/src/screens/tutors/TutorRequestScreen.js` — hub screen: AI-suggested tutors cards, "Request a Tutor" form (subject, description, urgency, schedule), My Requests list with status badges
- [x] `mobile/src/screens/tutors/TutorRequestDetailScreen.js` — role-aware thread chat, referral card when resolved
- [x] `mobile/src/navigation/AppNavigator.js` — register both screens
- [x] `mobile/src/screens/dashboard/DashboardScreen.js` — student entry point ("Find a Tutor")

## Mobile (Personal Tutor)
- [x] `mobile/src/screens/tutors/TutorReferralsScreen.js` — referrals list with unread count → shared role-aware thread
- [x] `mobile/src/navigation/AppNavigator.js` — `TutorReferrals` screen registered
- [x] `mobile/src/screens/dashboard/DashboardScreen.js` — "Student Referrals" portal for personal_teacher
- [x] `mobile/src/screens/notifications/NotificationsScreen.js` — tapping a tutor-request notification routes students to the request and tutors to referrals

## Web (Root Admin)
- [x] `frontend/src/pages/TutorRequests.jsx` — admin management: filterable list, request detail with chat thread, referral form (platform tutor or external) that closes the loop
- [x] `frontend/src/App.jsx` — add `/tutor-requests` route (PrivateRoute)
- [x] `frontend/src/components/Layout.jsx` — sidebar link under root_admin section
- [x] `TutorRequests.jsx` — unread badge counts tutor + student messages

## Web (Student)
- [x] `frontend/src/pages/StudentTutorRequests.jsx` — student portal: AI-suggested tutors, request form, My Requests list with status, role-aware thread + referral card
- [x] `frontend/src/App.jsx` — add `/find-tutor` route (PrivateRoute) for students
- [x] `frontend/src/components/Layout.jsx` — sidebar link for students ("Find a Tutor")

## Web (Personal Tutor)
- [x] `frontend/src/pages/TutorReferrals.jsx` — referrals list with unread count, student email link, role-aware thread chat
- [x] `frontend/src/App.jsx` — `/tutor-referrals` route
- [x] `frontend/src/components/Layout.jsx` — "Student Referrals" sidebar for personal_teacher

## Backend — Two-path marketplace (admin-match + direct)
- [x] `backend/models/TutorRequest.js` — `mode` (`admin`|`direct`), `published`, `applications[]` subdocs (`tutorId`, `message`, `status`, `messages[]` with `readByTutor`/`readByAdmin`, `appliedAt`, `reviewedAt`); referral gains `classroomId`, `classroomName`, `classUrl`; index `{published:1,status:1,createdAt:-1}`
- [x] `backend/models/Notification.js` — added `tutor_application` to type enum
- [x] `backend/routes/tutorRequests.js` — `GET /published` (tutor browse, hides student identity, `myApplication`, marks admin msgs read), `POST /:id/apply`, `POST /:id/applications/:appId/messages` (private admin↔tutor), `PUT /:id/applications/:appId/status` (accept matches + auto-picks/uses class + links `User.personalTeacherId` + declines others; decline notifies), `GET /:id/applications/:appId/tutor-classes`, `POST /direct` (student pick, reuse flood rule), `PUT /:id/class-link` (tutor shares class → resolved), `PUT /:id/publish`; list/detail populate applications + referral.classroomId; `POST /:id/messages` only notifies admins when mode admin

## Web — Marketplace
- [x] `frontend/src/pages/StudentTutorRequests.jsx` — direct chat via `POST /tutor-requests/direct`, "Chat with {name}" on suggestion cards, "Direct" chip, resolved referral card with class name + "Join Your New Class" (navigates classUrl)
- [x] `frontend/src/pages/TutorRequests.jsx` (admin) — Publish/Unpublish header button, "Tutor Applicants" panel with expandable private chat + Match/Decline, class-picker modal (`GET .../tutor-classes` → `PUT .../status`)
- [x] `frontend/src/pages/TutorReferrals.jsx` — tabs: Browse Requests (apply + inline private admin chat + status chips) and My Students (with "Share Your Class" → `GET /classrooms` + `PUT /:id/class-link`)

## Mobile — Marketplace
- [x] `mobile/src/screens/tutors/TutorRequestScreen.js` — suggestion "chat" → `POST /tutor-requests/direct`, opens TutorRequestDetail
- [x] `mobile/src/screens/tutors/TutorRequestDetailScreen.js` — role-aware (student/tutor/admin); resolved referral card + "Join Your New Class" (navigates ClassroomDetail)
- [x] `mobile/src/screens/tutors/TutorReferralsScreen.js` — tabs: Browse Requests (apply + private admin chat) and My Students (Share Class picker → `PUT /:id/class-link`)
- [x] `mobile/src/navigation/AppNavigator.js` — screens registered
- [x] Mobile detail/navigator/notifications role-aware routing

## Verification
- [x] Syntax-check all new/modified files (backend `node --check`, frontend + mobile esbuild)