# Store Upload Checklist

Preparing the Gracified LMS mobile app (Expo SDK 54) for release on **Google Play** and the **Apple App Store**.

**App:** Gracified LMS · version 1.0.0 · platform: Android + iOS
**Backend:** deployed on Render (HTTPS) · EAS project: `0023c05d-2ea5-4700-9fc2-1907c85914b9`

Legend: `[ ]` = pending, `[x]` = done.

---

## A. Developer Accounts & Legal

- [ ] Create Google Play Developer account ($25 one-time) — https://play.google.com/console
- [ ] Enroll in Apple Developer Program ($99/yr) — https://developer.apple.com/programs
- [ ] Host a privacy policy at a public URL (required by both stores)
- [ ] Set a support/contact email shown on both stores
- [ ] Choose app category (Education) and complete content-rating questionnaire

## B. Backend & Server

- [ ] Point `EXPO_PUBLIC_API_URL` to the deployed Render **HTTPS** URL (set as an EAS build secret, not hardcoded)
- [ ] Confirm Render instance stays awake (or use an always-on plan) to avoid launch timeouts
- [ ] Verify `/users/expo-token` endpoint and push sending work from the production backend
- [ ] Keep the API URL as an env var so the planned platform migration is seamless

## C. App Config (`mobile/app.json`)

- [ ] Add iOS `bundleIdentifier` (e.g. `com.isaac_joseph.gracifiedlmsmobile`) — currently missing
- [ ] Verify Android `package` matches what is registered in Play Console (cannot change after first upload)
- [ ] Set a real 1024x1024 app `icon` (validate `assets/icon.png`; current adaptive icon uses `favicon.png`)
- [ ] Add iOS `infoPlist`: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` (image picker)
- [ ] Configure the `expo-notifications` plugin (icon, color, sounds)
- [ ] Configure the `expo-splash-screen` plugin and verify splash image sizes
- [ ] Confirm version/buildNumber auto-increment (`appVersionSource: remote` in `eas.json`)

## D. Push Notifications

- [ ] Create a Firebase project and add `google-services.json` to EAS credentials (Android standalone)
- [ ] Upload an APNs key to EAS (iOS)
- [ ] Test push on a standalone Android build (not Expo Go)
- [ ] Test push on iOS via TestFlight

## E. Build & Signing

- [ ] Run `eas login` and verify the EAS project ID matches the dashboard
- [ ] Generate Android keystore + Play App Signing key via EAS
- [ ] Generate iOS distribution certificate + provisioning profile
- [ ] Build production Android (AAB): `eas build -p android --profile production`
- [ ] Build production iOS: `eas build -p ios --profile production`

## F. Testing Before Submit

- [ ] Install the production build on real Android and iOS devices
- [ ] Test auth (login/signup), roles, dashboard
- [ ] Test image picker permission prompts end-to-end
- [ ] Test the payment flow (Paystack checkout) end-to-end

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