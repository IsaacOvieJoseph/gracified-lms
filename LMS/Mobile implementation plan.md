Gracified LMS — Mobile App Implementation Plan
Overview
Build a React Native (Expo) cross-platform mobile app for Gracified LMS targeting both Students and Teachers. The app will share the same backend API as the existing web app (JWT-based REST API + Socket.io) but deliver a native mobile experience with platform-appropriate UI patterns.

The mobile app will live at LMS/mobile/ as a standalone Expo project.

User Review Required
IMPORTANT

Backend URL: The mobile app will need the production backend URL in its .env. The existing backend is deployed on Render. You'll need to confirm the live API URL so it can be pre-configured (e.g. https://gracified-lms-api.onrender.com/api).

IMPORTANT

Paystack on Mobile: Paystack's inline JS widget does not work natively. The mobile app will use a WebView to redirect to Paystack's hosted checkout page (https://checkout.paystack.com/{access_code}), then intercept the callback URL to verify payment. This is the standard mobile approach.

WARNING

Whiteboard (WebRTC): Full WebRTC + Canvas whiteboard on React Native requires significant native modules. The plan is to embed the existing web whiteboard in a WebView within the app. This covers the feature without native complexity, but the user must be online.

Open Questions
NOTE

Should the mobile app support push notifications (FCM/APNs) for assignment/enrollment events? This would require Expo Push Notifications and a small backend update to store Expo push tokens. If not, in-app polling is a simpler fallback.

Proposed Changes
1. Mobile App — New Project
[NEW] LMS/mobile/ — Expo React Native project
The entire mobile app will be a new directory at LMS/mobile/ initialized with npx create-expo-app.

Project Structure

LMS/mobile/
├── app.json                    # Expo config (name, icons, splash screen, scheme)
├── package.json
├── babel.config.js
├── .env                        # API URL, Paystack public key
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
└── src/
    ├── api/
    │   └── api.js              # Axios instance (AsyncStorage-based token)
    ├── context/
    │   ├── AuthContext.jsx     # JWT + AsyncStorage (mirrors web AuthContext)
    │   └── ThemeContext.jsx    # Dark/light mode
    ├── navigation/
    │   ├── AppNavigator.jsx    # Root navigator (auth guard)
    │   ├── AuthStack.jsx       # Login, Register, VerifyEmail, ForgotPassword
    │   └── MainTabs.jsx        # Bottom tab navigator (Dashboard, Classes, Exams, Profile)
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.jsx
    │   │   ├── RegisterScreen.jsx       # Role choice
    │   │   ├── RegisterStudentScreen.jsx
    │   │   ├── RegisterTeacherScreen.jsx
    │   │   ├── VerifyEmailScreen.jsx
    │   │   └── ForgotPasswordScreen.jsx
    │   ├── dashboard/
    │   │   └── DashboardScreen.jsx      # Role-adapted: stats, quick links
    │   ├── classrooms/
    │   │   ├── ClassroomsScreen.jsx     # List + filter (by level, price)
    │   │   ├── ClassroomDetailScreen.jsx # Topics, enroll, assignments
    │   │   └── TopicDetailScreen.jsx    # Materials, recorded videos
    │   ├── assignments/
    │   │   ├── AssignmentsScreen.jsx    # List view (due, submitted, graded)
    │   │   └── AssignmentDetailScreen.jsx # View + submit (text/file upload)
    │   ├── exams/
    │   │   ├── ExamsScreen.jsx          # List
    │   │   └── ExamCenterScreen.jsx     # Take exam (timed, MCQ + theory)
    │   ├── payments/
    │   │   ├── PaymentsScreen.jsx       # Payment history
    │   │   └── PaystackWebViewScreen.jsx # WebView checkout
    │   ├── qna/
    │   │   └── QnACenterScreen.jsx      # Submit questions to Q&A board
    │   ├── whiteboard/
    │   │   └── WhiteboardScreen.jsx     # WebView wrapping web whiteboard URL
    │   ├── notifications/
    │   │   └── NotificationsScreen.jsx  # In-app notification list
    │   └── profile/
    │       └── ProfileScreen.jsx        # Edit profile, 2FA, bank account
    ├── components/
    │   ├── ui/
    │   │   ├── Button.jsx
    │   │   ├── Input.jsx
    │   │   ├── Card.jsx
    │   │   ├── Badge.jsx
    │   │   ├── Avatar.jsx
    │   │   ├── LoadingSpinner.jsx
    │   │   └── EmptyState.jsx
    │   ├── ClassroomCard.jsx
    │   ├── AssignmentCard.jsx
    │   ├── NotificationItem.jsx
    │   └── TopicCard.jsx
    ├── hooks/
    │   ├── useApi.js           # Generic fetch hook with loading/error state
    │   └── useNotifications.js # Poll in-app notifications
    └── utils/
        ├── storage.js          # AsyncStorage wrappers
        ├── currency.js         # NGN formatting
        └── colors.js           # Design tokens (primary palette)
2. Key Technical Decisions
Authentication
Mirrors the web AuthContext exactly.
Uses AsyncStorage (via @react-native-async-storage/async-storage) instead of localStorage.
JWT stored in AsyncStorage, set as default Axios header on app boot.
GET /api/auth/me called on boot to verify token validity.
2FA handled: if requiresVerification: true → navigate to OTP screen.
Navigation
React Navigation v6 with:
Stack.Navigator for auth screens
Tab.Navigator (bottom tabs) for the main app
Nested Stack.Navigators for each tab's sub-screens
API
Shared Axios instance at src/api/api.js pointing to EXPO_PUBLIC_API_URL.
Interceptors: attach Bearer token, handle 401 → logout, handle network errors with Alert.
Payments
Paystack: open WebView with https://checkout.paystack.com/{access_code}.
Listen for redirect URL to /payments/verify → extract reference → call backend verify endpoint.
Whiteboard
WebView loading {WEB_APP_URL}/classrooms/:classId/whiteboard?token={jwt}.
Teacher passes JWT as query param for auth inside the WebView session.
Real-time / Socket.io
socket.io-client for notifications and QnA board updates.
Socket connected after login, disconnected on logout.
Styling
No Tailwind on mobile. Use StyleSheet API with a centralized colors.js design token file.
Dark mode via React Native Appearance API + ThemeContext.
Typography: Expo Google Fonts (@expo-google-fonts/inter).
3. Dependencies
json

{
  "expo": "~51.x",
  "react-native": "0.74.x",
  "react-navigation/native": "^6",
  "react-navigation/bottom-tabs": "^6",
  "react-navigation/stack": "^6",
  "@react-native-async-storage/async-storage": "^1",
  "axios": "^1",
  "socket.io-client": "^4",
  "react-native-webview": "^13",
  "expo-image-picker": "^15",
  "expo-document-picker": "^12",
  "expo-google-fonts/inter": "latest",
  "expo-font": "^12",
  "expo-status-bar": "~1",
  "expo-constants": "~16",
  "react-native-safe-area-context": "^4",
  "react-native-screens": "~3",
  "date-fns": "^2"
}
4. Screens by Role
Screen	Student	Teacher
Login / Register	✅	✅
Dashboard	Stats: enrolled classes, pending assignments	Stats: classrooms, pending grading
Classrooms List	Browse & filter public classrooms	My classrooms list
Classroom Detail	Topics, enroll button, assignments tab	Topics management, assignments tab
Topic Detail	Materials, recorded videos	Same + activate/complete controls
Assignments	View assigned, submit	View submissions, grade
Exams	Take exam (timed)	View + manage exam results
Payments	History + Paystack checkout	History
Q&A Board	Submit questions	View questions, moderate
Whiteboard	View session (WebView)	Host session (WebView)
Notifications	In-app list	In-app list
Profile	Edit info, 2FA	Edit info, bank account, 2FA
Verification Plan
Automated
Run npx expo start to confirm the dev server boots without errors.
Check TypeScript/JS errors with npx expo lint.
Manual Verification
Login → verify JWT stored, /auth/me called.
Student registers and verifies email OTP.
Student browses classrooms and enrolls (with Paystack WebView).
Student views topics, materials, and submits an assignment.
Teacher logs in → sees dashboard with classroom stats.
Teacher activates/completes a topic from Classroom Detail screen.
Teacher grades a student submission.
Both roles receive in-app notifications.
Whiteboard opens correctly in WebView.
Logout clears AsyncStorage and redirects to login.