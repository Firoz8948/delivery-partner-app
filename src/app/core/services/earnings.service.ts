import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EarningsSummary {
  total_earned: number;
  total_withdrawn: number;
  available_balance: number;
  unsettled_amount: number;
  settled_amount: number;
}

export interface BankAccount {
  id: number;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  is_verified: boolean;
  is_primary: boolean;
}

export interface Withdrawal {
  id: number;
  amount: number;
  status: string;
  created_at: string;
}

export interface HistoryPage {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: Record<string, unknown>[];
}

@Injectable({ providedIn: 'root' })
export class EarningsService {
  private readonly base = `${environment.apiBaseUrl}/payment`;

  constructor(private http: HttpClient) {}

  getRestaurantEarnings(): Observable<EarningsSummary> {
    return this.http.get<EarningsSummary>(`${this.base}/earnings/restaurant`);
  }

  getDeliveryEarnings(): Observable<EarningsSummary> {
    return this.http.get<EarningsSummary>(`${this.base}/earnings/delivery`);
  }

  getBankAccounts(): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(`${this.base}/bank-account`);
  }

  addBankAccount(data: {
    account_holder_name: string;
    account_number: string;
    ifsc_code: string;
  }): Observable<BankAccount> {
    return this.http.post<BankAccount>(`${this.base}/bank-account`, data);
  }

  requestWithdrawal(amount: number): Observable<Withdrawal> {
    return this.http.post<Withdrawal>(`${this.base}/withdraw`, { amount });
  }

  getWithdrawalHistory(): Observable<Withdrawal[]> {
    return this.http.get<Withdrawal[]>(`${this.base}/withdraw/history`);
  }

  getRestaurantSettlementHistory(page = 1) {
    return this.http.get<HistoryPage>(
      `${this.base}/earnings/restaurant/settlements?page=${page}`,
    );
  }

  getDeliverySettlementHistory(page = 1) {
    return this.http.get<HistoryPage>(
      `${this.base}/earnings/delivery/settlements?page=${page}`,
    );
  }
}
