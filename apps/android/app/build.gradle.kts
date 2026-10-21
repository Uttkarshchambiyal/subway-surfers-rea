plugins { id("com.android.application") }
android {
    namespace = "com.railrush.game"
    compileSdk = 36
    defaultConfig { applicationId = "com.railrush.game"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "1.0"; testInstrumentationRunner = providers.gradleProperty("railrushTestRunner").getOrElse("com.railrush.game.NativeSmoke") }
    sourceSets["main"].assets.srcDirs("../../../shared/native-resources")
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    testOptions.unitTests.isReturnDefaultValues = true
}
dependencies { testImplementation("junit:junit:4.13.2") }
