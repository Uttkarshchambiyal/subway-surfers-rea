# Asset provenance — current recovered release

The current three apps use third-party meshes, atlases, animation clips, scene geometry and audio recovered from the retained Subway Surfers 3.61.0 APK. The previous procedural replacement art is historical. The current release must not be described as containing only original artwork.

- `shared/recovered/character/manifest.json`: APK/bundle hashes, Unity object IDs, mesh/texture/clip export records and decoder corrections.
- `shared/recovered/environment/provenance.json`: addressable catalog/bundle dependency recovery records.
- `shared/recovered/environment/environment.json`: recovered meshes, UVs, material assignments, transforms, theme and pooling data.
- `shared/recovered/audio/manifest.json`: source clip identity and exported PCM hashes.
- `shared/recovered/native/render.json`: deterministic native scene/skin bake index, binary digest and bake limitations.
- `outputs/recovered-asset-manifest.json`: current recovered file sizes and SHA-256 values.

The apps still contain reconstruction code for rendering integration, route composition, controls, UI, persistence and gameplay. Recovery JSON retains placeholder materials; renderer-specific bindings restore the recovered common coin/pickup atlases. The default board uses the recovered common hoverboard palette. This does not establish the original full material-selection program.

`shared/native-resources/` and `apps/web/public/recovered/` are generated staging copies. Run `python3 scripts/recovery/stage-assets.py` to refresh them. The source archive omits the browser staging copy and includes its canonical source plus the staging script. The reference APK, extracted executable, cached tools and original-game recordings are excluded from delivery archives.
