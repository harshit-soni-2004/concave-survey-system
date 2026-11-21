import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/login/admin-login.component').then(m => m.AdminLoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'surveys',
        pathMatch: 'full'
      },
      {
        path: 'surveys',
        loadComponent: () => import('./features/admin/survey-list/admin-survey-list.component').then(m => m.AdminSurveyListComponent)
      },
      {
        path: 'upload',
        loadComponent: () => import('./features/admin/survey-upload/admin-survey-upload.component').then(m => m.AdminSurveyUploadComponent)
      },
      {
        path: 'surveys/:id',
        loadComponent: () => import('./features/admin/survey-detail/admin-survey-detail.component').then(m => m.AdminSurveyDetailComponent)
      },
      {
        path: 'surveys/:id/dashboard',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      }
    ]
  },
  {
    path: 's/:slug',
    loadComponent: () => import('./features/respondent/respondent-container.component').then(m => m.RespondentContainerComponent)
  },
  {
    path: 'r/:token',
    loadComponent: () => import('./features/respondent/respondent-container.component').then(m => m.RespondentContainerComponent)
  },
  {
    path: '**',
    redirectTo: 'admin'
  }
];
