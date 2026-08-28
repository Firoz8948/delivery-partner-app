export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000/api/v1',
  mainWebUrl: 'http://localhost:4200',
  /** WebSocket origin (no /api path suffix beyond what services append). */
  wsBaseUrl: 'ws://localhost:8000/api/v1',
  appName: 'LalganjEats',
  version: '1.0.0',
  tokenKey: 'le_token',
  userKey: 'le_user',
  /**
   * Client channel: 'web' | 'android_app' | 'ios_app' | 'auto'
   * Use android_app/ios_app to simulate Capacitor in browser.
   * Or set localStorage le_client_channel.
   */
  clientChannel: 'auto' as 'web' | 'android_app' | 'ios_app' | 'auto',
};
