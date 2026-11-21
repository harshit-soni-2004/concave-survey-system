import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { SurveyDetail, TokenItem } from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-survey-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
    MatSnackBarModule
  ],
  template: `
    <div class="detail-container" *ngIf="survey">
      <!-- Top Bar -->
      <div class="top-nav">
        <button mat-button routerLink="/admin/surveys">
          <mat-icon>arrow_back</mat-icon> All Surveys
        </button>
        <span class="spacer"></span>
        <button mat-stroked-button color="primary" [routerLink]="['/admin/surveys', survey.id, 'dashboard']">
          <mat-icon>bar_chart</mat-icon> View Dashboard
        </button>
      </div>

      <!-- Main Overview Header -->
      <mat-card class="overview-card">
        <div class="overview-header">
          <div>
            <div class="status-wrap">
              <span class="status-pill" [ngClass]="survey.status.toLowerCase()">{{ survey.status }}</span>
              <span class="slug-tag">{{ survey.slug }}</span>
            </div>
            <h1 class="survey-title">{{ survey.title }}</h1>
          </div>

          <div class="primary-actions">
            <!-- Preview / Test Button (Available for all roles) -->
            <button mat-stroked-button color="accent" (click)="onPreviewTest()">
              <mat-icon>bug_report</mat-icon> Preview / Test
            </button>

            <!-- Approve Button (Admin Only) -->
            <button
              *ngIf="authService.isAdmin() && latestDraftVersion"
              mat-raised-button
              color="primary"
              (click)="onApproveVersion(latestDraftVersion.id)"
            >
              <mat-icon>check</mat-icon> Approve v{{ latestDraftVersion.version_number }}
            </button>

            <!-- Close Survey Button (Admin Only) -->
            <button
              *ngIf="authService.isAdmin() && survey.status === 'LIVE'"
              mat-stroked-button
              color="warn"
              (click)="onCloseSurvey()"
            >
              <mat-icon>lock</mat-icon> Close Survey
            </button>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-box">
            <span class="meta-label">Target Sample</span>
            <span class="meta-val">{{ survey.target }} completes</span>
          </div>
          <div class="meta-box">
            <span class="meta-label">Deadline</span>
            <div class="deadline-row" *ngIf="!editingDeadline">
              <span class="meta-val">{{ survey.deadline_at ? (survey.deadline_at | date:'medium') : 'None' }}</span>
              <button *ngIf="authService.isAdmin()" mat-icon-button class="edit-btn" (click)="startEditDeadline()" title="Edit Deadline">
                <mat-icon>edit</mat-icon>
              </button>
            </div>
            <div class="deadline-edit-row" *ngIf="editingDeadline">
              <input type="datetime-local" [(ngModel)]="newDeadlineValue" class="date-input" />
              <button mat-icon-button color="primary" (click)="saveDeadline()"><mat-icon>check</mat-icon></button>
              <button mat-icon-button (click)="editingDeadline = false"><mat-icon>close</mat-icon></button>
            </div>
          </div>
          <div class="meta-box">
            <span class="meta-label">Public Participation Link</span>
            <div class="link-row">
              <code class="link-code">{{ getPublicUrl() }}</code>
              <button mat-icon-button (click)="copyText(getPublicUrl(), 'Participation link copied!')" title="Copy Link">
                <mat-icon>content_copy</mat-icon>
              </button>
              <a mat-icon-button [href]="getWhatsAppShareUrl(getPublicUrl())" target="_blank" title="Share via WhatsApp" class="share-icon wa-icon">
                <mat-icon>chat</mat-icon>
              </a>
              <a mat-icon-button [href]="getEmailShareUrl(getPublicUrl())" title="Share via Email" class="share-icon email-icon">
                <mat-icon>email</mat-icon>
              </a>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- Grid: Versions & Invite Links -->
      <div class="grid-2col">
        <!-- Versions Card -->
        <mat-card class="content-card">
          <mat-card-header>
            <mat-card-title>Survey Versions</mat-card-title>
            <mat-card-subtitle>All revisions and approval states</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="version-list">
              <div *ngFor="let v of survey.versions" class="version-item">
                <div class="version-info">
                  <strong>Version {{ v.version_number }}</strong>
                  <span class="v-status" [class.approved]="v.status === 'APPROVED'">{{ v.status }}</span>
                  <span class="v-date">Uploaded: {{ v.created_at | date:'short' }}</span>
                </div>
                <div class="v-actions" *ngIf="v.status === 'DRAFT' && authService.isAdmin()">
                  <button mat-button color="primary" (click)="onApproveVersion(v.id)">
                    Approve
                  </button>
                </div>
              </div>
            </div>

            <!-- Upload Revision -->
            <div class="upload-revision">
              <button mat-stroked-button (click)="showRevisionEditor = !showRevisionEditor">
                <mat-icon>{{ showRevisionEditor ? 'expand_less' : 'add' }}</mat-icon>
                {{ showRevisionEditor ? 'Cancel Revision' : 'Upload New Revision' }}
              </button>

              <div *ngIf="showRevisionEditor" class="revision-box">
                <textarea
                  [(ngModel)]="revisionContent"
                  rows="10"
                  class="code-textarea"
                  placeholder="Paste updated questionnaire definition..."
                ></textarea>
                <button
                  mat-raised-button
                  color="primary"
                  [disabled]="!revisionContent.trim() || uploadingRevision"
                  (click)="onUploadRevision()"
                >
                  {{ uploadingRevision ? 'Uploading...' : 'Save Draft Version' }}
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Generate Tokens Card -->
        <mat-card class="content-card">
          <mat-card-header>
            <mat-card-title>Generate Invite Links</mat-card-title>
            <mat-card-subtitle>Batch create one-time respondent tokens</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="token-generator-row">
              <mat-form-field appearance="outline" class="count-input">
                <mat-label>Quantity</mat-label>
                <input matInput type="number" min="1" max="500" [(ngModel)]="tokenCount" />
              </mat-form-field>
              <button
                mat-raised-button
                color="primary"
                [disabled]="generatingTokens || survey.status !== 'LIVE'"
                (click)="onGenerateTokens()"
              >
                Generate Links
              </button>
            </div>
            <p *ngIf="survey.status !== 'LIVE'" class="warn-note">
              * Survey must be LIVE to generate tokens.
            </p>

            <div *ngIf="generatedTokens.length > 0" class="token-results">
              <div class="token-results-header">
                <strong>Generated {{ generatedTokens.length }} Links:</strong>
                <button mat-button color="primary" (click)="copyAllTokens()">Copy All</button>
              </div>
              <div class="token-scroll">
                <div *ngFor="let tok of generatedTokens" class="token-line">
                  <span class="url-text">{{ getFullUrl(tok.url) }}</span>
                  <div class="action-btn-group">
                    <button mat-icon-button (click)="copyText(getFullUrl(tok.url), 'Link copied!')" title="Copy Link">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <a mat-icon-button [href]="getWhatsAppShareUrl(getFullUrl(tok.url))" target="_blank" title="Share via WhatsApp" class="share-icon wa-icon">
                      <mat-icon>chat</mat-icon>
                    </a>
                    <a mat-icon-button [href]="getEmailShareUrl(getFullUrl(tok.url))" title="Share via Email" class="share-icon email-icon">
                      <mat-icon>email</mat-icon>
                    </a>
                    <a mat-icon-button [href]="getFullUrl(tok.url)" target="_blank" title="Open Link" class="share-icon">
                      <mat-icon>open_in_new</mat-icon>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Export Data Section -->
      <mat-card class="export-card">
        <mat-card-header>
          <mat-card-title>Export Survey Data</mat-card-title>
          <mat-card-subtitle>Download completed, non-test responses in analytical formats</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="export-actions">
          <button mat-raised-button color="primary" (click)="downloadExport('csv')">
            <mat-icon>download</mat-icon> Download CSV
          </button>
          <button mat-raised-button color="accent" (click)="downloadExport('xlsx')">
            <mat-icon>table_chart</mat-icon> Download Excel (.xlsx)
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .top-nav {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    .spacer {
      flex: 1;
    }
    .overview-card {
      padding: 24px;
      margin-bottom: 24px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .overview-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .status-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .survey-title {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      color: #0f172a;
    }
    .slug-tag {
      font-family: monospace;
      font-size: 13px;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
      color: #475569;
    }
    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    .status-pill.live { background: #ecfdf5; color: #059669; }
    .status-pill.draft { background: #eff6ff; color: #2563eb; }
    .status-pill.closed { background: #f1f5f9; color: #64748b; }
    .primary-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
    }
    .meta-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .meta-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .meta-val {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
    }
    .deadline-row, .link-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .deadline-edit-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .date-input {
      padding: 6px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 13px;
    }
    .link-code {
      font-family: monospace;
      font-size: 13px;
      color: #0369a1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 280px;
    }
    .grid-2col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }
    .content-card {
      padding: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .version-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 16px 0;
    }
    .version-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .version-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .v-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      background: #e2e8f0;
    }
    .v-status.approved {
      background: #dcfce7;
      color: #15803d;
    }
    .v-date {
      font-size: 12px;
      color: #64748b;
    }
    .upload-revision {
      margin-top: 16px;
    }
    .revision-box {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .code-textarea {
      width: 100%;
      font-family: monospace;
      font-size: 13px;
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .token-generator-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
    }
    .count-input {
      width: 120px;
    }
    .warn-note {
      color: #d97706;
      font-size: 13px;
      margin: 0;
    }
    .token-results {
      margin-top: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
    }
    .token-results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .token-scroll {
      max-height: 180px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .token-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-family: monospace;
      padding: 2px 6px;
      background: #ffffff;
      border-radius: 4px;
    }
    .url-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .action-btn-group {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
    .share-icon {
      color: #64748b;
      width: 32px;
      height: 32px;
      line-height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .share-icon:hover {
      color: #0f172a;
    }
    .wa-icon:hover {
      color: #16a34a !important;
    }
    .email-icon:hover {
      color: #2563eb !important;
    }
    .export-card {
      padding: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .export-actions {
      display: flex;
      gap: 16px;
      margin-top: 16px;
    }
  `]
})
export class AdminSurveyDetailComponent implements OnInit {
  survey: SurveyDetail | null = null;
  latestDraftVersion: any = null;

