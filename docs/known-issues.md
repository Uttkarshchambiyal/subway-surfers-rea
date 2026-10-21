# Remaining verification and fidelity limits

- iOS app execution remains unverified: there are zero installed Simulator devices/runtimes here. The arm64 Simulator app compiles, Swift engine checks pass, and same-source macOS SceneKit previews were inspected. These exclude SwiftUI, iOS touch, lifecycle and AVAudioSession acceptance. No iPhone IPA/signing is supplied.
- Physical phones remain untested. Emulator/desktop observations do not establish real-device frame rate, thermal behavior, battery use or touch feel.
- Native acoustic output remains unverified; the Android emulator runs with audio disabled. The browser decodes all 10 recovered audio buffers. Gameplay MP4 audio is an added original soundtrack, not a capture of live effects.
- Gameplay and renderer fidelity limits are listed in `fidelity-differences.md`. The original full segment generator, native collider program, shader suite and Animator behavior are not ported.
- Browser offline use requires one successful load and completed cache installation at the same origin. Different hostnames/ports have separate saves and caches. File URLs do not run the game; use the included local launcher.
- The route audit is a bounded discrete model, not a continuous-space proof or a human playtest. Native power tests insert labeled synthetic pickups. Browser natural-play evidence uses ordinary keyboard input and an obstacle-reading autoplayer.
- A real Android outfit purchase using the existing earned wallet now survives force-stop/relaunch with one charge and restored selection. This covers that transaction on the emulator; all purchase/mission combinations and native iOS persistence remain unverified.
