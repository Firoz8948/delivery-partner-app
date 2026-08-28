import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ImpersonationExitService } from '../../../../core/services/impersonation-exit.service';
import { DeliveryPortalService } from '../../services/delivery-portal.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-dp-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dp-shell.component.html',
  styleUrl: './dp-shell.component.scss',
})
export class DpShellComponent implements OnInit {
  auth = inject(AuthService);
  private impersonationExit = inject(ImpersonationExitService);
  router = inject(Router);
  private dp = inject(DeliveryPortalService);

  isOnline = signal(false);
  impersonating = computed(() => this.auth.isDeliveryPartnerImpersonating());

  bottomNav = [
    { label: 'Home', route: '/deliverypartner/home', icon: 'home' },
    { label: 'Orders', route: '/deliverypartner/orders', icon: 'orders' },
    { label: 'Earnings', route: '/deliverypartner/earnings', icon: 'earn' },
  ];

  ngOnInit() {
    this.dp.dashboard().subscribe({
      next: (d) => this.isOnline.set(d.profile.is_online),
      error: () => {},
    });
  }

  toggleOnline() {
    this.dp.toggleOnline().subscribe({
      next: (r) => this.isOnline.set(r.is_online),
    });
  }

  logout() {
    if (this.impersonating()) {
      this.exitImpersonation();
      return;
    }
    this.auth.logout();
  }

  exitImpersonation() {
    const restore = () => {
      if (this.auth.exitAdminImpersonation()) {
        window.location.assign(`${environment.mainWebUrl}/admin/dashboard`);
        return;
      }
      this.auth.logout();
    };
    this.impersonationExit.exit().subscribe({
      next: () => restore(),
      error: () => restore(),
    });
  }

  get user() {
    return this.auth.currentUser();
  }

  isActive(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }
}
