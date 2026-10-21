# Browser ability animation correction, 2026-10-21

## Changes

The web renderer previously selected ordinary running/jumping clips during abilities, rendered the board as an independent runner-level prop, did not show super sneakers on the character, and used a fixed jetpack offset. Those were presentation bugs even though the power timers and collisions ran.

- Recovered thirteen additional shipped clips from the existing common-animation bundle: `h_skate_on`, `h_run`, `h_left`, `h_right`, `h_jump`, `h_hangtime`, `h_landing`, `h_roll`, `superRun`, `Jetpack_forward`, `Jetpack_forward_2`, `Jetpack_changeLane_left`, and the source's spelling `Jackpack_changeLane_Right`. Jake now has 37 recovered clips in the browser.
- Mounted the original board on the animated `attachPoint1` rig node. Original board clips drive both rider and board through mounting, riding, jumps, lane changes, rolls and landings. It is stowed during jet flight and returns if its timer remains active.
- Exported the original `superSneakers` skinned mesh (402 vertices, 472 triangles) with its original weights and inverse bind matrices, retargeted by the shared 26 bone names to Jake. The shoes now follow each foot, including running, enhanced jump and stacked powers. Outfit switching does not recolor them.
- Added flight-pose selection and back-follow attachment for the original jetpack. Nozzle locations come from its original named attachment points. The two animated flame cones are a renderer reconstruction, not the original Unity particle system. Flight ending transitions into ordinary falling and landing.
- Character animation advances with engine time and freezes during pause. Repeated actions reset their one-shot clips; ability priority prevents ordinary running from overriding the riding/flight pose.
- Corrected visible-bound calculations to exclude material-less submesh groups. The jetpack mesh contains a marker triangle near source Y=-80; it is not rendered, but including it in bounds shrank and misplaced the actual pack and pickup.
- Removed undefined texture-map constructor warnings. Offline registration no longer calls an immediate redundant update that races first activation. Audio initialization is shared between concurrent input events, and music/effect nodes are disconnected correctly.

The red `contentScript.js` rate error in the supplied Brave console is from a `chrome-extension://` script. The game-origin material and service-worker warnings were corrected; the clean-profile final run reported no warnings or errors.

## Evidence

The original APK SHA256 remains `92d60fb9a998bf4dd2d6b77e86bb9b4ba05e38498205e101dcabeda4e839d7fe`. Clip path IDs and source asset-file identities are recorded in `shared/recovered/character/manifest.json`. The sneaker export records its bundle SHA256 and mesh path ID in `shared/recovered/character/super-sneakers.json`. Recovery is reproducible with `scripts/recovery/character-export.py` and `scripts/recovery/ability-export.py` using the existing UnityPy environment.

The first ability release used `index-C49r5Qcb.js` and cache `rail-rush-c35f3056e976cbf9`; its 37 unit tests and ten functional browser sections passed. A later user screenshot exposed a separate anatomical attachment defect that those checks missed. The jetpack now uses a full torso frame; see [the back-attachment correction and 72-pose regression](jetpack-back-mount.md). The current production report is `outputs/web/production-qa/verification.json`; its cache identity identifies the tested release.

Fixture screenshots and animated attachment diagnostics are in `outputs/web/ability-animation/` and `outputs/web/production-qa/`. These are separated from normal-input evidence. The browser runtime was verified in Chrome on macOS, including emulated browser touch, offline reload, audio, purchases/settings persistence and four viewport sizes. Physical phones, native Android/iOS ability presentation, original Animator parity and universal production readiness are outside these checks. The later [magnet correction](magnet-attraction.md) updates native bakes to 37 recovered clips plus six reconstructed hand-up variants; the existing MP4 also predates these corrections.
