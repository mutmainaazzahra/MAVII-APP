import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Task, TaskList, TaskActionResponse } from '../models/task.model';
import { ApiResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private normalizeTask(task: any): any {
    const locationName =
      task.location_name ||
      task.lokasi_name ||
      (task.location && typeof task.location === 'object'
        ? task.location.name || task.location.nama
        : '') ||
      task.address ||
      task.alamat ||
      '';

    const customerName =
      task.customer_name ||
      task.nama_pelanggan ||
      (task.customer && typeof task.customer === 'object'
        ? task.customer.name || task.customer.nama
        : '') ||
      '';

    const description =
      task.description || task.gangguan || task.keluhan || task.title || '';

    const latitude =
      task.latitude ||
      task.lat ||
      (task.location && task.location.latitude) ||
      null;
    const longitude =
      task.longitude ||
      task.lng ||
      (task.location && task.location.longitude) ||
      null;

    return {
      ...task,
      location_name: locationName,
      customer_name: customerName,
      description: description,
      latitude: latitude,
      longitude: longitude,
    };
  }

  getMyTasks(): Observable<ApiResponse<TaskList[]>> {
    return this.http.get<any>(`${this.apiUrl}/api/technician/tasks`).pipe(
      map(
        (res) =>
          ({
            success: res.success ?? true,
            message: res.message,
            data: (res.data ?? res.tasks ?? []).map((t: any) =>
              this.normalizeTask(t),
            ),
          }) as ApiResponse<TaskList[]>,
      ),
    );
  }

  getTaskDetail(id: number): Observable<ApiResponse<Task>> {
    return this.http.get<any>(`${this.apiUrl}/api/technician/tasks/${id}`).pipe(
      map((res) => {
        const raw = res.data ?? res.task ?? res;
        return {
          success: res.success ?? true,
          message: res.message,
          data: this.normalizeTask(raw) as Task,
        } as ApiResponse<Task>;
      }),
    );
  }

  updateNotes(
    taskId: number,
    type: 'tindakan' | 'catatan',
    content: string,
  ): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/technician/tasks/${taskId}/notes`,
      { type, content },
    );
  }

  acceptTask(id: number): Observable<TaskActionResponse> {
    return this.http.post<TaskActionResponse>(
      `${this.apiUrl}/api/technician/tasks/${id}/accept`,
      {},
    );
  }

  rejectTask(id: number): Observable<TaskActionResponse> {
    return this.http.post<TaskActionResponse>(
      `${this.apiUrl}/api/technician/tasks/${id}/reject`,
      {},
    );
  }

  startTask(id: number): Observable<TaskActionResponse> {
    return this.http.post<TaskActionResponse>(
      `${this.apiUrl}/api/technician/tasks/${id}/start`,
      {},
    );
  }

  completeTask(
    id: number,
    actions: string = '',
    catatan: string = '',
  ): Observable<TaskActionResponse> {
    return this.http.post<TaskActionResponse>(
      `${this.apiUrl}/api/technician/tasks/${id}/complete`,
      { actions, catatan },
    );
  }

  getProofImageUrl(path: string): string {
    if (!path) return '';
    const filename = path.replace('proofs/', '');
    return `${this.apiUrl}/api/technician/proof/${filename}`;
  }
}
