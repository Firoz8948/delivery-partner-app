import { PortalPageHeaderComponent } from '../../../../shared/portal-page-header/portal-page-header.component';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  EarningsService,
  EarningsSummary,
  BankAccount,
  Withdrawal,
} from '../../../../core/services/earnings.service';
import { DeliveryPortalService } from '../../services/delivery-portal.service';

@Component({
  selector: 'app-dp-earnings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PortalPageHeaderComponent],
  templateUrl: './dp-earnings.component.html',
  styleUrl: './dp-earnings.component.scss',
})
export class DpEarningsComponent implements OnInit {
  summary: EarningsSummary | null = null;
  bankAccounts: BankAccount[] = [];
  withdrawalHistory: Withdrawal[] = [];

  cashOnHand = 0;
  cashOrderCount = 0;
  clearingCash = false;

  withdrawForm!: FormGroup;
  bankForm!: FormGroup;

  showBankForm = false;
  showWithdrawModal = false;
  loading = true;
  withdrawing = false;
  addingBank = false;

  successMsg = '';
  errorMsg = '';

  constructor(
    private fb: FormBuilder,
    private earningsService: EarningsService,
    private deliveryPortal: DeliveryPortalService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.withdrawForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
    });

    this.bankForm = this.fb.group({
      account_holder_name: ['', Validators.required],
      account_number: ['', [Validators.required, Validators.minLength(9)]],
      ifsc_code: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i)]],
    });

    const remit = this.route.snapshot.queryParamMap.get('remit');
    if (remit === 'success') {
      this.successMsg = 'Cash cleared successfully. Amount paid to platform.';
      setTimeout(() => (this.successMsg = ''), 6000);
    } else if (remit === 'failed') {
      this.errorMsg = 'Cash clear payment failed or was cancelled. You can try again.';
    }

    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.earningsService.getDeliveryEarnings().subscribe({
      next: (data) => {
        this.summary = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });

    this.earningsService.getBankAccounts().subscribe({
      next: (data) => (this.bankAccounts = data),
    });

    this.earningsService.getWithdrawalHistory().subscribe({
      next: (data) => (this.withdrawalHistory = data),
    });

    this.deliveryPortal.cashOnHand().subscribe({
      next: (data) => {
        this.cashOnHand = data.cash_on_hand || 0;
        this.cashOrderCount = data.order_count || 0;
      },
      error: () => {
        // Keep last known cash on hand; never zero it on a failed request.
      },
    });
  }

  clearCollectedCash(): void {
    if (this.cashOnHand <= 0 || this.clearingCash) return;
    this.errorMsg = '';
    this.clearingCash = true;
    this.deliveryPortal.initiateCashRemit().subscribe({
      next: (pay) => {
        this.clearingCash = false;
        this.deliveryPortal.redirectToPayU(pay.payment_url, pay.fields);
      },
      error: (err) => {
        this.clearingCash = false;
        this.errorMsg = err.error?.detail || 'Could not start cash clear payment';
      },
    });
  }

  get primaryBank(): BankAccount | undefined {
    return this.bankAccounts.find((b) => b.is_primary);
  }

  openWithdrawModal(): void {
    this.errorMsg = '';
    if (!this.primaryBank) {
      this.errorMsg = 'Please add a bank account first';
      return;
    }
    this.showWithdrawModal = true;
    this.withdrawForm.reset();
  }

  submitWithdrawal(): void {
    if (this.withdrawForm.invalid) return;
    const amount = this.withdrawForm.get('amount')?.value;

    if (amount > (this.summary?.available_balance || 0)) {
      this.errorMsg = 'Amount exceeds available balance';
      return;
    }

    this.withdrawing = true;
    this.earningsService.requestWithdrawal(amount).subscribe({
      next: () => {
        this.withdrawing = false;
        this.showWithdrawModal = false;
        this.successMsg = `Withdrawal of ₹${amount} requested successfully`;
        this.loadAll();
        setTimeout(() => (this.successMsg = ''), 4000);
      },
      error: (err) => {
        this.withdrawing = false;
        this.errorMsg = err.error?.detail || 'Withdrawal failed';
      },
    });
  }

  submitBankAccount(): void {
    if (this.bankForm.invalid) return;
    this.addingBank = true;

    const payload = {
      ...this.bankForm.value,
      ifsc_code: String(this.bankForm.value.ifsc_code).toUpperCase(),
    };

    this.earningsService.addBankAccount(payload).subscribe({
      next: () => {
        this.addingBank = false;
        this.showBankForm = false;
        this.successMsg = 'Bank account added successfully';
        this.loadAll();
        setTimeout(() => (this.successMsg = ''), 4000);
      },
      error: (err) => {
        this.addingBank = false;
        this.errorMsg = err.error?.detail || 'Failed to add bank account';
      },
    });
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-pending',
      processing: 'status-processing',
      completed: 'status-completed',
      failed: 'status-failed',
    };
    return map[status] || '';
  }
}
