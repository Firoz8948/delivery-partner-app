import { PortalPageHeaderComponent } from '../../../../shared/portal-page-header/portal-page-header.component';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import {
  DeliveryPortalService,
  DpDashboard,
  DpOrder,
} from '../../services/delivery-portal.service';

import { NotificationService } from '../../../../core/services/notification.service';
import { GpsFix, RiderLocationService } from '../../../../core/services/rider-location.service';

interface OrderWork {
  otp: string;
  otpVerified: boolean;
  lastDevOtp: string;
  sendingOtp: boolean;
  verifyingOtp: boolean;
  completing: boolean;
  cashAmount: number;
  onlineAmount: number;
  onlinePaid: boolean;
}

@Component({
  selector: 'app-dp-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PortalPageHeaderComponent,
    QRCodeComponent,
  ],
  templateUrl: './dp-home.component.html',
  styleUrl: './dp-home.component.scss',
})
export class DpHomeComponent implements OnInit, OnDestroy {
  private api = inject(DeliveryPortalService);
  private notif = inject(NotificationService);
  private router = inject(Router);
  /** Root-scoped: keeps pinging while the rider switches tabs / uses Google Maps. */
  riderLoc = inject(RiderLocationService);

  data = signal<DpDashboard | null>(null);
  error = signal('');
  busyId = signal<number | null>(null);
  acceptingAll = signal(false);
  orderWork = signal<Record<number, OrderWork>>({});
  orderDelivered = signal(false);
  deliveredStayOnHome = signal(false);

  // UPI/QR collection state
  qrModalOpen = signal(false);
  qrLoading = signal(false);
  qrCodeUrl = signal<string | null>(null);
  qrTxnId = signal<string>('');
  qrCheckingStatus = signal(false);
  qrError = signal<string>('');
  qrSecondsLeft = signal(0);
  qrLinkCopied = signal(false);
  private qrPoll?: ReturnType<typeof setInterval>;
  private qrTick?: ReturnType<typeof setInterval>;
  private qrExpiresAtMs = 0;
  private qrOrderId: number | null = null;
  private qrOrder: DpOrder | null = null;

  private poll?: ReturnType<typeof setInterval>;
  private knownOfferIds = new Set<number>();
  private isFirstDpLoad = true;
  private rememberedActives: DpOrder[] = [];
  activeList = signal<DpOrder[]>([]);
  expandedActiveId = signal<number | null>(null);

  ngOnInit() {
    // No GPS is read here: location is captured once on Accept and then
    // every 2 minutes only while an order is picked up.
    this.refresh();
    this.poll = setInterval(() => this.refresh(), 5000);
  }

