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
            <!-- Progress Pill -->
            <div *ngIf="session.screen === 'Question' && session.question" class="progress-pill">
              <span>{{ session.question.progress_percentage }}% Completed</span>
            </div>

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
      background: radial-gradient(circle at 50% 0%, #EEF2FF 0%, #F8FAFC 55%, #F1F5F9 100%);
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .survey-top-bar {
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(226, 232, 240, 0.9);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
    }
    .bar-content {
      max-width: 760px;
      margin: 0 auto;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .study-title {
      font-weight: 700;
      font-size: 15px;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.01em;
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
      gap: 12px;
    }
    .progress-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      background: #e0e7ff;
      color: #3730a3;
      letter-spacing: 0.3px;
      white-space: nowrap;
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
      background: #4f46e5;
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
      max-width: 760px;
      width: 100%;
      margin: 0 auto;
      padding: 36px 20px 48px 20px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .question-stage {
      width: 100%;
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
      border-radius: 12px;
      padding: 14px;
      color: #b91c1c;
      margin-bottom: 24px;
    }
    .end-screen-stage {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
    .end-card {
      width: 100%;
      max-width: 540px;
      padding: 40px 32px;
      border-radius: 20px;
      text-align: center;
      box-shadow: 0 16px 40px -10px rgba(15, 23, 42, 0.08);
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
      line-height: 32px;
    }
    .success-icon {
      background: #dcfce7;
      color: #16a34a;
    }
    .disqualify-icon {
      background: #fee2e2;
      color: #dc2626;
    }
    .info-icon {
      background: #e0e7ff;
      color: #4f46e5;
    }
    .closed-icon {
      background: #f1f5f9;
      color: #64748b;
    }
    .end-desc {
      font-size: 15px;
      color: #64748b;
      line-height: 1.6;
      margin-top: 10px;
    }
  `]
})
export class RespondentContainerComponent implements OnInit {
  token = '';
  session: RespondentSession | null = null;
  loading = true;
  submitting = false;
  errorMsg = '';
  currentLang = 'en';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.token = params['token'];
      if (this.token) {
        this.loadSession();
      } else {
        this.errorMsg = 'Invalid survey link. No token provided.';
        this.loading = false;
      }
    });
  }

  loadSession(): void {
    this.loading = true;
    this.errorMsg = '';

    this.api.getRespondentSession(this.token).subscribe({
      next: (session) => {
        this.session = session;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.detail || 'Could not load survey. The link may be expired, invalid, or the survey is closed.';
      }
    });
  }

  hasTranslations(): boolean {
    const q = this.session?.question;
    return !!(q && q.translations && Object.keys(q.translations).length > 0);
  }

  switchLanguage(lang: string): void {
    this.currentLang = lang;
  }

  onAnswerSubmitted(payload: { answer: any; otherText?: string }): void {
    if (this.submitting || !this.session || !this.session.question) return;
    this.submitting = true;

    this.api.submitAnswer(
      this.token,
      this.session.question.id,
      payload.answer,
      payload.otherText
    ).subscribe({
      next: (updatedSession: RespondentSession) => {
        this.session = updatedSession;
        this.submitting = false;
      },
      error: (err: any) => {
        this.submitting = false;
        this.errorMsg = err?.error?.detail || 'Failed to submit response. Please try again.';
      }
    });
  }

  onBackRequested(): void {
    if (this.submitting || !this.session) return;
    this.submitting = true;

    this.api.goBack(this.token).subscribe({
      next: (updatedSession: RespondentSession) => {
        this.session = updatedSession;
        this.submitting = false;
      },
      error: (err: any) => {
        this.submitting = false;
        this.errorMsg = err?.error?.detail || 'Failed to navigate back.';
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/admin/surveys']);
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  retakeSurvey(): void {
    if (this.session?.survey_id) {
      this.api.createTestSession(this.session.survey_id).subscribe({
        next: (res: { token: string; survey_slug: string; url: string }) => {
          this.router.navigate(['/survey', res.token]).then(() => {
            this.token = res.token;
            this.loadSession();
          });
        },
        error: (err: any) => {
          this.errorMsg = 'Could not generate new preview session.';
        }
      });
    }
  }
}
