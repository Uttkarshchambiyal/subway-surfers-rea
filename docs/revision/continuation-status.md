# Recovered release status — 21 October 2026

The browser, Android and iOS Simulator builds now use actual APK-derived character/environment assets and audio. The old procedural renderer has been replaced on all three platforms. The builds are packaged locally, with no publication or online service.

| Verification | Current result |
|---|---|
| Web engine | 21 regression checks passed, including 20-minute bounded simulation |
| Production browser | 12 UI/offline checks passed; zero page/console errors |
| Extended browser play | 65-second natural keyboard-only run, no restarts/errors; all five powers |
| Browser offline | Character, environment, textures/UI and music precached; reload/play with networking disabled passed; 10 audio buffers decoded |
| Android | 20 JVM tests and 29 native emulator checks passed against the current recovered build |
| Android purchase | Five real UI purchase/relaunch checks passed; 120 earned coins charged once and selected outfit restored |
| iOS | 40 Swift engine checks and unsigned arm64 Simulator build passed |
| Native visual review | Android emulator and same-source macOS SceneKit captures inspected |
| Cross-platform replay | 7 samples per platform, 154 numeric comparisons, maximum difference 0 |
| Route audit | 3 cycles passed in the retained bounded model; limitations remain |
| Gameplay MP4 | 74.28 seconds, 430×932 H.264, 25 fps, 1,857 frames; full video/audio decode passed |

The MP4 uses the original soundtrack added during export. It does not capture live effect timing or establish acoustic device playback. Current evidence is in `outputs/web/recovered-revision/`, `outputs/android/runtime-verification.json`, `outputs/android/recovered-runtime/`, `outputs/ios/build-verification.json`, `outputs/cross-platform-comparison.json`, and `outputs/artifact-manifest.json`.

The source recovery preserves the 26-bone Jake skin and 24 clips; native bakes contain 35 static prefab/track entries. All engines now use the original 20-source-unit lane spacing, speed-adjusted duration, lateral reversal gate and proportional return, interpreted from retained byte-backed IL2CPP disassembly.

## Remaining boundaries

No iOS Simulator runtime is installed, so iOS app UI/touch/audio/lifecycle execution remains unverified. The `.app` is a Simulator artifact, not an iPhone IPA. Physical devices and native acoustic quality are untested. Android power fixtures are synthetic; the browser extended run establishes natural encounters.

Full fidelity is not claimed: the repeating route, economy, menus, collider adaptation, camera, some ability semantics, shaders and Animator state machine remain reconstruction code. See [the recovered release report](recovered-build.md) and [fidelity differences](../fidelity-differences.md). Earlier output folders and logs describe historical revisions unless explicitly refreshed by these reports.
