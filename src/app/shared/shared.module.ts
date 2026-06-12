import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { OfflineBannerComponent } from './components/offline-banner/offline-banner.component';
import { SkeletonLoaderComponent } from './components/skeleton-loader/skeleton-loader.component';

@NgModule({
  declarations: [
    StatusBadgeComponent,
    OfflineBannerComponent,
    SkeletonLoaderComponent,
  ],
  imports: [CommonModule, IonicModule],
  exports: [
    StatusBadgeComponent,
    OfflineBannerComponent,
    SkeletonLoaderComponent,
  ],
})
export class SharedModule {}
