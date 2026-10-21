# Web model proportions, 2026-10-21

The web renderer previously retained source model width while independently compressing height and depth to placeholder collision dimensions. The stationary train was reduced from roughly 5.45 units tall to 3, and the three-car moving train from roughly 33.55 units long to 10. This flattened models and distorted their textures.

Web obstacle instances now retain the same absolute scale on X, Y and Z: `referenceUnitScale = 7/36` (Z is reflected for coordinate conversion). Alignment uses translation only. Dimensions are measured from visible indexed triangles, excluding unrelated unused vertices in Unity's shared vertex buffers. Trains, ramps and both barrier types keep their recovered proportions.

The browser engine receives those dimensions after asset loading. Route instances use their actual depth; ramps end at the associated train's leading edge; roof coins follow train height. Ramp support is sampled along the original mesh triangles. Collision width and height follow the visible models. The roll crossbar clearance remains a reconstructed 1.6 units, and a small roof-seam tolerance bridges the ramp's open mesh edge. This is not a recovered original Unity collider system.

The camera keeps the canvas aspect ratio and smoothly limits horizontal FOV to 75 degrees on wide displays, reducing peripheral perspective distortion. Portrait vertical FOV remains 68 degrees.

Validation:

- All 29 Node tests and the TypeScript/production build passed.
- Chrome verified uniform model scale, full train dimensions, an engine-driven ramp-to-roof traversal, and matching CSS/render-buffer aspect ratios.
- Fifteen stationary QA screenshots cover all five obstacle types at 1440x900, 430x932 and 2560x1080. These are fixtures, not natural-play screenshots.
- The passing browser run reported no page errors. Report and images: `outputs/web/proportions-fix/`.
- During initial checks, simultaneous asset requests exposed the Python preview server's small connection backlog. Its queue is now 128; the preview was restarted at the same address, `http://127.0.0.1:8175/`.

This change applies to the web build and refreshed web/source ZIPs. Android/iOS instance fitting has not been changed. The existing gameplay MP4 predates this correction.
