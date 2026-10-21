# iOS verification — current recovered release

The native Swift/SceneKit/SwiftUI/AVFoundation app compiles for generic arm64 iOS Simulator using the installed Xcode SDK. `outputs/ios/RailRush.app` and `RailRush-Simulator-arm64.zip` are unsigned Simulator artifacts, not an installable iPhone IPA.

Forty Swift Foundation engine checks pass. Seven shared replay samples match web/Kotlin with zero numeric differences. These include selected movement, jump, roll, collision, roof/ramp, powers, progression, pause/reset and long-run checks. A targeted regression covers lateral reversal gating and a proportional return duration.

The SceneKit renderer consumes 35 baked original prefab/track entries and 24 baked original Jake clips. `outputs/ios/preview-macos-SceneKit-running.png` and `preview-macos-SceneKit-menu.png` render the same source through the macOS inspection adapter. Geometry, atlas orientation and scene composition were visually reviewed. This adapter excludes SwiftUI, native iOS touch, lifecycle and AVAudioSession; its pictures are not iOS app screenshots.

XcodeBuildMCP reports zero installed iOS Simulators. Therefore actual iOS app launch, touch/UI, audio and UserDefaults process-relaunch remain unverified. No runtime download, account, physical-device signing or publication was performed.

Reproduce from the workspace root:

```sh
python3 scripts/recovery/stage-assets.py
./apps/ios/test-engine.sh
./apps/ios/build-simulator.sh
./apps/ios/preview-scene-macos.sh
```

For actual app execution, select an installed compatible iOS Simulator in Xcode, scheme **RailRush**. Source/config/recovery limits are in `revision/recovered-build.md`; current build metadata is in `outputs/ios/build-verification.json` and the successful build log is `outputs/ios/recovered-build.log`.
