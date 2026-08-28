import { PortalPageHeaderComponent } from '../../../../shared/portal-page-header/portal-page-header.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DeliveryPortalService,
  DpDashboard,
  DpOrder,
} from '../../services/delivery-portal.service';

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

import { NotificationService } from '../../../../core/services/notification.service';
import { DpOrderLiveMapComponent } from '../dp-order-live-map/dp-order-live-map.component';

@Component({
  selector: 'app-dp-home',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalPageHeaderComponent, DpOrderLiveMapComponent],
  templateUrl: './dp-home.component.html',
  styleUrl: './dp-home.component.scss',
})
export class DpHomeComponent implements OnInit, OnDestroy {
  private api = inject(DeliveryPortalService);
  private notif = inject(NotificationService);

  data = signal<DpDashboard | null>(null);
  error = signal('');
  busyId = signal<number | null>(null);
  otp = '';
  otpVerified = signal(false);
  lastDevOtp = signal('');
  cashAmount = 0;
  onlineAmount = 0;
  onlinePaid = signal(false);
  razorpayOrderId = '';
  razorpayPaymentId = '';
  razorpaySignature = '';

  // Live Location Signals for Hero Banner
  currentLat = signal<number | null>(null);
  currentLng = signal<number | null>(null);
  locationName = signal<string>('');
  locationActive = signal<boolean>(false);
  requestingLocation = signal<boolean>(false);

  private poll?: ReturnType<typeof setInterval>;
  private geoWatch?: number;
  private capWatchId?: string;
  private knownOfferIds = new Set<number>();
  private isFirstDpLoad = true;

  ngOnInit() {
    this.refresh();
    this.poll = setInterval(() => this.refresh(), 5000);
    // Snappy single-click location fetch
    this.fetchFastLocation().catch(() => {});
  }

