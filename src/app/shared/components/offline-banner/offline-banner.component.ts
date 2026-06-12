import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { NetworkService } from '../../../core/services/network.service';

@Component({
  selector: 'app-offline-banner',
  templateUrl: './offline-banner.component.html',
  styleUrls: ['./offline-banner.component.scss'],
  standalone: false,
})
export class OfflineBannerComponent implements OnInit, OnDestroy {
  isOnline = true;
  showOnlineBanner = false; // banner hijau sementara
  private sub!: Subscription;
  private onlineTimer: any;

  constructor(private networkService: NetworkService) {}

  ngOnInit() {
    this.sub = this.networkService.getNetworkStatus().subscribe((online) => {
      if (!this.isOnline && online) {
        // Baru kembali online → tampil banner hijau sebentar
        this.showOnlineBanner = true;
        this.onlineTimer = setTimeout(() => {
          this.showOnlineBanner = false;
        }, 3000); // hilang setelah 3 detik
      }
      this.isOnline = online;
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
    if (this.onlineTimer) clearTimeout(this.onlineTimer);
  }
}
