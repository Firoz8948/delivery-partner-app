import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { environment } from '../../../environments/environment';

export interface AppManifest {
  update_available: boolean;
  version?: string;
  bundle_url?: string;
  checksum?: string;
  release_notes?: string;
  is_mandatory?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LiveUpdateService {
  private http = inject(HttpClient);
  private currentVersion = environment.version || '1.0.0';

  constructor() {
    this.checkForUpdates();
  }

  async checkForUpdates() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await CapacitorUpdater.notifyAppReady();

      const url = `${environment.apiBaseUrl}/app-updates/manifest?app_id=delivery_partner&version=${encodeURIComponent(this.currentVersion)}`;
      this.http.get<AppManifest>(url).subscribe({
        next: async (manifest) => {
          if (manifest.update_available && manifest.bundle_url && manifest.version) {
            console.log(`[OTA Rider] Downloading live update version ${manifest.version}...`);
            try {
              const bundle = await CapacitorUpdater.download({
                url: manifest.bundle_url,
                version: manifest.version,
                checksum: manifest.checksum || undefined,
              });

              if (bundle) {
                console.log(`[OTA Rider] Live update ${manifest.version} downloaded.`);
                if (manifest.is_mandatory) {
                  await CapacitorUpdater.set(bundle);
                  await CapacitorUpdater.reload();
                } else {
                  await CapacitorUpdater.set(bundle);
                }
              }
            } catch (err) {
              console.warn('[OTA Rider] Download failed:', err);
            }
          }
        },
        error: () => {}
      });
    } catch (e) {
      console.warn('[OTA Rider] Check failed:', e);
    }
  }
}
