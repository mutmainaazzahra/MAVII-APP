import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { HistoryDetailPageRoutingModule } from './history-detail-routing.module';
import { HistoryDetailPage } from './history-detail.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    HistoryDetailPageRoutingModule,
    SharedModule,
  ],
  declarations: [HistoryDetailPage],
})
export class HistoryDetailPageModule {}
