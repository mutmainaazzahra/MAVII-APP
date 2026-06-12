import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Geolocation } from '@capacitor/geolocation';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private apiUrl = environment.apiUrl;
  private locationInterval: any = null;

  constructor(private http: HttpClient) {}

  updateLocation(
    latitude: number,
    longitude: number,
    accuracy: number,
    taskId: number,
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/technician/location/update`, {
      latitude,
      longitude,
      accuracy,
      task_id: taskId,
    });
  }

  setOnline(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/technician/online`, {});
  }
  setOffline(): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/technician/offline`, {});
  }

  async getCurrentPosition(): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number;
  }> {
    // Try high accuracy first
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch {
      // Fallback: low accuracy + accept cached position (5 minutes old)
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 300000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    }
  }

  startTracking(taskId: number): void {
    if (this.locationInterval) return;
    this.sendLocation(taskId);
    this.locationInterval = setInterval(() => this.sendLocation(taskId), 30000);
    console.log('📍 Location tracking started for task:', taskId);
  }

  stopTracking(): void {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
      console.log('📍 Location tracking stopped');
    }
  }

  isTracking(): boolean {
    return this.locationInterval !== null;
  }

  private async sendLocation(taskId: number): Promise<void> {
    try {
      const { latitude, longitude, accuracy } = await this.getCurrentPosition();
      this.updateLocation(latitude, longitude, accuracy, taskId).subscribe({
        next: () => console.log('📍 Location sent:', latitude, longitude),
        error: (err) => console.error('📍 Failed to send location:', err),
      });
    } catch (error) {
      console.error('📍 GPS error:', error);
    }
  }
}
