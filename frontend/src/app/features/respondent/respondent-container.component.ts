import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RespondentSession } from '../../core/models/survey.model';
import { QuestionRendererComponent } from './question-renderer/question-renderer.component';

@Component({
  selector: 'app-respondent-container',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    QuestionRendererComponent
  ],
  template: `
    <div class="respondent-viewport">
      <!-- Top Header & Progress -->
      <header class="survey-top-bar" *ngIf="session">
        <div class="bar-content">
          <div class="header-left">
            <span class="study-title">{{ session.survey_title }}</span>
            <span *ngIf="session.is_test" class="test-pill">PREVIEW / TEST MODE</span>
          </div>
          <div class="header-right">
            <!-- Language toggle if translations exist -->
            <div class="lang-toggle-bar" *ngIf="hasTranslations()">
              <button
                type="button"
                class="lang-pill"
                [class.active]="currentLang === 'en'"
                (click)="switchLanguage('en')"
              >
                EN
              </button>
              <button
                type="button"
                class="lang-pill"
                [class.active]="currentLang === 'hi'"
                (click)="switchLanguage('hi')"
              >
                हिंदी
              </button>
            </div>

            <button *ngIf="session.is_test || authService.isLoggedIn()" mat-button color="primary" class="nav-back-btn" (click)="goToDashboard()">
              <mat-icon>arrow_back</mat-icon> Return to Dashboard
            </button>
          </div>
        </div>
        <mat-progress-bar
          *ngIf="session.screen === 'Question' && session.question"
          mode="determinate"
          [value]="session.question.progress_percentage"
          class="survey-progress"
        ></mat-progress-bar>
      </header>

      <!-- Main Stage -->
      <main class="survey-main">
        <div *ngIf="loading" class="center-loading">
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          <p>Loading survey questions...</p>
        </div>

        <div *ngIf="errorMsg" class="error-banner">
          <mat-icon>error_outline</mat-icon>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- 1. Active Question Screen -->
        <div *ngIf="!loading && session?.screen === 'Question' && session?.question" class="question-stage">
          <app-question-renderer
            [question]="session!.question!"
            [currentLang]="currentLang"
            [submitting]="submitting"
            (answerSubmitted)="onAnswerSubmitted($event)"
            (backRequested)="onBackRequested()"
          ></app-question-renderer>
        </div>

        <!-- 2. Terminal Screen: Completed -->
        <div *ngIf="!loading && session?.screen === 'Completed'" class="end-screen-stage">
          <mat-card class="end-card success-card">
            <div class="icon-circle success-icon">
              <mat-icon>check</mat-icon>
            </div>
            <h2>Thank you!</h2>
            <p class="end-desc">Your responses have been recorded successfully. We appreciate your valuable time and participation.</p>
            <div class="end-actions">
              <button mat-raised-button color="primary" (click)="goToDashboard()" *ngIf="session?.is_test || authService.isLoggedIn()">
                <mat-icon>dashboard</mat-icon> Return to Dashboard
              </button>
              <button mat-stroked-button color="primary" (click)="retakeSurvey()" *ngIf="session?.is_test">
                <mat-icon>refresh</mat-icon> Retake Test
              </button>
              <button mat-stroked-button (click)="goToHome()" *ngIf="!session?.is_test && !authService.isLoggedIn()">
                <mat-icon>home</mat-icon> Return Home
              </button>
            </div>
          </mat-card>
        </div>

        <!-- 3. Terminal Screen: Not eligible -->
        <div *ngIf="!loading && session?.screen === 'Not eligible'" class="end-screen-stage">
          <mat-card class="end-card disqualify-card">
            <div class="icon-circle disqualify-icon">
              <mat-icon>block</mat-icon>
            </div>
            <h2>Not Eligible</h2>
            <p class="end-desc" *ngIf="session?.termination_reason">
              Thank you for your interest. You do not meet the criteria for this specific study:
              <strong>{{ session?.termination_reason }}</strong>.
            </p>
            <p class="end-desc" *ngIf="!session?.termination_reason">
              Thank you for your interest. Unfortunately, this study has reached its required quota for your demographic segment.
            </p>
            <div class="end-actions">
              <button mat-raised-button color="primary" (click)="goToDashboard()" *ngIf="session?.is_test || authService.isLoggedIn()">
                <mat-icon>dashboard</mat-icon> Return to Dashboard
              </button>
              <button mat-stroked-button color="primary" (click)="retakeSurvey()" *ngIf="session?.is_test">
                <mat-icon>refresh</mat-icon> Retake Test
              </button>
              <button mat-stroked-button (click)="goToHome()" *ngIf="!session?.is_test && !authService.isLoggedIn()">
                <mat-icon>home</mat-icon> Return Home
              </button>
            </div>
          </mat-card>
        </div>

        <!-- 4. Terminal Screen: Already completed -->
        <div *ngIf="!loading && session?.screen === 'Already completed'" class="end-screen-stage">
          <mat-card class="end-card info-card">
            <div class="icon-circle info-icon">
              <mat-icon>done_all</mat-icon>
            </div>
            <h2>Already Completed</h2>
            <p class="end-desc">You have already submitted your response for this survey. Each participant can submit only once.</p>
            <div class="end-actions">
              <button mat-raised-button color="primary" (click)="goToDashboard()" *ngIf="session?.is_test || authService.isLoggedIn()">
                <mat-icon>dashboard</mat-icon> Return to Dashboard
              </button>
              <button mat-stroked-button (click)="goToHome()" *ngIf="!session?.is_test && !authService.isLoggedIn()">
                <mat-icon>home</mat-icon> Return Home
              </button>
            </div>
          </mat-card>
        </div>

        <!-- 5. Terminal Screen: Survey closed -->
        <div *ngIf="!loading && session?.screen === 'Survey closed'" class="end-screen-stage">
          <mat-card class="end-card closed-card">
            <div class="icon-circle closed-icon">
              <mat-icon>lock</mat-icon>
            </div>
            <h2>Survey Closed</h2>
            <p class="end-desc">This survey has completed its collection target or passed its deadline and is no longer accepting new responses.</p>
            <div class="end-actions">
              <button mat-raised-button color="primary" (click)="goToDashboard()" *ngIf="session?.is_test || authService.isLoggedIn()">
                <mat-icon>dashboard</mat-icon> Return to Dashboard
              </button>
              <button mat-stroked-button (click)="goToHome()" *ngIf="!session?.is_test && !authService.isLoggedIn()">
                <mat-icon>home</mat-icon> Return Home
              </button>
            </div>
          </mat-card>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .respondent-viewport {
      min-height: 100vh;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .survey-top-bar {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .bar-content {
      max-width: 680px;
      margin: 0 auto;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .study-title {
      font-weight: 700;
      font-size: 15px;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .lang-toggle-bar {
      display: inline-flex;
      background: #f1f5f9;
      padding: 2px;
      border-radius: 20px;
    }
    .lang-pill {
      border: none;
      background: transparent;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s;
    }
    .lang-pill.active {
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .nav-back-btn {
      font-size: 13px;
      height: 32px;
      line-height: 32px;
    }
    .end-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    .test-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      background: #fef3c7;
      color: #92400e;
      letter-spacing: 0.5px;
    }
    .survey-progress {
      height: 4px;
    }
    .survey-main {
      flex: 1;
      max-width: 680px;
      width: 100%;
      margin: 0 auto;
      padding: 32px 16px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .center-loading {
      text-align: center;
      padding: 48px 16px;
      color: #64748b;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 14px;
      color: #b91c1c;
      margin-bottom: 24px;
    }
    .end-screen-stage {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      animation: fadeIn 0.3s ease;
    }
    .end-card {
      width: 100%;
      text-align: center;
      padding: 40px 24px;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px auto;
    }
    .icon-circle mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .success-icon { background: #dcfce7; color: #16a34a; }
    .disqualify-icon { background: #fee2e2; color: #dc2626; }
    .info-icon { background: #e0f2fe; color: #0284c7; }
    .closed-icon { background: #f1f5f9; color: #64748b; }
    .end-card h2 {
      margin: 0 0 12px 0;
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }
    .end-desc {
      font-size: 15px;
      color: #475569;
      line-height: 1.6;
      max-width: 440px;
      margin: 0 auto;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class RespondentContainerComponent implements OnInit {
  session: RespondentSession | null = null;
  loading = true;
  submitting = false;
  errorMsg = '';
  activeToken = '';
  currentLang = 'en';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    public authService: AuthService
  ) {}

  hasTranslations(): boolean {
    const q = this.session?.question;
    if (!q) return false;
    if (q.translations && Object.keys(q.translations).length > 0) return true;
    if (q.options?.some(o => o.translations && Object.keys(o.translations).length > 0)) return true;
    if (q.rows?.some(r => r.translations && Object.keys(r.translations).length > 0)) return true;
    return false;
  }

  switchLanguage(lang: string): void {
    if (this.currentLang === lang || !this.activeToken) return;
    this.currentLang = lang;
    this.apiService.updateLanguage(this.activeToken, lang).subscribe({
      error: err => console.error('Failed to update language preference', err)
    });
  }

  ngOnInit(): void {
    // Check if token route /r/:token or slug route /s/:slug
    this.route.params.subscribe(params => {
      if (params['token']) {
        this.activeToken = params['token'];
        this.fetchSession(this.activeToken);
      } else if (params['slug']) {
        const slug = params['slug'];
        const storageKey = `survey_token_${slug}`;
        const cachedToken = localStorage.getItem(storageKey);

        if (cachedToken) {
          this.activeToken = cachedToken;
          this.fetchSession(cachedToken);
        } else {
          // Join survey to get fresh token and store it
          this.loading = true;
          this.apiService.joinSurvey(slug).subscribe({
            next: joinRes => {
              this.activeToken = joinRes.token;
              localStorage.setItem(storageKey, joinRes.token);
              this.fetchSession(joinRes.token);
            },
            error: err => {
              this.loading = false;
              this.errorMsg = err?.error?.detail || 'Survey is closed or not available.';
            }
          });
        }
      }
    });
  }

  fetchSession(token: string): void {
    this.loading = true;
    this.errorMsg = '';
    this.apiService.getRespondentSession(token).subscribe({
      next: sess => {
        this.session = sess;
        if (sess.question?.active_language) {
          this.currentLang = sess.question.active_language;
        }
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.errorMsg = err?.error?.detail || 'Invalid or expired survey participation link.';
      }
    });
  }

  onAnswerSubmitted(event: { answer: any; otherText?: string }): void {
    if (!this.session?.question || !this.activeToken) return;
    this.submitting = true;
    this.apiService.submitAnswer(
      this.activeToken,
      this.session.question.id,
      event.answer,
      event.otherText
    ).subscribe({
      next: updatedSess => {
        this.submitting = false;
        this.session = updatedSess;
      },
      error: err => {
        this.submitting = false;
        alert(err?.error?.detail || 'Error saving answer. Please try again.');
      }
    });
  }

  onBackRequested(): void {
    if (!this.activeToken) return;
    this.submitting = true;
    this.apiService.goBack(this.activeToken).subscribe({
      next: prevSess => {
        this.submitting = false;
        this.session = prevSess;
      },
      error: err => {
        this.submitting = false;
        alert(err?.error?.detail || 'Cannot go back.');
      }
    });
  }

  goToDashboard(): void {
    if (this.session?.survey_id) {
      this.router.navigate(['/admin/surveys', this.session.survey_id]);
    } else {
      this.router.navigate(['/admin/surveys']);
    }
  }

  goToHome(): void {
    this.router.navigate(['/admin/login']);
  }

  retakeSurvey(): void {
    if (this.session?.survey_id) {
      this.loading = true;
      this.apiService.createTestSession(this.session.survey_id).subscribe({
        next: res => {
          window.location.href = res.url;
        },
        error: () => {
          this.goToDashboard();
        }
      });
    } else {
      this.goToDashboard();
    }
  }
}
