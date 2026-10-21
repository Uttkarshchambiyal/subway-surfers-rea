#!/bin/zsh
set -euo pipefail
cd "${0:A:h}/../.."
xcodebuild -project apps/ios/RailRush.xcodeproj -scheme RailRush -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath outputs/ios/DerivedData CODE_SIGNING_ALLOWED=NO ARCHS=arm64 build
mkdir -p outputs/ios
/usr/bin/ditto outputs/ios/DerivedData/Build/Products/Debug-iphonesimulator/RailRush.app outputs/ios/RailRush.app
/usr/bin/ditto -c -k --keepParent outputs/ios/RailRush.app outputs/ios/RailRush-Simulator-arm64.zip