  editingDeadline = false;
  newDeadlineValue = '';

  showRevisionEditor = false;
  revisionContent = '';
  uploadingRevision = false;

  tokenCount = 5;
  generatingTokens = false;
  generatedTokens: TokenItem[] = [];

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    public authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadSurvey(id);
    }
  }

  loadSurvey(id: number): void {
    this.apiService.getSurvey(id).subscribe(data => {
      this.survey = data;
      this.latestDraftVersion = data.versions.find(v => v.status === 'DRAFT');
    });
  }

  onPreviewTest(): void {
    if (!this.survey) return;
    this.apiService.createTestSession(this.survey.id).subscribe({
      next: res => {
        window.open(res.url, '_blank');
      },
      error: err => {
        this.snackBar.open(err?.error?.detail || 'Failed to create test session', 'Close', { duration: 3000 });
      }
    });
  }

  onApproveVersion(versionId: number): void {
    if (!this.survey) return;
    this.apiService.approveVersion(this.survey.id, versionId).subscribe({
      next: updated => {
        this.survey = updated;
        this.latestDraftVersion = updated.versions.find(v => v.status === 'DRAFT');
        this.snackBar.open('Version approved and survey is now LIVE!', 'Close', { duration: 3000 });
      },
      error: err => {
        this.snackBar.open(err?.error?.detail || 'Approve failed', 'Close', { duration: 3000 });
      }
    });
  }

  onCloseSurvey(): void {
    if (!this.survey) return;
    this.apiService.updateSurveyStatus(this.survey.id, 'CLOSED', 'ADMIN').subscribe({
      next: updated => {
        this.survey = updated;
        this.snackBar.open('Survey has been closed.', 'Close', { duration: 3000 });
      }
    });
  }

  startEditDeadline(): void {
    this.editingDeadline = true;
    if (this.survey?.deadline_at) {
      this.newDeadlineValue = new Date(this.survey.deadline_at).toISOString().slice(0, 16);
    }
  }

  saveDeadline(): void {
    if (!this.survey || !this.newDeadlineValue) return;
    this.apiService.updateSurveyDeadline(this.survey.id, new Date(this.newDeadlineValue).toISOString()).subscribe({
      next: updated => {
        this.survey = updated;
        this.editingDeadline = false;
        this.snackBar.open('Deadline updated successfully.', 'Close', { duration: 3000 });
      }
    });
  }

  onUploadRevision(): void {
    if (!this.survey || !this.revisionContent.trim()) return;
    this.uploadingRevision = true;
    this.apiService.uploadVersion(this.survey.id, this.revisionContent).subscribe({
      next: updated => {
        this.survey = updated;
        this.uploadingRevision = false;
        this.showRevisionEditor = false;
        this.revisionContent = '';
        this.latestDraftVersion = updated.versions.find(v => v.status === 'DRAFT');
        this.snackBar.open('New draft version uploaded.', 'Close', { duration: 3000 });
      },
      error: err => {
        this.uploadingRevision = false;
        this.snackBar.open(err?.error?.detail || 'Upload revision failed', 'Close', { duration: 4000 });
      }
    });
  }

  onGenerateTokens(): void {
    if (!this.survey) return;
    this.generatingTokens = true;
    this.apiService.generateTokens(this.survey.id, this.tokenCount).subscribe({
      next: res => {
        this.generatingTokens = false;
        this.generatedTokens = res.tokens;
        this.snackBar.open(`Generated ${res.tokens.length} invite tokens.`, 'Close', { duration: 3000 });
      },
      error: err => {
        this.generatingTokens = false;
        this.snackBar.open(err?.error?.detail || 'Could not generate tokens.', 'Close', { duration: 3000 });
      }
    });
  }

  downloadExport(format: 'csv' | 'xlsx'): void {
    if (!this.survey) return;
    const fetch$ = format === 'csv'
      ? this.apiService.getExportCsv(this.survey.id)
      : this.apiService.getExportXlsx(this.survey.id);

    fetch$.subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.survey?.slug}_export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  getPublicUrl(): string {
    return `${window.location.origin}/s/${this.survey?.slug}`;
  }

  getFullUrl(path: string): string {
    return `${window.location.origin}${path}`;
  }

  copyText(text: string, msg: string): void {
    navigator.clipboard.writeText(text);
    this.snackBar.open(msg, 'Close', { duration: 2000 });
  }

  copyAllTokens(): void {
    const all = this.generatedTokens.map(t => this.getFullUrl(t.url)).join('\n');
    navigator.clipboard.writeText(all);
    this.snackBar.open('All links copied to clipboard.', 'Close', { duration: 2000 });
  }

  getWhatsAppShareUrl(url: string): string {
    const title = this.survey?.title || 'our survey';
    const text = encodeURIComponent(`Hello! Please take a moment to participate in our study "${title}":\n${url}`);
    return `https://api.whatsapp.com/send?text=${text}`;
  }

  getEmailShareUrl(url: string): string {
    const title = this.survey?.title || 'Survey';
    const subject = encodeURIComponent(`Survey Invitation: ${title}`);
    const body = encodeURIComponent(`Hello,\n\nYou have been invited to participate in the study "${title}".\n\nPlease complete the survey by opening the link below:\n${url}\n\nThank you for your valuable feedback!`);
    return `mailto:?subject=${subject}&body=${body}`;
  }
}
