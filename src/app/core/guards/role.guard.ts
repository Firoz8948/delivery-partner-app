// frontend/src/app/core/guards/role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const LOGIN_BY_ROLE: Record<string, string> = {
  customer: '/auth/login',
  restaurant_owner: '/auth/hotel-login',
  delivery_partner: '/auth/delivery-login',
  admin: '/auth/admin-login',
  super_admin: '/auth/superadmin-login',
};

/**
 * Requires a logged-in user with the exact role.
 * Unauthenticated / wrong role → matching auth login page.
 */
export const roleGuard = (requiredRole: string): CanActivateFn => {
  return (route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const loginPath = LOGIN_BY_ROLE[requiredRole] || '/auth/login';

    if (!auth.isLoggedIn()) {
      router.navigate([loginPath], {
        queryParams: { returnUrl: state.url },
      });
      return false;
    }

    if (!auth.hasRole(requiredRole)) {
      router.navigate([loginPath], {
        queryParams: { returnUrl: state.url },
      });
      return false;
    }

    return true;
  };
};