  ngOnDestroy() {
    if (this.poll) clearInterval(this.poll);
    if (this.geoWatch != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.geoWatch);
    }
    if (this.capWatchId) {
      Geolocation.clearWatch({ id: this.capWatchId }).catch(() => {});
    }
  }

  refresh() {
    this.api.dashboard().subscribe({
      next: (d) => {
        let hasNewOffer = false;
        let newestOfferNum = '';

        if (d.available_orders) {
          for (const o of d.available_orders) {
            if (!this.knownOfferIds.has(o.id)) {
              this.knownOfferIds.add(o.id);
              hasNewOffer = true;
              newestOfferNum = o.order_number;
            }
          }
        }

        if (hasNewOffer && !this.isFirstDpLoad) {
          this.notif.notifyNewOffer(newestOfferNum);
        }

        this.isFirstDpLoad = false;
        this.data.set(d);
        const active = d.active_order;
        if (active?.otp_verified) this.otpVerified.set(true);
        if (
          active
          && !this.onlinePaid()
          && !this.otp.trim()
          && (active.payment_status || '').toLowerCase() !== 'paid'
          && this.cashAmount === 0
          && this.onlineAmount === 0
        ) {
          this.cashAmount = active.customer_total;
          this.onlineAmount = 0;
        }
      },
      error: (e) => this.error.set(e.error?.detail || 'Failed to load'),
    });
  }

  isPrepaid(o: DpOrder): boolean {
    return (o.payment_status || '').toLowerCase() === 'paid';
  }

  async requestLocationPermission() {
    if (this.requestingLocation()) return;
    this.requestingLocation.set(true);
    this.error.set('');

    try {
      if (Capacitor.isNativePlatform()) {
        const check = await Geolocation.checkPermissions();
        if (check.location !== 'granted' && check.coarseLocation !== 'granted') {
          await Geolocation.requestPermissions();
        }
      }
      await this.fetchFastLocation();
    } catch (e: any) {
      console.warn('Location request error:', e);
      this.error.set('Could not fetch GPS location. Please ensure Location is enabled in phone settings.');
    } finally {
      this.requestingLocation.set(false);
    }
  }

  async fetchFastLocation(): Promise<void> {
    // 1. Try Native Capacitor Geolocation (Snappy on Android)
    if (Capacitor.isNativePlatform()) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 15000,
        });
        if (pos && pos.coords) {
          this.handleGeoPos(pos.coords.latitude, pos.coords.longitude);
          this.startLiveWatch();
          return;
        }
      } catch (e) {
        console.warn('High accuracy failed, attempting coarse:', e);
        try {
          const coarse = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 3000,
            maximumAge: 60000,
          });
          if (coarse && coarse.coords) {
            this.handleGeoPos(coarse.coords.latitude, coarse.coords.longitude);
            this.startLiveWatch();
            return;
          }
        } catch (e2) {
          console.warn('Coarse location also failed:', e2);
        }
      }
    }

    // 2. Browser Fallback
    if (navigator.geolocation) {
      return new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            this.handleGeoPos(pos.coords.latitude, pos.coords.longitude);
            this.startLiveWatch();
            resolve();
          },
          (err) => {
            navigator.geolocation.getCurrentPosition(
              (p2) => {
                this.handleGeoPos(p2.coords.latitude, p2.coords.longitude);
                this.startLiveWatch();
                resolve();
              },
              (err2) => {
                console.warn('Browser GPS error:', err2);
                reject(err2);
              },
              { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
            );
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
        );
      });
    }
  }

  private startLiveWatch() {
    if (Capacitor.isNativePlatform()) {
      Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 5000 },
        (pos) => {
          if (pos && pos.coords) {
            this.handleGeoPos(pos.coords.latitude, pos.coords.longitude);
          }
        }
      ).then(id => {
        this.capWatchId = id;
      }).catch(() => {});
    } else if (navigator.geolocation) {
      if (this.geoWatch != null) navigator.geolocation.clearWatch(this.geoWatch);
      this.geoWatch = navigator.geolocation.watchPosition(
        (pos) => this.handleGeoPos(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  }

  private handleGeoPos(lat: number, lng: number) {
    this.currentLat.set(lat);
    this.currentLng.set(lng);
    this.locationActive.set(true);

    if (!this.locationName()) {
      this.locationName.set('Lalganj Sector');
    }

    // Ping backend with updated rider coordinates
    this.api.pingLocation(lat, lng).subscribe({ error: () => {} });

    // Reverse geocode locality name in background
    this.reverseGeocodeLocality(lat, lng);
  }

  private reverseGeocodeLocality(lat: number, lng: number) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.address) {
          const loc = data.address.suburb ||
                      data.address.neighbourhood ||
                      data.address.village ||
                      data.address.town ||
                      data.address.city ||
                      data.address.county ||
                      'Lalganj Sector';
          this.locationName.set(loc);
        }
      })
      .catch(() => {});
  }

  toggleOnline() {
    this.api.toggleOnline().subscribe({ next: () => this.refresh() });
  }

  accept(o: DpOrder) {
    this.busyId.set(o.id);
    this.api.accept(o.id).subscribe({
      next: () => { this.busyId.set(null); this.refresh(); },
      error: (e) => { this.busyId.set(null); this.error.set(e.error?.detail || 'Accept failed'); },
    });
  }

  reject(o: DpOrder) {
    this.busyId.set(o.id);
    this.api.reject(o.id).subscribe({
      next: () => { this.busyId.set(null); this.refresh(); },
      error: (e) => { this.busyId.set(null); this.error.set(e.error?.detail || 'Reject failed'); },
    });
  }

  pickedUp(o: DpOrder) {
    this.busyId.set(o.id);
    this.api.pickedUp(o.id).subscribe({
      next: () => { this.busyId.set(null); this.refresh(); },
      error: (e) => { this.busyId.set(null); this.error.set(e.error?.detail || 'Update failed'); },
    });
  }

  sendOtp(o: DpOrder) {
    this.busyId.set(o.id);
    this.api.sendOtp(o.id).subscribe({
      next: (res) => {
        this.busyId.set(null);
        if (res.dev_otp) this.lastDevOtp.set(res.dev_otp);
      },
      error: (e) => {
        this.busyId.set(null);
        this.error.set(e.error?.detail || 'Send OTP failed');
      },
    });
  }

  verifyOtp(o: DpOrder) {
    const code = this.otp.trim();
    if (code.length !== 6) {
      this.error.set('Enter 6-digit OTP');
      return;
    }
    this.busyId.set(o.id);
    this.api.verifyOtp(o.id, code).subscribe({
      next: () => {
        this.busyId.set(null);
        this.otpVerified.set(true);
        this.refresh();
      },
      error: (e) => {
        this.busyId.set(null);
        this.error.set(e.error?.detail || 'Invalid OTP');
      },
    });
  }

  setFullCash(a: DpOrder) {
    this.cashAmount = a.customer_total;
    this.onlineAmount = 0;
    this.onlinePaid.set(false);
  }

  setFullOnline(a: DpOrder) {
    this.cashAmount = 0;
    this.onlineAmount = a.customer_total;
    this.onlinePaid.set(false);
  }

  setSplitHalf(a: DpOrder) {
    const half = Math.round(a.customer_total / 2);
    this.cashAmount = half;
    this.onlineAmount = Math.max(0, a.customer_total - half);
    this.onlinePaid.set(false);
  }

  onSplitChange(a: DpOrder, mode: 'cash' | 'online', val: number) {
    const num = Math.max(0, Number(val) || 0);
    const total = a.customer_total;
    if (mode === 'cash') {
      this.cashAmount = num;
      this.onlineAmount = Math.max(0, total - num);
    } else {
      this.onlineAmount = num;
      this.cashAmount = Math.max(0, total - num);
    }
    this.onlinePaid.set(false);
  }

  payOnlinePortion(a: DpOrder) {
    if (this.onlineAmount <= 0) return;
    this.busyId.set(a.id);
    this.api.createCollectionPayment(a.id, this.onlineAmount).subscribe({
      next: (pay) => {
        this.busyId.set(null);
        this.api.openCollectionCheckout(
          pay,
          (resp) => {
            this.razorpayOrderId = resp.razorpay_order_id;
            this.razorpayPaymentId = resp.razorpay_payment_id;
            this.razorpaySignature = resp.razorpay_signature;
            this.onlinePaid.set(true);
          },
          () => {
            this.error.set('Online payment was cancelled or failed.');
          }
        );
      },
      error: (e) => {
        this.busyId.set(null);
        this.error.set(e.error?.detail || 'Could not initiate collection payment');
      }
    });
  }

  canComplete(a: DpOrder): boolean {
    if (!this.otpVerified()) return false;
    if (this.isPrepaid(a)) return true;
    const need = a.customer_total;
    const have = (this.cashAmount || 0) + (this.onlineAmount || 0);
    if (Math.abs(have - need) > 0.01) return false;
    if (this.onlineAmount > 0 && !this.onlinePaid()) return false;
    return true;
  }

  complete(o: DpOrder) {
    this.busyId.set(o.id);
    this.error.set('');
    const payload = {
      otp: this.otp.trim(),
      cash_amount: this.cashAmount,
      online_amount: this.onlineAmount,
      razorpay_order_id: this.razorpayOrderId || undefined,
      razorpay_payment_id: this.razorpayPaymentId || undefined,
      razorpay_signature: this.razorpaySignature || undefined,
    };
    this.api.complete(o.id, payload).subscribe({
      next: () => {
        this.busyId.set(null);
        this.otp = '';
        this.otpVerified.set(false);
        this.cashAmount = 0;
        this.onlineAmount = 0;
        this.onlinePaid.set(false);
        this.refresh();
      },
      error: (e) => {
        this.busyId.set(null);
        this.error.set(e.error?.detail || 'Deliver failed');
      },
    });
  }

  openDirections(lat?: number | null, lng?: number | null, address?: string) {
    if (lat != null && lng != null) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        '_system',
      );
    } else if (address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
        '_system',
      );
    }
  }
}
