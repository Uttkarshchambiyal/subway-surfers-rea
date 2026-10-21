# Browser production regression checks

`apps/web/tests/production-check.mjs` runs the production browser build with Chrome's real Three.js/WebGL renderer. It writes a machine-readable result and screenshots under `outputs/web/production-qa/`. A completed result must have `pass: true`; this document alone does not assert that a run passed.

Run a fresh production build and preview on port 8175, then:

```sh
cd apps/web
node tests/production-check.mjs
```

`GAME_URL` overrides the preview URL. `CHROME_PATH` overrides the Chrome executable. The default natural-input observation is 75 wall-clock seconds, and the accelerated engine soak covers 600 simulated seconds. `QA_NATURAL_SECONDS` and `QA_SOAK_SECONDS` can shorten a diagnostic iteration; shortened runs must be identified as such when reporting evidence.

## Coverage and evidence boundaries

| Check | Evidence |
| --- | --- |
| Production startup | Original character clip inventory, recovered renderer, valid service-worker response and current menu |
| Natural keyboard play | Real keyboard events; threat-reading automatic avoidance, distance, restarts, acquired powers and frame-rate samples; no engine mutation |
| Pause, resume and restart | Frozen distance and power timers; resumed distance; reset run and powers |
| Ability fixtures | Board and jumping board, enhanced jump, jet flight and lane change, all powers together, pause, expiry, landing and restart; screenshots and renderer diagnostics |
| Engine and renderer soak | Ten simulated minutes through the normal fixed-step engine with a collision-grace fixture; scene pools, geometry allocation and texture allocation bounds; rendered between chunks |
| Viewports | Phone portrait, desktop, ultrawide and landscape; canvas pixel ratios, horizontal FOV limit, horizontal overflow and sampled frame intervals |
| Save fixtures | Clearly labeled starting wallet and completed mission; real shop/mission/settings controls, one-time rewards, no duplicate outfit charge and reload persistence |
| Offline | Cached original model, environment and music; network-disabled reload, keyboard input and ten decoded audio buffers |
| Touch | CDP-dispatched browser touch events through pointer capture; left/right/up/down swipes and double-tap board consumption |
| Runtime hygiene | Uncaught exceptions, console errors/warnings and HTTP errors are collected and fail the run |

The accelerated soak tests engine lifetime and bounded renderer allocation; it is not ten wall-clock minutes of frame-rate profiling. Memory figures are observations: JavaScript heap growth alone is affected by garbage collection and does not prove a leak. Geometry and texture resource counts must remain bounded. Frame intervals depend on the test host and are not physical-device performance certification.

Touch events run through the browser's real input pipeline, but are not physical-device testing. Chrome runs in a clean profile: extension-origin failures visible in a user's Brave profile are outside that profile and are not silently classified as game errors. Any game-origin material or service-worker warnings still fail the clean run.

Ability fixtures activate powers directly and suppress unrelated obstacles to make attachments observable. They do not demonstrate natural acquisition, overall game balance or reproduction of the original Unity Animator. The natural-input section is reported separately. Passing these regressions does not establish original-game fidelity, iOS/Android readiness, accessibility completeness or universal production readiness.

## Ability release run: 21 October 2026

The ability release run passed all ten sections from **06:21:38 to 06:23:25 UTC** against `http://127.0.0.1:8175/`. That release used `index-C49r5Qcb.js` and offline cache **`rail-rush-c35f3056e976cbf9`**. Its functional attachment checks missed a later-reported anatomical placement defect: the jetpack could hang toward the hips when the torso rotated. See [the torso-frame correction](jetpack-back-mount.md) for the stronger rendered-mesh regression. The current numerical report in `outputs/web/production-qa/verification.json` records its own build/cache identity and replaces the earlier functional run when rerun.

| Observation | Final result |
| --- | --- |
| Natural keyboard play | 75.162 wall-clock seconds; 1,938.76 distance units; zero restarts; magnet, jetpack, boots, multiplier and board all encountered naturally |
| Ability animation fixtures | Original hoverboard entry/run/jump/roll clips; original super-run clip; 26-bone skinned shoes; advancing original jet flight clip, attached full-size jetpack and visible exhaust; frozen animation during pause; expiry, landing and run restart passed |
| Power priority and protection | Board hidden during jet flight; all active power timers preserve during pause; one crash consumes the active board without an extra inventory charge; expired/reset attachments hide |
| Engine soak | 600 simulated seconds / 72,000 fixed steps; 24,179.52 distance units; 3,995 spawns; at most 77 active entities in sampled frames; geometry resources remained exactly 57 |
| Renderer sampling | 430×932, 1440×900, 2560×1080 and 932×430; median frame interval 16.7 ms, p95 16.7–16.8 ms on this Mac/Chrome host; 128–145 draw calls in sampled endpoint scenes |
| Touch controls | Real browser touch pipeline through CDP: both lane directions, jump, roll and double-tap board; exactly one board consumed |
| Local persistence | UI outfit purchase, board bundle, one-time mission claim, outfit reselection without duplicate charge, mute/volume and reload persistence passed with an explicitly seeded save fixture |
| Offline | Cached original character/environment/music, network-disabled reload, movement and ten decoded audio buffers passed |
| Runtime hygiene | Zero captured uncaught exceptions, console warnings/errors or HTTP error responses |

The earlier candidate also passed the functional harness. Independent screenshot inspection nevertheless exposed an undersized jet prop: an unused, material-less marker triangle distorted its bounds. The renderer's drawn-triangle bounds were corrected and the complete run was repeated against the release identified above. This is why numerical attachment checks are paired with visual review. The initial numerical report is retained as `outputs/web/production-qa/initial-candidate-verification.json`; the final screenshots show the corrected full-size jet prop with both nozzle flames, and the settled hoverboard riding pose.

The **75-second natural run** and the **600-second accelerated engine soak** measure different things. The soak disables fatal collision through a documented grace fixture and advances engine steps faster than wall time while rendering between chunks. It is evidence of bounded entity/resource behavior across route reuse, not ten minutes of sustained physical-device play. The frame measurements are short host-specific samples, not a guarantee on other GPUs, browsers or mobile devices. No physical phone, Brave-extension profile, iOS runtime or universal production certification is claimed.

## Torso-mount correction rerun

After the later jetpack attachment report, all ten functional sections passed again on `index-DsBjCqQe.js`, cache `rail-rush-ede1fd2e16a2016f`, with no captured console warnings/errors or HTTP failures. This release also passed 38 unit tests and the separate [72-pose rendered-mesh attachment regression](jetpack-back-mount.md). The latter checks anatomical placement through both flight loops and both banks, a property that the earlier functional harness did not verify.


## Magnet release rerun

The [raised-hand magnet correction](magnet-attraction.md) passed all ten sections on `index-DjvuAUWU.js`, cache `rail-rush-5f5cdf059ea49e67`. The run used 30 seconds of natural keyboard input and the full 600-second accelerated engine soak. Geometry allocations stayed at 59, with at most 77 active entities in sampled frames. Controls, power stacking, pause/restart, responsive rendering, purchases/settings, offline reload, touch input and runtime hygiene passed. The separate magnet fixtures verify actual visible magnet body size, timed flights, moving-hand attachment and credit on arrival. Android emulator evidence and the iOS compile/runtime boundary are recorded in the magnet report.
