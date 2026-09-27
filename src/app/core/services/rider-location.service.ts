import { Injectable, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type {
  BackgroundGeolocationPlugin,
  Location as BgLocation,
} from '@capacitor-community/background-geolocation';
import { DeliveryPortalService } from '../../features/delivery-portal/services/delivery-portal.service';

/**
 * Rider GPS policy (cost-free — nothing here talks to Google):
 *
 *  - Nothing is captured while idle / waiting for offers.
 *  - `captureOnce()` grabs a single fix when the rider taps Accept.
 *  - `startDeliveryTracking()` runs only while an order is picked up: the
 *    latest fix is sent to our backend every PING_MS (2 min). On a native
 *    build with the background-geolocation plugin this keeps working while
 *    the rider is inside the Google Maps app (foreground service +
 *    notification). On older APKs (plugin not compiled in) it falls back to
 *    a foreground timer.
 */
export const PING_MS = 2 * 60 * 1000;

const BackgroundGeolocation =
  registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
}

@Injectable({ providedIn: 'root' })
export class RiderLocationService {
  private api = inject(DeliveryPortalService);

  /** True while the 2-minute delivery pings are running. */
  tracking = signal(false);
  /** Whether the background (foreground-service) watcher is active. */
  backgroundCapable = signal(false);
  lastFix = signal<GpsFix | null>(null);
  lastSentAt = signal<number | null>(null);

  private orderIds: number[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private watcherId?: string;
  private pendingFix: GpsFix | null = null;
  private visibilityHandler = () => {
    if (document.visibilityState === 'visible' && this.tracking()) {
      const last = this.lastSentAt() ?? 0;
      if (Date.now() - last > 60_000) void this.tick();
    }
  };

  // ── One-shot fix (Accept) ───────────────────────────────────

  async captureOnce(timeoutMs = 8000): Promise<GpsFix | null> {
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch {
        /* ignore — try reading anyway */
      }
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 30_000,
        });
        return this.toFix(pos.coords);
      } catch {
        try {
          const coarse = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 120_000,
          });
          return this.toFix(coarse.coords);
        } catch {
          /* fall through to browser API */
        }
      }
    }
    if (!navigator.geolocation) return null;
    return new Promise<GpsFix | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(this.toFix(pos.coords)),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
      );
    });
  }

  // ── Periodic pings while picked up ──────────────────────────

  async startDeliveryTracking(orderIds: number[]): Promise<void> {
    const ids = [...orderIds].sort((a, b) => a - b);
    const same =
      this.tracking() &&
      ids.length === this.orderIds.length &&
      ids.every((id, i) => id === this.orderIds[i]);
    this.orderIds = ids;
    if (same) return;
    if (this.tracking()) {
      // Order set changed: keep the loop, just retarget.
      return;
    }

    this.tracking.set(true);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    await this.startBackgroundWatcher();

    // Immediate first ping, then every 2 minutes.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), PING_MS);
  }

  async stopDeliveryTracking(): Promise<void> {
    if (!this.tracking()) return;
    this.tracking.set(false);
    this.orderIds = [];
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.watcherId) {
      try {
        await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
      } catch {
        /* ignore */
      }
      this.watcherId = undefined;
    }
    this.backgroundCapable.set(false);
    this.pendingFix = null;
  }

  private async startBackgroundWatcher(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    if (!Capacitor.isPluginAvailable('BackgroundGeolocation')) return;
    try {
      this.watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: 'LalganjEats delivery in progress',
          backgroundMessage: 'Sharing your location with the customer every 2 minutes.',
          requestPermissions: true,
          stale: false,
          distanceFilter: 30,
        },
        (position?: BgLocation, error?) => {
          if (error || !position) return;
          const fix: GpsFix = {
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy_m: position.accuracy ?? null,
          };
          this.pendingFix = fix;
          this.lastFix.set(fix);
          // The JS timer may be throttled while Google Maps is in front; the
          // watcher callback keeps firing, so send from here when due.
          const last = this.lastSentAt() ?? 0;
          if (Date.now() - last >= PING_MS) void this.send(fix);
        },
      );
      this.backgroundCapable.set(true);
    } catch (e) {
      console.warn('[RiderLocation] background watcher unavailable:', e);
      this.backgroundCapable.set(false);
    }
  }

  private async tick(): Promise<void> {
    if (!this.tracking()) return;
    let fix = this.pendingFix;
    if (!fix || !this.backgroundCapable()) {
      fix = (await this.captureOnce(10_000)) ?? fix;
    }
    if (!fix) return;
    await this.send(fix);
  }

  private async send(fix: GpsFix): Promise<void> {
    if (!this.tracking()) return;
    this.lastFix.set(fix);
    this.lastSentAt.set(Date.now());
    const orderId = this.orderIds[0];
    this.api
      .pingLocation(fix.latitude, fix.longitude, {
        order_id: orderId,
        accuracy_m: fix.accuracy_m ?? null,
        source: 'pickup_ping',
      })
      .subscribe({ error: () => {} });
  }

  private toFix(c: { latitude: number; longitude: number; accuracy?: number | null }): GpsFix {
    return {
      latitude: c.latitude,
      longitude: c.longitude,
      accuracy_m: c.accuracy ?? null,
    };
  }
}
