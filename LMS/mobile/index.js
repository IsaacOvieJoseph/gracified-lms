const rootGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this;

if (typeof rootGlobal.DOMRect === 'undefined') {
  class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.top = y;
      this.left = x;
      this.bottom = y + height;
      this.right = x + width;
    }

    toJSON() {
      return {
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        top: this.top,
        left: this.left,
        bottom: this.bottom,
        right: this.right,
      };
    }

    static fromRect(rect) {
      return new DOMRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  rootGlobal.DOMRect = DOMRect;
  rootGlobal.DOMRectReadOnly = DOMRect;
  if (typeof rootGlobal.window !== 'undefined') {
    rootGlobal.window.DOMRect = DOMRect;
    rootGlobal.window.DOMRectReadOnly = DOMRect;
  }
}

require('react-native-gesture-handler');

// Firebase Cloud Messaging — background message handler. Must be registered at
// the module root (before the app root mounts). When the app is backgrounded or
// closed, FCM/OS renders the notification payload automatically; this handler is
// required to exist even for data-only messages.
const {
  getMessaging,
  setBackgroundMessageHandler,
} = require('@react-native-firebase/messaging');
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  // No-op for notification messages (handled by the OS). Add data-only
  // handling here if you send messages without a `notification` payload.
});

const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
