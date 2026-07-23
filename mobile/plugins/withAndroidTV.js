const {
  withAndroidManifest,
  AndroidConfig,
} = require("@expo/config-plugins");

/**
 * Adds Android TV leanback support while keeping phone installs working.
 */
function withAndroidTV(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }

    const features = manifest["uses-feature"];
    const ensureFeature = (name, required) => {
      const exists = features.some((f) => f.$?.["android:name"] === name);
      if (!exists) {
        features.push({
          $: {
            "android:name": name,
            "android:required": required ? "true" : "false",
          },
        });
      }
    };

    ensureFeature("android.software.leanback", false);
    ensureFeature("android.hardware.touchscreen", false);

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const activities = app.activity || [];
    for (const activity of activities) {
      if (!activity.$) activity.$ = {};
      activity.$["android:banner"] = "@drawable/splashscreen_logo";
      activity.$["android:screenOrientation"] = "sensorLandscape";

      const filters = activity["intent-filter"] || [];
      const hasLeanback = filters.some((f) =>
        (f.category || []).some(
          (c) => c.$?.["android:name"] === "android.intent.category.LEANBACK_LAUNCHER"
        )
      );
      if (!hasLeanback) {
        filters.push({
          action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
          category: [
            { $: { "android:name": "android.intent.category.LEANBACK_LAUNCHER" } },
          ],
        });
        activity["intent-filter"] = filters;
      }
    }

    return config;
  });
}

module.exports = withAndroidTV;
