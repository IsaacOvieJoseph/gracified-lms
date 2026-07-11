Task Checklist: Gracified LMS Mobile Parity & Polish

Backend Enhancements
- [x] Add expoPushToken field to User model (backend/models/User.js)
- [x] Create push notification utility (backend/utils/pushNotifications.js)
- [x] Create API route to save user's Expo push token (POST /api/users/expo-token)
- [x] Add Mongoose lifecycle hooks to Notification model to trigger push notifications (backend/models/Notification.js)

Mobile App Environment & Dependencies
- [x] Create .env file in the mobile directory
- [x] Install required Expo packages (react-native-webview, expo-notifications, expo-device)
- [x] Update mobile/src/context/AuthContext.js to expose setUser and setToken

Screen Implementations & Styling Fixes
- [x] Build VerifyEmailScreen.js (email verification OTP check)
- [x] Build ForgotPasswordScreen.js (forgot password OTP reset)
- [x] Update AppNavigator.js to integrate all routing guards and screens
- [x] Fix compiler and UI errors in ClassroomsScreen.js (add missing StyleSheet styles)
- [x] Polish DashboardScreen.js and add Notifications indicator
- [x] Update ClassroomDetailScreen.js with curriculum topics, assignments list, exams list, whiteboard button, Q&A button, and Paystack buy button
- [x] Build TopicDetailScreen.js (view outlines, resources, videos)
- [x] Build AssignmentsScreen.js (list assignments)
- [x] Build AssignmentDetailScreen.js (view details, submit answers / grade submissions)
- [x] Build ExamsScreen.js (list exams)
- [x] Build ExamCenterScreen.js (timed MCQ + theory exam taking)
- [x] Build PaymentsScreen.js (payout configurations & transaction logs)
- [x] Build PaystackWebViewScreen.js (handle Paystack inline checkout & callback redirection)
- [x] Build QnACenterScreen.js (WebView real-time Q&A container)
- [x] Build WhiteboardScreen.js (WebView collaborative canvas WebRTC container)
- [x] Build NotificationsScreen.js (in-app messages checklist)

Verification
- [x] Run compiler check and ensure the app starts cleanly
- [x] Confirm backend integrates correctly with the mobile screens