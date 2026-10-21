> Historical pre-integration audit from 20 October. The native integration issues and unknown lane spacing listed below are superseded by the [21 October recovered release](recovered-build.md). Serialized observations remain useful evidence; the current implementation status is in continuation-status.md.

# Reference parameter audit — 20 October 2026

This audit reuses the saved Android 3.61.0 reference artifacts. Serialized values are verified static configuration, not measurements of an active run. No additional target download, execution or native analysis session was performed. Current recreation code was inspected separately; passing recreation tests cannot establish original-game fidelity.

## Source identity

Paths below are relative to `reference/native/`. SHA-256 was recomputed in this audit.

| Artifact | SHA-256 |
|---|---|
| `core-character.bundle` | `b70c6ecc648dffb77df627a3dbb72290de0332786d37848b7d31b0d72d22e31e` |
| `core-character-decoded.json` | `906496c0d263a421e761212a6ad5ecd1ea3369ef6d7b153dab7ab55289efd3c4` |
| `core-camera.bundle` | `e67b2d3422d69abca61a3957ab95f45e8b4b45f2ac53b91a08d8d2786f3c195c` |
| `core-camera-decoded.json` | `fbb2113b046fafda49ae3054f2761cd4bca37905d4b2479663a337cec4ae2f85` |
| `libil2cpp.so` | `d800441e9b293fcf959d2c884d78ffc28fc539c8fc4523c413848ea1ea505c51` |
| `global-metadata.dat` | `649aac59ad865099cd9716ccf7604e0fe6bcfc01f4d0e2b05f1451f6da2e4b9d` |

The unpacked manifests identify UnityFS v8 / Unity 2022.3.62f2 and bind each bundle digest. `core-character-structure.json`, `core-camera-structure.json`, `metadata-selected.json`, `resolved-field-layouts.json` and the local decode scripts preserve the decoding/mapping boundary. These are saved analyst outputs, not separate runtime attestations.

REA evidence `ev_e53462bbf8b67bb67214a578a75596d1c06b085dce8e47eb233599a57ea20273` in `character-motor-config-objdump-rea.json` records the constructor disassembly, complete command result and unchanged native digest. `character-motor-config-rea.json` is a failed Hopper attempt and supplies no successful native semantic evidence. Other assembly text files are saved local disassembly without independently retained REA IDs.

## Serialized movement baseline and reconstruction scale

`core-character-decoded.json`: `CharacterMotorConfig`, path ID `8858910492168667143`, object offset `240224`, size `224`, type ID `24`. The asset overrides constructor defaults. For example, constructor gravity/speeds/lane duration are −40 / 25→35 / .5; the serialized asset is −200 / 110→220 / .27. Constructor values must not replace this asset baseline.

The reconstruction deliberately chooses `s = 1.75 / 9 = 0.19444444444444445` from its standing height and the serialized collider height. Multiply world distances, velocities and accelerations by `s`; preserve seconds, ratios, angles and normalized curve coordinates. This is a chosen uniform scale, not recovered original renderer units or a metric measurement. Shared HUD distance labeled metres is therefore a reconstruction unit convention.

| Serialized field | Original baseline | Shared reconstruction value / interpretation |
|---|---:|---|
| `Gravity` | −200 | `gravity = 38.88888888888889`, magnitude subtracted by integrator |
| `InitialTargetSpeed` | 110 | `initialSpeed = 21.38888888888889` |
| `FinalTargetSpeed` | 220 | `maxSpeed = 42.77777777777778` |
| `TargetSpeedAccelerationDuration` | 179 s | `acceleration = (220−110)*s/179 = .11949099937926753`; linear ramp is a reconstruction inference |
| `LaneChangeDuration` | .2700000107 s | `.27` |
| `MinimumTravelBeforeAllowingLaneChange` | 1.5 | `.2916666666666667` |
| `JumpHeight`, `AirJumpHeight` | 20, 20 | `jumpHeight = 3.888888888888889`; air jump is not implemented as a separate ability |
| `GroundedTimeExtensionForForgivingJumps` | .150000006 s | `.15` |
| `JumpDiveVelocityY` | −90 | `diveVelocity = −17.5` |
| `RollDuration` | .6000000238 s | `.6` |
| `ColliderHeight` | 9 | `standingHeight = 1.75` |
| `LaneChangeXCurve` | (0,0)→(1,1), inner slopes 1, weighted mode 0 | Linear normalized interpolation; outer slopes 0 do not make the interval smoothstep |

The serialized `ability_JetpackLaneChanging` at path ID `2362644830000971057` enables `_laneChangingDuration = .5400000215`; shared `.54` preserves that selected override. Actual activation and override precedence have not been traced.

With ordinary ballistic motion, launch velocity is `sqrt(2*200*20)*s = 17.391639824998364`, and same-height airtime is `2*sqrt(2*20/200) = .894427191 s`. These are derived, not sampled timings. Shared fixed-step semi-implicit integration introduces a small trajectory error relative to an analytic parabola. `ability_HighJump`, path ID `-7221307898038548888`, enables a height multiplier of 2, air-jump height 9 and a non-linear three-key curve override. Shared `superJumpVelocity = 24.59549291242073` reproduces a ballistic double-height target only; it does not reproduce that curve.

