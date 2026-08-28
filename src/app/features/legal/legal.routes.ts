import { Routes } from '@angular/router';


export const LEGAL_ROUTES: Routes = [
  {
    path: ':document',
    loadComponent: () =>
      import('./legal-page.component').then((m) => m.LegalPageComponent),
  },
  { path: '', redirectTo: 'terms', pathMatch: 'full' },
];
