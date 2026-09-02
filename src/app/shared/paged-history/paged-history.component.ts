import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

export interface HistoryPage {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: Record<string, unknown>[];
}

export interface HistoryColumn {
  key: string;
  label: string;
  kind?: 'text' | 'money' | 'datetime' | 'status';
}

@Component({
  selector: 'app-paged-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!hideButton) {
      <button type="button" class="hist-btn" [class.on]="open" (click)="toggle()">
        {{ buttonLabel }}
      </button>
    }
    @if (open) {
      <div class="hist">
        @if (loading) {
          <p class="hist-empty">Loading…</p>
        } @else if (!items.length) {
          <p class="hist-empty">{{ emptyText }}</p>
        } @else {
          <div class="hist-table-wrap">
            <table>
              <thead>
                <tr>
                  @for (col of columns; track col.key) {
                    <th>{{ col.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of items; track $index) {
                  <tr>
                    @for (col of columns; track col.key) {
                      <td>
                        @switch (col.kind) {
                          @case ('money') {
                            ₹{{ (row[col.key] || 0) | number:'1.2-2' }}
                          }
                          @case ('datetime') {
                            {{ (row[col.key] || '') | date:'d MMM yyyy, h:mm a' }}
                          }
                          @case ('status') {
                            <span class="hist-status" [attr.data-status]="row['status']">
                              {{ row['status_label'] || row[col.key] }}
                            </span>
                          }
                          @default {
                            {{ row[col.key] }}
                          }
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (totalPages > 1) {
            <div class="hist-pager">
              <button type="button" [disabled]="page <= 1 || loading" (click)="load(page - 1)">Prev</button>
              <span>Page {{ page }} of {{ totalPages }}</span>
              <button type="button" [disabled]="page >= totalPages || loading" (click)="load(page + 1)">Next</button>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [`
    :host { display: contents; }
    .hist-btn {
      border: 1px solid #ddd;
      background: #fff;
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .hist-btn.on { background: #111; color: #fff; border-color: #111; }
    .hist {
      margin-top: 10px;
      flex-basis: 100%;
      width: 100%;
      border: 1px solid #eee;
      border-radius: 12px;
      background: #fafafa;
      padding: 10px;
    }
    .hist-empty { margin: 8px 0; color: #888; font-size: 13px; }
    .hist-table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
    th { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .hist-pager {
      display: flex; align-items: center; justify-content: flex-end; gap: 8px;
      margin-top: 8px; font-size: 13px;
    }
    .hist-pager button {
      border: 1px solid #ddd; background: #fff; border-radius: 8px;
      padding: 4px 10px; cursor: pointer;
    }
    .hist-pager button:disabled { opacity: 0.45; cursor: default; }
    .hist-status[data-status='paid'] { color: #166534; font-weight: 700; }
    .hist-status[data-status='failed'],
    .hist-status[data-status='cancelled'] { color: #b91c1c; font-weight: 700; }
  `],
})
export class PagedHistoryComponent implements OnInit {
  @Input() buttonLabel = 'History';
  @Input() emptyText = 'No history yet.';
  @Input() hideButton = false;
  @Input() columns: HistoryColumn[] = [];
  @Input({ required: true }) fetchPage!: (page: number) => Observable<HistoryPage>;

  open = false;
  loading = false;
  page = 1;
  totalPages = 0;
  items: Record<string, unknown>[] = [];

  ngOnInit() {
    if (this.hideButton) {
      this.open = true;
      this.load(1);
    }
  }

  toggle() {
    this.open = !this.open;
    if (this.open) this.load(1);
  }

  load(page: number) {
    if (!this.fetchPage) return;
    this.loading = true;
    this.fetchPage(page).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.page = res.page || 1;
        this.totalPages = res.total_pages || 0;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.items = [];
      },
    });
  }
}
