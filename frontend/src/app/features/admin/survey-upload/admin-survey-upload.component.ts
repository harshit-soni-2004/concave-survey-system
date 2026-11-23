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
          <p class="subtitle">Deterministic XML tag parser, line-numbered validator, and study version initializer.</p>
        </div>
        <button mat-stroked-button routerLink="/admin/surveys" class="back-btn">
          <mat-icon>arrow_back</mat-icon> Back to Surveys
        </button>
      </div>

      <!-- Sample Auto-fill Banner (Exact ATS Style) -->
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

      <!-- Main Upload Grid: 2 Columns on desktop -->
      <div class="upload-grid">
        <!-- Left Column: Choose File From System -->
        <div class="grid-col">
          <div class="col-header">
            <span class="col-title">1. Choose File from Local System</span>
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
                [disabled]="loading">
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
            <span class="col-title">2. Questionnaire Definition Syntax</span>
            <span class="col-sub">{{ rawContent.length }} characters &bull; Live XML Syntax</span>
          </div>

          <div class="textarea-card">
            <textarea
              [(ngModel)]="rawContent"
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
          [disabled]="loading"
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

    /* Auto-fill banner matching ATS UploadDropzone banner */
    .sample-autofill-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 18px;
      background: rgba(24, 24, 38, 0.55);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      margin-bottom: 24px;
    }

    .autofill-info {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .sparkle-circle {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: rgba(139, 108, 255, 0.15);
      color: #2DD4F5;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .autofill-title {
      font-family: var(--font-heading);
      font-size: 14px;
      font-weight: 700;
      color: #F8F8FC;
      margin: 0 0 2px 0;
    }

    .autofill-subtitle {
      font-size: 12px;
      color: #9A9AB5;
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
      min-height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%);
      color: #07070F;
      font-size: 12px;
      font-weight: 700;
      font-family: var(--font-heading);
      border: none;
      cursor: pointer;
      box-shadow: 0 0 16px -2px rgba(45, 212, 245, 0.35);
      transition: all 0.2s ease;
    }

    .btn-sample-gradient:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-sample-outline {
      padding: 8px 16px;
      min-height: 40px;
      border-radius: 12px;
      background: rgba(251, 113, 133, 0.1);
      color: #FB7185;
      border: 1px solid rgba(251, 113, 133, 0.3);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-sample-outline:hover {
      background: rgba(251, 113, 133, 0.2);
    }

    /* 2 Column Layout */
    .upload-grid {
      display: grid;
      grid-template-columns: 1fr 1.15fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    @media (max-width: 900px) {
      .upload-grid {
        grid-template-columns: 1fr;
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

    /* File Drop Zone (Exact ATS Resume Dropzone aesthetics) */
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
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }

    .drop-icon-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .drop-heading {
      font-family: var(--font-heading);
      font-size: 16px;
      font-weight: 700;
      color: #F8F8FC;
      margin: 0 0 6px 0;
    }

    .drop-desc {
      font-size: 13px;
      color: #9A9AB5;
      margin: 0 0 20px 0;
    }

    .btn-choose-file {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      min-height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%);
      color: #07070F;
      font-size: 13px;
      font-weight: 700;
      font-family: var(--font-heading);
      border: none;
      cursor: pointer;
      box-shadow: 0 0 20px -2px rgba(45, 212, 245, 0.35);
      transition: all 0.2s ease;
    }

    .btn-choose-file:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    /* Selected File Card */
    .selected-file-card {
      flex: 1;
      min-height: 380px;
      border: 1px solid rgba(52, 211, 153, 0.35);
      border-radius: 20px;
      background: rgba(52, 211, 153, 0.06);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 32px 24px;
      box-shadow: inset 0 1px 0 rgba(52, 211, 153, 0.15);
    }

    .file-details {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .file-icon-box {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(52, 211, 153, 0.15);
      color: #34D399;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .file-icon-box mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .file-name {
      font-family: var(--font-heading);
      font-size: 15px;
      font-weight: 700;
      color: #F8F8FC;
      word-break: break-all;
      max-width: 320px;
    }

    .file-size {
      font-size: 12px;
      color: #34D399;
      font-family: var(--font-mono);
    }

    .file-card-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn-create-file-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      min-height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%);
      border: none;
      color: #07070F;
      font-size: 13px;
      font-weight: 700;
      font-family: var(--font-heading);
      cursor: pointer;
      box-shadow: 0 0 16px -2px rgba(45, 212, 245, 0.35);
      transition: all 0.2s ease;
    }

    .btn-create-file-primary:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-create-file-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .btn-change-file {
      padding: 8px 18px;
      min-height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #F8F8FC;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-change-file:hover {
      background: rgba(255, 255, 255, 0.14);
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
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-upload-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 28px;
      min-height: 48px;
      border-radius: 14px;
      background: linear-gradient(135deg, #8B6CFF 0%, #2DD4F5 100%);
      color: #07070F;
      font-family: var(--font-heading);
      font-size: 14px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 0 24px -2px rgba(45, 212, 245, 0.4);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn-upload-primary:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 0 30px -2px rgba(45, 212, 245, 0.55);
    }

    .btn-upload-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .loading-bar-wrap {
      margin-bottom: 16px;
    }

    /* Light Theme Overrides */
    :host-context([data-theme="light"]) .upload-card,
    :host-context([data-theme="light"]) .sample-autofill-banner,
    :host-context([data-theme="light"]) .file-drop-zone {
      background: #FFFFFF !important;
      border: 1px solid #E2E8F0 !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
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
    :host-context([data-theme="light"]) .btn-validate:disabled {
      background: #F1F5F9 !important;
      border-color: #E2E8F0 !important;
      color: #94A3B8 !important;
      opacity: 0.8 !important;
    }
    :host-context([data-theme="light"]) .btn-upload-primary:disabled {
      background: #E2E8F0 !important;
      color: #94A3B8 !important;
      box-shadow: none !important;
      opacity: 0.8 !important;
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

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (!this.rawContent) {
      this.loadSampleValid();
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
      // Reset input value so re-selecting same file triggers change
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
        this.snackBar.open(`Loaded "${file.name}" successfully`, 'Close', { duration: 3000 });
        this.onValidate();
      };
      reader.onerror = () => {
        this.apiService.extractFile(file).subscribe({
          next: res => {
            this.loading = false;
            this.rawContent = res.content;
            this.snackBar.open(`Loaded "${file.name}" successfully`, 'Close', { duration: 3000 });
            this.onValidate();
          },
          error: err => {
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
    if (!this.rawContent.trim()) {
      this.snackBar.open('Please paste questionnaire XML, select a file, or click "Load Valid Study Sample".', 'Close', { duration: 4000 });
      this.validationErrors = [{ line: 1, message: 'Questionnaire is empty. Please enter survey XML or upload a file.' }];
      this.isValid = false;
      return;
    }
    this.loading = true;
    this.apiService.createSurvey(this.rawContent).subscribe({
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
