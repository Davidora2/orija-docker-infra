import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. Static defaults live in app.json.
 * Bake production API URL into native builds via EXPO_PUBLIC_API_URL.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Life OS',
  slug: config.slug ?? 'life-os',
  android: {
    ...config.android,
    package: config.android?.package ?? 'co.orijadesign.lifeos',
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
  },
  extra: {
    ...(typeof config.extra === 'object' && config.extra ? config.extra : {}),
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://lifeos.orija.store/api',
  },
});
