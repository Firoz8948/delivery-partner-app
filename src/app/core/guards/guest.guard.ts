// frontend/src/app/core/guards/guest.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * For login pages: allow guests; if already logged in with the matching role,
 * send them to their dashboard.
 */
export const guestGuard = (role: string, dashboardPath: string): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasRole(role)) {
      router.navigateByUrl(dashboardPath);
      return false;
    }
    return true;
  };
};
