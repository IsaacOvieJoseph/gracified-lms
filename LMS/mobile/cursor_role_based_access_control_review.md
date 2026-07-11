# Role-based access control review
_Exported on 7/11/2026 at 10:41:52 GMT+1 from Cursor (3.1.17)_

---

**User**

Explore the web frontend at c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS to understand role-based access control and CTAs (call-to-actions).

Find:
1. How roles are defined: student, teacher, personal_teacher, school_admin, root_admin
2. Route guards / protected routes per role
3. What each role can see and do on: dashboard, classrooms, assignments, exams, payments, profile, admin features
4. CTA visibility logic (buttons, links, actions) conditioned on role
5. Any utility hooks/functions like useAuth, canManage, isStudent, role checks

Search in frontend/, src/, client/, web/ or similar directories.

Return: file paths, key functions, role permission matrix (role x feature x allowed actions), and code patterns used.

---

**Cursor**

I'll explore the web frontend for role definitions, route guards, and CTA visibility logic.


# Web Frontend RBAC & CTA Analysis

The web app lives under `c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\frontend\src\`. There is **no centralized permissions module** — RBAC is implemented with inline `user?.role` checks scattered across pages and `Layout.jsx`.

---

## 1. How Roles Are Defined

**Canonical enum** (backend source of truth, mirrored in frontend):

```22:26:c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\backend\models\User.js
  role: {
    type: String,
    enum: ['student', 'teacher', 'school_admin', 'personal_teacher', 'root_admin'],
    default: 'student',
  },
