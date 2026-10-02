# Mobile app role access review
_Exported on 7/11/2026 at 10:40:50 GMT+1 from Cursor (3.1.17)_

---

**User**

Explore the mobile app at c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\mobile to understand current role-based access and CTAs.

Find:
1. How roles are checked in screens (student, teacher, personal_teacher, school_admin, root_admin)
2. Navigation structure and what's shown per role
3. CTAs/buttons conditioned on role in: Dashboard, Classrooms, ClassroomDetail, Assignments, Exams, Payments, Profile
4. AuthContext user object and role fields
5. Gaps vs what a full LMS would need per role

Return: file paths, current role checks found, and what each screen currently allows per role.

---

**Cursor**

I'll explore the mobile app for role checks, navigation, and screen-level CTAs across the listed areas.


# Mobile App Role-Based Access Report

## Summary

Role handling is **decentralized and inconsistent**. There is **no shared role utility**, **no role-based navigation**, and **no route guards** beyond email verification. Most screens show the **same UI to every role**; meaningful RBAC exists mainly on **Classrooms**, **ClassroomDetail**, **AssignmentDetail**, **TopicDetail**, and **Profile**.

---

## 1. How Roles Are Checked

### AuthContext (`c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\mobile\src\context\AuthContext.js`)

- Stores `user`, `token`, `loading`
- Hydrates user from `GET /auth/me` on startup
- **No role helpers** — screens read `user?.role` directly

### Recurring pattern (duplicated in 4 files)

```javascript
const isTeacher = user?.role === 'teacher' || user?.role === 'personal_teacher' 
  || user?.role === 'school_admin' || user?.role === 'root_admin';
```

| File | Role checks |
|------|-------------|
| `mobile\src\navigation\AppNavigator.js` | `user.role !== 'root_admin'` for email verification bypass |
| `mobile\src\screens\classrooms\ClassroomsScreen.js` | `canCreate`, `canManageClassroom`, list filtering, student enroll CTAs, create-modal teacher/school pickers |
| `mobile\src\screens\classrooms\ClassroomDetailScreen.js` | `isTeacher`, `canManageClassroom()` |
| `mobile\src\screens\classrooms\TopicDetailScreen.js` | `isTeacher` for topic lifecycle CTAs |
| `mobile\src\screens\assignments\AssignmentDetailScreen.js` | `isTeacher` → grading vs student submit |
| `mobile\src\screens\profile\ProfileScreen.js` | `isTeacherOrAdmin` for bank payout form |
| `mobile\src\screens\dashboard\DashboardScreen.js` | `getRoleDisplayName()` only (display) |

### Screens with **no** role checks

- `AssignmentsScreen.js`, `ExamsScreen.js`, `PaymentsScreen.js`, `ExamCenterScreen.js`, `NotificationsScreen.js`, `WhiteboardScreen.js`, `QnACenterScreen.js`

---

## 2. Navigation Structure (same for all roles)

**File:** `c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\mobile\src\navigation\AppNavigator.js`

```
Unauthenticated → Login, Register, ForgotPassword, NetworkTest
Authenticated + unverified (except root_admin) → VerifyEmail only
Authenticated + verified:
  Bottom tabs: Dashboard | Classes | Profile
  Stack (reachable from anywhere): ClassroomDetail, TopicDetail, Assignments,
    AssignmentDetail, Exams, ExamCenter, Payments, PaystackWebView,
    QnACenter, Whiteboard, Notifications
```

**Per-role tab differences:** none. Every verified user sees the same 3 tabs and can deep-link to any stack screen.

---

## 3. Screen-by-Screen CTAs Per Role

### Dashboard — `mobile\src\screens\dashboard\DashboardScreen.js`

| Role | What they see / can do |
|------|------------------------|
| **All** | Role label, notifications bell, class count → Classes, assignment count → Assignments, live sessions info, portal links to Assignments & Exams |
| **All** | “Payments & Payouts” portal → navigates to **`Profile`**, not `Payments` (likely bug) |
| **No role-specific CTAs** | Same dashboard for student, teacher, admins |

