# Recovered-asset release — 21 October 2026

This release connects actual Subway Surfers 3.61.0 APK assets to the TypeScript/Three.js, Kotlin/GLES2 and Swift/SceneKit games. The earlier procedural character/environment renderer is no longer used by any app. This is a local reconstruction, with recovered content and selected byte-backed movement semantics; it is not a complete port of the original Unity/IL2CPP program.

## What changed

- Jake's default body/head, original atlas, 26-bone skin and 24 decoded animation clips replace the procedural figure. The browser plays the recovered skeleton clips. Native renderers use reproducible 30 Hz skin bakes with interpolated vertex positions.
- Original Ireland track, terrain, sheep, trees, lighthouse, commuter/cargo trains, start train with logo, obstacles, coins and power-up geometry replace the generated scenery. Native baking includes 35 static prefab/track entries.
- Runtime-assigned coin/pickup materials are explicitly restored from the recovered common material atlases. The default board mesh uses the recovered common hoverboard palette material. Source prefab placeholders are retained unchanged in the raw recovery JSON.
- Original Ireland music and character/game effects replace the synthesized audio. Browser decoding checks cover 10 buffers. Android's emulator is muted at the emulator level, so its successful controls do not establish acoustic playback quality.
- The browser wardrobe now changes recovered outfit textures. Native wardrobe selections use the same three atlases. Internal save identifiers remain compatible with the previous build.
- Browser asset loading is awaited before enabling play. The service worker precaches the actual model, textures, scene JSON, UI images and audio; its content hash includes those resources. The offline ZIP includes local Python launchers.
- Native menus no longer draw a second procedural title over the original start-train logo. Android uses an immersive screen; deferred system-bar configuration fixes the startup crash found during testing.

## Movement recovered from native bytes

`reference/recovered-logic/disassembly-manifest.json` records the method ranges and range hashes. `metadata-and-native-map.json` ties IL2CPP names to native addresses. Current native source SHA-256 is `d800441e9b293fcf959d2c884d78ffc28fc539c8fc4523c413848ea1ea505c51`.

| Native function | Address | Implemented interpretation |
|---|---|---|
| WorldConstants.GetLanePosition | `0x1e37198` | 20 source units per lane; ties-to-even rounding and three-lane bounds |
| CharacterMotor.GetLaneChangeDuration | `0x1e568f0` | Base ability duration divided by max(1, speed / initial target speed) |
| CharacterMotor.CanChangeLane | `0x1e56724` | During a transition, reject repeated same-direction commands; gate reversal on lateral travel |
| CharacterMotor.ChangeLane | `0x1e56ad4` | Reversal uses the current continuous position and a proportional return duration |
| CharacterMotor.ApplyLaneChangeVelocity | `0x1e58554` | Evaluate the serialized linear lane curve; accumulate absolute lateral travel |

The shared normalization is still `1.75 / 9`. Lane width is therefore `35 / 9` reconstruction units, replacing the previous erroneous 2.7. Regression tests cover initial/max-speed duration, early reversal rejection and the shortened return.

The current REA native decompiler attempt could not launch Hopper because macOS denied Apple Events automation. It supplied no new pseudocode. The interpretation above uses the retained, byte-backed metadata/disassembly and deterministic cross-platform tests, rather than claiming a new successful decompilation or effective runtime measurement.

## Verification and deliverables

Current evidence is indexed in `continuation-status.md`, `outputs/web/recovered-revision/verification.json`, `outputs/android/recovered-instrumentation.log`, `outputs/ios/recovered-build.log` and `outputs/cross-platform-comparison.json`. APK and archive hashes are in `outputs/artifact-manifest.json` after packaging.

iOS Simulator runtime availability remains zero. The app is compiled; the macOS SceneKit previews inspect the same geometry/animation source but exclude SwiftUI, native iOS touch, lifecycle and audio acceptance. No iPhone signing or physical-device run is claimed.

## Fidelity boundary

Scene assembly and the repeating 96-row route remain reconstruction code. Menus, shop prices, missions, score/economy, collision response, high-jump behavior, power attachment offsets and some transitions are simplified. Guard/dog pursuit, revives, seasonal services and the original full segment generator are absent. Native static baking omits particle/shadow-only passes. Browser original shadow passes that relied on unavailable Unity shader behavior are omitted.

The Android/iOS visual meshes for trains/ramps/barriers remain fitted to the earlier collision contract: 3-unit train roofs, 7-unit ramps, 10-unit trains and the earlier barrier/overhead dimensions. The web renderer was corrected on 2026-10-21: original uniform scale is preserved, with collision sizes taken from visible indexed triangles and ramp support sampled from original meshes. Web roof-coin heights and ramp placement follow those sizes. Roll clearance and ramp/roof seam tolerance are still reconstructed. See [the web proportions correction](web-proportions-fix.md). The original full collider, camera modifier, shader and Animator state machine behavior is not claimed as reproduced.

Recovery manifests preserve APK/bundle/object identity and export hashes. These are third-party recovered assets, not newly authored replacement art. The reference APK and extracted native executable remain outside the playable/source archives. The build does not call an account, ad, cloud, billing or leaderboard service.

## Reproduce

For ordinary editing, the recovered assets and native bakes are already in `shared/`:

```sh
python3 scripts/recovery/stage-assets.py
npm --prefix apps/web ci
npm --prefix apps/web test
npm --prefix apps/web run build
./apps/ios/test-engine.sh
# Android: use installed JDK17+ / SDK36; see apps/android/README.md
```

To rebake native geometry/animation from the recovered JSON, run `python3 scripts/recovery/build-native-assets.py` with NumPy available, then stage assets again. Full APK recovery additionally needs the separately retained reference APK and the pinned UnityPy exporter environment described in `shared/recovered/character/README.md`. Running the game does not require recovery tools or the APK.