Other verified serialized fields: `StickToGround=1`, `SkipHolesLookaheadDistance=4`, `JumpOnGroundedLaneChanges=1`, `AllowLaneChangingTowardsBoundaries=0`, `_endRollAutomatically=0`, `LowerImpactMaxHeight≈.33`, `UpperImpactMinHeight≈.66`, `LowerImpactHeightRatioThreshold≈.72`, `CornerImpactRegionDepthMin=8`, `CornerImpactRegionDepthMax=13`, `CornerImpactRegionWidth≈5.66`, `SurfaceMaxUpwardsSpeed=75`, `IsNonPlayerCharacter=0`. Their full consumers/units and event semantics were not traced; do not automatically treat ratios as distances or infer roll lifetime from the boolean alone.

## Native semantic coverage

- `lane-change-duration-assembly.txt`, `CharacterMotor.GetLaneChangeDuration`, `0x1e568f0`: divides a base-duration result by `max(1, stateField/configField)` using offsets `0x1cc` and config `0x68`. This establishes a runtime duration modifier path. The short saved window does not resolve those fields or the complete base-duration selector; `.27/.54` alone are not complete original semantics.
- `jump-duration-assembly.txt`, `JumpCurve.ComputeDuration`, `0x1e31e88`: metadata names struct fields `Gravity`, `Height`, `EndOffsetY`; saved arithmetic uses square roots and an end-height-dependent solution, with a non-finite fallback to twice the ascent time. It supports the same-height ballistic duration above, not a claim that the complete original jump is integrated exactly like the recreation.
- `camera-config-assembly.txt` and `method-addresses.json` bind config accessors and modifier application. `gameplay-camera-update-assembly.txt`, `GameplayCameraState.OnStateUpdate`, `0x1e5bf30`, applies modifiers, updates FOV and interpolates camera/focus per axis; `Lerp` at `0x1e5c1b4` clamps each factor to [0,1]. Full configuration selection, startup, ability and environment paths remain partial.

## Camera baseline and limits

`core-camera-decoded.json`: `camConfig_Run`, path ID `4846821469368467633`, offset `21016`, size `188`. Its static baseline is speed `(15,7.5,200)`, offset `(0,33,−33)`, bias `(.75,1,1)`, field of view `68`, priority `99`, apply-instantly false, shake power `1.5`. It references DefaultOffset, SpeedFOV, Grounded, SpecialJump and Environment modifiers. Flying config has offset `(0,32.4000015,−33)`, bias `(.89999998,1,1)`, speed `(15,300,1200)`, apply-instantly true, FOV `68` and a separate Fly modifier. These are distinct state configurations.

`camera-offset-modifier-assembly.txt`, `CameraOffsetModifier.Apply`, `0x1e5fa38`, combines a transform position with config offset, multiplies by offset bias, then adds a Z constant of −180 (`0xc3340000`). Thus copying only `(0,33,−33)*s` into a new coordinate system cannot establish equivalent framing. `camera-fov-aspect-assembly.txt`, `CameraFovScreenAspectAdjuster.ComputeFov`, `0x23b39a8`, shows an additional aspect-dependent FOV computation; its active component values and connection to gameplay are unresolved.

Shared `camera.verticalFov=68` matches a serialized base. Shared position `(0,6.2,7.45)`, target `(0,.41,−14)`, lateral follow `.75/.55`, vertical follow `.12/.82` and image targets remain fitted reconstruction choices. Serialized bias `.75` is not by itself proof that the recreation's lateral-follow equation is equivalent. The SpeedFOV modifier carries ability offsets `25,20,18,9,−14` with smoothing `2`; runtime ability identity/selection and final FOV remain unresolved. Screenshots constrain composition, not a unique camera transform.

## Implementation discrepancies at the audit snapshot

These observations precede any platform corrections made in the current continuation; source changes and fresh tests must resolve them.

1. Web consumes the new normalized values and linear lane interpolation. Android/iOS still interpolate lanes with smoothstep, do not consume jetpack `.54`, minimum travel or `.15` grounded jump grace, and hardcode airborne dive to `−15`. Android additionally hardcodes roll to `.7`; iOS consumes shared `.6`. Android's loader supplies only the original ten `Tuning` parameters. Its actual loaded core speeds/gravity are therefore updated, despite stale default values in `Tuning`.
2. Web clamps a boundary swipe, resets lane interpolation and updates the travel gate even when the requested lane is unchanged. Both native implementations also restart boundary movement. The serialized boundary flag is false; complete original rejection semantics remain untraced. At minimum, prevent a rejected edge input from delaying a valid opposite input as a reconstruction consistency fix.
3. Android and iOS repeat routes using hardcoded `3648`; shared route now repeats at `6144`. iOS additionally uses the obsolete spawn-row gate `76 + 38*nextRow` instead of shared first row `96` / spacing `64`. These are cross-platform reconstruction bugs, independent of unknown original generation semantics.
4. Shared camera provenance names `m_FieldOfView`, but the decoded key is `_fieldOfView`; correct the citation spelling. The numerical `68` matches. `docs/investigation.md`, `docs/evidence-ledger.md` and `fidelity-correction.md` retain earlier claims that numeric constants were wholly unknown/no native disassembly was performed; those claims need a dated reference to this later static baseline while preserving runtime gaps.

## Remaining evidence gaps

Runtime activation of the selected motor/camera assets; modifier precedence and speed curve; real lane spacing and renderer scale; lane boundary/reversal/grounded-lane-jump behavior; high-jump and roll event semantics; collision corner/stumble rules; pickup radii; upgrade-dependent power duration; original route generation; score/distance conversion; dynamic FOV and camera focus; and original iOS internals remain unresolved. `laneWidth=2.7`, player radius/rolling height, route spacing, power timers, score formula and fitted camera have no complete original semantic proof in this selected evidence. Existing recordings are original runtime observations but have not been used here to validate those numeric baselines or modifiers.
