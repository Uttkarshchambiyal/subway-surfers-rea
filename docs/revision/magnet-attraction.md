# Raised-hand magnet and coin attraction — 21 October 2026

The old magnet immediately removed and credited coins inside its range. It also had no hand prop. Browser, native Android GLES, and iOS SceneKit now keep captured coins alive until a timed flight reaches the animated hand.

## Behavior and presentation

- The recovered red horseshoe magnet is held upright above the right hand. An additive two-bone pose raises the arm while the recovered locomotion continues. Equip and release blend over 0.2 seconds.
- A shipped marker triangle near source Y=-80 distorted the magnet's bounds and shrank its visible mesh. Marker-only triangles are excluded from the recovered powerup draw indices in both web preparation and native baking. The actual recovered model/atlas is preserved.
- Shared configuration uses a 10.5-unit attraction radius, spanning both outside tracks, with the existing 4-unit vertical gate. Each flight lasts `0.34 + horizontal/forward range * 0.02` seconds.
- Browser trails share one fixed GPU buffer and render in one draw call, avoiding geometry growth during long runs.
- Coins visibly accelerate along an arcing path to the live magnet tips, spin, leave tapered gold ribbons, shrink at arrival, and pulse the magnet field. Lane changes and jumps move the destination with the hand.
- Score, sound and coin credit occur once on arrival. Pause freezes flights and pose. Already captured coins finish after power expiry; the magnet remains held until those coins arrive. Collision allows pending arrivals before settlement. Restart clears flights and props.
- Native baking now contains 37 recovered clips and six reconstructed magnet-pose variants. Per-frame hand mounts are sampled with the same interpolation as the actual character vertices. These arm poses, ribbons and field effects are reconstructed presentation, not extracted original Unity particle/Animator behavior.

## Verification

- Browser: 43 unit tests passed. Production WebGL fixtures passed in 600×1000 and 1440×900 viewports: three-lane launch, visible intermediate motion, moving-hand arrival, pause freeze, expiry, exactly-once credit, and board/boots/jetpack stacking. Screenshots were visually inspected. Reports: `outputs/web/magnet/verification.json`; images in the same directory.
- Final production suite: all ten sections passed on browser bundle `index-DjvuAUWU.js`, cache `rail-rush-5f5cdf059ea49e67`. This includes 30.1 seconds of keyboard play, 600 accelerated simulated seconds, touch, pause/restart, all power fixtures, persistence, offline reload, and clean console/HTTP checks. Geometry count stayed at 59 across the soak; at most 77 active entities were sampled. Report: `outputs/web/production-qa/verification.json`.
- The existing jetpack anatomical placement regression passed 72 rendered pose samples with no errors.
- Android: 21 JVM engine tests passed. Updated APK installed and ran on the API 36 arm64 emulator. Dedicated native GLES fixture passed pre-arrival visibility, pause freeze, three-lane arrival after expiry, cleanup and restart. Held/launch/curve/moving-hand/roll/jetpack screenshots were captured and inspected. Report and images: `outputs/android/magnet/`. Renderer log contains no GL errors. This is emulator evidence, not physical-phone testing.
- iOS: 44 Foundation engine checks passed, including far-track attraction, pause freeze, expiry and delayed credit. The arm64 Simulator app compiled with Xcode. No iOS Simulator runtime is installed, so SceneKit animation execution and physical-device behavior remain unverified.
- Shared deterministic scenario: 154 numeric comparisons across seven samples per platform passed with zero difference. Collision grace is explicitly enabled in that fixture; it does not replace independent collision tests.

Updated deliverables are `outputs/RailRush-web-offline.zip`, `outputs/android/RailRush-debug.apk`, `outputs/ios/RailRush-Simulator-arm64.zip`, and `outputs/RailRush-editable-source.zip`. The old general gameplay MP4 predates this correction. The iOS ZIP is an unsigned Simulator app, not an installable iPhone IPA.
