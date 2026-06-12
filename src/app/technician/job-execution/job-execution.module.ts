import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { JobExecutionPageRoutingModule } from './job-execution-routing.module';
import { JobExecutionPage } from './job-execution.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    JobExecutionPageRoutingModule,
  ],
  declarations: [JobExecutionPage],
})
export class JobExecutionPageModule {}
