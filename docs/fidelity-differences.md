# Fidelity boundary

The recovered release replaces the earlier procedural figure, trains and scenery with actual APK-derived assets. Jake's body/head, atlas, 26-bone skin and 24 clips are recovered; Ireland geometry and audio are recovered. It is a playable reconstruction with selected native-derived semantics, not a complete port of the original Unity program.

Remaining differences:

- The route generator is the local deterministic 96-row, 6,144-unit cycle. Original chunks/pooling data have been catalogued but the original full segment-selection logic is not ported.
- Web trains, ramps and blockers now retain uniform source proportions. Their collision sizes and roof-coin heights follow the rendered geometry; ramp support samples come from the original triangles. Roll clearance and the ramp/roof handoff remain reconstructed. Android/iOS still fit these instances to the earlier collision dimensions.
- The camera is fitted to saved reference composition. Original runtime camera modifiers, dynamic FOV, hitbox/stumble categories and enhanced-jump interpolation are not fully ported.
- The web renderer now uses 37 recovered clips, including original board, sneaker-running and jet-flight poses, a rig-mounted board and skinned super sneakers. Jetpack mounting and flame rendering remain reconstructed. Native clips use the previous 24-clip baked set at 30 Hz, with interpolated vertex positions. The original complete Animator, expression curves, animation event logic and all ability override layers are not reproduced.
- Common textured unlit/alpha/additive rendering replaces original Unity shaders. Particle systems, original real-time reflections and some shadow passes remain omitted.
- Guard/dog pursuit, revives and seasonal systems are absent. Menus, shop prices, mission goals, scoring/economy and some power/attachment behavior are local reconstruction choices.
- Android emulator and Chrome acceptance do not establish phone performance. The iOS app compiles, but no iOS Simulator runtime is installed and no iPhone signing or device run has been performed.

The original 20-source-unit lane spacing, speed-scaled lane duration, lateral reversal gate and proportional return are now implemented in all three engines. See [the recovered release report](revision/recovered-build.md) for addresses and evidence boundaries.
