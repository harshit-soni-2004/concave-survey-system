import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="admin-shell">
      <!-- Ambient Animated Background Layer (Pure CSS, 40-60s loop) -->
      <div class="ambient-background-layer" aria-hidden="true">
        <div class="fluid-blob fluid-blob-1"></div>
        <div class="fluid-blob fluid-blob-2"></div>
        <div class="fluid-blob fluid-blob-3"></div>
        <div class="fluid-blob fluid-blob-4"></div>
        <div class="fluid-blob fluid-blob-5"></div>
        <div class="dark-vignette"></div>
        <div class="ambient-grain-overlay"></div>
      </div>

      <!-- Mobile Backdrop -->
      <div 
        class="mobile-backdrop" 
        *ngIf="mobileNavOpen" 
        (click)="mobileNavOpen = false">
      </div>

      <!-- Left Sidebar -->
      <aside 
        class="admin-sidebar" 
        [class.collapsed]="isCollapsed"
        [class.mobile-open]="mobileNavOpen">
        
        <!-- Brand / Header -->
        <div class="sidebar-brand" routerLink="/admin/surveys" (click)="closeMobileNav()">
          <div class="brand-logo-circle">
            <mat-icon>insights</mat-icon>
          </div>
          <div class="brand-text-wrap" *ngIf="!isCollapsed">
            <div class="brand-title-row">
              <span class="brand-name">Concave<span class="text-accent-gradient">Insights</span></span>
              <span class="ats-badge">AI COPILOT</span>
            </div>
            <span class="brand-tag">SURVEY INTELLIGENCE ENGINE</span>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav class="sidebar-nav">
          <div class="nav-section-title" *ngIf="!isCollapsed">STUDY MANAGEMENT</div>

          <a 
            routerLink="/admin/surveys" 
            routerLinkActive="active-nav" 
            class="nav-link-item" 
            title="Surveys"
            (click)="closeMobileNav()">
            <mat-icon class="nav-icon">poll</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Surveys</span>
          </a>

          <a 
            routerLink="/admin/analytics" 
            routerLinkActive="active-nav" 
            class="nav-link-item" 
            title="In-Depth Questionnaire Analytics"
            (click)="closeMobileNav()">
            <mat-icon class="nav-icon">insights</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Analytics</span>
          </a>

          <a 
            routerLink="/admin/upload" 
            routerLinkActive="active-nav" 
            class="nav-link-item" 
            title="Upload Questionnaire"
            (click)="closeMobileNav()">
            <mat-icon class="nav-icon">cloud_upload</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">Upload</span>
          </a>

          <div class="nav-section-title" *ngIf="!isCollapsed" style="margin-top: 24px;">DEVELOPER</div>

          <a 
            href="/docs" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="nav-link-item" 
            title="Interactive API Documentation"
            (click)="closeMobileNav()">
            <mat-icon class="nav-icon">menu_book</mat-icon>
            <span class="nav-label" *ngIf="!isCollapsed">API Docs</span>
            <mat-icon class="external-icon" *ngIf="!isCollapsed">open_in_new</mat-icon>
          </a>
        </nav>

        <!-- Bottom User Profile Card -->
        <div class="sidebar-footer" *ngIf="authService.isLoggedIn()">
          <div class="user-chip">
            <div class="avatar-circle">
              {{ getUserInitial() }}
            </div>
            <div class="user-meta" *ngIf="!isCollapsed">
              <span class="user-fullname" [title]="authService.currentUser()?.name || 'Admin'">
                {{ authService.currentUser()?.name }}
              </span>
              <span class="role-pill">{{ authService.currentUser()?.role | uppercase }}</span>
            </div>
            <button mat-icon-button (click)="authService.logout()" title="Sign Out" class="logout-icon-btn">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Layout Body -->
      <div class="admin-main-wrap" [class.sidebar-collapsed]="isCollapsed">
        <!-- Top Translucent Bar -->
        <header class="admin-topbar">
          <div class="topbar-left">
            <button mat-icon-button (click)="toggleSidebar()" class="toggle-btn" title="Toggle Navigation">
              <mat-icon>{{ isCollapsed ? 'menu' : 'menu_open' }}</mat-icon>
            </button>
            <div class="breadcrumb-info">
              <span class="portal-badge">Admin Workspace</span>
              <span class="sep">/</span>
              <span class="page-title">Market Research System</span>
            </div>
          </div>

          <div class="topbar-right">
            <!-- Theme Switcher Button -->
            <button 
              mat-icon-button 
              class="theme-toggle-btn"
              (click)="themeService.toggleTheme()" 
              [attr.aria-label]="themeService.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
              [attr.aria-pressed]="themeService.isDark() ? 'false' : 'true'"
              [matTooltip]="themeService.isDark() ? 'Switch to Light Theme' : 'Switch to Dark Theme'">
              <mat-icon>{{ themeService.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>

            <!-- Dynamic Health Status backed by /api/health -->
            <div class="health-status" [class.unhealthy]="!dbHealthy">
              <span class="health-dot" [class.green]="dbHealthy" [class.red]="!dbHealthy"></span>
              <span class="health-text">{{ healthLabel }}</span>
            </div>

            <button mat-flat-button color="primary" routerLink="/admin/upload" class="new-survey-btn">
              <mat-icon>add</mat-icon> <span class="btn-text">New Survey</span>
            </button>
          </div>
        </header>

        <!-- Dynamic Page Content -->
        <main class="admin-content-stage">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .admin-shell {
      display: flex;
      min-height: 100vh;
      background-color: var(--color-bg);
      font-family: var(--font-sans);
      position: relative;
      overflow-x: hidden;
    }

    /* Mobile Backdrop */
    .mobile-backdrop {
      display: none;
    }

    /* Left Sidebar: Fixed Floating Rounded Glass UI (stays 100% intact on scroll) */
    .admin-sidebar {
      width: 260px;
      position: fixed;
      top: 14px;
      left: 14px;
      height: calc(100vh - 28px);
      border-radius: 20px;
      background: rgba(14, 13, 28, 0.65);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12),
                  0 20px 48px -10px rgba(0, 0, 0, 0.65),
                  0 0 24px -4px rgba(139, 108, 255, 0.12);
      color: #F8F8FC;
      display: flex;
      flex-direction: column;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      z-index: 100;
      flex-shrink: 0;
      overflow: hidden;
    }

    :host-context([data-theme="light"]) .admin-sidebar {
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.90);
      box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.06),
                  0 1px 3px rgba(15, 23, 42, 0.04),
                  inset 0 1px 0 rgba(255, 255, 255, 0.95);
      color: #0F172A;
    }

    .admin-sidebar.collapsed {
      width: 76px;
    }

    .sidebar-brand {
      height: 68px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: pointer;
    }

    :host-context([data-theme="light"]) .sidebar-brand {
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

    .brand-logo-circle {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #07070F;
      flex-shrink: 0;
      box-shadow: 0 0 20px -2px rgba(45, 212, 245, 0.45);
    }

    :host-context([data-theme="light"]) .brand-logo-circle {
      background: linear-gradient(135deg, #4F46E5 0%, #0284C7 100%);
      color: #FFFFFF;
      box-shadow: 0 4px 14px -2px rgba(79, 70, 229, 0.35);
    }

    .brand-logo-circle mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      font-weight: 700;
    }

    .brand-text-wrap {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      white-space: nowrap;
      gap: 2px;
    }

    .brand-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .brand-name {
      font-family: var(--font-heading);
      font-weight: 800;
      font-size: 16px;
      color: #F8F8FC;
      letter-spacing: -0.4px;
    }

    :host-context([data-theme="light"]) .brand-name {
      color: #0F172A;
    }

    .ats-badge {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 1.5px 6px;
      border-radius: 9999px;
      background: rgba(139, 108, 255, 0.15);
      color: #2DD4F5;
      border: 1px solid rgba(139, 108, 255, 0.35);
      text-transform: uppercase;
    }

    :host-context([data-theme="light"]) .ats-badge {
      background: rgba(79, 70, 229, 0.08);
      color: #4F46E5;
      border: 1px solid rgba(79, 70, 229, 0.25);
    }

    .brand-tag {
      font-size: 9px;
      font-weight: 600;
      color: #9A9AB5;
      letter-spacing: 0.8px;
    }

    :host-context([data-theme="light"]) .brand-tag {
      color: #64748B;
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
      color: #9A9AB5;
      letter-spacing: 1px;
      padding: 8px 12px 4px 12px;
    }

    :host-context([data-theme="light"]) .nav-section-title {
      color: #94A3B8;
    }

    .nav-link-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      border-radius: 12px;
      color: #C4C4D6;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
      white-space: nowrap;
      position: relative;
      border: 1px solid transparent;
    }

    .nav-link-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #F8F8FC;
    }

    :host-context([data-theme="light"]) .nav-link-item {
      color: #475569;
    }

    :host-context([data-theme="light"]) .nav-link-item:hover {
      background: #F1F5F9;
      color: #0F172A;
    }

    /* Active Nav Item */
    .nav-link-item.active-nav {
      background: rgba(139, 108, 255, 0.16) !important;
      border-color: rgba(139, 108, 255, 0.35) !important;
      color: #F8F8FC !important;
      font-weight: 600;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 18px -4px rgba(45, 212, 245, 0.35);
    }

    :host-context([data-theme="light"]) .nav-link-item.active-nav {
      background: rgba(79, 70, 229, 0.08) !important;
      border-color: rgba(79, 70, 229, 0.25) !important;
      color: #4F46E5 !important;
      font-weight: 700 !important;
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.08) !important;
    }

    .nav-link-item.active-nav .nav-icon {
      color: #2DD4F5 !important;
    }

    :host-context([data-theme="light"]) .nav-link-item.active-nav .nav-icon {
      color: #4F46E5 !important;
    }

    .nav-link-item.active-nav::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 3.5px;
      background: #2DD4F5;
      border-radius: 0 4px 4px 0;
      box-shadow: 0 0 10px rgba(45, 212, 245, 0.8);
    }

    :host-context([data-theme="light"]) .nav-link-item.active-nav::before {
      background: #4F46E5;
      box-shadow: 0 0 8px rgba(79, 70, 229, 0.5);
    }

    .nav-icon {
      font-size: 20px;
      height: 20px;
      width: 20px;
      flex-shrink: 0;
      color: #C4C4D6;
    }

    :host-context([data-theme="light"]) .nav-icon {
      color: #64748B;
    }

    .nav-label {
      flex: 1;
    }

    .external-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
      opacity: 0.6;
    }

    /* User Profile Card */
    .sidebar-footer {
      padding: 14px 12px;
      border-top: 1px solid var(--color-border);
      background: rgba(0, 0, 0, 0.2);
    }

    :host-context([data-theme="light"]) .sidebar-footer {
      background: #FFFFFF;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--color-border);
    }

    :host-context([data-theme="light"]) .user-chip {
      background: #F8FAFC;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }

    .avatar-circle {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    :host-context([data-theme="light"]) .avatar-circle {
      background: linear-gradient(135deg, #4F46E5 0%, #0284C7 100%);
      color: #FFFFFF;
    }

    .user-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .user-fullname {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text);
      word-break: break-word;
      line-height: 1.25;
    }

    :host-context([data-theme="light"]) .user-fullname {
      color: #0F172A;
    }

    .role-pill {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-highlight);
      margin-top: 2px;
    }

    :host-context([data-theme="light"]) .role-pill {
      color: #D97706;
    }

    .logout-icon-btn {
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    :host-context([data-theme="light"]) .logout-icon-btn {
      color: #64748B;
    }

    .logout-icon-btn:hover {
      color: var(--color-danger);
    }

    :host-context([data-theme="light"]) .logout-icon-btn:hover {
      color: #DC2626;
    }

    /* Right Main Area with offset for Fixed Sidebar */
    .admin-main-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      width: 100%;
      position: relative;
      z-index: 1;
      margin-left: 288px;
      transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .admin-main-wrap.sidebar-collapsed {
      margin-left: 104px;
    }

    /* Floating Translucent Glass Top Bar */
    .admin-topbar {
      height: 64px;
      margin: 14px 20px 0 20px;
      border-radius: 18px;
      background: rgba(14, 13, 28, 0.65);
      backdrop-filter: blur(24px) saturate(160%);
      -webkit-backdrop-filter: blur(24px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 12px 32px -4px rgba(0, 0, 0, 0.45);
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 14px;
      z-index: 90;
      transition: var(--transition-theme);
    }

    :host-context([data-theme="light"]) .admin-topbar {
      background: rgba(255, 255, 255, 0.82);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.90);
      box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 1);
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .toggle-btn {
      color: #C4C4D6;
    }

    :host-context([data-theme="light"]) .toggle-btn {
      color: #475569;
    }

    .breadcrumb-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
    }

    .portal-badge {
      font-family: var(--font-heading);
      font-weight: 700;
      color: #2DD4F5;
    }

    :host-context([data-theme="light"]) .portal-badge {
      color: #4F46E5;
    }

    .sep {
      color: rgba(255, 255, 255, 0.25);
    }

    :host-context([data-theme="light"]) .sep {
      color: #CBD5E1;
    }

    .page-title {
      font-weight: 500;
      color: #9A9AB5;
    }

    :host-context([data-theme="light"]) .page-title {
      color: #0F172A;
      font-weight: 600;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    /* Theme Toggle Button */
    .theme-toggle-btn {
      color: #FBBF24;
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.25);
      border-radius: 10px;
      transition: all 0.2s ease;
    }

    .theme-toggle-btn:hover {
      background: rgba(251, 191, 36, 0.2);
      transform: rotate(15deg);
    }

    :host-context([data-theme="light"]) .theme-toggle-btn {
      color: #D97706;
      background: rgba(217, 119, 6, 0.1);
      border: 1px solid rgba(217, 119, 6, 0.25);
    }

    .health-status {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      color: #C4C4D6;
    }

    :host-context([data-theme="light"]) .health-status {
      background: #F8FAFC;
      border: 1px solid rgba(15, 23, 42, 0.08);
      color: #334155;
    }

    .health-status.unhealthy {
      background: rgba(251, 113, 133, 0.12);
      color: #FB7185;
      border-color: rgba(251, 113, 133, 0.28);
    }

    :host-context([data-theme="light"]) .health-status.unhealthy {
      background: rgba(220, 38, 38, 0.08);
      color: #DC2626;
      border-color: rgba(220, 38, 38, 0.2);
    }

    .health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .health-dot.green {
      background: #34D399;
      box-shadow: 0 0 8px rgba(52, 211, 153, 0.8);
      animation: pulseGreen 2s infinite;
    }

    :host-context([data-theme="light"]) .health-dot.green {
      background: #059669;
      box-shadow: 0 0 8px rgba(5, 150, 105, 0.6);
    }

    .health-dot.red {
      background: #FB7185;
      box-shadow: 0 0 8px rgba(251, 113, 133, 0.8);
    }

    :host-context([data-theme="light"]) .health-dot.red {
      background: #DC2626;
      box-shadow: 0 0 8px rgba(220, 38, 38, 0.6);
    }

    @keyframes pulseGreen {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }

    .new-survey-btn {
      font-family: var(--font-heading) !important;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%) !important;
      color: #07070F !important;
      font-weight: 700 !important;
      font-size: 13px !important;
      border-radius: 12px !important;
      box-shadow: 0 0 20px -2px rgba(45, 212, 245, 0.35) !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      padding: 0 16px !important;
      height: 40px !important;
    }

    :host-context([data-theme="light"]) .new-survey-btn {
      background: linear-gradient(135deg, #4F46E5 0%, #0284C7 100%) !important;
      color: #FFFFFF !important;
      box-shadow: 0 4px 14px -2px rgba(79, 70, 229, 0.35) !important;
    }

    .new-survey-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 0 26px -2px rgba(45, 212, 245, 0.5) !important;
    }

    :host-context([data-theme="light"]) .new-survey-btn:hover {
      box-shadow: 0 6px 20px -2px rgba(79, 70, 229, 0.45) !important;
    }

    .admin-content-stage {
      flex: 1;
      padding: 24px;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      box-sizing: border-box;
      position: relative;
      z-index: 1;
    }

    /* Responsive Breakpoints: 1280px, 768px, 390px */
    @media (max-width: 768px) {
      .admin-sidebar {
        position: fixed;
        left: -290px;
        top: 10px;
        bottom: 10px;
        margin: 0;
        height: calc(100vh - 20px);
        transition: left 0.25s ease;
      }
      .admin-sidebar.mobile-open {
        left: 10px;
      }
      .admin-main-wrap,
      .admin-main-wrap.sidebar-collapsed {
        margin-left: 0 !important;
      }
      .admin-topbar {
        margin: 10px 12px 0 12px;
        border-radius: 14px;
      }
      .mobile-backdrop {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        z-index: 95;
      }
      .page-title {
        display: none;
      }
      .sep {
        display: none;
      }
      .admin-content-stage {
        padding: 16px;
      }
    }

    @media (max-width: 390px) {
      .admin-topbar {
        padding: 0 10px;
      }
      .breadcrumb-info {
        font-size: 11.5px;
      }
      .btn-text {
        display: none;
      }
      .health-status {
        display: none;
      }
      .admin-content-stage {
        padding: 12px 8px;
      }
    }
  `]
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  isCollapsed = false;
  mobileNavOpen = false;
  dbHealthy = true;
  healthLabel = 'MySQL 8.0 Live';
  private timerSub?: Subscription;

  constructor(
    public authService: AuthService, 
    public themeService: ThemeService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkHealth();
    this.timerSub = interval(30000).subscribe(() => this.checkHealth());
  }

  ngOnDestroy(): void {
    if (this.timerSub) {
      this.timerSub.unsubscribe();
    }
  }

  checkHealth(): void {
    this.apiService.getHealth().subscribe({
      next: (res) => {
        if (res.status === 'healthy' || res.database === 'connected') {
          this.dbHealthy = true;
          this.healthLabel = res.database_engine ? `${res.database_engine} Live` : 'MySQL 8.0 Live';
        } else {
          this.dbHealthy = false;
          this.healthLabel = 'DB Degraded';
        }
      },
      error: () => {
        this.dbHealthy = false;
        this.healthLabel = 'API Offline';
      }
    });
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 768) {
      this.mobileNavOpen = !this.mobileNavOpen;
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
  }

  closeMobileNav(): void {
    this.mobileNavOpen = false;
  }

  getUserInitial(): string {
    const name = this.authService.currentUser()?.name || 'Admin';
    return name.slice(0, 1).toUpperCase();
  }
}
