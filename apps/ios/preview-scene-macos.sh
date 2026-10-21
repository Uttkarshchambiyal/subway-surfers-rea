#!/bin/zsh
# Scene geometry/camera inspection only: this does not launch the iOS app or show its SwiftUI HUD.
set -euo pipefail
cd "${0:A:h}/../.."
_previewDir=$(mktemp -d /tmp/subway-native-preview.XXXXXX)
trap 'rm -rf "$_previewDir"' EXIT
python3 - "$_previewDir" <<'PY'
import pathlib,re,sys
source=pathlib.Path('apps/ios/RailRush/SceneRenderer.swift').read_text()
source=source.replace('import UIKit','import AppKit\ntypealias UIColor = NSColor\ntypealias UIFont = NSFont\ntypealias UIImage = NSImage')
# SceneKit uses CGFloat vector components on macOS and Float components on iOS.
source=source.replace('position.x=Float(', 'position.x=CGFloat(').replace('position.z=Float(', 'position.z=CGFloat(').replace('? Float(Double.pi','? CGFloat(Double.pi').replace('node.eulerAngles.y=Float(', 'node.eulerAngles.y=CGFloat(')
pathlib.Path(sys.argv[1],'SceneRenderer.swift').write_text(source)
PY
xcrun swiftc -module-cache-path /tmp/subway-preview-cache apps/ios/RailRush/GameEngine.swift "$_previewDir/SceneRenderer.swift" apps/ios/Preview/main.swift -o "$_previewDir/preview"
RAILRUSH_TESTS=1 "$_previewDir/preview" "$PWD"
