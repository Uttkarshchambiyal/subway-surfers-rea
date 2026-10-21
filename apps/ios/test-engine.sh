#!/bin/zsh
set -euo pipefail
cd "${0:A:h}/../.."
mkdir -p outputs/ios
xcrun swiftc -module-cache-path /tmp/railrush-swift-cache apps/ios/RailRush/GameEngine.swift apps/ios/Tests/main.swift -o outputs/ios/engine-tests
RAILRUSH_TESTS=1 outputs/ios/engine-tests "$PWD" > outputs/ios/engine-test-results.json
cat outputs/ios/engine-test-results.json
