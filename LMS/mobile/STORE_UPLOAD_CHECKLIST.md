# Store Upload Checklist

Preparing the Gracified LMS mobile app (Expo SDK 57 / React Native 0.86) for release on **Google Play** and the **Apple App Store**.

**App:** Gracified LMS · version 1.0.0 · platform: Android + iOS
**Backend:** deployed on Render (HTTPS) · EAS project: `0023c05d-2ea5-4700-9fc2-1907c85914b9`
**Push stack:** Firebase Cloud Messaging (`@react-native-firebase/messaging`) + Notifee — **not** `expo-notifications`

Legend: `[ ]` = pending, `[x]` = done.

_Last audited against the repo: November 3, 2026._

---

## A. Developer Accounts & Legal

- [ ] Create Google Play Developer account ($25 one-time) — https://play.google.com/console
- [ ] Enroll in Apple Developer Program ($99/yr) — https://developer.apple.com/programs
- [x] Host a privacy policy at a public URL — web app serves `/privacy` and `/terms` (e.g. https://gracified-lms.vercel.app/privacy)
- [ ] Set a support/contact email shown on both stores — app defines `gracifiedlms@gmail.com` in `frontend/src/pages/Legal.jsx`; still needs to be entered in Play Console and App Store Connect
- [ ] Choose app category (Education) and complete content-rating questionnaire

## B. Backend & Server

- [ ] Point `EXPO_PUBLIC_API_URL` to the deployed Render **HTTPS** URL (set as an EAS build secret, not hardcoded) — local `mobile/.env` still points to `http://10.216.82.171/api` (LAN HTTP), which will not work in store builds
- [ ] Confirm Render instance stays awake (or use an always-on plan) to avoid launch timeouts
- [x] Confirm push-token endpoints exist — `POST/DELETE /users/push-token` with legacy `POST /users/expo-token` alias in `backend/routes/users.js`
- [ ] Verify push delivery works end-to-end from the production backend
- [x] Keep the API URL as an env var so the planned platform migration is seamless — `EXPO_PUBLIC_API_URL` (API) and `EXPO_PUBLIC_FRONTEND_URL` (links)

## C. App Config (`mobile/app.json`)

- [x] Add iOS `bundleIdentifier` — set to `com.isaac_joseph.gracifiedlmsmobile`
- [ ] Verify Android `package` matches what is registered in Play Console — set to `com.isaac_joseph.gracifiedlmsmobile`; confirm in Play Console before first upload (cannot change afterwards)
- [ ] Set a real 1024x1024 app `icon` — `assets/icon.png` is 1055x833 and no top-level `icon` key exists; `assets/favicon_adaptive.png` is 1024x1024 but is only used as the Android adaptive foreground
- [ ] Add iOS `infoPlist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` (image picker) — not present in `app.json`; verify whether the `expo-image-picker` config plugin adds usable defaults after prebuild
- [ ] Configure notification icon, color, and sound for Firebase Messaging/Notifee — `expo-notifications` is not installed; `App.js` creates the Android channel but sets no small icon/color/sound
- [x] Configure the `expo-splash-screen` plugin and verify splash image sizes — light/dark images configured in `app.json` (2048x2048 assets)
- [x] Confirm version/buildNumber auto-increment — `appVersionSource: remote` and production `autoIncrement: true` in `eas.json`

## D. Push Notifications

- [x] Create a Firebase project and add Android `google-services.json` — checked in at `mobile/google-services.json`, package matches, and referenced in `app.json`
- [ ] Replace placeholder iOS `GoogleService-Info.plist` — file exists but `GOOGLE_APP_ID` is all zeros (`1:1069453591011:ios:0000000000000000000000`); register a real iOS app in Firebase and download the real plist
- [ ] Upload an APNs key to EAS (iOS)
- [ ] Test push on a standalone Android build (not Expo Go)
- [ ] Test push on iOS via TestFlight

## E. Build & Signing

- [x] Confirm the EAS project ID is configured — `app.json` project ID matches the checklist and `eas.json` exists; still run `eas login` to confirm dashboard access
- [ ] Generate Android keystore + Play App Signing key via EAS
- [ ] Generate iOS distribution certificate + provisioning profile
- [ ] Build production Android (AAB): `eas build -p android --profile production`
- [ ] Build production iOS: `eas build -p ios --profile production`

## F. Testing Before Submit

- [ ] Install the production build on real Android and iOS devices
- [ ] Test auth (login/signup), roles, dashboard
- [ ] Test image picker permission prompts end-to-end
- [ ] Test paid-content locked state and out-of-band purchase flow — in-app checkout was removed for store compliance; verify locked content, website redirect, and payment history rendering

## G. Store Listing Assets

- [ ] Google Play: 2-8 phone screenshots, 1024x500 feature graphic, 512x512 high-res icon
- [ ] App Store: 6.7" and 6.5"/5.5" screenshots (+ optional app preview)
- [ ] Write short and full descriptions
- [ ] Complete the Play Data Safety form and App Store privacy "nutrition labels"

## H. Policy / Compliance Review

- [x] Move purchases off the app: payments happen only on the website; the app now shows a locked state for paid content until access is granted (Apple IAP + Google Play Billing compliance — resolved)
- [x] Confirm Google Play Payments policy approach: purchases are out-of-band on the website; no purchase UI/links remain in the app (resolved)
- [ ] If minors use the app: review Play "Families" + COPPA/GDPR-K data rules

## I. Submission & Launch

- [ ] Upload AAB to Play Console -> internal testing track
- [ ] Upload `.ipa` to TestFlight
- [ ] Address review feedback
- [ ] Promote to the production track on both stores
