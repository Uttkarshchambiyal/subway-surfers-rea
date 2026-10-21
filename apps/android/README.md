# Native Android game

Kotlin, Android Views and GLES2. Requires JDK17+, SDK36 and Gradle dependencies. Run `python3 scripts/recovery/stage-assets.py` from the workspace root before a native build.

```sh
./gradlew --offline assembleDebug testDebugUnitTest
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.railrush.game/.MainActivity
```

The local APK requires API26+, uses a debug signature, requests no network permission and includes recovered assets/audio. Current emulator evidence, test commands and limitations are in `../../docs/android.md`.
