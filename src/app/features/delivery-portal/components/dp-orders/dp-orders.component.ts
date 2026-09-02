import { PortalPageHeaderComponent } from '../../../../shared/portal-page-header/portal-page-header.component';
import { Component, OnInit, inject, signal, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeliveryPortalService, DpOrder } from '../../services/delivery-portal.service';

@Component({
  selector: 'app-dp-orders',
  standalone: true,
  imports: [CommonModule, PortalPageHeaderComponent],
  template: `
    <div class="page">
      <app-portal-page-header eyebrow="DELIVERY LOG" title="My Orders" subtitle="Today's deliveries and past delivery history." tone="delivery" />

      <div class="toolbar">
        <button type="button" [class.on]="view()==='today'" (click)="loadToday()">Today</button>
        <button type="button" [class.on]="view()==='history'" (click)="openHistory()">Delivery History</button>
        <button type="button" class="date-btn" (click)="openDatePicker()" aria-label="Pick a date">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
        <input
          #dateInput
          class="date-hidden"
          type="date"
          [value]="dateStr()"
          (change)="onDate($any($event.target).value)" />
      </div>

      <p class="heading">{{ heading() }}</p>

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
                <span class="status-pill">DELIVERED</span>
                @if (payChip(o); as chip) {
                  <p class="pay-line">{{ chip }}</p>
                }
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
                @if (payChip(o); as chip) {
                  <div class="kv">
                    <span>Payment</span>
                    <strong>{{ chip }}</strong>
                  </div>
                }
              </div>
            }
          </div>
        } @empty {
          <p class="muted">{{ dateFilter() ? 'No deliveries on this date.' : 'No delivery history yet.' }}</p>
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 96px; max-width: 720px; margin: 0 auto; }
    .toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .toolbar button { border: 1px solid #ddd; background: #fff; border-radius: 999px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
    .toolbar button.on { background: #222; color: #fff; border-color: #222; }
    .date-btn {
      width: 38px; height: 38px; padding: 0 !important; border-radius: 10px !important;
      display: inline-flex; align-items: center; justify-content: center; color: #1d4ed8;
    }
    .date-hidden { position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; }
    .heading { margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #0f172a; }
    .list-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 48px 12px; color: #64748b;
    }
    .spinner {
      width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #2563eb;
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .order-card { border-bottom: 1px solid #eee; }
    .row {
      width: 100%; display: flex; justify-content: space-between; gap: 12px;
      padding: 12px 0; border: 0; background: transparent; text-align: left; cursor: pointer;
    }
    .status-pill {
      display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 800;
      letter-spacing: 0.04em; color: #166534; background: #dcfce7;
      border-radius: 999px; padding: 2px 8px; vertical-align: middle;
    }
    .pay-line { margin: 4px 0 0; color: #334155; font-size: 13px; font-weight: 700; }
    .row-right { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    .chevron { color: #64748b; transition: transform 0.15s ease; }
    .chevron.up { transform: rotate(180deg); }
    .details {
      margin: 0 0 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
      border: 1px solid #d7e6f5; border-radius: 12px; background: #f7fbfe;
    }
    .section-label { margin: 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .item-line { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; background: #fff; border-radius: 8px; padding: 8px 10px; }
    .kv { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: #334155; }
    .muted { color: #888; }
    p { margin: 4px 0 0; color: #666; font-size: 13px; }
  `],
})
export class DpOrdersComponent implements OnInit {
  private api = inject(DeliveryPortalService);
  private dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  orders = signal<DpOrder[]>([]);
  view = signal<'today' | 'history'>('today');
  dateStr = signal(this.todayIso());
  dateFilter = signal<string | null>(this.todayIso());
  loading = signal(true);
  expandedId = signal<number | null>(null);

  ngOnInit() { this.loadToday(); }

  todayIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  heading(): string {
    const iso = this.dateFilter();
    if (!iso) return 'Delivery history';
    if (iso === this.todayIso()) return 'Delivery for today';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const label = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Delivery for ${label}`;
  }

  loadToday() {
    this.view.set('today');
    this.dateStr.set(this.todayIso());
    this.dateFilter.set(this.todayIso());
    this.fetch('today', this.dateStr());
  }

  openHistory() {
    this.view.set('history');
    this.dateFilter.set(null);
    this.fetch('history');
  }

  openDatePicker() {
    const el = this.dateInput()?.nativeElement;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  }

  onDate(value: string) {
    if (!value) return;
    this.dateStr.set(value);
    this.dateFilter.set(value);
    this.view.set(value === this.todayIso() ? 'today' : 'history');
    this.fetch(this.view(), value);
  }

  fetch(filter: string, date?: string) {
    this.expandedId.set(null);
    this.loading.set(true);
    this.api.myOrders(filter, date).subscribe({
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

  cashAmount(o: DpOrder): number {
    if (o.cash_amount != null) return Number(o.cash_amount);
    return Number(o.cash_collected || 0);
  }

  prepaidAmount(o: DpOrder): number {
    if (o.prepaid_amount != null) return Number(o.prepaid_amount);
    return Number(o.online_collected || 0);
  }

  payChip(o: DpOrder): string | null {
    const cash = this.cashAmount(o);
    const prepaid = this.prepaidAmount(o);
    if (cash > 0 && prepaid > 0) return `Split · Cash ₹${cash} + Online ₹${prepaid}`;
    if (cash > 0) return `Cash ₹${cash}`;
    if (prepaid > 0) return `Prepaid ₹${prepaid}`;
    return null;
  }
}
