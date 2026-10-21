# Route fairness audit

This audit concerns the recreation's shared route and gameplay settings. It is source/model analysis, not a REA finding about the original game or a physical playtest.

The current swept-envelope planner retained reachable states through three complete 6,144-unit route cycles: 18,433.75 units over 475.67 seconds of modeled running time, including the maximum-speed phase. The minimum reachable state count was 9 and the maximum was 285. The endpoint-only comparison also passed. These are bounded model results; they do not establish a continuously traversable path in the actual engine.

Reproduce the checked-in results from the repository root:

```sh
python3 scripts/validate-route.py
python3 scripts/validate-route-coarse.py
```

The scripts write `outputs/route-validation.json` and `outputs/route-validation-coarse.json`, respectively. Both include SHA-256 hashes of their shared config inputs, the modeled parameters and their limitations. The coarse script uses the same parameterized implementation and writes its own result rather than overwriting the main result. `--cycles` and `--planner-ticks` permit bounded alternative runs; the checked-in results use the defaults of three cycles and ten physics ticks per planning step.

## Current model

The planner reads `shared/config/gameplay.json` and `shared/config/route.json`. Current inputs include:

| Quantity | Current setting |
| --- | --- |
| Speed | 21.388889 → 42.777778 units/second |
| Acceleration | 0.119491 units/second² |
| Gravity / normal jump velocity | 38.888889 / 17.391640 |
| Lane interpolation / movement duration | Linear / 0.27 seconds |
| Roll duration | 0.6 seconds |
| Obstacle activation lookahead | 300 units |
| Route cycle | 6,144 units |

Speed and distance are integrated in the same order as the web engine at the configured 1/120-second fixed step. A moving train travels at 4 units/second after activation; activation is quantized to the first fixed-step distance that reaches its configured lookahead, with movement beginning on the following tick. The model includes obstacle copies beyond the audited endpoint so a next-cycle train moving into range is considered.

Actions are chosen on a 1/12-second grid. Linear lane movement uses the configured 0.27-second duration, while a new lane action is allowed only after the containing grid interval completes (0.333333 seconds). Mid-transition retargeting is omitted. Jump and roll activation have one planner interval of lag. Planned rolling lasts 0.583333 seconds, shorter than the configured 0.6 seconds even after accounting for the engine's first timer decrement. Jump bounds use configured velocity/gravity with a semi-implicit lower-height padding of 0.162037 units per elapsed jump second. An embedded self-check verifies that every fixed-step sample of the modeled normal jump falls inside its planner interval's vertical bounds; other assertions check roll duration, lane-action spacing and supported linear interpolation.

The main mode rejects a state if any obstacle's swept longitudinal interval overlaps while its lane center falls inside the whole planner interval's horizontal envelope and its height intersects the vertical envelope. This deliberately combines interval extremes even when they occur at different moments, which may reject safe possibilities. The endpoint comparison instead checks only endpoint horizontal/vertical positions and can miss collisions during a transition. Neither mode claims that timing restrictions make the entire model strictly conservative.

Some engine constants still live directly in `apps/web/src/engine.ts`, rather than shared config: moving-train speed 4, longitudinal collision margin 0.32, barrier top 1.05, overhead lower/upper thresholds 1.1/2.6 and train threshold 2.92. The audit records its copies of these constants in each output; changes to those engine semantics require a corresponding model update.

## Limits and older evidence

The planner omits ramps, train-roof landing, powers, airborne dive rolls, lane retargeting and entity-pool behavior. In particular, ignoring roofs can change the later vertical trajectory; it cannot be justified merely as removing a helpful option. States are merged without retaining a predecessor witness, and no resulting action sequence is replayed through the unchanged game engine. The grid, swept envelopes and shortened actions reduce specific forms of optimism but do not close these gaps. A passing result is supporting evidence only. A failing model run would also not prove that the actual route is impossible.

The older `outputs/independent-route-occupancy.json` used the previous speed, route and 230-unit activation assumptions. It is historical evidence and has **not** been refreshed for the current fidelity correction. Its old encounter timestamps, lane-clearance counts and moving-train example do not describe the current route. The previously reported 10,945.73-unit reachability run, 0.18-second lane duration and 0.7-second roll duration are likewise superseded by the two current result files.

A stronger guarantee needs actual fixed-step engine planning, retained action witnesses and replay through the unchanged engine, with roof/ramp/power behavior and every collision transition covered. No concrete impossible route has been established by this audit.
