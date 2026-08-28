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
      @for (o of orders(); track o.id) {
        <div class="row">
          <div>
            <strong>{{ o.order_number }}</strong>
            <p>{{ o.restaurant }} · {{ o.status }}</p>
          </div>
          <strong>₹{{ o.payout }}</strong>
        </div>
      } @empty {
        <p class="muted">No orders yet.</p>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 96px; max-width: 720px; margin: 0 auto; }
    .tabs { display: flex; gap: 8px; margin-bottom: 14px; }
    .tabs button { border: 1px solid #ddd; background: #fff; border-radius: 999px; padding: 6px 12px; cursor: pointer; }
    .tabs button.on { background: #222; color: #fff; border-color: #222; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid #eee; }
    .muted { color: #888; }
    p { margin: 4px 0 0; color: #666; font-size: 13px; }
  `],
})
export class DpOrdersComponent implements OnInit {
  private api = inject(DeliveryPortalService);
  orders = signal<DpOrder[]>([]);
  filter = signal('all');

  ngOnInit() { this.load('all'); }

  load(f: string) {
    this.filter.set(f);
    this.api.myOrders(f).subscribe({ next: (o) => this.orders.set(o) });
  }
}
