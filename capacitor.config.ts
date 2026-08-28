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
};

export default config;
