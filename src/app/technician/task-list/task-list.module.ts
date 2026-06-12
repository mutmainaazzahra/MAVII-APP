import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TaskListPageRoutingModule } from './task-list-routing.module';
import { TaskListPage } from './task-list.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, IonicModule, TaskListPageRoutingModule, SharedModule],
  declarations: [TaskListPage],
})
export class TaskListPageModule {}
