import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eeriecast.app',
  appName: 'Eeriecast',
  webDir: 'dist',
  server: {
    // In production, the app loads from the built files in webDir.
    // During development, uncomment the line below and set it to your dev server URL:
    // url: 'http://YOUR_LOCAL_IP:5178',
    androidScheme: 'https',
  },
  plugins: {
    Browser: {
      // The in-app browser inherits the system theme by default.
      // No additional config needed.
    },
  },
};

export default config;
