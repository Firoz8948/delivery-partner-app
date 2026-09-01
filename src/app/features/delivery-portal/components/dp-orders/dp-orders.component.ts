import { PortalPageHeaderComponent } from '../../../../shared/portal-page-header/portal-page-header.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeliveryPortalService, DpOrder } from '../../services/delivery-portal.service';

@Component({
  selector: 'app-dp-orders',
  standalone: true,
  imports: [CommonModule, PortalPageHeaderComponent],
  template: `
    <div class="page">
      <app-portal-page-header eyebrow="DELIVERY LOG" title="My Orders" subtitle="Review active assignments and completed deliveries." tone="delivery" />
      <div class="tabs">
        <button type="button" [class.on]="filter()==='all'" (click)="load('all')">All</button>
        <button type="button" [class.on]="filter()==='active'" (click)="load('active')">Active</button>
        <button type="button" [class.on]="filter()==='delivered'" (click)="load('delivered')">Delivered</button>
      </div>
      @if (loading()) {
        <div class="list-loading">
          <span class="spinner"></span>
          <p>Loading orders…</p>
        </div>
      } @else {
        @for (o of orders(); track o.id) {
          <div class="order-card" [class.open]="expandedId() === o.id">
            <button type="button" class="row" (click)="toggle(o.id)">
              <div>
                <strong>{{ o.order_number }}</strong>
                <p>{{ o.restaurant }} · {{ o.status }}</p>
              </div>
              <div class="row-right">
                <strong>₹{{ o.payout }} payout</strong>
                <span class="chevron" [class.up]="expandedId() === o.id">▾</span>
              </div>
            </button>
            @if (expandedId() === o.id) {
              <div class="details">
                <p class="section-label">Items ordered</p>
                @for (item of o.items; track item.name + (item.variant_label || '') + item.quantity) {
                  <p class="item-line">{{ item.line_label || (item.quantity + '× ' + item.name) }}</p>
                } @empty {
                  <p class="muted">No items</p>
                }
                <div class="kv">
                  <span>Distance (restaurant → customer)</span>
                  <strong>
                    @if (o.distance_km_restaurant_to_customer != null) {
                      {{ o.distance_km_restaurant_to_customer }} km
                    } @else {
                      —
                    }
                  </strong>
                </div>
                <div class="kv">
                  <span>Final amount</span>
                  <strong>₹{{ o.customer_total }}</strong>
                </div>
                <div class="kv">
                  <span>Payment mode</span>
                  <strong>{{ o.payment_label || paymentMode(o) }}</strong>
                </div>
                <div class="pay-box">
                  <div class="kv"><span>Cash</span><strong>₹{{ cashAmount(o) }}</strong></div>
                  <div class="kv"><span>Prepaid</span><strong>₹{{ prepaidAmount(o) }}</strong></div>
                </div>
              </div>
            }
          </div>
        } @empty {
          <p class="muted">No orders yet.</p>
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 96px; max-width: 720px; margin: 0 auto; }
    .tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .tabs button { border: 1px solid #ddd; background: #fff; border-radius: 999px; padding: 6px 12px; cursor: pointer; }
    .tabs button.on { background: #222; color: #fff; border-color: #222; }
    .list-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 48px 12px;
      color: #64748b;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #e2e8f0;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .order-card { border-bottom: 1px solid #eee; }
    .row {
      width: 100%;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 0;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .row-right { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    .chevron { color: #64748b; transition: transform 0.15s ease; }
    .chevron.up { transform: rotate(180deg); }
    .details {
      margin: 0 0 14px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border: 1px solid #d7e6f5;
      border-radius: 12px;
      background: #f7fbfe;
    }
    .section-label { margin: 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .item-line { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; background: #fff; border-radius: 8px; padding: 8px 10px; }
    .kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: #334155; }
    .pay-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
    .muted { color: #888; }
    p { margin: 4px 0 0; color: #666; font-size: 13px; }
  `],
})
export class DpOrdersComponent implements OnInit {
  private api = inject(DeliveryPortalService);
  orders = signal<DpOrder[]>([]);
  filter = signal('all');
  loading = signal(true);
  expandedId = signal<number | null>(null);

  ngOnInit() { this.load('all'); }

  load(f: string) {
    this.filter.set(f);
    this.expandedId.set(null);
    this.loading.set(true);
    this.api.myOrders(f).subscribe({
      next: (o) => {
        this.orders.set(o);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggle(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  paymentMode(o: DpOrder): string {
    if (o.payment_label) return o.payment_label;
    return o.payment_method === 'cash' ? 'Cash' : 'Prepaid';
  }

  cashAmount(o: DpOrder): number {
    if (o.cash_amount != null) return o.cash_amount;
    return Number(o.cash_collected || 0);
  }

  prepaidAmount(o: DpOrder): number {
    if (o.prepaid_amount != null) return o.prepaid_amount;
    return 0;
  }
}
