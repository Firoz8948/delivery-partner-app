import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const DELIVERY_PORTAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/dp-shell/dp-shell.component').then(m => m.DpShellComponent),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        canActivate: [roleGuard('delivery_partner')],
        loadComponent: () =>
          import('./components/dp-home/dp-home.component').then(m => m.DpHomeComponent),
      },
      {
        path: 'orders',
        canActivate: [roleGuard('delivery_partner')],
        loadComponent: () =>
          import('./components/dp-orders/dp-orders.component').then(m => m.DpOrdersComponent),
      },
      {
        path: 'earnings',
        canActivate: [roleGuard('delivery_partner')],
        loadComponent: () =>
          import('./components/dp-earnings/dp-earnings.component').then(m => m.DpEarningsComponent),
      },
    ],
  },
];
