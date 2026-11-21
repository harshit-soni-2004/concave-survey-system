import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

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
    MatIconModule
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Concave Insights</mat-card-title>
          <mat-card-subtitle>Research & Operations Portal</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="errorMessage" class="error-banner">
            {{ errorMessage }}
          </div>

          <form (ngSubmit)="onLogin()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required />
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" class="full-width login-btn" [disabled]="loading">
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>
          </form>

          <div class="demo-helpers">
            <p class="demo-title">Quick Demo Logins:</p>
            <div class="demo-buttons">
              <button mat-stroked-button type="button" (click)="quickLogin('admin@concave.com', 'AdminPassword123!')">
                Admin
              </button>
              <button mat-stroked-button type="button" (click)="quickLogin('researcher@concave.com', 'ResearcherPassword123!')">
                Researcher
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 16px;
    }
    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 24px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .login-btn {
      height: 44px;
      font-size: 15px;
      margin-top: 8px;
    }
    .error-banner {
      background-color: #ffebee;
      color: #c62828;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 14px;
    }
    .demo-helpers {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }
    .demo-title {
      font-size: 12px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .demo-buttons {
      display: flex;
      gap: 12px;
    }
    .demo-buttons button {
      flex: 1;
    }
  `]
})
export class AdminLoginComponent {
  email = '';
  password = '';
  loading = false;
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  quickLogin(e: string, p: string): void {
    this.email = e;
    this.password = p;
    this.onLogin();
  }

  onLogin(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter email and password.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/admin/surveys']);
      },
      error: err => {
        this.loading = false;
        this.errorMessage = err?.error?.detail || 'Invalid email or password.';
      }
    });
  }
}
