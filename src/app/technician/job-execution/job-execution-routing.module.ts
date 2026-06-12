import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { JobExecutionPage } from './job-execution.page';

const routes: Routes = [
  {
    path: '',
    component: JobExecutionPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JobExecutionPageRoutingModule {}
