// delivery-partner-app/src/app/core/interceptors/jwt.interceptor.ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

function isAuthRequest(url: string): boolean {
  return /\/auth\/(send-otp|verify-otp|partner-login|admin-login|superadmin-login)\b/.test(
    url,
  );
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !!token &&
        !isAuthRequest(req.url)
      ) {
        auth.handleSessionExpired();
      }
      return throwError(() => err);
    }),
  );
};
