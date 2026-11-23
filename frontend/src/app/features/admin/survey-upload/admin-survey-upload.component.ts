import { Component, OnInit } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    MatProgressBarModule,
    MatSnackBarModule
  ],
  template: `
    <div class="upload-container">
      <!-- Header -->
      <div class="header-row">
        <div>
          <div class="header-badge-row">
            <span class="ats-badge">QUESTIONNAIRE INGESTION</span>
            <span class="header-breadcrumb">/admin/upload</span>
          </div>
          <h1 class="page-heading">Upload Questionnaire Definition</h1>
          <p class="subtitle">Deterministic XML tag parser, unique title constraint validator, and study version initializer.</p>
        </div>
        <button mat-stroked-button routerLink="/admin/surveys" class="back-btn">
          <mat-icon>arrow_back</mat-icon> Back to Surveys
        </button>
      </div>

      <!-- Sample Auto-fill Banner -->
      <div class="sample-autofill-banner">
        <div class="autofill-info">
          <div class="sparkle-circle">
            <mat-icon>auto_awesome</mat-icon>
          </div>
          <div>
            <h4 class="autofill-title">Want to test immediately?</h4>
            <p class="autofill-subtitle">Load a verified sample study questionnaire or run the broken validator test:</p>
          </div>
        </div>
        <div class="autofill-actions">
          <button type="button" class="btn-sample-gradient" (click)="loadSampleValid()">
            Load Valid Study Sample
          </button>
          <button type="button" class="btn-sample-outline" (click)="loadSampleBroken()">
            Broken Sample (Test Validator)
          </button>
        </div>
      </div>

      <!-- Validation Errors Banner -->
      <div *ngIf="validationErrors.length > 0" class="error-container">
        <div class="error-header">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <strong>Syntax Validation Failed ({{ validationErrors.length }} errors detected):</strong>
        </div>
        <div class="error-list">
          <div *ngFor="let err of validationErrors" class="error-item">
            <span class="line-badge">Line {{ err.line }}</span>
            <span class="error-msg">{{ err.message }}</span>
          </div>
        </div>
      </div>

      <!-- Validation Success Banner -->
      <div *ngIf="isValid === true && validationErrors.length === 0" class="success-banner">
        <mat-icon>check_circle</mat-icon>
        <span>Questionnaire syntax is 100% valid and verified. Ready to upload.</span>
      </div>

      <!-- 1. STUDY DETAILS & CONFIGURATION PANEL -->
      <div class="config-card">
        <div class="config-header">
          <div class="config-title-wrap">
            <div class="config-step-badge">1</div>
            <div>
              <h3 class="config-title">Study Identity &amp; Configuration</h3>
              <p class="config-desc">Configure the survey name, identifier, target sample, and fieldwork schedule before publishing</p>
            </div>
          </div>
          <div class="uniqueness-summary-badge" [class.valid]="isTitleUnique && isSlugUnique && surveyTitle.trim()" [class.invalid]="!isTitleUnique || !isSlugUnique">
            <mat-icon>{{ isTitleUnique && isSlugUnique && surveyTitle.trim() ? 'verified' : 'info' }}</mat-icon>
            <span>{{ getStatusSummaryText() }}</span>
          </div>
        </div>

        <div class="config-form-grid">
          <!-- Survey Name / Title -->
          <div class="form-group col-span-2">
            <div class="form-label-row">
              <label class="form-label-title">
                Survey Name / Title <span class="required-star">*</span>
              </label>
              <span class="constraint-pill">Constraint: Unique Across Workspace</span>
            </div>
            <div class="input-wrap" [class.input-error]="!isTitleUnique" [class.input-success]="isTitleUnique && surveyTitle.trim().length > 0">
              <mat-icon class="input-prefix-icon">title</mat-icon>
              <input 
                type="text" 
                [(ngModel)]="surveyTitle" 
                (ngModelChange)="onTitleChange($event)"
                placeholder="e.g. Q4 Brand Perception & Market Study" 
                class="config-input" 
                required
              />
              <div class="trailing-badge" *ngIf="surveyTitle.trim()">
                <span *ngIf="isTitleUnique" class="badge-unique">
                  <mat-icon>check_circle</mat-icon> Unique Name
                </span>
                <span *ngIf="!isTitleUnique" class="badge-duplicate">
                  <mat-icon>error</mat-icon> Name Already Taken
                </span>
              </div>
            </div>
            <p *ngIf="!isTitleUnique" class="field-error-text">
              <mat-icon>warning</mat-icon> A survey named "{{ surveyTitle }}" already exists. 2 surveys cannot have the same name.
            </p>
            <p *ngIf="isTitleUnique" class="field-help-text">
              Official public and analytical name for this research study.
            </p>
          </div>

          <!-- Study Slug / URL Identifier -->
          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label-title">
                Study Slug / Identifier <span class="required-star">*</span>
              </label>
              <span class="slug-preview">/s/{{ surveySlug || 'slug' }}</span>
            </div>
            <div class="input-wrap" [class.input-error]="!isSlugUnique" [class.input-success]="isSlugUnique && surveySlug.trim().length > 0">
              <mat-icon class="input-prefix-icon">link</mat-icon>
              <input 
                type="text" 
                [(ngModel)]="surveySlug" 
                (ngModelChange)="onSlugChange($event)"
                placeholder="e.g. brand_perception_q4" 
                class="config-input font-mono" 
                required
              />
              <div class="trailing-badge" *ngIf="surveySlug.trim()">
                <span *ngIf="isSlugUnique" class="badge-unique">
                  <mat-icon>check_circle</mat-icon> Available
                </span>
                <span *ngIf="!isSlugUnique" class="badge-duplicate">
                  <mat-icon>error</mat-icon> Slug In Use
                </span>
              </div>
            </div>
            <p *ngIf="!isSlugUnique" class="field-error-text">
              <mat-icon>warning</mat-icon> Identifier "{{ surveySlug }}" already exists.
            </p>
          </div>

          <!-- Target Completes -->
          <div class="form-group">
            <div class="form-label-row">
              <label class="form-label-title">
                Target Completes <span class="required-star">*</span>
              </label>
              <span class="field-help-mini">Sample Size</span>
            </div>
            <div class="input-wrap">
              <mat-icon class="input-prefix-icon">group</mat-icon>
              <input 
                type="number" 
                min="1" 
                max="100000" 
                [(ngModel)]="surveyTarget" 
                (ngModelChange)="onTargetChange($event)"
                placeholder="150" 
                class="config-input font-mono" 
                required
              />
            </div>
            <p class="field-help-text">
              Total complete responses needed to satisfy study quota.
            </p>
          </div>

          <!-- Target Fieldwork Deadline (Optional) -->
          <div class="form-group col-span-2">
            <div class="form-label-row">
              <label class="form-label-title">
                Fieldwork Deadline (Optional)
              </label>
              <span class="field-help-mini">Auto-lock on expiry</span>
            </div>
            <div class="input-wrap">
              <mat-icon class="input-prefix-icon">schedule</mat-icon>
              <input 
                type="datetime-local" 
                [(ngModel)]="surveyDeadline" 
                class="config-input font-mono" 
              />
            </div>
            <p class="field-help-text">
              Setting a deadline enables quota completion pace tracking and automated deadline alerts.
            </p>
          </div>
        </div>
      </div>

      <!-- Main Upload Grid: 2 Columns on desktop -->
      <div class="upload-grid">
        <!-- Left Column: Choose File From System -->
        <div class="grid-col">
          <div class="col-header">
            <div class="step-header-wrap">
              <div class="config-step-badge">2</div>
              <span class="col-title">Choose File from Local System</span>
            </div>
            <span class="col-sub">Supports .txt, .docx, .xml up to 10MB</span>
          </div>

          <!-- Hidden File Input shared by dropzone and change file -->
          <input
            #fileInput
            type="file"
            (change)="onFileSelected($event)"
            accept=".txt,.docx,.doc,.xml,.text"
            style="display: none"
          />

          <!-- File Dropzone -->
          <div
            *ngIf="!selectedFileName"
            class="file-drop-zone"
            [class.drag-over]="isDragging"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onFileDrop($event)"
            (click)="fileInput.click()"
          >
            <div class="drop-icon-box">
              <mat-icon>cloud_upload</mat-icon>
            </div>
            <h3 class="drop-heading">Click or drag &amp; drop questionnaire file</h3>
            <p class="drop-desc">Select any questionnaire document from your computer</p>
            
            <button 
              type="button" 
              class="btn-choose-file"
              (click)="$event.stopPropagation(); fileInput.click()">
              <mat-icon>folder_open</mat-icon> Choose File from System
            </button>
          </div>

          <!-- Selected File Card -->
          <div *ngIf="selectedFileName" class="selected-file-card">
            <div class="file-details">
              <div class="file-icon-box">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="file-text-col">
                <span class="file-name">{{ selectedFileName }}</span>
                <span class="file-size">{{ selectedFileSize }} &bull; File Loaded</span>
              </div>
            </div>
            <div class="file-card-actions">
              <button 
                type="button" 
                class="btn-create-file-primary"
                (click)="onUpload()"
                [disabled]="loading || !isTitleUnique || !isSlugUnique">
                <mat-icon *ngIf="!loading">cloud_upload</mat-icon>
                <mat-icon *ngIf="loading" class="spin-icon">sync</mat-icon>
                <span>{{ loading ? 'Uploading...' : 'Create Study from File' }}</span>
              </button>
              <button 
                type="button" 
                class="btn-change-file" 
                (click)="fileInput.click()">
                Change File
              </button>
              <button 
                type="button" 
                class="btn-clear-file" 
                (click)="clearSelectedFile()" 
                title="Remove File">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Right Column: Questionnaire Content Editor -->
        <div class="grid-col">
          <div class="col-header">
            <div class="step-header-wrap">
              <div class="config-step-badge">3</div>
              <span class="col-title">Questionnaire Definition Syntax</span>
            </div>
            <span class="col-sub">{{ rawContent.length }} characters &bull; Live Two-Way XML</span>
          </div>

          <div class="textarea-card">
            <textarea
              [(ngModel)]="rawContent"
              (ngModelChange)="onXmlContentChange($event)"
              name="rawContent"
              rows="16"
              class="code-textarea"
              placeholder="// Type or paste your questionnaire XML definition here...&#10;// Or choose a file from your system on the left, or click 'Load Valid Study Sample' above."
              required
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Loading Bar -->
      <div *ngIf="loading" class="loading-bar-wrap">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </div>

      <!-- Action Buttons -->
      <div class="action-footer">
        <button
          type="button"
          class="btn-validate"
          (click)="onValidate()"
          [disabled]="loading"
        >
          <mat-icon>rule</mat-icon> Validate Syntax
        </button>

        <button
          type="button"
          class="btn-upload-primary"
          (click)="onUpload()"
          [disabled]="loading || !isTitleUnique || !isSlugUnique"
          [title]="!isTitleUnique ? 'Cannot create survey: Name must be unique' : 'Upload and initialize survey'"
        >
          <mat-icon *ngIf="!loading">publish</mat-icon>
          <mat-icon *ngIf="loading" class="spin-icon">sync</mat-icon>
          <span>{{ loading ? 'Creating Survey...' : 'Upload & Create Survey' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .upload-container {
      width: 100%;
      max-width: 1280px;
      margin: 0 auto;
      padding-bottom: 40px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .header-badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .ats-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 2px 8px;
      border-radius: 9999px;
      background: rgba(139, 108, 255, 0.15);
      color: #2DD4F5;
      border: 1px solid rgba(139, 108, 255, 0.35);
      text-transform: uppercase;
    }

    .header-breadcrumb {
      font-size: 12px;
      color: #8A8AA3;
      font-family: var(--font-mono);
    }

    .page-heading {
      font-family: var(--font-heading);
      font-size: 26px;
      font-weight: 800;
      color: #F8F8FC;
      letter-spacing: -0.4px;
      margin: 0 0 4px 0;
    }

    .subtitle {
      font-size: 13.5px;
      color: #9A9AB5;
      margin: 0;
    }

    .back-btn {
      color: #C4C4D6 !important;
      border-color: rgba(255, 255, 255, 0.12) !important;
      border-radius: 12px !important;
    }

    /* Auto-fill banner */
    .sample-autofill-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-radius: 20px;
      background: rgba(24, 24, 38, 0.55);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      margin-bottom: 24px;
      gap: 16px;
    }

    .autofill-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .sparkle-circle {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(45, 212, 245, 0.12);
      border: 1px solid rgba(45, 212, 245, 0.3);
      color: #2DD4F5;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .autofill-title {
      font-size: 14px;
      font-weight: 700;
      color: #F8F8FC;
      margin: 0 0 2px 0;
    }

    .autofill-subtitle {
      font-size: 12.5px;
      color: #8A8AA3;
      margin: 0;
    }

    .autofill-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .btn-sample-gradient {
      padding: 8px 16px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2DD4F5 0%, #3B82F6 100%);
      color: #07070C;
      font-size: 12px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(45, 212, 245, 0.25);
    }

    .btn-sample-gradient:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }

    .btn-sample-outline {
      padding: 8px 16px;
      border-radius: 10px;
      background: rgba(251, 113, 133, 0.08);
      border: 1px solid rgba(251, 113, 133, 0.3);
      color: #FB7185;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-sample-outline:hover {
      background: rgba(251, 113, 133, 0.15);
    }

    /* 1. CONFIGURATION CARD */
    .config-card {
      border-radius: 20px;
      background: rgba(24, 24, 38, 0.55);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      padding: 22px 24px;
      margin-bottom: 24px;
      transition: all 0.2s ease;
    }

    .config-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      gap: 16px;
    }

    .config-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .config-step-badge {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366F1 0%, #2DD4F5 100%);
      color: #07070C;
      font-size: 13px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-header-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .step-header-wrap .config-step-badge {
      width: 22px;
      height: 22px;
      font-size: 11px;
    }

    .config-title {
      font-size: 16px;
      font-weight: 700;
      color: #F8F8FC;
      margin: 0 0 2px 0;
    }

    .config-desc {
      font-size: 12.5px;
      color: #8A8AA3;
      margin: 0;
    }

    .uniqueness-summary-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #C4C4D6;
    }

    .uniqueness-summary-badge.valid {
      background: rgba(52, 211, 153, 0.12);
      border-color: rgba(52, 211, 153, 0.35);
      color: #34D399;
    }

    .uniqueness-summary-badge.invalid {
      background: rgba(251, 113, 133, 0.12);
      border-color: rgba(251, 113, 133, 0.35);
      color: #FB7185;
    }

    .uniqueness-summary-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .config-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .col-span-2 {
      grid-column: span 2;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .form-label-title {
      font-size: 12px;
      font-weight: 700;
      color: #C4C4D6;
      letter-spacing: 0.02em;
    }

    .required-star {
      color: #FB7185;
      font-weight: 700;
    }

    .constraint-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(139, 108, 255, 0.15);
      color: #A78BFA;
      border: 1px solid rgba(139, 108, 255, 0.3);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .slug-preview {
      font-size: 11px;
      font-family: var(--font-mono);
      color: #2DD4F5;
    }

    .field-help-mini {
      font-size: 11px;
      color: #8A8AA3;
    }

    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-prefix-icon {
      position: absolute;
      left: 12px;
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748B;
      pointer-events: none;
    }

    .config-input {
      width: 100%;
      height: 42px;
      background: rgba(15, 15, 26, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      color: #F8F8FC;
      font-size: 13.5px;
      padding: 0 120px 0 38px;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }

    .config-input:focus {
      outline: none;
      border-color: #2DD4F5;
      box-shadow: 0 0 14px -2px rgba(45, 212, 245, 0.3);
      background: rgba(15, 15, 26, 0.85);
    }

    .input-wrap.input-error .config-input {
      border-color: #FB7185;
      box-shadow: 0 0 14px -2px rgba(251, 113, 133, 0.3);
    }

    .input-wrap.input-success .config-input {
      border-color: rgba(52, 211, 153, 0.5);
    }

    .trailing-badge {
      position: absolute;
      right: 8px;
      display: flex;
      align-items: center;
    }

    .badge-unique {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #34D399;
      background: rgba(52, 211, 153, 0.15);
      border: 1px solid rgba(52, 211, 153, 0.35);
      padding: 2px 8px;
      border-radius: 6px;
    }

    .badge-unique mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .badge-duplicate {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #FB7185;
      background: rgba(251, 113, 133, 0.15);
      border: 1px solid rgba(251, 113, 133, 0.35);
      padding: 2px 8px;
      border-radius: 6px;
    }

    .badge-duplicate mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .field-error-text {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #FB7185;
      margin: 2px 0 0 0;
      font-weight: 500;
    }

    .field-error-text mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .field-help-text {
      font-size: 11.5px;
      color: #8A8AA3;
      margin: 2px 0 0 0;
    }

    /* Upload Grid */
    .upload-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    @media (max-width: 900px) {
      .upload-grid, .config-form-grid {
        grid-template-columns: 1fr;
      }
      .col-span-2 {
        grid-column: span 1;
      }
      .sample-autofill-banner {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    .grid-col {
      display: flex;
      flex-direction: column;
    }

    .col-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .col-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #C4C4D6;
    }

    .col-sub {
      font-size: 11px;
      color: #8A8AA3;
      font-family: var(--font-mono);
    }

    /* File Drop Zone */
    .file-drop-zone {
      flex: 1;
      min-height: 380px;
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      background: rgba(24, 24, 38, 0.45);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 24px;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }

    .file-drop-zone:hover, .file-drop-zone.drag-over {
      border-color: #2DD4F5;
      background: rgba(24, 24, 38, 0.65);
      box-shadow: 0 0 24px -4px rgba(45, 212, 245, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    .drop-icon-box {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: #11111C;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #2DD4F5;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .drop-icon-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .drop-heading {
      font-size: 15px;
      font-weight: 700;
      color: #F8F8FC;
      margin: 0 0 6px 0;
    }

    .drop-desc {
      font-size: 12.5px;
      color: #8A8AA3;
      margin: 0 0 20px 0;
      max-width: 260px;
    }

    .btn-choose-file {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 12px;
      background: rgba(45, 212, 245, 0.12);
      border: 1px solid rgba(45, 212, 245, 0.3);
      color: #2DD4F5;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-choose-file:hover {
      background: rgba(45, 212, 245, 0.22);
      transform: translateY(-1px);
    }

    /* Selected File Card */
    .selected-file-card {
      flex: 1;
      min-height: 380px;
      border-radius: 20px;
      background: rgba(24, 24, 38, 0.55);
      border: 1px solid rgba(52, 211, 153, 0.3);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 0 24px -4px rgba(52, 211, 153, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .file-details {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
    }

    .file-icon-box {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(52, 211, 153, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.35);
      color: #34D399;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }

    .file-icon-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .file-name {
      font-size: 14.5px;
      font-weight: 700;
      color: #F8F8FC;
      margin-bottom: 4px;
      word-break: break-all;
    }

    .file-size {
      font-size: 12px;
      color: #8A8AA3;
      font-family: var(--font-mono);
    }

    .file-card-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn-create-file-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2DD4F5 0%, #3B82F6 100%);
      color: #07070C;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(45, 212, 245, 0.3);
      transition: all 0.2s ease;
    }

    .btn-create-file-primary:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-1px);
    }

    .btn-create-file-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-change-file {
      padding: 10px 18px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #C4C4D6;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-change-file:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .btn-clear-file {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(251, 113, 133, 0.1);
      border: 1px solid rgba(251, 113, 133, 0.25);
      color: #FB7185;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-clear-file:hover {
      background: rgba(251, 113, 133, 0.2);
    }

    /* Textarea Card */
    .textarea-card {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .code-textarea {
      width: 100%;
      height: 100%;
      min-height: 380px;
      padding: 16px;
      border-radius: 20px;
      background: rgba(24, 24, 38, 0.45);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      color: #F8F8FC;
      font-family: var(--font-mono);
      font-size: 12.5px;
      line-height: 1.6;
      box-sizing: border-box;
      resize: vertical;
      transition: all 0.2s ease;
    }

    .code-textarea:focus {
      outline: none;
      border-color: #2DD4F5;
      box-shadow: 0 0 20px -2px rgba(45, 212, 245, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    /* Banners */
    .error-container {
      background: rgba(251, 113, 133, 0.1);
      border: 1px solid rgba(251, 113, 133, 0.3);
      border-radius: 16px;
      padding: 16px 20px;
      margin-bottom: 20px;
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #FB7185;
      font-size: 13.5px;
      margin-bottom: 12px;
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
    }

    .line-badge {
      background: rgba(251, 113, 133, 0.2);
      color: #FB7185;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(251, 113, 133, 0.35);
    }

    .error-msg {
      color: #F8F8FC;
    }

    .success-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(52, 211, 153, 0.1);
      color: #34D399;
      border: 1px solid rgba(52, 211, 153, 0.3);
      border-radius: 16px;
      padding: 14px 20px;
      margin-bottom: 20px;
      font-size: 13.5px;
      font-weight: 600;
    }

    /* Footer Buttons */
    .action-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 14px;
      margin-top: 8px;
    }

    .btn-validate {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      min-height: 48px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #F8F8FC;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-validate:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.12);
    }

    .btn-validate:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-upload-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 28px;
      min-height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #2DD4F5 0%, #3B82F6 100%);
      color: #07070C;
      font-size: 13.5px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(45, 212, 245, 0.3);
      transition: all 0.2s ease;
    }

    .btn-upload-primary:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(45, 212, 245, 0.4);
    }

    .btn-upload-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .spin-icon {
      animation: spin 1.2s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .loading-bar-wrap {
      margin-bottom: 16px;
    }

    /* Light Theme Overrides */
    :host-context([data-theme="light"]) .config-card,
    :host-context([data-theme="light"]) .sample-autofill-banner,
    :host-context([data-theme="light"]) .file-drop-zone {
      background: #FFFFFF !important;
      border: 1px solid #E2E8F0 !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
    }
    :host-context([data-theme="light"]) .config-input {
      background: #F8FAFC !important;
      border-color: #CBD5E1 !important;
      color: #0F172A !important;
    }
    :host-context([data-theme="light"]) .config-input:focus {
      border-color: #4F46E5 !important;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important;
    }
    :host-context([data-theme="light"]) .config-title,
    :host-context([data-theme="light"]) .form-label-title {
      color: #0F172A !important;
    }
    :host-context([data-theme="light"]) .file-drop-zone {
      border: 2px dashed #CBD5E1 !important;
    }
    :host-context([data-theme="light"]) .file-drop-zone.drag-over,
    :host-context([data-theme="light"]) .file-drop-zone:hover {
      border-color: #4F46E5 !important;
      background: #F8FAFC !important;
    }
    :host-context([data-theme="light"]) .page-title,
    :host-context([data-theme="light"]) .page-heading,
    :host-context([data-theme="light"]) .col-title,
    :host-context([data-theme="light"]) .drop-heading,
    :host-context([data-theme="light"]) .autofill-title {
      color: #0F172A !important;
    }
    :host-context([data-theme="light"]) .page-subtitle,
    :host-context([data-theme="light"]) .subtitle,
    :host-context([data-theme="light"]) .header-breadcrumb,
    :host-context([data-theme="light"]) .col-sub,
    :host-context([data-theme="light"]) .drop-desc,
    :host-context([data-theme="light"]) .autofill-subtitle {
      color: #64748B !important;
    }
    :host-context([data-theme="light"]) .back-btn {
      background: #FFFFFF !important;
      border: 1px solid #CBD5E1 !important;
      color: #0F172A !important;
    }
    :host-context([data-theme="light"]) .drop-icon-box {
      background: #EEF2FF !important;
      color: #4F46E5 !important;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15) !important;
    }
    :host-context([data-theme="light"]) .code-textarea {
      background: #FFFFFF !important;
      border: 1px solid #CBD5E1 !important;
      color: #0F172A !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
    }
    :host-context([data-theme="light"]) .code-textarea:focus {
      border-color: #4F46E5 !important;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15) !important;
    }
    :host-context([data-theme="light"]) .btn-choose-file {
      background: #EEF2FF !important;
      border: 1px solid #C7D2FE !important;
      color: #4F46E5 !important;
    }
    :host-context([data-theme="light"]) .btn-choose-file:hover {
      background: #E0E7FF !important;
    }
    :host-context([data-theme="light"]) .btn-validate {
      background: #F8FAFC !important;
      border: 1px solid #CBD5E1 !important;
      color: #0F172A !important;
    }
    :host-context([data-theme="light"]) .btn-validate:hover:not(:disabled) {
      background: #F1F5F9 !important;
    }
    :host-context([data-theme="light"]) .btn-upload-primary {
      background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%) !important;
      color: #FFFFFF !important;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.3) !important;
    }
    :host-context([data-theme="light"]) .btn-sample-gradient {
      background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%) !important;
      color: #FFFFFF !important;
    }
    :host-context([data-theme="light"]) .btn-sample-outline {
      background: #F8FAFC !important;
      border: 1px solid #CBD5E1 !important;
      color: #0F172A !important;
    }
    :host-context([data-theme="light"]) .btn-create-file-primary {
      background: linear-gradient(135deg, #4F46E5 0%, #6366F1 100%) !important;
      color: #FFFFFF !important;
      box-shadow: 0 2px 10px rgba(79, 70, 229, 0.3) !important;
    }
  `]
})
export class AdminSurveyUploadComponent implements OnInit {
  rawContent = '';
  loading = false;
  isValid: boolean | null = null;
  validationErrors: ValidationError[] = [];

