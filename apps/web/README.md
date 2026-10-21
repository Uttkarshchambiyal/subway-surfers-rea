# Browser game

Uses Three.js/TypeScript/Vite with recovered APK character clips, Ireland assets and audio. Build automatically stages canonical recovered assets.

```sh
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 8173
```

Production offline reload/play requires a first successful load and completed service-worker cache install. Save data belongs to the same hostname/port. The packaged build includes `play.py` and macOS/Windows launchers; file URLs are unsupported.

QA entry: `?qa=1` exposes `window.railRush`. `tests/recovered-final.mjs` exercises production UI/offline behavior. `tests/natural-play.mjs` records a keyboard-only natural route run. These are desktop automation, not physical touchscreen tests.
