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
  otp_verified?: boolean;
  cash_collected?: number | null;
  items: { name: string; quantity: number; price: number }[];
  created_at: string | null;
}

export interface DpDashboard {
  profile: {
    is_online: boolean;
    full_name: string;
    phone: string;
    total_earnings: number;
    has_location: boolean;
  };
  today: { orders: number; earnings: number };
  active_order: DpOrder | null;
  available_orders: DpOrder[];
}

export interface CollectionPaymentResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

declare const Razorpay: any;

@Injectable({ providedIn: 'root' })
export class DeliveryPortalService {
  private api = `${environment.apiBaseUrl}/delivery`;
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

  createCollectionPayment(orderId: number, onlineAmount: number) {
    return this.http.post<CollectionPaymentResponse>(
      `${this.api}/orders/${orderId}/collection-payment`,
      { online_amount: onlineAmount },
    );
  }

  complete(
    orderId: number,
    payload: {
      otp: string;
      cash_amount: number;
      online_amount: number;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    return this.http.post(`${this.api}/orders/${orderId}/complete`, payload);
  }

  openCollectionCheckout(
    pay: CollectionPaymentResponse,
    onSuccess: (data: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => void,
    onFailure: () => void,
  ) {
    const options = {
      key: pay.key_id,
      amount: Math.round(pay.amount * 100),
      currency: pay.currency,
      name: 'LalganjEats',
      description: 'Order collection',
      order_id: pay.razorpay_order_id,
      theme: { color: '#187a43' },
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => onSuccess(response),
      modal: { ondismiss: () => onFailure() },
    };
    const rzp = new Razorpay(options);
    rzp.open();
  }

  myOrders(filter = 'all') {
    return this.http.get<DpOrder[]>(`${this.api}/orders?filter=${filter}`);
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

  initiateCashRemit() {
    return this.http.post<{
      payment_url: string;
      fields: Record<string, string>;
      remittance_id: number;
      amount: number;
      order_count: number;
    }>(`${this.api}/cash-remit/initiate`, {});
  }

  /** Auto-submit a hidden form to PayU hosted checkout. */
  redirectToPayU(paymentUrl: string, fields: Record<string, string>): void {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = paymentUrl;
    form.style.display = 'none';
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value ?? '';
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  pingLocation(lat: number, lng: number) {
    return this.http.post(this.locApi, { latitude: lat, longitude: lng });
  }
}
