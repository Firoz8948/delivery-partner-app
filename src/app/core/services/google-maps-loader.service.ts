import { Injectable } from '@angular/core';

export type GoogleMapsApi = any;

declare global {
  interface Window {
    google?: any;
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loading: Promise<GoogleMapsApi> | null = null;

  load(apiKey: string): Promise<GoogleMapsApi> {
    if (typeof window !== 'undefined' && window.google?.maps) {
      return Promise.resolve(window.google);
    }
    if (this.loading) return this.loading;
    if (!apiKey) {
      return Promise.reject(new Error('Google Maps API key missing'));
    }

    this.loading = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-le-maps]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(window.google as GoogleMapsApi));
        existing.addEventListener('error', () => reject(new Error('Maps script failed')));
        return;
      }
      const script = document.createElement('script');
      script.dataset['leMaps'] = '1';
      script.async = true;
      script.defer = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&libraries=geometry,places&v=weekly`;
      script.onload = () => resolve(window.google as GoogleMapsApi);
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
    return this.loading;
  }
}
