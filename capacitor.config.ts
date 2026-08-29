import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lalganjeats.deliverypartner',
  appName: 'Delivery Partner LalganjEats',
  webDir: 'dist/delivery-partner-app/browser',
  server: {
    androidScheme: 'https',
    hostname: 'dp.lalganjeats.com',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert', 'list'],
    },
  },
};

export default config;
