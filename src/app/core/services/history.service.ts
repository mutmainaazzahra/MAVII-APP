import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { HistoryItem, HistoryResponse } from '../models/history.model';
import { ApiResponse } from '../models/user.model';
import { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMyHistory(): Observable<HistoryResponse> {
    return this.http.get<any>(`${this.apiUrl}/api/technician/history`).pipe(
      map((res) => {
        const rawItems = res.data ?? res.history ?? res.tasks ?? [];
        const items = rawItems.map((item: any) => ({
          ...item,
          location_name:
            item.location_name || item.address || item.alamat || '',
          customer_name: item.customer_name || item.nama_pelanggan || '',
        }));
        return { success: res.success ?? true, data: items } as HistoryResponse;
      }),
    );
  }

  getHistoryDetail(id: number): Observable<ApiResponse<Task>> {
    return this.http.get<any>(`${this.apiUrl}/api/technician/tasks/${id}`).pipe(
      map((res) => {
        const raw = res.data ?? res.task ?? res;
        const normalized = {
          ...raw,
          location_name: raw.location_name || raw.address || raw.alamat || '',
          customer_name: raw.customer_name || raw.nama_pelanggan || '',
          description: raw.description || raw.gangguan || raw.title || '',
        };
        return {
          success: res.success ?? true,
          message: res.message,
          data: normalized as Task,
        } as ApiResponse<Task>;
      }),
    );
  }
}
