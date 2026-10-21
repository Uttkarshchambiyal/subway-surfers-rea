# Subway Surfers reference investigation

This document preserves the initial investigation stages. The current reconstruction uses recovered game assets; [asset provenance](asset-provenance.md) and the [recovered build report](revision/recovered-build.md) supersede the early placeholder-art boundary described below. Original reference material remains local and is excluded from Git.

Investigation date: 20 October 2026 (Asia/Kolkata). Reference is version 3.61.0, not a latest-version claim.

## Acquisition and identity

The user-supplied [APKMirror standalone listing](https://www.apkmirror.com/apk/sybo-games/subwaysurfers/subway-surfers-3-61-0-release/subway-surfers-3-61-0-2-android-apk-download/) was inspected. Its ordinary download flow failed: actual Chrome received a Cloudflare access block (REA `ev_d2b4d8136aeffbb14be98afb3f2df29603cbe6e78fc807d5df1665d2669e59cf`). No CAPTCHA or access control was bypassed. Uptodown's listing was readable through web search but its direct download path returned 410; a shell listing fetch returned 404.

The alternate [APKPure version listing](https://apkpure.net/subway-surfers-game/com.kiloo.subwaysurf/download/3.61.0) exposed a standalone APK link. That actual link redirected normally to `data.winudf.com`, returned HTTP 200, and downloaded 239,701,887 bytes. Exact initial/final URLs, response headers, acquisition time and hashes are in `reference/acquisition/provenance.json` and `apkpure-download-headers.txt`.

The downloaded ZIP/APK SHA-256 is `92d60fb9a998bf4dd2d6b77e86bb9b4ba05e38498205e101dcabeda4e839d7fe`. It matches the user-selected APKMirror published SHA-256 and APKPure's published SHA-1. `aapt dump badging` independently reports package `com.kiloo.subwaysurf`, version `3.61.0` / `90395`, minimum SDK 23, target SDK 35, ARM64 and ARMv7 native ABIs.

Android build-tools 35.0.0 `apksigner verify --verbose --print-certs` succeeded for v1, v2 and v3. Certificate SHA-256: `a0328a96ac93be7983b5bec417bd2c03f129af6f8aff39512470e66a18dd964e`; DN: `CN=Jacob Møller, OU=Kiloo, O=Kiloo Games, L=Aarhus, ST=Jutland, C=45`. Source stamp verified. The full output, including v1 META-INF entry warnings, is retained in `reference/acquisition/signer.txt`. A matching checksum establishes file identity, not a safety guarantee.

The APK remains unchanged under `reference/`, separate from recreation source and distributables. Extracted analytical samples and screenshots are reference material only; no original game assets were copied into the recreation.

## REA static route and engine boundary

REA opened the original APK directly and completed its archive inventory: 5,014 file occurrences, 4,892 content nodes, zero integrity contradictions. The archive graph manifest is `agm_08c8a7276ece4e4404ec90f44d28e1239763795126f19b06ea730f5d6b55f97c`; inventory Evidence `ev_027bb47f38712434e71d65b678039b795714e5c8894ef366abd423c9799a71b9`, inspection Evidence `ev_2ab211faa6b51be9104fa5d6df105bc317b2ff12cbb1c9611cc3f4c963d2585b`.

Selected member Evidence `ev_a14b1de6a4844c1c9ad7f8dc53a502d1cc5c30cafd69189f081400f4e980923b` establishes:

| Member | Bytes | Meaning |
|---|---:|---|
| `lib/arm64-v8a/libil2cpp.so` | 78,934,928 | Native IL2CPP library |
| `lib/arm64-v8a/libunity.so` | 19,142,280 | Unity runtime |
| `assets/bin/Data/Managed/Metadata/global-metadata.dat` | 15,746,896 | IL2CPP metadata carrier |
| `assets/tower/gamedata/runconfiguration.json` | 18,808 | Named configuration carrier; opaque bytes |

ARMv7 versions of the native libraries are present too. `ScriptingAssemblies.json` and `RuntimeInitializeOnLoads.json` refer to Unity modules and SYBO startup classes. A serialized Unity header contains `2022.3.62f2`; runtime logs independently confirm that engine version, release build, stripping enabled and IL2CPP backend.

REA's Android JADX route was attempted once and returned `capability_unavailable`: no caller-supplied `REA_JADX_MCP_JAR` was configured. No engine was installed or setup repeated. JADX would cover Java/Dalvik boundaries rather than recover all Unity native gameplay. At the initial acquisition stage, native disassembly / IL2CPP metadata reconstruction had not been performed. Later saved native assembly, metadata mappings and decoded UnityFS assets are audited in [reference parameter audit](revision/reference-parameters.md); that later static baseline supersedes the initial numerical unknowns below. The `assets/tower/gamedata/*.json` names do not establish decoded JSON: sampled `general.json` is non-UTF8 opaque bytes. Its encoding/transform was not established in that initial pass; later decoded data is retained under `reference/native/gamedata-decoded/`. No numeric movement/camera constants were inferred from those names.

## Local Android runtime

Only the existing `Flowers_API_36` ARM64 Android emulator was used, serial `emulator-5554`, 720×1600. REA installed the exact hash-verified APK (Evidence `ev_b8e09c0c3b778983fdb59f80d0971641ef74bc04fbfea4033067e60715669176`) and launched its declared activity (`ev_2737f0874e8fb63c250a74b48e3d6ec9b3f2e2b84b79bdb135b8439867f79e8a`). No original binary ran directly on macOS. No account, app store or login was used. A synthetic adult age of 24 was selected for the emulator-only first-run flow. The reference opened and played despite missing Google Play Services warnings.

A bounded process-scoped log dump (`ev_b677381edf474e923767a5a0660095e3cbf08009e6e749bd2af666391fc5bc16`) confirms Unity 2022.3.62f2 / IL2CPP and reports ES 3.2 configuration fallback and unavailable analytics/Play Services components. These are reference app/emulator observations, not findings about the recreation.

Observed states include first-run age selection, loading, animated menu, start chase, running, tutorial collision/reset, jump/roll sequences, hoverboard instruction and riding, jetpack flight, multiplier feedback, mission completion, and results. The tutorial can slow/reset its obstacle sequence, so it is unsuitable as an unqualified baseline for normal speed or reaction-time estimates. Subsequent scripted movement samples reached challenge/results UI; their input logs prove attempted gestures, not successful movement actions. They are retained and explicitly excluded from timing estimates.

The reference was force-stopped after capture (`ev_40663a618585d3728a804aeb5382cefe138ecb7e264cd9df8041e736d6e66d80`), and the emulator was handed over for native recreation QA.

## Visual observations and measurements

Measurements below are image-space estimates from 720×1600 runtime frames, not recovered 3D camera parameters. Confidence is medium for composition and low for geometry inferred from perspective.

| Property | Runtime observation / method | Confidence |
|---|---|---|
| Camera framing | In ordinary running frame 10, runner head ≈ y1090 (68%); feet ≈ y1350 (84%). Runner occupies ≈18% of height. | Medium |
| Vanishing point | Rails in frames 08/10/12 converge around center x360 and y450–510 (28–32% height). Curved tracks alter this. | Medium |
| Lane layout | Three tracks; rails, sleepers and regular coin trails provide strong forward motion cues. Camera follows laterally rather than rigidly keeping all lane positions fixed in image space. | Medium |
| Train proportions | Large lane-width train bodies flank runner; cream/yellow cab faces, dark windows, gray roof, green freight containers in this city. | High |
| Environment | Orange-red ballast; cyan sky; low-poly green cliffs/trees with pink foliage, sheep, birds, lighthouse and water in Ireland theme. | High |
| Obstacle readability | Red/white diagonal-striped barriers; low barriers and high underpass barriers use distinct silhouettes. | High |
| HUD | Pause upper-left, multiplier and score upper-right, coin count below; temporary power-up meters along bottom. | High |
| Feedback | Mission banner, coin-count changes, flight trails, board beneath feet and segmented duration meters visibly change during play. | High |

Actual camera distance/FOV, metric track width, initial speed, acceleration and original collision volumes remain unknown. A screenshot cannot uniquely recover these quantities. Approximate recreation constants must be labeled design estimates and validated as recreation behavior only.

## Recording boundary

`reference/runtime/reference-tutorial.mp4` is an Android `screenrecord` capture, decoded with local AVFoundation: H.264 (`avc1`), 720×1600, 59.9517 seconds, nominal/average 10.6085 fps, zero audio tracks. Sample frames are retained in `tutorial-frames/`. Software rendering and variable frame cadence substantially limit action timing precision. This is no evidence of physical-device performance. The screen recorder captured video only; absent audio is not evidence that the original game is silent.

Two later captures (`reference-actions.mp4`, `reference-fresh-movement.mp4`) preserve attempted movement schedules and results screens. The clean movement capture actually begins at a challenge/revive UI; it cannot establish lane/jump/roll durations. No original duration, height, speed, power-up lifetime or scoring equation is reported as measured.

## Unknowns

Exact lane transition time; jump duration/height/air control; roll duration; initial speed/acceleration; camera distance/FOV/smoothing; collision AABBs and graze rules; generation weights/fairness algorithm; train movement speeds; original coin pickup radius and magnet reach; power-up durations and upgrade effects; scoring formula; original save schema; original sound/music composition; original iOS implementation. Android evidence does not establish original iOS code or rendering.

Recreation tuning may approximate observed composition and broad behavior. It must not be called recovered original source, exact mechanics, or perfect fidelity.

## Later static baseline — fidelity continuation

The [reference parameter audit](revision/reference-parameters.md) verifies serialized motor values (lane .27s, roll .6s, gravity-200, speed110→220 over179s, jump height20) and running-camera base FOV68°. These are static baselines, not observed effective runtime values. A selected uniform reconstruction scale1.75/9 preserves time and scales distances. Original asset activation, modifier precedence, high-jump curve, camera aspect/FOV changes and collision semantics remain partially or wholly unresolved. Current implementation and verification status supersede the initial estimate-only delivery.
