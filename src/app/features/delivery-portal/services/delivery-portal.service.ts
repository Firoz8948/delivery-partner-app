import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface DpOrder {
  id: number;
  order_number: string;
  status: string;
  restaurant: string | null;
  restaurant_address?: string | null;
  restaurant_lat?: number | null;
  restaurant_lng?: number | null;
  delivery_address: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  customer_total: number;
  payout: number;
  distance_km_to_restaurant: number | null;
  distance_km_restaurant_to_customer: number | null;
  eta_minutes: number | null;
  map_to_restaurant: string | null;
  map_to_customer: string | null;
  payment_method: string;
  payment_status?: string;
  payment_label?: string;
  payment_mode?: string;
  payment_mode_label?: string;
  payment_verified?: boolean;
  payment_via?: string | null;
  prepaid_amount?: number;
  cash_amount?: number;
  otp_verified?: boolean;
  cash_collected?: number | null;
  online_collected?: number | null;
  items: {
    name: string;
    quantity: number;
    price: number;
    variant_label?: string | null;
    line_total?: number;
    line_label?: string;
  }[];
  created_at: string | null;
  delivered_at?: string | null;
}

export interface DpOrdersPage {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: DpOrder[];
}

export interface DpDashboard {
  profile: {
    is_online: boolean;
    full_name: string;
    phone: string;
    total_earnings: number;
    has_location: boolean;
    allow_multiple_orders?: boolean;
  };
  today: { orders: number; earnings: number };
  active_order: DpOrder | null;
  active_orders?: DpOrder[];
  available_orders: DpOrder[];
}

/** Response from initiating a UPI/QR doorstep collection via Razorpay Payment Link. */
export interface OnlineCollectionInitResponse {
  txnid: string;
  amount: number;
  qr_url: string;            // Razorpay payment-link short_url for QR
  payment_page_url: string;
  expires_at: string | null;
}

/** Polled while customer completes UPI payment on their phone. */
export interface OnlineCollectionStatusResponse {
  paid: boolean;
  amount: number;
  paid_at: string | null;
  txnid: string;
}

export interface RazorpayCheckoutSession {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  checkout_config_id?: string | null;
  name?: string;
  description?: string;
  remittance_id?: number;
  order_count?: number;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

declare const Razorpay: new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (resp: unknown) => void) => void;
};

@Injectable({ providedIn: 'root' })
export class DeliveryPortalService {
  private api = `${environment.apiBaseUrl}/delivery`;
  private payApi = `${environment.apiBaseUrl}/payment`;
  private locApi = `${environment.apiBaseUrl}/getlocation`;

  constructor(private http: HttpClient) {}

  dashboard(): Observable<DpDashboard> {
    return this.http.get<DpDashboard>(`${this.api}/dashboard`);
  }

  toggleOnline(): Observable<{ is_online: boolean }> {
    return this.http.patch<{ is_online: boolean }>(`${this.api}/toggle-online`, {});
  }

  accept(orderId: number) {
    return this.http.patch(`${this.api}/orders/${orderId}/accept`, {});
  }

  reject(orderId: number) {
    return this.http.patch(`${this.api}/orders/${orderId}/reject`, {});
  }

  pickedUp(orderId: number) {
    return this.http.patch(`${this.api}/orders/${orderId}/picked-up`, {});
  }

  onTheWay(orderId: number) {
    return this.http.patch(`${this.api}/orders/${orderId}/on-the-way`, {});
  }

  sendOtp(orderId: number) {
    return this.http.post<{ message: string; dev_otp?: string }>(
      `${this.api}/orders/${orderId}/send-otp`,
      {}
    );
  }

  verifyOtp(orderId: number, otp: string) {
    return this.http.post<{ verified: boolean }>(
      `${this.api}/orders/${orderId}/verify-otp`,
      { otp },
    );
  }

  /**
   * Initiate a Razorpay Payment Link for the online portion of a doorstep order.
   * Backend returns a short URL to be encoded in a QR the customer scans.
   */
  initiateOnlineCollection(orderId: number, onlineAmount: number) {
    return this.http.post<OnlineCollectionInitResponse>(
      `${this.api}/orders/${orderId}/collect-online/initiate`,
      { online_amount: onlineAmount },
    );
  }

  /** Poll payment-link status while DP is showing the QR to the customer. */
  getOnlineCollectionStatus(orderId: number, txnid: string) {
    return this.http.get<OnlineCollectionStatusResponse>(
      `${this.api}/orders/${orderId}/collect-online/status?txnid=${encodeURIComponent(txnid)}`,
    );
  }

  complete(
    orderId: number,
    payload: {
      otp: string;
      cash_amount: number;
      online_amount: number;
      collection_txnid?: string;
    },
  ) {
    return this.http.post(`${this.api}/orders/${orderId}/complete`, payload);
  }

  myOrders(filter = 'today', date?: string, page = 1) {
    const params = new URLSearchParams({ filter, page: String(page) });
    if (date) params.set('date', date);
    return this.http.get<DpOrdersPage>(`${this.api}/orders?${params.toString()}`);
  }

  earnings(filter = 'today') {
    return this.http.get(`${this.api}/earnings?filter=${filter}`);
  }

  cashOnHand() {
    return this.http.get<{
      cash_on_hand: number;
      order_count: number;
      orders: {
        id: number;
        order_number: string;
        cash_collected: number;
        customer_total: number;
      }[];
    }>(`${this.api}/cash-on-hand`);
  }

  cashRemittanceHistory(page = 1) {
    return this.http.get<{
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
      items: Record<string, unknown>[];
    }>(`${this.api}/cash-remittances?page=${page}`);
  }

  initiateCashRemit() {
    return this.http.post<RazorpayCheckoutSession>(`${this.api}/cash-remit/initiate`, {});
  }

  verifyCashRemit(payload: {
    remittance_id: number;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    return this.http.post(`${this.payApi}/verify-remittance`, payload);
  }

  /** Opens Razorpay Standard Checkout overlay inside the app WebView. */
  openRazorpayCheckout(
    session: RazorpayCheckoutSession,
    onSuccess: (data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => void,
    onDismiss: () => void,
  ): void {
    if (typeof Razorpay === 'undefined') {
      onDismiss();
      throw new Error('Razorpay SDK failed to load');
    }

    const options: Record<string, unknown> = {
      key: session.key_id,
      amount: Math.round(Number(session.amount) * 100),
      currency: session.currency || 'INR',
      name: session.name || 'LalganjEats',
      description: session.description || 'Payment',
      order_id: session.razorpay_order_id,
      prefill: session.prefill || {},
      theme: { color: '#c41e3a' },
      // Required so Razorpay shows UPI inside Android WebView / Capacitor APK.
      webview_intent: true,
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => onSuccess(response),
      modal: {
        ondismiss: () => onDismiss(),
        escape: true,
        confirm_close: true,
      },
    };

    if (session.checkout_config_id) {
      options['config'] = { checkout_config_id: session.checkout_config_id };
    }

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', () => onDismiss());
    rzp.open();
  }

  pingLocation(lat: number, lng: number) {
    return this.http.post(this.locApi, { latitude: lat, longitude: lng });
  }
}
