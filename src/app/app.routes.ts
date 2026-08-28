import { Routes } from '@angular/router';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'deliverypartner/home',
  },
  {
    path: 'deliverypartner',
    loadChildren: () =>
      import('./features/delivery-portal/delivery-portal.routes')
        .then((m) => m.DELIVERY_PORTAL_ROUTES),
  },
  {
    path: 'auth/delivery-login',
    canActivate: [guestGuard('delivery_partner', '/deliverypartner/home')],
    loadComponent: () =>
      import('./features/auth/components/delivery-login/delivery-login.component')
        .then((m) => m.DeliveryLoginComponent),
  },
  {
    path: 'login',
    pathMatch: 'full',
    redirectTo: 'auth/delivery-login',
  },
  {
    path: 'legal',
    loadChildren: () =>
      import('./features/legal/legal.routes').then((m) => m.LEGAL_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'deliverypartner/home',
  },
];
