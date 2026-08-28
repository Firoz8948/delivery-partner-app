// frontend/src/app/core/utils/client-channel.ts
import { environment } from '../../../environments/environment';

export type ClientChannel = 'web' | 'android_app' | 'ios_app';

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

/**
 * Resolve client channel for promocodes + app landing.
 * Priority: localStorage override → Capacitor native → environment → web.
 */
export function getClientChannel(): ClientChannel {
  try {
    const stored = localStorage.getItem('le_client_channel');
    if (stored === 'android_app' || stored === 'ios_app' || stored === 'web') {
      return stored;
    }
  } catch {
    /* ignore */
  }

  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  if (cap?.isNativePlatform?.()) {
    const platform = (cap.getPlatform?.() || '').toLowerCase();
    return platform === 'ios' ? 'ios_app' : 'android_app';
  }

  const configured = (environment as { clientChannel?: string }).clientChannel;
  if (configured === 'android_app' || configured === 'ios_app' || configured === 'web') {
    return configured;
  }

  return 'web';
}

export function isMobileAppChannel(): boolean {
  const channel = getClientChannel();
  return channel === 'android_app' || channel === 'ios_app';
}

/** Delivery app landing used after logout. */
export function getDefaultLandingPath(): string {
  return '/auth/delivery-login';
}
