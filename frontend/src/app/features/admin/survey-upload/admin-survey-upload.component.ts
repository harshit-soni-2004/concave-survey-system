import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../../core/services/api.service';
import { ValidationError } from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-survey-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule
  ],
  template: `
    <div class="upload-container">
      <div class="header-row">
        <div>
          <h2>Upload Questionnaire</h2>
          <p class="subtitle">Parse, validate line numbers, and initialize survey version.</p>
        </div>
        <button mat-stroked-button routerLink="/admin/surveys">
          <mat-icon>arrow_back</mat-icon> Back to Surveys
        </button>
      </div>

      <mat-card class="editor-card">
        <mat-card-header>
          <mat-card-title>Tag-Based Questionnaire Definition</mat-card-title>
          <mat-card-subtitle>Paste survey syntax with questions, options, skip logic, quotas and screeners.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="quick-samples">
            <span class="sample-label">Load Template:</span>
            <button mat-button color="primary" type="button" (click)="loadSampleValid()">
              Valid Sample Study
            </button>
            <button mat-button color="warn" type="button" (click)="loadSampleBroken()">
              Broken Sample (Test Validator)
            </button>
          </div>

          <div *ngIf="validationErrors.length > 0" class="error-container">
            <div class="error-header">
              <mat-icon color="warn">error</mat-icon>
              <strong>Validation Failed ({{ validationErrors.length }} errors found):</strong>
            </div>
            <div class="error-list">
              <div *ngFor="let err of validationErrors" class="error-item">
                <span class="line-badge">Line {{ err.line }}</span>
                <span class="error-msg">{{ err.message }}</span>
              </div>
            </div>
          </div>

          <div *ngIf="isValid === true && validationErrors.length === 0" class="success-banner">
            <mat-icon>check_circle</mat-icon> Questionnaire syntax is 100% valid.
          </div>

          <mat-form-field appearance="outline" class="full-width editor-field">
            <mat-label>Questionnaire Content</mat-label>
            <textarea
              matInput
              [(ngModel)]="rawContent"
              name="rawContent"
              rows="18"
              class="code-textarea"
              placeholder="<survey id=&quot;...&quot; title=&quot;...&quot; target=&quot;...&quot;>&#10;  <question id=&quot;q1&quot; type=&quot;single&quot;>&#10;    ...&#10;  </question>&#10;</survey>"
              required
            ></textarea>
          </mat-form-field>

          <div *ngIf="loading" class="mb-3">
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          </div>

          <div class="action-buttons">
            <button
              mat-stroked-button
              type="button"
              (click)="onValidate()"
              [disabled]="loading || !rawContent.trim()"
            >
              <mat-icon>rule</mat-icon> Validate Syntax
            </button>

            <button
              mat-raised-button
              color="primary"
              type="button"
              (click)="onUpload()"
              [disabled]="loading || !rawContent.trim()"
            >
              <mat-icon>publish</mat-icon> Upload & Create Survey
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .header-row h2 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 700;
    }
    .subtitle {
      margin: 0;
      color: #64748b;
      font-size: 14px;
    }
    .editor-card {
      padding: 16px;
    }
    .quick-samples {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 0 16px 0;
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
    }
    .sample-label {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .full-width {
      width: 100%;
    }
    .code-textarea {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
    }
    .error-container {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .error-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #b91c1c;
      font-size: 14px;
      margin-bottom: 10px;
    }
    .error-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .error-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #7f1d1d;
    }
    .line-badge {
      background: #fee2e2;
      color: #991b1b;
      font-weight: 700;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
    }
    .success-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 500;
    }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }
    .mb-3 {
      margin-bottom: 16px;
    }
  `]
})
export class AdminSurveyUploadComponent {
  rawContent = '';
  loading = false;
  isValid: boolean | null = null;
  validationErrors: ValidationError[] = [];

  constructor(private apiService: ApiService, private router: Router) {}

  loadSampleValid(): void {
    const suffix = Math.floor(Math.random() * 900 + 100);
    this.rawContent = `<survey id="study_${suffix}" title="Brand Perception Study ${suffix}" target="150">

<question id="q0" type="info">
  <text>Welcome to our annual brand study. Your insights help improve digital services.</text>
</question>

<question id="q1" type="consent" required>
  <text>Do you agree to participate in this 5-minute study?</text>
  <option>Yes</option>
  <option>No</option>
</question>

<question id="q2" type="number" required min="18" max="75">
  <text>What is your age?</text>
</question>

<question id="q3" type="single" required>
  <text>What is your gender?</text>
  <option>Male</option>
  <option>Female</option>
  <option>Other</option>
</question>

<question id="q4" type="dropdown" required terminate-on="Other city" reason="City not in quota">
  <text>Which city do you reside in?</text>
  <option>Mumbai</option>
  <option>Delhi</option>
  <option>Bengaluru</option>
  <option>Other city</option>
</question>

<question id="q5" type="multi" required shuffle="true" max="3">
  <text>Which services have you used in the last 6 months?</text>
  <option>Fintech</option>
  <option>E-commerce</option>
  <option>Healthtech</option>
  <option fixed="true" other="true">Other (specify)</option>
</question>

<question id="q6" type="nps" required>
  <text>How likely are you to recommend our products to colleagues?</text>
</question>

<quota question="q3" value="Male" target="75"/>
<quota question="q3" value="Female" target="75"/>

</survey>`;
    this.validationErrors = [];
    this.isValid = null;
    this.onValidate();
  }

  loadSampleBroken(): void {
    this.rawContent = `<survey id="broken_test" title="Broken Study" target="50">

<question type="single">
  <text>Missing question id error</text>
  <option>A</option>
</question>

<question id="q2" type="unknown_type">
  <text>Unknown type error</text>
</question>

<question id="q3" type="single" show-if="nonexistent_q=Yes">
  <text>Reference to nonexistent question</text>
  <option>Option</option>
</question>

<quota question="q99" value="None" target="10"/>

</survey>`;
    this.validationErrors = [];
    this.isValid = null;
    this.onValidate();
  }

  onValidate(): void {
    if (!this.rawContent.trim()) return;
    this.loading = true;
    this.apiService.validateSurvey(this.rawContent).subscribe({
      next: res => {
        this.loading = false;
        this.isValid = res.valid;
        this.validationErrors = res.errors;
      },
      error: err => {
        this.loading = false;
        this.isValid = false;
        this.validationErrors = err?.error?.detail?.errors || [{ line: 1, message: 'Invalid questionnaire payload' }];
      }
    });
  }

  onUpload(): void {
    if (!this.rawContent.trim()) return;
    this.loading = true;
    this.apiService.createSurvey(this.rawContent).subscribe({
      next: survey => {
        this.loading = false;
        this.router.navigate(['/admin/surveys', survey.id]);
      },
      error: err => {
        this.loading = false;
        this.isValid = false;
        const detail = err?.error?.detail;
        if (detail?.errors) {
          this.validationErrors = detail.errors;
        } else if (typeof detail === 'string') {
          this.validationErrors = [{ line: 1, message: detail }];
        } else {
          this.validationErrors = [{ line: 1, message: 'Upload failed. Please check questionnaire parameters.' }];
        }
      }
    });
  }
}
