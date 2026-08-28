import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { PartnerContactDialogComponent } from '../partner-contact-dialog/partner-contact-dialog.component';

type Mode = 'password' | 'otp';
type Step = 'phone' | 'otp';

@Component({
  selector: 'app-delivery-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PartnerContactDialogComponent],
  templateUrl: './delivery-login.component.html',
  styleUrl: './delivery-login.component.scss',
})
export class DeliveryLoginComponent {
  mode = signal<Mode>('password');
  step = signal<Step>('phone');

  // Password mode form
  username = '';
  password = '';

  // OTP mode form
  phone = '';
  otp = '';

  acceptedLegal = false;
  loading = signal(false);
  error = signal('');
  contactDialogOpen = signal(false);

  readonly ROLE = 'delivery_partner';

  constructor(private auth: AuthService, private router: Router) {
    if (this.auth.hasRole('delivery_partner')) {
      this.router.navigate(['/deliverypartner']);
    }
  }

  setMode(newMode: Mode) {
    this.mode.set(newMode);
    this.error.set('');
  }

  loginWithPassword() {
    if (!this.username.trim() || !this.password) {
      this.error.set('Please enter both username/phone and password');
      return;
    }
    if (!this.acceptedLegal) {
      this.error.set('Accept the partner Terms, Privacy Policy and Refund Policy to continue');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    this.auth.partnerLogin(this.username, this.password, this.ROLE, this.acceptedLegal).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigate(['/deliverypartner']);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.detail || 'Invalid username or password');
      },
    });
  }

  sendOTP() {
    if (this.phone.length !== 10) {
      this.error.set('Enter a valid 10-digit mobile number');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    this.auth.sendOTP(this.phone, this.ROLE).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('otp');
      },
      error: (e) => {
        this.loading.set(false);
        if (this.isUnregisteredPartnerError(e)) {
          this.contactDialogOpen.set(true);
          this.error.set('');
          return;
        }
        this.error.set(e.error?.detail || 'Failed to send OTP');
      },
    });
  }

  verifyOTP() {
    if (this.otp.length !== 6) {
      this.error.set('Enter the 6-digit OTP');
      return;
    }
    if (!this.acceptedLegal) {
      this.error.set('Accept the partner Terms, Privacy Policy and Refund Policy to continue');
      return;
    }
    this.error.set('');
    this.loading.set(true);

    this.auth.verifyOTP(
      this.phone,
      this.otp,
      this.ROLE,
      this.acceptedLegal,
    ).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.router.navigate(['/deliverypartner']);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.detail || 'Invalid OTP');
      },
    });
  }

  resendOTP() {
    this.otp = '';
    this.sendOTP();
  }

  goBack() {
    this.step.set('phone');
    this.error.set('');
  }

  private isUnregisteredPartnerError(error: any): boolean {
    const detail = String(error.error?.detail || '').toLowerCase();
    return error.status === 403 && detail.includes('not registered on this number');
  }
}
