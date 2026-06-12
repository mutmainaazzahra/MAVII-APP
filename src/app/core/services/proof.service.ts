import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProofResponse } from '../models/proof.model';

@Injectable({
  providedIn: 'root',
})
export class ProofService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadProof(
    taskId: number,
    photoBlob: Blob,
    caption: string,
  ): Observable<ProofResponse> {
    const formData = new FormData();
    formData.append('photo', photoBlob, 'proof.jpg');
    formData.append('caption', caption);

    return this.http.post<ProofResponse>(
      `${this.apiUrl}/api/technician/tasks/${taskId}/proof`,
      formData,
    );
  }
}
