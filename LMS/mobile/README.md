# Gracified LMS Mobile App

A polished Expo-based mobile experience for the Gracified LMS platform.

## Features
- Secure login and account registration
- Professional dashboard and profile screens
- Classrooms and learning-space overview
- Backend integration with the existing LMS API

## Requirements
- Node.js 20+
- npm
- Expo Go app on your phone, or an Android/iOS emulator

## Setup
1. Open the project folder:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npx expo start
   ```
4. Scan the QR code with Expo Go, or run on an emulator.

## Environment
The app uses the following environment variable in the mobile project:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000/api
```

For a physical device, replace the URL with your local network IP or your deployed backend URL.

## Scripts
- `npm start` – start Expo
- `npm run android` – launch on Android
- `npm run ios` – launch on iOS
- `npm run web` – launch in web mode

## Notes
- The mobile app is wired to the existing backend authentication endpoints.
- For production, update the API URL in the `.env` file to point to your deployed backend.
