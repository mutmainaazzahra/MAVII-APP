import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private isOnline$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    this.initNetworkListener();
  }

  private async initNetworkListener(): Promise<void> {
    const status = await Network.getStatus();
    this.isOnline$.next(status.connected);

    Network.addListener('networkStatusChange', (status) => {
      console.log('🌐 Network status changed:', status.connected);
      this.isOnline$.next(status.connected);
    });
  }

  getNetworkStatus(): Observable<boolean> {
    return this.isOnline$.asObservable();
  }

  isOnline(): boolean {
    return this.isOnline$.getValue();
  }
}