  isDragging = false;
  selectedFileName = '';
  selectedFileSize = '';

  // Configurable study metadata fields
  surveyTitle = '';
  surveySlug = '';
  surveyTarget = 150;
  surveyDeadline = '';

  existingSurveys: { id: number; title: string; slug: string }[] = [];
  isTitleUnique = true;
  isSlugUnique = true;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadExistingSurveys();
    if (!this.rawContent) {
      this.loadSampleValid();
    }
  }

  loadExistingSurveys(): void {
    this.apiService.getSurveys().subscribe({
      next: (surveys) => {
        this.existingSurveys = surveys.map(s => ({
          id: s.id,
          title: s.title || '',
          slug: s.slug || ''
        }));
        this.checkUniqueness();
      },
      error: () => {
        // Fallback silently if offline or token expired
      }
    });
  }

  checkUniqueness(): void {
    const trimmedTitle = (this.surveyTitle || '').trim().toLowerCase();
    if (!trimmedTitle) {
      this.isTitleUnique = true;
    } else {
      this.isTitleUnique = !this.existingSurveys.some(s => s.title.trim().toLowerCase() === trimmedTitle);
    }

    const trimmedSlug = (this.surveySlug || '').trim().toLowerCase();
    if (!trimmedSlug) {
      this.isSlugUnique = true;
    } else {
      this.isSlugUnique = !this.existingSurveys.some(s => s.slug.trim().toLowerCase() === trimmedSlug);
    }
  }

  getStatusSummaryText(): string {
    if (!this.surveyTitle.trim()) {
      return 'Title Required';
    }
    if (!this.isTitleUnique) {
      return 'Duplicate Title Detected';
    }
    if (!this.isSlugUnique) {
      return 'Slug In Use';
    }
    return 'Details Verified & Unique';
  }

  onTitleChange(newTitle: string): void {
    this.surveyTitle = newTitle;
    this.checkUniqueness();
    this.syncConfigToXml();
  }

  onSlugChange(newSlug: string): void {
    this.surveySlug = newSlug;
    this.checkUniqueness();
    this.syncConfigToXml();
  }

  onTargetChange(newTarget: number): void {
    this.surveyTarget = newTarget;
    this.syncConfigToXml();
  }

  onXmlContentChange(xml: string): void {
    this.rawContent = xml;
    this.extractMetadataFromXml();
  }

  extractMetadataFromXml(): void {
    if (!this.rawContent) return;
    const surveyTagMatch = this.rawContent.match(/<survey\b([^>]*)>/i);
    if (surveyTagMatch) {
      const attrs = surveyTagMatch[1];
      const titleMatch = attrs.match(/title=["']([^"']*)["']/i);
      const idMatch = attrs.match(/id=["']([^"']*)["']/i);
      const targetMatch = attrs.match(/target=["']([^"']*)["']/i);

      if (titleMatch && titleMatch[1]) {
        this.surveyTitle = titleMatch[1];
      }
      if (idMatch && idMatch[1]) {
        this.surveySlug = idMatch[1];
      }
      if (targetMatch && targetMatch[1]) {
        const parsedTarget = parseInt(targetMatch[1], 10);
        if (!isNaN(parsedTarget)) {
          this.surveyTarget = parsedTarget;
        }
      }
      this.checkUniqueness();
    }
  }

  syncConfigToXml(): void {
    if (!this.rawContent) return;
    const surveyTagRegex = /<survey\b([^>]*)>/i;
    const match = this.rawContent.match(surveyTagRegex);
    if (match) {
      let attrs = match[1];

      // Replace or insert title
      if (/title=["'][^"']*["']/i.test(attrs)) {
        attrs = attrs.replace(/title=["'][^"']*["']/i, `title="${this.surveyTitle || ''}"`);
      } else {
        attrs += ` title="${this.surveyTitle || ''}"`;
      }

      // Replace or insert id
      if (/id=["'][^"']*["']/i.test(attrs)) {
        attrs = attrs.replace(/id=["'][^"']*["']/i, `id="${this.surveySlug || ''}"`);
      } else {
        attrs += ` id="${this.surveySlug || ''}"`;
      }

      // Replace or insert target
      if (/target=["'][^"']*["']/i.test(attrs)) {
        attrs = attrs.replace(/target=["'][^"']*["']/i, `target="${this.surveyTarget || 0}"`);
      } else {
        attrs += ` target="${this.surveyTarget || 0}"`;
      }

      this.rawContent = this.rawContent.replace(surveyTagRegex, `<survey${attrs}>`);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
      input.value = '';
    }
  }

  processFile(file: File): void {
    this.selectedFileName = file.name;
    this.selectedFileSize = this.formatBytes(file.size);
    this.loading = true;

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.docx')) {
      this.apiService.extractFile(file).subscribe({
        next: res => {
          this.loading = false;
          this.rawContent = res.content;
          this.extractMetadataFromXml();
          this.snackBar.open(`Extracted text from "${file.name}"`, 'Close', { duration: 3000 });
          this.onValidate();
        },
        error: err => {
          this.loading = false;
          this.snackBar.open(err?.error?.detail || 'Failed to extract text from docx file.', 'Close', { duration: 4000 });
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loading = false;
        this.rawContent = (e.target?.result as string) || '';
        this.extractMetadataFromXml();
        this.snackBar.open(`Loaded "${file.name}" successfully`, 'Close', { duration: 3000 });
        this.onValidate();
      };
      reader.onerror = () => {
        this.apiService.extractFile(file).subscribe({
          next: res => {
            this.loading = false;
            this.rawContent = res.content;
            this.extractMetadataFromXml();
            this.snackBar.open(`Loaded "${file.name}" successfully`, 'Close', { duration: 3000 });
            this.onValidate();
          },
          error: () => {
            this.loading = false;
            this.snackBar.open('Failed to read file from system.', 'Close', { duration: 4000 });
          }
        });
      };
      reader.readAsText(file);
    }
  }

  clearSelectedFile(): void {
    this.selectedFileName = '';
    this.selectedFileSize = '';
    this.rawContent = '';
    this.validationErrors = [];
    this.isValid = null;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  loadSampleValid(): void {
    let suffix = Math.floor(Math.random() * 9000 + 1000);
    // Find a unique title & slug against existing surveys
    while (this.existingSurveys.some(s => s.slug === `study_${suffix}` || s.title === `Brand Perception Study ${suffix}`)) {
      suffix = Math.floor(Math.random() * 9000 + 1000);
    }

    this.surveyTitle = `Brand Perception Study ${suffix}`;
    this.surveySlug = `study_${suffix}`;
    this.surveyTarget = 150;
    this.surveyDeadline = '';

    this.rawContent = `<survey id="${this.surveySlug}" title="${this.surveyTitle}" target="${this.surveyTarget}">

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
    this.checkUniqueness();
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
    this.extractMetadataFromXml();
    this.validationErrors = [];
    this.isValid = null;
    this.onValidate();
  }

  onValidate(): void {
    this.syncConfigToXml();
    if (!this.rawContent.trim()) {
      this.snackBar.open('Please paste questionnaire XML or select a questionnaire file to validate.', 'Close', { duration: 4000 });
      this.validationErrors = [{ line: 1, message: 'Questionnaire is empty. Please enter survey XML or select a file.' }];
      this.isValid = false;
      return;
    }
    this.loading = true;
    this.apiService.validateSurvey(this.rawContent).subscribe({
      next: res => {
        this.loading = false;
        this.isValid = res.valid;
        this.validationErrors = res.errors;
        if (res.valid) {
          this.snackBar.open('Questionnaire syntax verified successfully!', 'Close', { duration: 3000 });
        }
      },
      error: err => {
        this.loading = false;
        this.isValid = false;
        this.validationErrors = err?.error?.detail?.errors || [{ line: 1, message: 'Invalid questionnaire payload' }];
      }
    });
  }

  onUpload(): void {
    if (!this.surveyTitle.trim()) {
      this.snackBar.open('Please provide a name/title for your survey.', 'Close', { duration: 4000 });
      this.validationErrors = [{ line: 1, message: 'Survey name/title is required.' }];
      this.isValid = false;
      return;
    }

    if (!this.isTitleUnique) {
      const msg = `Cannot create survey: A survey with the name "${this.surveyTitle}" already exists. Survey names must be unique.`;
      this.snackBar.open(msg, 'Close', { duration: 5000 });
      this.validationErrors = [{ line: 1, message: msg }];
      this.isValid = false;
      return;
    }

    if (!this.isSlugUnique) {
      const msg = `Cannot create survey: Study identifier "${this.surveySlug}" is already in use.`;
      this.snackBar.open(msg, 'Close', { duration: 5000 });
      this.validationErrors = [{ line: 1, message: msg }];
      this.isValid = false;
      return;
    }

    this.syncConfigToXml();

    if (!this.rawContent.trim()) {
      this.snackBar.open('Please paste questionnaire XML, select a file, or click "Load Valid Study Sample".', 'Close', { duration: 4000 });
      this.validationErrors = [{ line: 1, message: 'Questionnaire is empty. Please enter survey XML or upload a file.' }];
      this.isValid = false;
      return;
    }

    this.loading = true;
    this.apiService.createSurvey({
      raw_content: this.rawContent,
      title: this.surveyTitle.trim(),
      slug: this.surveySlug.trim(),
      target: Number(this.surveyTarget) || 100,
      deadline_at: this.surveyDeadline ? new Date(this.surveyDeadline).toISOString() : undefined
    }).subscribe({
      next: survey => {
        this.loading = false;
        this.snackBar.open(`Survey "${survey.title}" created successfully! Redirecting...`, 'Close', { duration: 3000 });
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
        this.snackBar.open(this.validationErrors[0]?.message || 'Failed to create survey.', 'Close', { duration: 5000 });
      }
    });
  }
}
