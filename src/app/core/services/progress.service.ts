import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProgressRequest, ProgressResponse } from '../models/progress.model';

@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  updateProgress(
    taskId: number,
    data: ProgressRequest,
  ): Observable<ProgressResponse> {
    return this.http.post<ProgressResponse>(
      `${this.apiUrl}/api/technician/tasks/${taskId}/progress`,
      data,
    );
  }
}
