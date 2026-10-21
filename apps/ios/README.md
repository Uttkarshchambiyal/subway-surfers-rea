# Native iOS game

Open `RailRush.xcodeproj`, scheme **RailRush**, with an installed iOS Simulator. SceneKit/SwiftUI/AVFoundation use shared configuration and recovered assets. Stage resources from the workspace root with `python3 scripts/recovery/stage-assets.py`.

`./test-engine.sh` runs Foundation engine checks. `./build-simulator.sh` produces the unsigned arm64 Simulator app and ZIP. No developer account is needed for Simulator compilation. This machine has no Simulator runtime, so native iOS execution is unverified. No iPhone IPA/signing is supplied. See `../../docs/ios-verification.md`.
