import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="login-wrapper">
      <!-- Ambient Animated Background Layer -->
      <div class="ambient-background-layer" aria-hidden="true">
        <div class="fluid-blob fluid-blob-1"></div>
        <div class="fluid-blob fluid-blob-2"></div>
        <div class="fluid-blob fluid-blob-3"></div>
        <div class="fluid-blob fluid-blob-4"></div>
        <div class="fluid-blob fluid-blob-5"></div>
        <div class="dark-vignette"></div>
        <div class="ambient-grain-overlay"></div>
      </div>

      <!-- Centered Modern Card -->
      <div class="login-card admin-card">
        <div class="login-brand">
          <div class="brand-logo-circle">
            <mat-icon>insights</mat-icon>
          </div>
          <div class="badge-row">
            <span class="ats-badge">AI + SURVEY COPILOT</span>
          </div>
          <h1 class="brand-title">Concave<span class="text-accent-gradient">Insights</span></h1>
          <p class="brand-subtitle">Enterprise Operations &amp; Research Portal</p>
        </div>

        <div *ngIf="errorMessage" class="error-banner">
          <mat-icon class="err-icon">error_outline</mat-icon>
          <span>{{ errorMessage }}</span>
        </div>

        <form (ngSubmit)="onLogin()" class="login-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" [(ngModel)]="email" name="email" required placeholder="admin@concave.com" />
            <mat-icon matPrefix class="input-icon">mail_outline</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput type="password" [(ngModel)]="password" name="password" required />
            <mat-icon matPrefix class="input-icon">lock_outline</mat-icon>
          </mat-form-field>

          <button mat-flat-button type="submit" class="full-width login-submit-btn" [disabled]="loading">
            <mat-icon *ngIf="!loading">login</mat-icon>
            {{ loading ? 'Signing in...' : 'Sign In to Workspace' }}
          </button>
        </form>

        <div class="demo-helpers">
          <span class="demo-title">Quick Demo Sign-in:</span>
          <div class="demo-buttons">
            <button mat-stroked-button type="button" class="demo-pill" (click)="quickLogin('admin@concave.com', 'AdminPassword123!')">
              <mat-icon>admin_panel_settings</mat-icon> Admin
            </button>
            <button mat-stroked-button type="button" class="demo-pill" (click)="quickLogin('researcher@concave.com', 'ResearcherPassword123!')">
              <mat-icon>analytics</mat-icon> Researcher
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 24px;
      position: relative;
      background-color: var(--color-bg);
      overflow: hidden;
    }

    .badge-row {
      margin-bottom: 8px;
    }

    .ats-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 2.5px 10px;
      border-radius: 9999px;
      background: rgba(139, 108, 255, 0.15);
      color: #2DD4F5;
      border: 1px solid rgba(139, 108, 255, 0.35);
      text-transform: uppercase;
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 40px 36px;
      border-radius: 24px;
      background: rgba(24, 24, 38, 0.55);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 50px -10px rgba(0, 0, 0, 0.7);
      position: relative;
      z-index: 2;
    }

    .login-brand {
      text-align: center;
      margin-bottom: 28px;
    }

    .brand-logo-circle {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #07070F;
      box-shadow: 0 0 24px -2px rgba(45, 212, 245, 0.45);
      margin-bottom: 14px;
    }

    .brand-logo-circle mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      font-weight: 700;
    }

    .brand-title {
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 800;
      color: #F8F8FC;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
    }

    .brand-subtitle {
      font-size: 13.5px;
      color: #9A9AB5;
      margin: 0;
    }

    .error-banner {
      background: rgba(251, 113, 133, 0.1);
      border: 1px solid rgba(251, 113, 133, 0.28);
      color: #FB7185;
      padding: 12px 16px;
      border-radius: 12px;
      margin-bottom: 20px;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .err-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .login-form {
      display: flex;
      flex-direction: column;
    }

    .full-width {
      width: 100%;
      margin-bottom: 14px;
    }

    .input-icon {
      color: #8A8AA3;
      margin-right: 6px;
    }

    .login-submit-btn {
      height: 48px;
      font-family: var(--font-heading) !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      letter-spacing: 0.2px;
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 14px !important;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%) !important;
      color: #07070F !important;
      border: none;
      box-shadow: 0 0 24px -2px rgba(45, 212, 245, 0.4) !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }

    .login-submit-btn:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 0 32px -2px rgba(45, 212, 245, 0.55) !important;
    }

    .demo-helpers {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      text-align: center;
    }

    .demo-title {
      font-size: 11.5px;
      font-weight: 600;
      color: #8A8AA3;
      display: block;
      margin-bottom: 12px;
    }

    .demo-buttons {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .demo-pill {
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #C4C4D6 !important;
      border-color: rgba(255, 255, 255, 0.12) !important;
      border-radius: 12px !important;
      padding: 6px 14px !important;
      transition: all 0.2s ease !important;
    }

    .demo-pill:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      color: #F8F8FC !important;
      border-color: #2DD4F5 !important;
    }
  `]
})
export class AdminLoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(
    private authService: AuthService,
    public themeService: ThemeService,
    private router: Router
  ) {}

  onLogin(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please provide both email and password.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/admin/surveys']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Invalid email or password. Please try again.';
      }
    });
  }

  quickLogin(email: string, pass: string): void {
    this.email = email;
    this.password = pass;
    this.onLogin();
  }
}