---

### Classrooms — `mobile\src\screens\classrooms\ClassroomsScreen.js`

| Role | List scope | CTAs |
|------|------------|------|
| **student** | Published classrooms only; split “Your classes” / “Explore more” | **Enroll** / **Pay & Enroll** / **Open**; search & price filters |
| **teacher** | Own classrooms (`teacherId === user._id`) | **Create** classroom; **Publish/Unpublish**, **Delete** on owned classes |
| **personal_teacher** | Same as teacher | Same as teacher |
| **school_admin** | Classrooms in admin’s `schoolId`(s) | **Create**; manage (publish/delete) any in scope; create modal: **assign teacher**, **school visibility** |
| **root_admin** | All classrooms | **Create**; manage any; create modal: assign teacher & schools |

**Note:** `isClassOwner` is defined but unused; management uses `canManageClassroom`.

---

### ClassroomDetail — `mobile\src\screens\classrooms\ClassroomDetailScreen.js`

| Role | Access | CTAs |
|------|--------|------|
| **student** (not enrolled) | Hero + enrollment gate | **Enroll** / **Pay and enroll** |
| **student** (enrolled) | Full content | **Whiteboard**, **Q&A Board**, syllabus/assignments/exams tabs |
| **teacher** (class owner) | Bypasses enrollment (`isTeacher`) | Above + **Publish/Unpublish**, **Delete class**; Q&A as presenter |
| **teacher** (not owner) | Still bypasses enrollment | Live tools + content tabs; **no** publish/delete |
| **personal_teacher** | Same as teacher | Same |
| **school_admin** | Bypasses enrollment; `canManageClassroom` = true for all | Manage + full content on any class |
| **root_admin** | Same as school_admin | Same |

**Gap:** Any non-student role skips the enrollment gate, even for classes they do not own.

---

### Assignments — `mobile\src\screens\assignments\AssignmentsScreen.js`

| Role | Behavior |
|------|----------|
| **All** | Same list from `GET /assignments` (backend-scoped); filters: all/pending/submitted/graded; tap → detail |
| **No create/edit** | No role-based UI |

Detail screen (`AssignmentDetailScreen.js`):

| Role | CTAs |
|------|------|
| **student** | Answer MCQ/theory, **Submit assignment**; view graded feedback |
| **teacher, personal_teacher, school_admin, root_admin** | **Grade/Regrade** any submission; no ownership check |

---

### Exams — `mobile\src\screens\exams\ExamsScreen.js` + `ExamCenterScreen.js`

| Role | Behavior |
|------|----------|
| **All** | List exams from `GET /exams`; tap → **ExamCenter** to take exam |
| **No role checks** | No create/publish/grade UI on mobile |
| **ExamCenter** | Uses `user.name`/`user.email` only for `accessMode === 'open'` exams |

---

### Payments — `mobile\src\screens\payments\PaymentsScreen.js`

| Role | Behavior |
|------|----------|
| **All** | Read-only transaction history from `GET /payments/history` |
| **No role branching** | No student-only billing vs teacher payout views |

Paystack enrollment flow is triggered from Classrooms/ClassroomDetail (student path), not Payments.

---

### Profile — `mobile\src\screens\profile\ProfileScreen.js`

| Role | CTAs |
|------|------|
| **All** | Role badge, **Appearance** toggle, **Billing & Payment History** → Payments, **Notifications**, **Sign out** |
| **teacher, personal_teacher, school_admin, root_admin** | **Bank Payout Details** form (bank name, account number, account name) |
| **student** | No bank/payout section |

---

### Related (not in your list but role-aware)

**TopicDetail** (`TopicDetailScreen.js`): teacher/admin roles get **Activate topic** / **Mark as complete**.

---

## 4. AuthContext User Object & Role Fields

**Source:** `login` → `response.data.user`; hydrate → `GET /auth/me` → `response.data.user`

**Fields used in mobile:**

