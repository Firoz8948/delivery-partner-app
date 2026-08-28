import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImpersonationExitService {
  private readonly endpoint = `${environment.apiBaseUrl}/admin/impersonation/exit`;

  constructor(private readonly http: HttpClient) {}

  exit(): Observable<{ ok: boolean; ended_at: string | null }> {
    return this.http.post<{ ok: boolean; ended_at: string | null }>(
      this.endpoint,
      {},
    );
  }
}
