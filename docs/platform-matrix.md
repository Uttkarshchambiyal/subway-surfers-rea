# Current verification matrix — 21 October 2026

| Area | Browser / Three.js | Android / Kotlin GLES2 | iOS / Swift SceneKit |
|---|---|---|---|
| Build | Production passed | Debug APK passed; signature verified | arm64 Simulator build passed |
| Engine regression | 21 checks passed | 20 JVM checks passed | 40 Foundation checks passed |
| Shared replay | 7 samples | 7 matching samples | 7 matching samples |
| Shared numeric comparison | 154 comparisons across native/web, maximum difference 0 | Same | Same |
| Recovered character | Original mesh/atlas, 24 skeleton clips | Original mesh/atlas, 24 baked/interpolated clips | Original mesh/atlas, 24 baked/interpolated clips |
| Recovered scenery | Original Ireland geometry/materials, renderer adaptations | 35 baked prefab/track entries | Same 35 entries |
| Runtime UI/input | 12 production browser checks passed | 29 emulator checks passed | Unverified: zero installed runtimes |
| Powers | All five naturally encountered in extended keyboard-only run | All five labeled synthetic pickup cases passed | Engine checks only |
| Offline | Network-disabled production reload and play passed; all 10 audio buffers decoded | Local APK, no network permission | Local bundle compiled; app execution pending |
| Persistence | Browser settings survive reload; engine economy checks | Settings/menu/background checks, outfit purchase and force-stop/relaunch | Foundation progression checks; UserDefaults app runtime pending |
| Audio | Original buffers decoded; mute/volume checked | Original playback code/controls; emulator audio disabled | Original AVFoundation code compiled; playback pending |
| Native iOS display | Not applicable | Not applicable | macOS same-source SceneKit preview only, excluding SwiftUI |
| Physical phone | Untested | Untested | Untested |

A passing shared replay establishes matching reconstruction engines, not original-game equivalence. It deliberately enables diagnostic collision grace; separate regressions cover selected collisions. Native power fixtures are synthetic. Pointer/browser checks do not establish real touchscreen behavior. See `revision/recovered-build.md` for asset and fidelity boundaries.