| Field | Used where |
|-------|------------|
| `_id` / `id` | Enrollment, submissions, ownership |
| `name`, `email` | Display, open exams |
| `role` | All RBAC checks |
| `isVerified` | AppNavigator gate |
| `enrolledClasses` | Classrooms enrollment state |
| `schoolId` | school_admin classroom filtering & create payload |
| `bankDetails` | Profile bank form defaults |

**Returned by API but largely unused in mobile:**

`profilePicture`, `tutorialId`, `subscriptionStatus`, `trialEndDate`, `subscriptionEndDate`, `defaultPricingType`, `payoutPreference`, `subscriptionPlan`, `twoFAEnabled`, `loginCount`

**Backend enum** (`backend\models\User.js`):  
`student | teacher | school_admin | personal_teacher | root_admin`

**Register** (`RegisterScreen.js`): `role` defaults to `'student'` with **no UI to pick role** — mobile registration is effectively student-only.

---

## 5. Gaps vs a Full LMS Per Role

### Cross-cutting

- No centralized `useRole()` / permission map; duplicated `isTeacher` logic
- No navigation or route guards by role (only email verification)
- Backend is assumed to enforce access; mobile UI does not mirror fine-grained permissions
- Subscription/trial expiry flags from API are ignored on mobile

### student

**Has:** explore/enroll, submit assignments, take exams, view payments, consume class content  
**Missing:** progress tracking, gradebook, calendar, direct Payments portal from dashboard, assignment creation, parent/guardian view, certificates, discussion forums beyond Q&A

### teacher / personal_teacher

**Has:** create/manage own classrooms, grade assignments (any class), topic activate/complete, bank details, whiteboard/Q&A presenter flag  
**Missing:** create assignments/exams/topics from mobile, class roster management, analytics, subscription/billing UI (`personal_teacher`), student invite, schedule management, file upload for materials, scoped grading (only own classes)

### school_admin

**Has:** school-scoped classroom list, create with teacher/school assignment, manage all classes in school, bank details  
**Missing:** user/teacher management, school settings, org-wide analytics, subscription management, approval workflows, bulk enroll, reports

### root_admin

**Has:** all classrooms, full create/manage, email verification bypass  
**Missing:** platform admin console (users, schools, settings, subscriptions, payouts oversight), 2FA login flow (enabled in backend), system configuration — effectively same app as school_admin with wider data scope

### Structural gaps

| Area | Current state |
|------|----------------|
| Admin dashboards | None |
| Content authoring (assignments, exams, topics) | Web/backend only |
| Role-specific home/dashboard | Display label only |
| Payments | One history view; no payouts dashboard for teachers |
| User management | None |
| 2FA / invite flows | Not implemented on mobile |
| Ownership checks | Weak — admins treated as teachers everywhere |

---

## Key File Paths

| Purpose | Path |
|---------|------|
| Auth state | `mobile\src\context\AuthContext.js` |
| Navigation | `mobile\src\navigation\AppNavigator.js` |
| Dashboard | `mobile\src\screens\dashboard\DashboardScreen.js` |
| Classrooms | `mobile\src\screens\classrooms\ClassroomsScreen.js` |
| Classroom detail | `mobile\src\screens\classrooms\ClassroomDetailScreen.js` |
| Assignments list | `mobile\src\screens\assignments\AssignmentsScreen.js` |
| Assignment detail | `mobile\src\screens\assignments\AssignmentDetailScreen.js` |
| Exams | `mobile\src\screens\exams\ExamsScreen.js` |
| Payments | `mobile\src\screens\payments\PaymentsScreen.js` |
| Profile | `mobile\src\screens\profile\ProfileScreen.js` |
| User model (backend) | `backend\models\User.js` |
| User API shape | `backend\routes\auth.js` (`/login`, `/me`) |

**Bottom line:** Mobile RBAC is **lightweight** — strongest on classroom CRUD/enrollment and assignment grading. Most features are **shared across roles** with backend filtering doing the real access control. A full LMS would need role-specific navigation, authoring tools, admin consoles, ownership-scoped actions, and subscription/2FA flows that the backend already partially supports but the mobile app does not surface.