```

| Role | How users get it |
|------|------------------|
| `student` | `RegisterStudent.jsx` → `POST /auth/register` with `role: 'student'` |
| `school_admin` | `RegisterSchoolAdmin.jsx` → `role: 'school_admin'` |
| `personal_teacher` | `RegisterPersonalTeacher.jsx` → `role: 'personal_teacher'` |
| `teacher` | Created by `school_admin` / `root_admin` via Users page (not self-registration) |
| `root_admin` | Created only by `root_admin` via Users page |

**Auth state**: `c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\frontend\src\context\AuthContext.jsx`
- `useAuth()` returns `{ user, loading, login, logout, refreshUser, platformSettings, ... }`
- `user.role` is a string; no role helpers (`isStudent`, `canManage`, etc.) exist in context

---

## 2. Route Guards / Protected Routes

### Global guard: `PrivateRoute` in `App.jsx`

```48:77:c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\frontend\src\App.jsx
const PrivateRoute = ({ children }) => {
  const { user, loading, platformSettings } = useAuth();
  // ... loading spinner ...
  if (!user) return <Navigate to="/login" />;
  if (!user.isVerified && user.role !== 'root_admin') {
    return <Navigate to="/verify-email" state={{ email: user.email }} />;
  }
  if (isCheckingEnabled && (user.role === 'school_admin' || user.role === 'personal_teacher') && user.trialExpired) {
    return <Navigate to="/subscription-management" state={{ email: user.email }} />;
  }
  return children;
};
```

**Checks applied to all `PrivateRoute` pages:**
1. Must be logged in
2. Must be email-verified (**except** `root_admin`)
3. `school_admin` / `personal_teacher` with expired trial → redirect to `/subscription-management` (when subscription checking is enabled)

**There are NO per-role route wrappers** — every authenticated role can hit any `PrivateRoute` URL directly; enforcement is via nav hiding + page-level UI + backend APIs.

### Public routes (no auth)
`/login`, `/register/*`, `/c/:shortCode`, `/s/:identifier`, `/exam-center/:token`, `/qna/:token`, `/shared-script/:shareToken`, `/forgot-password`, `/set-password`, `/subscription-management` (special case)

### Page-level role guards (only these)
| Page | Guard |
|------|-------|
| `Disbursements.jsx` | `user?.role !== 'root_admin'` → "Access Denied" |
| `SubscriptionManagement.jsx` | Only `school_admin` / `personal_teacher` |

**No frontend guard** on: `PlatformSettings`, `Feedbacks`, `Marketing`, `AdminSubscriptionPlans`, `Users`, `Schools` — hidden from nav for non-admins but reachable by URL.

### Subscription overlay (not route-level)
`Layout.jsx` blocks non-dashboard pages for expired `school_admin` / `personal_teacher` via `SubscriptionBlockBanner` (dashboard still accessible).

---

## 3. Navigation Visibility (`Layout.jsx`)

```105:121:c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\frontend\src\components\Layout.jsx
  const navItems = [
    { path: '/dashboard', ... },      // ALL roles
    { path: '/classrooms', ... },     // ALL roles
  // Payments: student, root_admin, school_admin, teacher, personal_teacher
    { path: '/exams', ... },          // ALL roles
  // Assignments: student ONLY
  // Users: root_admin, school_admin, teacher, personal_teacher
    { path: '/reports', ... },        // ALL roles
  // Schools: root_admin, school_admin
  // root_admin only: disbursements, subscription-plans-admin, feedbacks, platform-settings, marketing
  ];
```

| Nav item | student | teacher | personal_teacher | school_admin | root_admin |
|----------|---------|---------|------------------|--------------|------------|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Classrooms | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payments | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exams | ✓ | ✓ | ✓ | ✓ | ✓ |
| Assignments | ✓ | — | — | — | — |
| Users | — | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| Schools | — | — | — | ✓ | ✓ |
| Disbursements | — | — | — | — | ✓ |
| Subscription Plans | — | — | — | — | ✓ |
| Feedbacks | — | — | — | — | ✓ |
| Platform Settings | — | — | — | — | ✓ |
| Marketing | — | — | — | — | ✓ |

**Note:** Teachers manage assignments inside Classroom Detail, not via the Assignments nav link.

---

## 4. Role × Feature Permission Matrix

Legend: **V** = view, **C** = create, **E** = edit, **D** = delete, **G** = grade/manage, **—** = no access / hidden

### Dashboard (`Dashboard.jsx`)
| Role | See | Actions |
|------|-----|---------|
| student | Own enrolled classes, schedule, payment count, assignment count | Enter classrooms |
| teacher | Published classes they teach, student counts | Enter classrooms |
| personal_teacher | Own classes, student counts | Enter classrooms |
| school_admin | Classes filtered by selected schools, all students in scope | Enter classrooms; school switcher |
| root_admin | All classrooms & students | Enter classrooms |

Students/teachers only see **published** classrooms; admins see unpublished too.

### Classrooms (`Classrooms.jsx`, `ClassroomDetail.jsx`)
| Role | List | Create class | Publish/unpublish | Delete | Edit | Manage students | Start meeting | Whiteboard |
|------|------|--------------|-------------------|--------|------|-----------------|---------------|------------|
| student | Browse + enroll | — | — | — | — | — | — (join if enrolled) | If enabled |
| teacher | Own + assigned | ✓ | Own class | Own class | Own class | — | Own class | Teacher/admin |
| personal_teacher | Own | ✓ | Own | Own | Own | Own classes | Own | Teacher/admin |
| school_admin | School-scoped | ✓ + assign teacher | School classes | School classes | School classes of their schools | School classes | School admin of class | Admin |
| root_admin | All | ✓ | All | All | All | All | All | Admin |

**Key computed flags** in `ClassroomDetail.jsx`:
- `canEdit` — root_admin, school admin of class, or owning teacher/personal_teacher
- `canManageStudents` — root_admin, school admin of class, or owning personal_teacher
- `canChangeTeacher` — root_admin only (non-personal-teacher classes)
- `canViewStudents` — teachers of class + canManageStudents + root_admin
- Student CTAs: Enroll, Pay (if paid), Submit assignments, View graded work

### Assignments (`Assignments.jsx` + embedded in `ClassroomDetail.jsx`)
| Role | Nav link | View | Submit | Create | Edit/delete | Grade | Notify |
|------|----------|------|--------|--------|-------------|-------|--------|
| student | ✓ | Own submissions | ✓ (topic paywall check) | — | — | — | — |
| teacher | — (classroom only) | Classes they teach | — | ✓ | Own classes (`canManageAssignment`) | Own classes | ✓ |
| personal_teacher | — | Own classes | — | ✓ | Own classes | Own classes | ✓ |
| school_admin | — | School classes | — | ✓ | School overlap | ✓ | ✓ |
| root_admin | — | All | — | ✓ | All | All | ✓ |

Helpers:
```271:290:c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\frontend\src\pages\Assignments.jsx
const canCreateAssignment = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);
const canGradeAssignment = ['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role);
const canManageAssignment = (assignment) => { /* root → true; school_admin → school overlap; teacher → owns class */ };
```

### Exams (`Exams.jsx`, `ExamCreator.jsx`, `ExamCenter.jsx`)
| Role | View list | Take exam | Create/edit/delete | Copy link | View submissions |
|------|-----------|-----------|-------------------|-----------|------------------|
| student | Assigned exams | ✓ (`Take Exam` / `View Score`) | — | — | — |
| teacher | All (API-filtered) | — | ✓ | ✓ | ✓ |
| personal_teacher | All | — | ✓ | ✓ | ✓ |
| school_admin | All | — | ✓ | ✓ | ✓ |
| root_admin | All | — | ✓ | ✓ | ✓ |

Student vs staff UI split: `user.role === 'student'` vs `user.role !== 'student'` for header, stats, and action buttons.

### Payments (`Payments.jsx`)
| Role | Nav | View history | Pay (enrollment/topic) | See net payout column |
|------|-----|--------------|------------------------|----------------------|
| student | ✓ | Own payments | ✓ (Paystack modal) | — |
| teacher | ✓ | Revenue from their classes (API) | — | ✓ |
| personal_teacher | ✓ | Own tutorial revenue | — | ✓ |
| school_admin | ✓ | School revenue | — | ✓ |
| root_admin | ✓ | Platform-wide | — | ✓ |

### Profile (`Profile.jsx`)
| Role | Avatar | Institution logo | Bank/payout details | 2FA toggle |
|------|--------|------------------|---------------------|------------|
| student | ✓ | — | — | ✓ |
| teacher | ✓ | — | — | ✓ |
| school_admin | — (logo instead) | ✓ school logo | ✓ | ✓ |
| personal_teacher | — (logo instead) | ✓ tutorial logo | ✓ | ✓ |
| root_admin | ✓ | — | — | Hidden (mandatory 2FA assumed) |

```200:201:c:\Users\Hp\Desktop\LMS\Gracified-Learning-Management-System\LMS\frontend\src\pages\Profile.jsx
const canEditBankDetails = user?.role === 'school_admin' || user?.role === 'personal_teacher';
const canEditLogo = user?.role === 'school_admin' || user?.role === 'personal_teacher';
```

### Admin features
| Feature | File | Who sees nav | Page guard | Capabilities |
|---------|------|--------------|------------|--------------|
| Users | `Users.jsx` | staff roles | None | Teachers: view own students only. school_admin/root: create, bulk upload, delete (school_admin: only users they created). root_admin: can assign `school_admin`/`root_admin` roles |
| Schools | `Schools.jsx` | school_admin, root_admin | `canManage` / `canCreateSchool` | root: all schools + tutorial centers; school_admin: own schools |
| Disbursements | `Disbursements.jsx` | root_admin | **root_admin only** | Approve pending payouts |
| Platform Settings | `PlatformSettings.jsx` | root_admin | None | Tax rates, subscription toggle, AI provider |
| Subscription Plans | `AdminSubscriptionPlans.jsx` | root_admin | None | CRUD plans, grant free access |
| Feedbacks | `Feedbacks.jsx` | root_admin | None | View/manage feedback |
| Marketing | `Marketing.jsx` | root_admin | None | Contacts, campaigns, templates |
| Reports | `Reports/index.jsx` | All | Role-based component switch | StudentReport / TeacherReport / SchoolAdminReport / RootAdminReport |

### Users page role creation limits
- **school_admin** can create: `student`, `teacher`, `personal_teacher`
- **root_admin** can additionally create: `school_admin`, `root_admin`

---

## 5. CTA Visibility Patterns

### Pattern A: Role array includes
```javascript
['root_admin', 'school_admin', 'teacher', 'personal_teacher'].includes(user?.role)
```
Used for: create classroom, create assignment, grade, users nav, payments nav.

### Pattern B: Single role equality
```javascript
user?.role === 'student'
user?.role !== 'student'
user?.role === 'root_admin'
```

### Pattern C: Ownership + role (classroom-scoped)
```javascript
user?.role === 'teacher' && classroom?.teacherId?._id === user?._id
user?.role === 'school_admin' && isSchoolAdminOfClass
```

### Pattern D: Named boolean helpers (page-local, not shared)
| Helper | File | Logic |
|--------|------|-------|
| `canCreate` | `Classrooms.jsx` | staff roles |
| `canCreateAssignment` | `Assignments.jsx` | staff roles |
| `canManageAssignment(assignment)` | `Assignments.jsx` | root / school overlap / teacher owns class |
| `canEdit`, `canManageStudents`, `canChangeTeacher` | `ClassroomDetail.jsx` | composite ownership |
| `canManage`, `canCreateSchool` | `Schools.jsx` | root_admin, school_admin |
| `canEditBankDetails`, `canEditLogo` | `Profile.jsx` | school_admin, personal_teacher |
| `isAdmin` | `QnACenter.jsx` | teacher, personal_teacher, root_admin, school_admin |
| `isTeacher` | `Whiteboard.jsx` | teacher, personal_teacher, school_admin, root_admin |

### Pattern E: Subscription gating
- `PrivateRoute` trial redirect → `/subscription-management`
- `Layout.jsx` `shouldBlock` + `SubscriptionBlockBanner` for expired school_admin/personal_teacher
- `TopicManagement.jsx` premium upload: `root_admin` OR `subscriptionPlan.name === 'Premium'`

### Pattern F: Student-only payment CTAs
- `PaymentRequiredModal.jsx` — topic paywall (student flow)
- `ClassroomDetail.jsx` — enroll/pay buttons when `user?.role === 'student'`
- `TopicDisplay.jsx` — paid topic UI hidden from staff roles

---

## 6. Utility Hooks / Functions

| Symbol | Location | Purpose |
|--------|----------|---------|
| `useAuth()` | `context/AuthContext.jsx` | User session; **no role helpers** |
| `AuthProvider` | same | login, logout, `refreshUser`, `platformSettings` |
| `PrivateRoute` | `App.jsx` | Auth + verify + trial redirect |
| `SchoolSwitcher` | `components/SchoolSwitcher.jsx` | **school_admin only** — multi-school filter |
| `OnboardingTour` | `components/OnboardingTour.jsx` | Role-specific tour steps (`student`, `school_admin`, `teacher_common`) |
| `ROLE_STEPS` | `OnboardingTour.jsx` | Per-role onboarding content |

**No shared utilities** like `canManage()`, `isStudent()`, `hasRole()`, or a permissions constants file exist in `frontend/src/utils/`.

---

## 7. Key File Index

| Concern | Path |
|---------|------|
| Auth context + `useAuth` | `frontend\src\context\AuthContext.jsx` |
| Routing + `PrivateRoute` | `frontend\src\App.jsx` |
| Sidebar nav RBAC | `frontend\src\components\Layout.jsx` |
| Dashboard role stats | `frontend\src\pages\Dashboard.jsx` |
| Classrooms RBAC | `frontend\src\pages\Classrooms.jsx`, `ClassroomDetail.jsx` |
| Assignments RBAC | `frontend\src\pages\Assignments.jsx` |
| Exams RBAC | `frontend\src\pages\Exams.jsx` |
| Payments RBAC | `frontend\src\pages\Payments.jsx` |
| Profile RBAC | `frontend\src\pages\Profile.jsx` |
| Users admin | `frontend\src\pages\Users.jsx` |
| Schools admin | `frontend\src\pages\Schools.jsx` |
| Reports switch | `frontend\src\pages\Reports\index.jsx` |
| Disbursements guard | `frontend\src\pages\Disbursements.jsx` |
| Subscription gate | `frontend\src\pages\SubscriptionManagement.jsx`, `components\SubscriptionBlockBanner.jsx` |
| Registration roles | `RegisterStudent.jsx`, `RegisterSchoolAdmin.jsx`, `RegisterPersonalTeacher.jsx` |
| Backend role enum | `backend\models\User.js` |

---

## 8. Architecture Summary

```mermaid
flowchart TD
  A[User logs in] --> B[AuthContext stores user.role]
  B --> C{PrivateRoute}
  C -->|not logged in| D[/login]
  C -->|unverified & not root_admin| E[/verify-email]
  C -->|trial expired admin/PT| F[/subscription-management]
  C -->|pass| G[Page renders]
  G --> H[Layout navItems filtered by role]
  G --> I[Page-level user.role checks for CTAs]
  I --> J[Backend API enforces real authorization]
```

**Important gaps:**
1. **Security-through-obscurity** for admin pages — nav hidden but URLs not blocked (except Disbursements & SubscriptionManagement).
2. **Assignments page** is student-only in nav but fully supports staff actions if visited directly.
3. **teacher** and **personal_teacher** are often grouped; differences are mainly ownership (personal_teacher owns tutorial, can manage students) vs school-assigned teacher.
4. All real enforcement ultimately depends on **backend middleware** (`backend\middleware\auth.js`); frontend RBAC is presentation-layer only.

If you want this mapped to the mobile app or want a proposed centralized `permissions.js` module, switch to Agent mode and I can implement or document that next.

