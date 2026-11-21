import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <div class="layout-container">
      <mat-toolbar color="primary" class="main-toolbar">
        <span class="brand-title" routerLink="/admin/surveys">Concave Insights</span>
        <div class="nav-links" *ngIf="authService.isLoggedIn()">
          <button mat-button routerLink="/admin/surveys" routerLinkActive="active-nav">
            <mat-icon>assessment</mat-icon> Surveys
          </button>
          <button mat-button routerLink="/admin/upload" routerLinkActive="active-nav">
            <mat-icon>cloud_upload</mat-icon> Upload
          </button>
        </div>

        <span class="spacer"></span>

        <div class="user-meta" *ngIf="authService.isLoggedIn()">
          <span class="user-name">{{ authService.currentUser()?.name }}</span>
          <span class="role-badge" [class.admin-role]="authService.isAdmin()">
            {{ authService.currentUser()?.role | uppercase }}
          </span>
          <button mat-icon-button (click)="authService.logout()" title="Sign Out">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </mat-toolbar>

      <main class="content-body">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .layout-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: #f8fafc;
    }
    .main-toolbar {
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .brand-title {
      font-weight: 700;
      font-size: 19px;
      letter-spacing: -0.5px;
      cursor: pointer;
      margin-right: 24px;
    }
    .nav-links {
      display: flex;
      gap: 8px;
    }
    .active-nav {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .user-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
    }
    .user-name {
      font-weight: 500;
    }
    .role-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      background: rgba(255,255,255,0.25);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .role-badge.admin-role {
      background: #ffd54f;
      color: #212121;
    }
    .content-body {
      flex: 1;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 24px 16px;
      box-sizing: border-box;
    }
  `]
})
export class AdminLayoutComponent {
  constructor(public authService: AuthService) {}
}
