# Gracified LMS — Expo Splash Screen

This gives you two layers, matching how Expo actually handles splash screens:

1. **Native splash** (static image) — shown instantly by the OS before your JS
   bundle even loads. Configured in `app.json`, can't be animated.
2. **`GracifiedSplash` component** (this folder) — a real animated React
   Native screen you show *after* the native splash hides, while your app
   finishes loading fonts/data/auth/etc. This is what reproduces the
   staggered icon → "Gracified" → tagline → loading-bar animation.

## 1. Copy files into your project

```
your-app/
  assets/
    gracified/            <- copy this whole folder in
      icon-light.png
      icon-dark.png
      title-light.png
      title-dark.png
      subtitle-light.png
      subtitle-dark.png
      native-splash-light.png
      native-splash-dark.png
  components/
    GracifiedSplash.tsx    <- copy this in (adjust the require() paths
                              at the top if you place it somewhere else)
```

## 2. Native splash — `app.json`

```jsonc
{
  "expo": {
    // ...
    "splash": {
      "image": "./assets/gracified/native-splash-light.png",
      "resizeMode": "contain",
      "backgroundColor": "#fbfcff",
      "dark": {
        "image": "./assets/gracified/native-splash-dark.png",
        "backgroundColor": "#0a0d1f"
      }
    }
  }
}
```

The `dark` key requires `expo-splash-screen` to be installed (SDK 49+
handles this automatically via the config plugin — no extra plugin config
needed for this simple case).

## 3. Install expo-splash-screen

```bash
npx expo install expo-splash-screen
```

## 4. Wire it up in `App.tsx`

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import GracifiedSplash from './components/GracifiedSplash';
// import your real app/navigator:
// import MainApp from './MainApp';

// Keep the native splash on screen until we say otherwise.
SplashScreen.preventAutoHideAsync();

export default function App() {
  const scheme = useColorScheme(); // 'light' | 'dark'
  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  useEffect(() => {
    (async () => {
      // Load fonts, auth state, remote config, etc. here.
      // await Font.loadAsync({...});
      setAppReady(true);
    })();
  }, []);

  const handleLayoutRootView = useCallback(async () => {
    if (appReady) {
      // Hide the native splash now that JS has taken over — the
      // GracifiedSplash animation is already playing underneath it.
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (showCustomSplash) {
    return (
      <GracifiedSplash
        theme={scheme === 'dark' ? 'dark' : 'light'}
        onFinish={() => {
          // Reveal sequence finished (~4.3s). If appReady is already true,
          // move on to the real app; otherwise you can keep the loader bar
          // spinning until it is.
          if (appReady) setShowCustomSplash(false);
        }}
      />
    );
  }

  return null; /* <MainApp onLayout={handleLayoutRootView} /> */
}
```

The important handoff: native splash (instant, static) → `GracifiedSplash`
(animated, JS-driven) → your real app. `onFinish` fires once the reveal
sequence completes, which is a natural point to swap in your main
navigator once data is actually ready.

## Notes

- All positions/sizes in `GracifiedSplash.tsx` are percentage-based and
  match the source artwork exactly — the three images (icon, title,
  subtitle) reassemble into the full lockup with the same spacing as the
  web version, no manual tweaking needed.
- The loading bar is a solid color by default. For the exact gradient
  sweep from the web version, install `expo-linear-gradient`
  (`npx expo install expo-linear-gradient`) and swap `loaderFill`'s
  `View` for a `<LinearGradient colors={['#5b4fd6', '#3b6fe0', '#4fd1ff']} ... />`.
- `useNativeDriver: true` is used throughout so the animation runs on the
  native thread and stays smooth even if JS is busy loading things.
- Tested against Expo SDK 49+ conventions; if you're on an older SDK the
  `splash.dark` key in `app.json` won't be picked up — just point
  `splash.image` at whichever theme you use most.