  ngOnDestroy() {
    if (this.poll) clearInterval(this.poll);
    this.stopQrTimers();
    // Delivery pings intentionally keep running (root service).
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
        const actives = this.buildActiveList(d);
        this.activeList.set(actives);
        this.syncExpanded(actives);
        this.hydrateOrderWork(actives);
        this.syncLocationTracking(actives);
      },
      error: (e) => this.error.set(e.error?.detail || 'Failed to load'),
    });
  }

  /** Start 2-minute pings while any order is picked up; stop otherwise. */
  private syncLocationTracking(actives: DpOrder[]) {
    const pickedUp = actives
      .filter((o) => this.isPickedUp(o))
      .map((o) => o.id);
    if (pickedUp.length) {
      void this.riderLoc.startDeliveryTracking(pickedUp);
    } else {
      void this.riderLoc.stopDeliveryTracking();
    }
  }

  isPickedUp(o: DpOrder): boolean {
    const s = (o.status || '').toLowerCase();
    return s === 'picked_up' || s === 'out_for_delivery';
  }

  /** Directions deep link: Google Maps app routes from the rider's live GPS. */
  navUrl(lat?: number | null, lng?: number | null, address?: string | null): string | null {
    if (lat != null && lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    }
    if (address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
    }
    return null;
  }

  lastPingLabel(): string {
    const at = this.riderLoc.lastSentAt();
    if (!at) return 'sending first update...';
    const mins = Math.round((Date.now() - at) / 60000);
    return mins <= 0 ? 'updated just now' : `updated ${mins} min ago`;
  }

  allowMultiple(d: DpDashboard): boolean {
    return !!d.profile.allow_multiple_orders;
  }

  activeOrders(d: DpDashboard | null): DpOrder[] {
    if (this.activeList().length) return this.activeList();
    return this.buildActiveList(d);
  }

  isExpanded(order: DpOrder): boolean {
    if (this.activeList().length <= 1) return true;
    return this.expandedActiveId() === order.id;
  }

  toggleActive(orderId: number) {
    if (this.activeList().length <= 1) return;
    this.expandedActiveId.set(orderId);
  }

  statusLabel(status: string): string {
    if (status === 'picked_up') return 'Picked Up';
    if (status === 'out_for_delivery') return 'Out for delivery';
    if (status === 'ready') return 'Ready For Pickup';
    if (status === 'accepted') return 'Order Accepted';
    return status;
  }

  private mergeOrders(...groups: Array<DpOrder | DpOrder[] | null | undefined>): DpOrder[] {
    const byId = new Map<number, DpOrder>();
    for (const group of groups) {
      const items = Array.isArray(group) ? group : group ? [group] : [];
      for (const item of items) {
        if (item?.id != null) byId.set(item.id, item);
      }
    }
    return [...byId.values()].sort((a, b) => {
      const aAt = a.created_at || '';
      const bAt = b.created_at || '';
      if (aAt !== bAt) return aAt.localeCompare(bAt);
      return a.id - b.id;
    });
  }

  private isActiveStatus(status: string | undefined): boolean {
    return ['accepted', 'ready', 'picked_up', 'out_for_delivery'].includes(
      (status || '').toLowerCase(),
    );
  }

  private rememberActive(order: DpOrder | null | undefined) {
    if (!order?.id) return;
    this.rememberedActives = this.mergeOrders(this.rememberedActives, order);
    this.activeList.set(this.mergeOrders(this.activeList(), order));
  }

  private buildActiveList(d: DpDashboard | null): DpOrder[] {
    if (!d) return this.rememberedActives.filter((row) => this.isActiveStatus(row.status));
    const fromApi = this.mergeOrders(d.active_orders, d.active_order);
    if (d.active_orders && d.active_orders.length) {
      this.rememberedActives = fromApi;
      return fromApi;
    }
    const merged = this.mergeOrders(fromApi, this.rememberedActives).filter((row) =>
      this.isActiveStatus(row.status),
    );
    this.rememberedActives = merged;
    return merged;
  }

  private syncExpanded(orders: DpOrder[]) {
    if (!orders.length) {
      this.expandedActiveId.set(null);
      return;
    }
    const current = this.expandedActiveId();
    if (!current || !orders.some((row) => row.id === current)) {
      this.expandedActiveId.set(orders[0].id);
    }
  }

  w(o: DpOrder): OrderWork {
    return this.orderWork()[o.id] ?? this.defaultWork(o);
  }

  setOtp(o: DpOrder, value: string) {
    this.patchWork(o.id, { otp: value });
  }

  qrOnlineAmount(): number {
    if (this.qrOrderId == null) return 0;
    return this.orderWork()[this.qrOrderId]?.onlineAmount ?? 0;
  }

  qrOrderMatches(o: DpOrder): boolean {
    return this.qrOrderId === o.id;
  }

  private defaultWork(o?: DpOrder): OrderWork {
    const prepaid = o ? this.isPrepaid(o) : false;
    return {
      otp: '',
      otpVerified: !!o?.otp_verified,
      lastDevOtp: '',
      sendingOtp: false,
      verifyingOtp: false,
      completing: false,
      cashAmount: o && !prepaid ? o.customer_total : 0,
      onlineAmount: 0,
      onlinePaid: false,
    };
  }

  private patchWork(id: number, patch: Partial<OrderWork>) {
    this.orderWork.update((all) => {
      const current = all[id] ?? this.defaultWork();
      return { ...all, [id]: { ...current, ...patch } };
    });
  }

  private hydrateOrderWork(orders: DpOrder[]) {
    this.orderWork.update((all) => {
      const next: Record<number, OrderWork> = { ...all };
      const ids = new Set(orders.map((order) => order.id));
      for (const order of orders) {
        const existing = next[order.id];
        if (!existing) {
          next[order.id] = this.defaultWork(order);
        } else if (order.otp_verified && !existing.otpVerified) {
          next[order.id] = { ...existing, otpVerified: true };
        }
      }
      for (const id of Object.keys(next)) {
        const numId = Number(id);
        if (!ids.has(numId) && numId !== this.qrOrderId) {
          delete next[numId];
        }
      }
      return next;
    });
  }

  isPrepaid(o: DpOrder): boolean {
    return (o.payment_status || '').toLowerCase() === 'paid';
  }

  collectText(o: DpOrder): string {
    if (this.isPrepaid(o)) return 'Collect 0 Rs';
    return `Collect - ₹${o.customer_total}`;
  }

  telHref(phone?: string | null): string | null {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `tel:+91${digits}`;
    return `tel:+${digits.replace(/^0+/, '')}`;
  }

  toggleOnline() {
    this.api.toggleOnline().subscribe({ next: () => this.refresh() });
  }

  async accept(o: DpOrder) {
    this.notif.stopSound();
    this.busyId.set(o.id);
    // Single GPS fix on Accept — the only location read before pickup.
    const fix: GpsFix | null = await this.riderLoc.captureOnce().catch(() => null);
    this.api.accept(o.id, fix).subscribe({
      next: (res: any) => {
        this.busyId.set(null);
        this.rememberActive(res?.order || o);
        this.refresh();
      },
      error: (e) => { this.busyId.set(null); this.error.set(e.error?.detail || 'Accept failed'); },
    });
  }

  async acceptAll(orders: DpOrder[]) {
    if (!orders.length || this.acceptingAll()) return;
    this.notif.stopSound();
    this.acceptingAll.set(true);
    this.error.set('');
    const fix: GpsFix | null = await this.riderLoc.captureOnce().catch(() => null);
    const run = (index: number) => {
      if (index >= orders.length) {
        this.acceptingAll.set(false);
        this.refresh();
        return;
      }
      this.api.accept(orders[index].id, fix).subscribe({
        next: (res: any) => {
          this.rememberActive(res?.order || orders[index]);
          run(index + 1);
        },
        error: (e) => {
          this.acceptingAll.set(false);
          this.error.set(e.error?.detail || 'Could not accept all orders');
          this.refresh();
        },
      });
    };
    run(0);
  }

  reject(o: DpOrder) {
    this.notif.stopSound();
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
    this.patchWork(o.id, { sendingOtp: true });
    this.error.set('');
    this.api.sendOtp(o.id).subscribe({
      next: (res) => {
        this.patchWork(o.id, {
          sendingOtp: false,
          lastDevOtp: res.dev_otp || this.w(o).lastDevOtp,
        });
      },
      error: (e) => {
        this.patchWork(o.id, { sendingOtp: false });
        this.error.set(e.error?.detail || 'Failed to send OTP to customer');
      },
    });
  }

  verifyOtp(o: DpOrder) {
    const code = this.w(o).otp.trim();
    if (code.length < 4 || code.length > 6) {
      this.error.set('Please enter the 4-digit OTP sent to customer');
      return;
    }
    this.patchWork(o.id, { verifyingOtp: true });
    this.error.set('');
    this.api.verifyOtp(o.id, code).subscribe({
      next: () => {
        this.patchWork(o.id, { verifyingOtp: false, otpVerified: true });
        this.refresh();
      },
      error: (e) => {
        this.patchWork(o.id, { verifyingOtp: false });
        this.error.set(e.error?.detail || 'Invalid or expired OTP. Please try again.');
      },
    });
  }

  setFullCash(a: DpOrder) {
    this.patchWork(a.id, {
      cashAmount: a.customer_total,
      onlineAmount: 0,
      onlinePaid: false,
    });
  }

  setFullOnline(a: DpOrder) {
    this.patchWork(a.id, {
      cashAmount: 0,
      onlineAmount: a.customer_total,
      onlinePaid: false,
    });
  }

  setSplitHalf(a: DpOrder) {
    const half = Math.round(a.customer_total / 2);
    this.patchWork(a.id, {
      cashAmount: half,
      onlineAmount: Math.max(0, a.customer_total - half),
      onlinePaid: false,
    });
  }

  onSplitChange(a: DpOrder, mode: 'cash' | 'online', val: number) {
    const num = Math.max(0, Number(val) || 0);
    const total = a.customer_total;
    if (mode === 'cash') {
      this.patchWork(a.id, {
        cashAmount: num,
        onlineAmount: Math.max(0, total - num),
        onlinePaid: false,
      });
    } else {
      this.patchWork(a.id, {
        onlineAmount: num,
        cashAmount: Math.max(0, total - num),
        onlinePaid: false,
      });
    }
  }

  /** Whether payment collection has reached a completable state. */
  paymentReady(a: DpOrder): boolean {
    if (this.isPrepaid(a)) return true;
    const work = this.w(a);
    const total = a.customer_total;
    const sum = (work.cashAmount || 0) + (work.onlineAmount || 0);
    if (Math.abs(sum - total) > 0.01) return false;
    if (work.onlineAmount > 0 && !work.onlinePaid) return false;
    return true;
  }

  /** Ask backend for a Razorpay Payment Link URL, show QR modal, then poll for success. */
  openUpiQr(a: DpOrder) {
    const work = this.w(a);
    if (work.onlineAmount <= 0) return;
    if (this.qrLoading()) return;

    this.stopQrTimers();
    this.qrError.set('');
    this.qrCodeUrl.set(null);
    this.qrTxnId.set('');
    this.qrSecondsLeft.set(0);
    this.qrLinkCopied.set(false);
    this.qrOrderId = a.id;
    this.qrOrder = a;
    this.qrLoading.set(true);
    this.qrModalOpen.set(true);

    this.api.initiateOnlineCollection(a.id, work.onlineAmount).subscribe({
      next: (res) => {
        this.qrLoading.set(false);
        this.qrCodeUrl.set(res.qr_url);
        this.qrTxnId.set(res.txnid);
        this.startQrTimers(this.expirySeconds(res.expires_in_seconds, res.expires_at));
      },
      error: (e) => {
        this.qrLoading.set(false);
        this.qrError.set(e.error?.detail || 'Could not start UPI collection. Please retry.');
      },
    });
  }

  /** Regenerate a fresh payment link (after expiry or a failed attempt). */
  refreshUpiQr() {
    if (this.qrOrder) this.openUpiQr(this.qrOrder);
  }

  closeQrModal() {
    this.qrModalOpen.set(false);
    this.stopQrTimers();
  }

  qrExpired(): boolean {
    return !!this.qrCodeUrl() && this.qrSecondsLeft() <= 0;
  }

  qrCountdown(): string {
    const s = Math.max(0, this.qrSecondsLeft());
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  async copyQrLink() {
    const url = this.qrCodeUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.qrLinkCopied.set(true);
      setTimeout(() => this.qrLinkCopied.set(false), 2000);
    } catch {
      this.qrLinkCopied.set(false);
    }
  }

  private expirySeconds(expiresIn?: number, expiresAt?: string | null): number {
    if (expiresIn && expiresIn > 0) return expiresIn;
    const at = expiresAt ? Date.parse(expiresAt) : NaN;
    return Number.isFinite(at) ? Math.max(0, Math.round((at - Date.now()) / 1000)) : 15 * 60;
  }

  private startQrTimers(seconds: number) {
    this.stopQrTimers();
    this.qrExpiresAtMs = Date.now() + seconds * 1000;
    this.qrSecondsLeft.set(seconds);
    this.qrPoll = setInterval(() => this.checkQrPaymentNow(), 3500);
    this.qrTick = setInterval(() => {
      const left = Math.max(0, Math.round((this.qrExpiresAtMs - Date.now()) / 1000));
      this.qrSecondsLeft.set(left);
      if (left <= 0) {
        // One last check in case the payment landed right before expiry.
        this.checkQrPaymentNow();
        this.stopQrTimers();
      }
    }, 1000);
  }

  private stopQrTimers() {
    if (this.qrPoll) {
      clearInterval(this.qrPoll);
      this.qrPoll = undefined;
    }
    if (this.qrTick) {
      clearInterval(this.qrTick);
      this.qrTick = undefined;
    }
  }

  checkQrPaymentNow() {
    const orderId = this.qrOrderId;
    const txnid = this.qrTxnId();
    if (!orderId || !txnid || this.qrCheckingStatus()) return;

    this.qrCheckingStatus.set(true);
    this.api.getOnlineCollectionStatus(orderId, txnid).subscribe({
      next: (res) => {
        this.qrCheckingStatus.set(false);
        if (res.paid) {
          if (this.qrOrderId != null) {
            this.patchWork(this.qrOrderId, { onlinePaid: true });
          }
          this.closeQrModal();
        }
      },
      error: () => {
        this.qrCheckingStatus.set(false);
      },
    });
  }

  canComplete(a: DpOrder): boolean {
    const work = this.w(a);
    if (!work.otpVerified) return false;
    if (this.isPrepaid(a)) return true;
    const need = a.customer_total;
    const have = (work.cashAmount || 0) + (work.onlineAmount || 0);
    if (Math.abs(have - need) > 0.01) return false;
    if (work.onlineAmount > 0 && !work.onlinePaid) return false;
    return true;
  }

  complete(o: DpOrder) {
    const work = this.w(o);
    this.patchWork(o.id, { completing: true });
    this.error.set('');
    const payload = {
      otp: work.otp.trim(),
      cash_amount: work.cashAmount,
      online_amount: work.onlineAmount,
      collection_txnid: this.qrTxnId() || undefined,
    };
    this.api.complete(o.id, payload).subscribe({
      next: () => {
        this.patchWork(o.id, { completing: false });
        this.orderWork.update((all) => {
          const next = { ...all };
          delete next[o.id];
          return next;
        });
        this.rememberedActives = this.rememberedActives.filter((item) => item.id !== o.id);
        this.activeList.update((rows) => rows.filter((item) => item.id !== o.id));
        const remaining = this.activeList();
        this.deliveredStayOnHome.set(remaining.length > 0);
        this.orderDelivered.set(true);
        this.refresh();
        setTimeout(() => {
          this.orderDelivered.set(false);
          this.deliveredStayOnHome.set(false);
          if (remaining.length === 0) {
            this.qrTxnId.set('');
            this.qrCodeUrl.set(null);
            this.qrOrderId = null;
            this.router.navigate(['/deliverypartner/orders']);
          }
        }, 1800);
      },
      error: (e) => {
        this.patchWork(o.id, { completing: false });
        this.error.set(e.error?.detail || 'Failed to complete delivery');
      },
    });
  }

  /**
   * Opens the Google Maps APP with driving directions from the rider's live
   * position (no origin given → Maps uses device GPS). Costs us nothing.
   */
  openDirections(lat?: number | null, lng?: number | null, address?: string | null) {
    const url = this.navUrl(lat, lng, address);
    if (url) window.open(url, '_system');
  }
}
