// frontend/src/app/core/services/auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { getDefaultLandingPath } from '../utils/client-channel';

export interface AuthUser {
  user_id:      number;
  full_name:    string;
  phone?:       string;
  role:         string;
  access_token: string;
  redirect_to:  string;
  restaurant_id?: number;
  restaurant_name?: string;
  impersonated_by?: number;
  impersonation_session_id?: string;
  legal_terms_version?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private apiUrl   = `${environment.apiBaseUrl}/auth`;
  currentUser      = signal<AuthUser | null>(this.loadFromStorage());

  // ── Computed helpers ──────────────────────────────────
  isLoggedIn    = computed(() => !!this.currentUser());
  isCustomer    = computed(() => this.currentUser()?.role === 'customer');
  displayGreeting = computed(() => this.resolveDisplayGreeting(this.currentUser()));
  avatarInitial   = computed(() => {
    const user = this.currentUser();
    if (!user) return 'U';

    const name = user.full_name?.trim() ?? '';
    if (name && !this.isPlaceholderName(name)) {
      return name.charAt(0).toUpperCase();
    }

    const phone = user.phone?.replace(/\D/g, '') ?? '';
    if (phone.length >= 1) {
      return phone.slice(-1);
    }

    return 'U';
  });

  constructor(private http: HttpClient, private router: Router) {}

  // ── OTP Flow ──────────────────────────────────────────
  sendOTP(phone: string, role: string) {
    return this.http.post(`${this.apiUrl}/send-otp`, { phone, role });
  }

  verifyOTP(
    phone: string,
    otp_code: string,
    role: string,
    accepted_legal: boolean,
    full_name?: string,
  ) {
    return this.http.post<AuthUser>(
      `${this.apiUrl}/verify-otp`,
      {
        phone,
        otp_code,
        role,
        full_name,
        accepted_legal,
        legal_version: '2026-08-17',
      }
    ).pipe(tap(user => this.saveSession(user)));
  }

  partnerLogin(
    username: string,
    password: string,
    role: string,
    accepted_legal: boolean,
  ) {
    return this.http.post<AuthUser>(`${this.apiUrl}/partner-login`, {
      username,
      password,
      role,
      accepted_legal,
      legal_version: '2026-08-17',
    }).pipe(tap((user) => this.saveSession(user)));
  }

  // ── Admin Login ───────────────────────────────────────
  adminLogin(username: string, password: string) {
    return this.http.post<AuthUser>(
      `${this.apiUrl}/admin-login`,
      { username, password }
    ).pipe(tap(user => this.saveSession(user)));
  }

  // ── Super Admin Login ─────────────────────────────────
  superadminLogin(username: string, password: string) {
    return this.http.post<AuthUser>(
      `${this.apiUrl}/superadmin-login`,
      { username, password }
    ).pipe(tap(user => this.saveSession(user)));
  }

  /** Enter tenant admin UI while keeping superadmin session for exit. */
  startImpersonation(session: AuthUser) {
    const current = this.currentUser();
    if (current?.role === 'super_admin') {
      localStorage.setItem('le_superadmin_backup', JSON.stringify(current));
    }
    this.saveSession(session);
  }

  exitImpersonation(): boolean {
    try {
      const raw = localStorage.getItem('le_superadmin_backup');
      if (!raw) return false;
      const backup = JSON.parse(raw) as AuthUser;
      localStorage.removeItem('le_superadmin_backup');
      this.saveSession(backup);
      return true;
    } catch {
      return false;
    }
  }

  isImpersonating(): boolean {
    return !!localStorage.getItem('le_superadmin_backup');
  }

  private startAdminImpersonation(session: AuthUser) {
    const current = this.currentUser();
    if (current?.role !== 'admin') return false;
    localStorage.setItem('le_admin_backup', JSON.stringify(current));
    this.saveSession(session);
    return true;
  }

  /** Enter a restaurant dashboard while preserving the tenant-admin session. */
  startRestaurantImpersonation(session: AuthUser) {
    return this.startAdminImpersonation(session);
  }

  startDeliveryPartnerImpersonation(session: AuthUser) {
    return this.startAdminImpersonation(session);
  }

  exitAdminImpersonation(): boolean {
    try {
      const raw = localStorage.getItem('le_admin_backup');
      if (!raw) return false;
      const backup = JSON.parse(raw) as AuthUser;
      localStorage.removeItem('le_admin_backup');
      this.saveSession(backup);
      return true;
    } catch {
      return false;
    }
  }

  exitRestaurantImpersonation(): boolean {
    return this.exitAdminImpersonation();
  }

  isRestaurantImpersonating(): boolean {
    return !!localStorage.getItem('le_admin_backup')
      && this.currentUser()?.role === 'restaurant_owner';
  }

  isDeliveryPartnerImpersonating(): boolean {
    return !!localStorage.getItem('le_admin_backup')
      && this.currentUser()?.role === 'delivery_partner';
  }

  /** Refresh name/phone from profile API for navbar greeting */
  loadCustomerDisplayInfo() {
    if (!this.isCustomer()) return;
    this.http.get<{ full_name: string; phone: string }>(
      `${environment.apiBaseUrl}/users/profile`
    ).subscribe({
      next: (profile) => this.patchUser({
        full_name: profile.full_name,
        phone: profile.phone
      })
    });
  }

  patchUser(data: Partial<Pick<AuthUser, 'full_name' | 'phone'>>) {
    const current = this.currentUser();
    if (!current) return;
    const updated = { ...current, ...data };
    localStorage.setItem('le_user', JSON.stringify(updated));
    this.currentUser.set(updated);
  }

  // ── Session ───────────────────────────────────────────
  saveSession(user: AuthUser) {
    localStorage.setItem('le_user',  JSON.stringify(user));
    localStorage.setItem('le_token', user.access_token);
    this.currentUser.set(user);
  }

  logout() {
    localStorage.removeItem('le_admin_backup');
    localStorage.removeItem('le_superadmin_backup');
    localStorage.removeItem('le_user');
    localStorage.removeItem('le_token');
    this.currentUser.set(null);
    this.router.navigateByUrl(getDefaultLandingPath());
  }

  getToken(): string | null {
    return localStorage.getItem('le_token');
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.role === role;
  }

  private loadFromStorage(): AuthUser | null {
    try {
      const data = localStorage.getItem('le_user');
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  private resolveDisplayGreeting(user: AuthUser | null): string {
    if (!user) return '';

    const name = user.full_name?.trim() ?? '';
    if (name && !this.isPlaceholderName(name)) {
      return name.split(' ')[0];
    }

    const phone = user.phone?.replace(/\D/g, '') ?? '';
    if (phone.length >= 3) {
      return `User ${phone.slice(-3)}`;
    }

    const fromName = name.match(/User_?(\d+)/i);
    if (fromName) {
      return `User ${fromName[1].slice(-3)}`;
    }

    return `User ${user.user_id}`;
  }

  private isPlaceholderName(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return true;
    return /^User_?\d+$/i.test(trimmed.replace(/\s/g, ''));
  }
}
