# Actual Jake assets recovered from the supplied APK

These are third-party Subway Surfers 3.61.0 assets from the local
`reference/subway-surfers-3.61.0.apk`, not the earlier procedural study.
`manifest.json` records the APK digest, exact APK bundle members, per-member
digests, Unity object IDs, export hashes, and tool version.

## Ready to load

- `jake.glb`: self-contained glTF 2.0 with default Jake body, head, atlas,
  26-bone skin, and 24 named clips.
- `jake.gltf`, `jake.bin`, `jake_outfit0_tex.png`: the same data in editable,
  separate files.
- `jake.json`: ordinary JSON arrays for native implementations. `nodes` use
  glTF indices, local translation/quaternion/scale, and child node indices.
  `meshes` contain positions, UVs, triangle indices by submesh, bone indices,
  weights, `boneNodes`, and column-major inverse-bind matrices. `animations`
  contain shared per-clip times and local node tracks. Interpolate translation
  and scale linearly and rotation with quaternion slerp.

The mesh contains 1,264 vertices and 1,651 triangles across body and head.
Only the default body and head selected by the source
`Jake_Default_outfit_config` are instantiated. The optional two additional
outfit PNGs are recovered alternatives; the default mesh uses outfit 0.

Coordinates are right-handed Y-up, with source Unity Z reflected. The model
faces approximately -Z. The top `RecoveredJake` wrapper scales source units
by 0.2; set its scale to 1 for a scene using original game units. Source bind
geometry spans approximately 9.844 units vertically. Do not normalize the
animated bounds separately every frame; the source clips contain body bob,
root offsets, and airborne poses.

Example Three.js loading:

```js
const asset = await new GLTFLoader().loadAsync('/recovered/character/jake.glb');
scene.add(asset.scene);
const mixer = new THREE.AnimationMixer(asset.scene);
mixer.clipAction(THREE.AnimationClip.findByName(asset.animations, 'run')).play();
// Per rendered frame:
mixer.update(deltaSeconds);
```

Gameplay clips include `run`, `RunSlow`, `RunNormal`, `RunFast`, `jump`,
`hangtime`, `landing`, `roll`, `dodgeLeft`, `dodgeRight`, `introRun`, stumble
variants, and death variants. Menu clips include `Jake_Breathe`,
`Jake_Look_01`, `Jake_Look_02`, `Jake_Come_on`, `Jake_ScrollbarPose`, and
`idlePaint`. `stumble_variant` retains a second source clip also named
`stumble`; its original name and object ID are retained in JSON provenance.

## Recovery and verification

Run `.tools/unity-python/bin/python scripts/recovery/character-export.py`.
The source serialized files contain Unity generic transform curves. Dense,
constant, and streamed cubic source channels are decoded and sampled at at
least 30 Hz. Source CRC32 animation paths match the recovered Jake hierarchy.
The exported material uses the actual decoded ETC atlas with glTF unlit shading.
Unity Animator scalar parameters are preserved as skipped binding records;
they are not transform tracks. Source shader and state-machine code are not
included. Normals were recalculated because the shipped mesh omits normals.

The exporter corrects one specific UnityPy 1.25.4 decompression arithmetic
error: for the body's two four-influence vertices, UnityPy returned a fourth
weight of -26. The exact residual weight derived from the first three packed
weights is 4/31. These corrections are recorded, and every vertex is checked
for nonnegative, unit-sum skin weights. APK/bundle bytes remain unchanged.

`reference/recovered-character/preview.html` loads the actual GLB using
Three.js. `scripts/recovery/character-preview.mjs` rendered and captured run
front/back, jump, roll, and menu idle poses using headless Chrome. The PNG
evidence is in `reference/recovered-character/preview-*.png`.
