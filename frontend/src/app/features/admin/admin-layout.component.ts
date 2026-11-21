import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
  ],
  template: `
    <div class="admin-shell">
      <!-- Left Sidebar -->
      <aside class="admin-sidebar" [class.collapsed]="isCollapsed">
        <!-- Brand / Header -->
        <div class="sidebar-brand" routerLink="/admin/surveys">
          <div class="brand-logo-circle">
            <mat-icon>insights</mat-icon>
          </div>
          <div class="brand-text-wrap" *ngIf="!isCollapsed">
            <span class="brand-name">Concave</span>
            <span class="brand-tag">INSIGHTS ENGINE</span>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="sidebar-nav">
          <div class="nav-section-title" *ngIf="!isCollapsed">STUDY MANAGEMENT</div>

          <a routerLink="/admin/surveys" routerLinkActive="active-nav" class="nav-link-item" title="Surveys">
            <mat-icon class="nav-icon">poll</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Surveys</span>
          </a>

          <a routerLink="/admin/upload" routerLinkActive="active-nav" class="nav-link-item" title="Upload Questionnaire">
            <mat-icon class="nav-icon">cloud_upload</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Upload</span>
          </a>

          <a routerLink="/admin/surveys" class="nav-link-item" title="Metrics & Performance">
            <mat-icon class="nav-icon">bar_chart</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Metrics</span>
            <span class="live-badge" *ngIf="!isCollapsed">Live</span>
          </a>

          <div class="nav-section-title" *ngIf="!isCollapsed" style="margin-top: 24px;">SYSTEM & TOOLS</div>

          <button type="button" class="nav-link-item btn-link" (click)="showSettingsModal = true" title="System Settings">
            <mat-icon class="nav-icon">settings</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Settings</span>
          </button>

          <a href="/docs" target="_blank" class="nav-link-item" title="FastAPI Interactive Docs">
            <mat-icon class="nav-icon">menu_book</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">API Docs</span>
            <mat-icon class="external-icon" *ngIf="!isCollapsed">open_in_new</mat-icon>
          </a>
        </nav>

        <!-- Bottom User Card -->
        <div class="sidebar-footer" *ngIf="authService.isLoggedIn()">
          <div class="user-chip">
            <div class="avatar-circle">
              {{ getUserInitial() }}
            </div>
            <div class="user-meta" *ngIf="!isCollapsed">
              <span class="user-fullname">{{ authService.currentUser()?.name }}</span>
              <span class="role-pill">{{ authService.currentUser()?.role | uppercase }}</span>
            </div>
            <button mat-icon-button (click)="authService.logout()" title="Sign Out" class="logout-icon-btn">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Layout Body -->
      <div class="admin-main-wrap">
        <!-- Top Compact Bar -->
        <header class="admin-topbar">
          <div class="topbar-left">
            <button mat-icon-button (click)="isCollapsed = !isCollapsed" class="toggle-btn" title="Toggle Sidebar">
              <mat-icon>{{ isCollapsed ? 'menu' : 'menu_open' }}</mat-icon>
            </button>
            <div class="breadcrumb-info">
              <span class="portal-badge">Admin Workspace</span>
              <span class="sep">/</span>
              <span class="page-title">Market Research System</span>
            </div>
          </div>

          <div class="topbar-right">
            <div class="health-status">
              <span class="health-dot"></span>
              <span class="health-text">MySQL 8 Live</span>
            </div>
            <button mat-raised-button color="primary" routerLink="/admin/upload" class="new-survey-btn">
              <mat-icon>add</mat-icon> New Survey
            </button>
          </div>
        </header>

        <!-- Dynamic Page Content -->
        <main class="admin-content-stage">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Settings Modal Overlay -->
      <div *ngIf="showSettingsModal" class="settings-modal-backdrop" (click)="showSettingsModal = false">
        <div class="settings-modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <mat-icon color="primary">settings</mat-icon>
              <h3>Platform & System Settings</h3>
            </div>
            <button mat-icon-button (click)="showSettingsModal = false">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="modal-body">
            <div class="setting-row">
              <span class="setting-label">Backend API Server</span>
              <span class="setting-val code-val">http://127.0.0.1:8000</span>
            </div>
            <div class="setting-row">
              <span class="setting-label">Primary Database</span>
              <span class="setting-val code-val">MySQL 8.0 (survey_db)</span>
            </div>
            <div class="setting-row">
              <span class="setting-label">Automated Test Database</span>
              <span class="setting-val code-val">survey_test (Isolated)</span>
            </div>
            <div class="setting-row">
              <span class="setting-label">Authentication Scheme</span>
              <span class="setting-val">JWT Bearer (HS256)</span>
            </div>
            <div class="setting-row">
              <span class="setting-label">Active Operator</span>
              <span class="setting-val">{{ authService.currentUser()?.email }} ({{ authService.currentUser()?.role }})</span>
            </div>
            <div class="setting-row">
              <span class="setting-label">Questionnaire DSL Parser</span>
              <span class="setting-val">XML/Tag-based Logic Engine v1.0</span>
            </div>
          </div>

          <div class="modal-footer">
            <button mat-raised-button color="primary" (click)="showSettingsModal = false">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .admin-shell {
      display: flex;
      min-height: 100vh;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Left Sidebar */
    .admin-sidebar {
      width: 250px;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: sticky;
      top: 0;
      height: 100vh;
      z-index: 100;
      box-shadow: 2px 0 8px rgba(0,0,0,0.06);
    }
    .admin-sidebar.collapsed {
      width: 72px;
    }

    .sidebar-brand {
      height: 64px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
    }
    .brand-logo-circle {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
    }
    .brand-text-wrap {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      white-space: nowrap;
    }
    .brand-name {
      font-weight: 700;
      font-size: 16px;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .brand-tag {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.8px;
    }

    /* Nav items */
    .sidebar-nav {
      flex: 1;
      padding: 20px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
    }
    .nav-section-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 1px;
      padding: 8px 10px 4px 10px;
    }
    .nav-link-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 12px;
      border-radius: 8px;
      color: #cbd5e1;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.15s ease;
      cursor: pointer;
      white-space: nowrap;
    }
    .nav-link-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #ffffff;
    }
    .nav-link-item.active-nav {
      background: #2563eb;
      color: #ffffff;
      font-weight: 600;
    }
    .nav-icon {
      font-size: 20px;
      height: 20px;
      width: 20px;
      flex-shrink: 0;
    }
    .nav-label {
      flex: 1;
    }
    .btn-link {
      background: transparent;
      border: none;
      width: 100%;
      text-align: left;
    }
    .live-badge {
      background: #10b981;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.4px;
    }
    .external-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
      opacity: 0.6;
    }

    /* User Profile Card */
    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 23, 42, 0.6);
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.04);
    }
    .avatar-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #3b82f6;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .user-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .user-fullname {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .role-pill {
      font-size: 10px;
      font-weight: 700;
      color: #38bdf8;
    }
    .logout-icon-btn {
      color: #94a3b8;
      width: 32px;
      height: 32px;
      line-height: 32px;
    }
    .logout-icon-btn:hover {
      color: #ef4444;
    }

    /* Right Main Area */
    .admin-main-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .admin-topbar {
      height: 64px;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 90;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .toggle-btn {
      color: #64748b;
    }
    .breadcrumb-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .portal-badge {
      font-weight: 600;
      color: #2563eb;
    }
    .sep {
      color: #94a3b8;
    }
    .page-title {
      font-weight: 500;
      color: #475569;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .health-status {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      color: #475569;
    }
    .health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
    }
    .new-survey-btn {
      font-size: 13px;
      font-weight: 600;
    }
    .admin-content-stage {
      flex: 1;
      padding: 28px 24px;
      max-width: 1280px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
    }

    /* Modal Backdrop */
    .settings-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .settings-modal-card {
      background: #ffffff;
      border-radius: 12px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      animation: modalPop 0.15s ease-out;
    }
    @keyframes modalPop {
      from { transform: scale(0.96); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .modal-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .modal-title-wrap h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    .modal-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13.5px;
    }
    .setting-label {
      color: #64748b;
      font-weight: 500;
    }
    .setting-val {
      color: #0f172a;
      font-weight: 600;
    }
    .code-val {
      font-family: monospace;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: flex-end;
      background: #f8fafc;
    }
  `]
})
export class AdminLayoutComponent {
  isCollapsed = false;
  showSettingsModal = false;

  constructor(public authService: AuthService, private router: Router) {}

  getUserInitial(): string {
    const name = this.authService.currentUser()?.name || 'Admin';
    return name.slice(0, 1).toUpperCase();
  }
}
