import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fsms.mavii',
  appName: 'MAVII',
  webDir: 'www',
  server: {
    androidScheme: 'http',
    hostname: 'localhost',
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    SplashScreen: {
      launchShowDuration: 30000,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
