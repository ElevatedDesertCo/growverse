import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.worldofclaudecraft',
  appName: 'Growverse',
  webDir: 'dist',
  plugins: {
    LiveUpdates: {
      appId: '9fa1b0c1',
      channel: 'Production',
      autoUpdateMethod: 'none',
      maxVersions: 2,
    },
  },
  server: {
    androidScheme: 'http',
  },
  ios: {
    contentInset: 'never',
  },
};

export default config;
