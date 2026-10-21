# Current gameplay media

`outputs/web/RailRush-gameplay.mp4` shows the recovered-asset release: original Jake/animations, Ireland scenery, trains, pickups and original soundtrack. It is 74.28 seconds, 430×932 portrait H.264 (`avc1`), 25 fps, 1,857 decoded frames, with one audio track. All video frames decode with monotonic timestamps; audio PCM decoding also passes. Metadata is in `outputs/web/recovered-revision/video-verification.json`.

The source WebM records an extended 65-second natural run using ordinary DOM keyboard input from an obstacle-reading autoplayer. There is no diagnostic gameplay-state mutation, restart or page error, and all five powers are encountered naturally. Its report is `outputs/web/recovered-revision/natural-play.json`. The MP4 includes startup/menu time.

The soundtrack was added from the recovered original music file during AVFoundation export at reduced volume. It is not a capture of live sound effects and does not establish phone/acoustic quality. `scripts/export-gameplay.py`, `mux-gameplay.swift` and `verify-gameplay.swift` reproduce export and decode verification using installed local tools.

Actual Chrome local-file playback is checked by `apps/web/tests/video-playback.mjs`; its report and representative 0/30/60-second samples are under `outputs/web/recovered-revision/`. Intermediate PNG sequences are task-owned temporary files removed after export.

Earlier clips/reports are historical. Android images are from the local emulator; its power cases use labeled synthetic pickups. iOS images are same-source macOS SceneKit previews, excluding SwiftUI and actual iOS execution.
