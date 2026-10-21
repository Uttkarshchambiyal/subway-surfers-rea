# Android verification — current recovered release

`outputs/android/RailRush-debug.apk` is a debug-signed API26+ native Kotlin/GLES2 app. It renders recovered Jake geometry/24 source clips and the recovered Ireland environment, trains, blockers, pickups and board. The native scene baker produces 35 textured prefab/track entries. The APK requests no network permission.

The current APK passed 20 JVM engine regressions and all 29 instrumentation checks on the existing read-only `Flowers_API_36` ARM64/API36 emulator using host GPU rendering. Checks cover menus/settings, actual lane/jump/roll swipes, GLES-thread progression, pause/resume, five power fixtures, inventory shield, collision/results/restart and background/foreground behavior. `outputs/android/runtime-verification.json` records the tested APK hash and scope. Captures and the native report are in `outputs/android/recovered-runtime/`.

The five power cases insert labeled synthetic route-format pickups. They establish collection/effect plumbing, not natural encounter timing. A separate actual UI outfit purchase spends 120 existing earned coins once and restores ownership/selection after force-stop/relaunch; its five checks pass in `outputs/android/recovered-runtime/purchase-persistence.json`. This does not cover every transaction, a physical phone or acoustic playback. The emulator runs with audio disabled.

Build with installed JDK17+, SDK36 and cached Gradle dependencies:

```sh
python3 scripts/recovery/stage-assets.py
cd apps/android
./gradlew --offline assembleDebug assembleDebugAndroidTest testDebugUnitTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.railrush.game/.MainActivity
```

Optional UI runner:

```sh
adb install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w com.railrush.game.test/com.railrush.game.NativeSmoke
adb exec-out run-as com.railrush.game cat files/runtime-smoke.json
```

The playback/source archives do not include the reference APK. Recovery scripts and staged resources are documented in `revision/recovered-build.md`. Older Android logs/captures are historical; the `recovered-*` logs and current runtime report describe this release.
