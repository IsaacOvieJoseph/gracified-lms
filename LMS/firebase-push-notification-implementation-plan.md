# Firebase Push Notification Implementation Plan

**Status:** Planning only — No code changes will be made as part of this document.  
**Target Stack:** React Native (Expo EAS) mobile app + Node.js/Express/MongoDB backend  
**Push Provider:** Firebase Cloud Messaging (FCM) via Firebase Admin SDK on the backend

---

## 1. Goals & Objectives

- Replace the current Expo push service (`https://exp.host/--/api/v2/push/send`) with Firebase Cloud Messaging (FCM).
- Support multi-device token storage (instead of single `User.expoPushToken`).
- Properly handle token invalidation (uninstall, token refresh, permission revocation).
- Keep existing in-app notification model and flows intact (Notification model hooks, in-app endpoints).
- Use a phased, backward-compatible migration (dual-sender optional if needed).
- Follow security best practices (service account, least privilege).

...

(This is the full plan as drafted)