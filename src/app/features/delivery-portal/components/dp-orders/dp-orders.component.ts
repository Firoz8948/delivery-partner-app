import { PortalPageHeaderComponent } from '../../../../shared/portal-page-header/portal-page-header.component';
import { Component, OnInit, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DeliveryPortalService, DpOrder } from '../../services/delivery-portal.service';

@Component({
  selector: 'app-dp-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, PortalPageHeaderComponent],
  template: `
    <div class="page">
      <app-portal-page-header eyebrow="DELIVERY LOG" title="My Orders" subtitle="Today's deliveries and past delivery history." tone="delivery" />

      @if (actives().length) {
        <p class="heading">Active orders ({{ actives().length }})</p>
        @for (o of actives(); track o.id) {
          <a class="active-row" routerLink="/deliverypartner/home">
            <div>
              <strong>{{ o.order_number }}</strong>
              <span class="status-pill live">{{ o.status.replace('_', ' ') }}</span>
              <p>{{ o.restaurant }}</p>
            </div>
            <span class="open-home">Open</span>
          </a>
        }
      }

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
                @if (o.delivered_at || o.created_at) {
                  <p class="when">{{ (o.delivered_at || o.created_at) | date:'d MMM yyyy, h:mm a' }}</p>
                }
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
        @if (total() > 0) {
          <div class="pager">
            <span class="pager-meta">Showing {{ showingFrom() }}–{{ showingTo() }} of {{ total() }}</span>
            @if (totalPages() > 1) {
              <div class="pager-nav">
                <button type="button" [disabled]="page() <= 1 || loading()" (click)="goToPage(page() - 1)">Prev</button>
                <span>Page {{ page() }} of {{ totalPages() }}</span>
                <button type="button" [disabled]="page() >= totalPages() || loading()" (click)="goToPage(page() + 1)">Next</button>
                <label class="pager-goto">
                  Go
                  <input
                    #pageInput
                    type="number"
                    min="1"
                    [attr.max]="totalPages()"
                    [value]="page()"
                    (keydown.enter)="goToPage(pageInput.value)" />
                </label>
                <button type="button" [disabled]="loading()" (click)="goToPage(pageInput.value)">Go</button>
              </div>
            }
          </div>
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
    .active-row {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      margin: 0 0 10px; padding: 12px 14px; text-decoration: none;
      border: 1px solid #fecaca; border-radius: 12px; background: #fff7f7;
      color: inherit; animation: row-in 180ms ease-out;
    }
    .active-row p { margin: 4px 0 0; }
    .open-home { font-size: 12px; font-weight: 800; color: #dc2626; }
    .status-pill.live { color: #9a3412; background: #ffedd5; }
    @keyframes row-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .active-row { animation: none; } }
    .row {
      width: 100%; display: flex; justify-content: space-between; gap: 12px;
      padding: 12px 0; border: 0; background: transparent; text-align: left; cursor: pointer;
    }
    .status-pill {
      display: inline-block; margin-left: 8px; font-size: 10px; font-weight: 800;
      letter-spacing: 0.04em; color: #166534; background: #dcfce7;
      border-radius: 999px; padding: 2px 8px; vertical-align: middle;
    }
    .when { margin: 4px 0 0; color: #64748b; font-size: 12px; font-weight: 600; }
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
    .pager {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 10px; margin-top: 12px; color: #64748b; font-size: 13px;
    }
    .pager-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .pager-nav button {
      border: 1px solid #ddd; background: #fff; border-radius: 8px;
      padding: 6px 12px; cursor: pointer; font-weight: 700;
    }
    .pager-nav button:disabled { opacity: 0.45; cursor: default; }
    .pager-goto { display: inline-flex; align-items: center; gap: 6px; }
    .pager-goto input {
      width: 56px; border: 1px solid #ddd; border-radius: 8px; padding: 6px 8px;
    }
  `],
})
export class DpOrdersComponent implements OnInit {
  private api = inject(DeliveryPortalService);
  private dateInput = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  orders = signal<DpOrder[]>([]);
  actives = signal<DpOrder[]>([]);
  view = signal<'today' | 'history'>('today');
  dateStr = signal(this.todayIso());
  dateFilter = signal<string | null>(this.todayIso());
  loading = signal(true);
  expandedId = signal<number | null>(null);
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  totalPages = signal(0);

  readonly showingFrom = computed(() => {
    if (!this.total()) return 0;
    return (this.page() - 1) * this.pageSize() + 1;
  });
  readonly showingTo = computed(() =>
    Math.min(this.page() * this.pageSize(), this.total()),
  );

  ngOnInit() {
    this.loadToday();
    this.api.dashboard().subscribe({
      next: (d) => {
        const fromList = d.active_orders || [];
        this.actives.set(fromList.length ? fromList : (d.active_order ? [d.active_order] : []));
      },
      error: () => {},
    });
  }

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
    this.fetch('today', this.dateStr(), 1);
  }

  openHistory() {
    this.view.set('history');
    this.dateFilter.set(null);
    this.fetch('history', undefined, 1);
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
    this.fetch(this.view(), value, 1);
  }

  fetch(filter: string, date?: string, page = this.page()) {
    const nextPage = Math.max(1, Math.trunc(Number(page) || 1));
    this.expandedId.set(null);
    this.loading.set(true);
    this.api.myOrders(filter, date, nextPage).subscribe({
      next: (res) => {
        const items = res.items || [];
        this.orders.set(items.filter((row) => (row.status || '').toLowerCase() === 'delivered'));
        this.page.set(res.page || 1);
        this.pageSize.set(res.page_size || 10);
        this.total.set(res.total || 0);
        this.totalPages.set(res.total_pages || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goToPage(raw: string | number) {
    const last = this.totalPages();
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n) || n < 1 || !last) return;
    const target = Math.min(n, last);
    if (target === this.page() && this.orders().length) return;
    const date = this.dateFilter() || undefined;
    this.fetch(this.view() === 'today' ? 'today' : 'history', date, target);
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
