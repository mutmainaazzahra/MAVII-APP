import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';

const routes: Routes = [
  { path: '', redirectTo: 'welcome', pathMatch: 'full' },
  {
    path: 'welcome',
    loadChildren: () =>
      import('./welcome/welcome.module').then((m) => m.WelcomePageModule),
  },
  {
    path: 'privacy-policy',
    loadChildren: () =>
      import('./privacy-policy/privacy-policy/privacy-policy.module').then(
        (m) => m.PrivacyPolicyPageModule,
      ),
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: 'auth/login',
    loadChildren: () =>
      import('./auth/login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'forgot-password',
    loadChildren: () =>
      import('./auth/forgot-password/forgot-password.module').then(
        (m) => m.ForgotPasswordPageModule,
      ),
  },
  {
    path: 'technician',
    canActivate: [AuthGuard, RoleGuard],
    children: [
      {
        path: 'tabs',
        loadChildren: () =>
          import('./technician/tabs/tabs.module').then((m) => m.TabsPageModule),
      },
      {
        path: 'task-detail/:id',
        loadChildren: () =>
          import('./technician/task-detail/task-detail.module').then(
            (m) => m.TaskDetailPageModule,
          ),
      },
      {
        path: 'job-execution/:id',
        loadChildren: () =>
          import('./technician/job-execution/job-execution.module').then(
            (m) => m.JobExecutionPageModule,
          ),
      },
      {
        path: 'history-detail/:id',
        loadChildren: () =>
          import('./technician/history-detail/history-detail.module').then(
            (m) => m.HistoryDetailPageModule,
          ),
      },
      { path: '', redirectTo: 'tabs', pathMatch: 'full' },
    ],
  },
  {
    path: 'reset-password',
    loadChildren: () =>
      import('./auth/reset-password/reset-password.module').then(
        (m) => m.ResetPasswordPageModule,
      ),
  },
  { path: '**', redirectTo: 'welcome' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
