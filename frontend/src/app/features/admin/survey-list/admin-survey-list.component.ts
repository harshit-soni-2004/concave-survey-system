import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { SurveyListItem } from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-survey-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dashboard-container">
      <!-- 1. Executive Header -->
      <div class="dashboard-header">
        <div>
          <h1 class="page-title">Research Operations Dashboard</h1>
          <p class="subtitle">Monitor real-time field progress, launch live surveys, and track complete quotas.</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" routerLink="/admin/upload" class="create-btn">
            <mat-icon>add</mat-icon> Upload Questionnaire
          </button>
        </div>
      </div>

      <!-- 2. Loading State -->
      <div *ngIf="loading" class="loading-state">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </div>

      <div *ngIf="!loading">
        <!-- 3. Key Metrics KPI Strip -->
        <div class="kpi-strip">
          <div class="kpi-card">
            <div class="kpi-icon-wrap live-icon">
              <mat-icon>sensors</mat-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Active Live Studies</span>
              <div class="kpi-val-row">
                <span class="kpi-value">{{ liveSurveys.length }}</span>
                <span class="pulse-badge" *ngIf="liveSurveys.length > 0">
                  <span class="pulse-dot"></span> Field Active
                </span>
              </div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap completes-icon">
              <mat-icon>task_alt</mat-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Total Completes</span>
              <span class="kpi-value">{{ totalCompletes | number }}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap target-icon">
              <mat-icon>flag</mat-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Target Capacity</span>
              <span class="kpi-value">{{ totalTarget | number }}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon-wrap rate-icon">
              <mat-icon>pie_chart</mat-icon>
            </div>
            <div class="kpi-content">
              <span class="kpi-label">Overall Field Progress</span>
              <div class="kpi-val-row">
                <span class="kpi-value">{{ overallFulfillment }}%</span>
                <span class="sub-progress-text">of targets met</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Featured Live Surveys Spotlight -->
        <section class="section-block">
          <div class="section-header">
            <div class="section-title-wrap">
              <div class="live-dot-pulse"></div>
              <h2>Active Live Surveys (Field Operations)</h2>
            </div>
            <span class="section-hint">Click any card to view detailed live analytics or share links directly</span>
          </div>

          <div *ngIf="liveSurveys.length === 0" class="no-live-box">
            <mat-icon>pause_circle_outline</mat-icon>
            <p>No surveys are currently LIVE. Upload a questionnaire and approve it to start field collection.</p>
          </div>

          <div class="live-cards-grid" *ngIf="liveSurveys.length > 0">
            <div *ngFor="let s of liveSurveys" class="live-survey-card">
              <div class="card-top">
                <div class="card-badge-row">
                  <span class="live-tag">
                    <span class="small-dot"></span> LIVE NOW
                  </span>
                  <span class="slug-tag">{{ s.slug }}</span>
                </div>
                <h3 class="survey-title" [routerLink]="['/admin/surveys', s.id, 'dashboard']" title="Open Dashboard">
                  {{ s.title }}
                </h3>
              </div>

              <div class="progress-section">
                <div class="progress-labels">
                  <span class="count-display">
                    <strong>{{ s.completed_count || 0 }}</strong> / {{ s.target }} completes
                  </span>
                  <span class="percent-display">{{ getPercent(s) }}%</span>
                </div>
                <mat-progress-bar mode="determinate" [value]="getPercent(s)" class="card-bar"></mat-progress-bar>
              </div>

              <div class="card-footer-actions">
                <button
                  mat-flat-button
                  color="primary"
                  [routerLink]="['/admin/surveys', s.id, 'dashboard']"
                  class="action-btn-main"
                  title="View Real-Time Analytics"
                >
                  <mat-icon>bar_chart</mat-icon> Live Dashboard
                </button>

                <button
                  mat-stroked-button
                  [routerLink]="['/admin/surveys', s.id]"
                  class="action-btn-sub"
                  title="Manage Versions, Quotas & Links"
                >
                  <mat-icon>tune</mat-icon> Manage
                </button>

                <button
                  mat-icon-button
                  (click)="openShareModal(s)"
                  class="share-btn"
                  title="Share Survey (WhatsApp, Email, Copy)"
                >
                  <mat-icon>share</mat-icon>
                </button>

                <button
                  mat-icon-button
                  (click)="testSurvey(s)"
                  class="test-btn"
                  title="Run Preview Test"
                >
                  <mat-icon>play_circle</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 5. All Studies Repository Table -->
        <section class="section-block" style="margin-top: 36px;">
          <div class="section-header table-controls-header">
            <div>
              <h2>All Studies Repository</h2>
              <p class="subtitle">Complete history across all drafts, live studies, and closed projects.</p>
            </div>

            <!-- Search & Filters -->
            <div class="filters-row">
              <div class="search-wrap">
                <mat-icon class="search-icon">search</mat-icon>
                <input
                  type="text"
                  placeholder="Filter studies..."
                  [(ngModel)]="searchQuery"
                  class="search-input"
                />
                <button *ngIf="searchQuery" mat-icon-button (click)="searchQuery = ''" class="clear-search">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <div class="filter-chips">
                <span
                  class="chip-filter"
                  [class.active]="selectedStatusFilter === 'ALL'"
                  (click)="selectedStatusFilter = 'ALL'"
                >
                  All ({{ surveys.length }})
                </span>
                <span
                  class="chip-filter"
                  [class.active]="selectedStatusFilter === 'LIVE'"
                  (click)="selectedStatusFilter = 'LIVE'"
                >
                  Live ({{ liveSurveys.length }})
                </span>
                <span
                  class="chip-filter"
                  [class.active]="selectedStatusFilter === 'DRAFT'"
                  (click)="selectedStatusFilter = 'DRAFT'"
                >
                  Drafts
                </span>
                <span
                  class="chip-filter"
                  [class.active]="selectedStatusFilter === 'CLOSED'"
                  (click)="selectedStatusFilter = 'CLOSED'"
                >
                  Closed
                </span>
              </div>
            </div>
          </div>

          <div *ngIf="filteredSurveys.length === 0" class="empty-state">
            <mat-icon class="empty-icon">search_off</mat-icon>
            <h3>No matching surveys</h3>
            <p>Try searching with another keyword or clear the status filter.</p>
          </div>

          <div class="table-card" *ngIf="filteredSurveys.length > 0">
            <table mat-table [dataSource]="filteredSurveys" class="survey-table">
              <!-- Slug & Title -->
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Study Name</th>
                <td mat-cell *matCellDef="let s">
                  <div class="title-cell">
                    <a [routerLink]="['/admin/surveys', s.id]" class="survey-link">{{ s.title }}</a>
                    <span class="survey-slug">{{ s.slug }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let s">
                  <span class="status-pill" [ngClass]="s.status.toLowerCase()">
                    {{ s.status }}
                  </span>
                </td>
              </ng-container>

              <!-- Completes / Target -->
              <ng-container matColumnDef="progress">
                <th mat-header-cell *matHeaderCellDef>Completes / Target</th>
                <td mat-cell *matCellDef="let s">
                  <div class="progress-col">
                    <div class="counts">
                      <strong>{{ s.completed_count || 0 }}</strong> / {{ s.target }}
                      <span class="percent">({{ getPercent(s) }}%)</span>
                    </div>
                    <mat-progress-bar mode="determinate" [value]="getPercent(s)"></mat-progress-bar>
                  </div>
                </td>
              </ng-container>

              <!-- Deadline -->
              <ng-container matColumnDef="deadline">
                <th mat-header-cell *matHeaderCellDef>Deadline</th>
                <td mat-cell *matCellDef="let s">
                  <span *ngIf="s.deadline_at">{{ s.deadline_at | date:'mediumDate' }}</span>
                  <span *ngIf="!s.deadline_at" class="muted">None</span>
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
                <td mat-cell *matCellDef="let s" class="text-right">
                  <button mat-icon-button (click)="openShareModal(s)" title="Share Survey" *ngIf="s.status === 'LIVE'">
                    <mat-icon>share</mat-icon>
                  </button>
                  <button mat-icon-button color="primary" [routerLink]="['/admin/surveys', s.id, 'dashboard']" title="Live Dashboard">
                    <mat-icon>bar_chart</mat-icon>
                  </button>
                  <button mat-icon-button [routerLink]="['/admin/surveys', s.id]" title="Survey Setup">
                    <mat-icon>tune</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        </section>
      </div>

      <!-- 6. Share Modal Dialog Overlay -->
      <div *ngIf="activeShareSurvey" class="share-modal-backdrop" (click)="activeShareSurvey = null">
        <div class="share-modal-card" (click)="$event.stopPropagation()">
          <div class="share-header">
            <div class="share-title-wrap">
              <mat-icon color="primary">share</mat-icon>
              <div>
                <h3>Share Survey</h3>
                <span class="share-subtitle">{{ activeShareSurvey.title }}</span>
              </div>
            </div>
            <button mat-icon-button (click)="activeShareSurvey = null">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="share-body">
            <label class="share-label">Public Participation Link</label>
            <div class="link-copy-box">
              <code class="url-snippet">{{ getSurveyPublicUrl(activeShareSurvey) }}</code>
              <button mat-flat-button color="primary" (click)="copyLink(getSurveyPublicUrl(activeShareSurvey))">
                <mat-icon>content_copy</mat-icon> Copy
              </button>
            </div>

            <div class="direct-share-channels">
              <span class="channel-label">1-Click Direct Sharing:</span>
              <div class="channels-grid">
                <!-- WhatsApp Share -->
                <a
                  [href]="getWhatsAppShareUrl(activeShareSurvey)"
                  target="_blank"
                  class="channel-btn whatsapp-channel"
                >
                  <mat-icon>chat</mat-icon> Share on WhatsApp
                </a>

                <!-- Email Share -->
                <a
                  [href]="getEmailShareUrl(activeShareSurvey)"
                  class="channel-btn email-channel"
                >
                  <mat-icon>email</mat-icon> Share via Email
                </a>
              </div>
            </div>
          </div>

          <div class="share-footer">
            <a [href]="getSurveyPublicUrl(activeShareSurvey)" target="_blank" mat-stroked-button>
              <mat-icon>open_in_new</mat-icon> Open in New Tab
            </a>
            <button mat-button (click)="activeShareSurvey = null">Done</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      width: 100%;
    }
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .page-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
    }
    .subtitle {
      color: #64748b;
      font-size: 14px;
      margin: 0;
    }
    .create-btn {
      font-weight: 600;
    }
    .loading-state {
      margin-bottom: 24px;
    }

    /* KPI Strip */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .kpi-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kpi-icon-wrap mat-icon {
      font-size: 24px;
      height: 24px;
      width: 24px;
    }
    .live-icon { background: #dcfce7; color: #15803d; }
    .completes-icon { background: #eff6ff; color: #2563eb; }
    .target-icon { background: #fef3c7; color: #b45309; }
    .rate-icon { background: #f3e8ff; color: #7e22ce; }

    .kpi-content {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .kpi-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .kpi-val-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pulse-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #ecfdf5;
      color: #047857;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 9999px;
      border: 1px solid #a7f3d0;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .sub-progress-text {
      font-size: 12px;
      color: #94a3b8;
    }

    /* Section Block */
    .section-block {
      margin-bottom: 28px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .section-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-title-wrap h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .live-dot-pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
    }
    .section-hint {
      font-size: 13px;
      color: #64748b;
    }
    .no-live-box {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 32px;
      text-align: center;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    /* Live Cards Grid */
    .live-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
    }
    .live-survey-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-top: 4px solid #2563eb;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
      transition: all 0.2s ease;
    }
    .live-survey-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
      transform: translateY(-2px);
      border-color: #94a3b8;
    }
    .card-top {
      margin-bottom: 16px;
    }
    .card-badge-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .live-tag {
      background: #dcfce7;
      color: #166534;
      font-size: 10.5px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      letter-spacing: 0.5px;
    }
    .small-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #16a34a;
    }
    .slug-tag {
      font-family: monospace;
      font-size: 11px;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .survey-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      cursor: pointer;
      line-height: 1.35;
      transition: color 0.15s ease;
    }
    .survey-title:hover {
      color: #2563eb;
    }

    .progress-section {
      margin-bottom: 20px;
    }
    .progress-labels {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .count-display strong {
      font-size: 16px;
      color: #0f172a;
    }
    .percent-display {
      font-weight: 700;
      color: #2563eb;
      font-size: 14px;
    }
    .card-bar {
      height: 8px;
      border-radius: 4px;
    }

    .card-footer-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
    }
    .action-btn-main {
      flex: 1;
      font-size: 13px;
      font-weight: 600;
      height: 36px;
    }
    .action-btn-sub {
      font-size: 13px;
      height: 36px;
    }
    .share-btn {
      color: #2563eb;
    }
    .test-btn {
      color: #10b981;
    }

    /* Table & Filter Controls */
    .table-controls-header {
      align-items: flex-end;
    }
    .filters-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .search-wrap {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0 10px;
      height: 36px;
    }
    .search-icon {
      color: #94a3b8;
      font-size: 18px;
      height: 18px;
      width: 18px;
      margin-right: 6px;
    }
    .search-input {
      border: none;
      outline: none;
      font-size: 13px;
      color: #1e293b;
      width: 140px;
    }
    .clear-search {
      width: 24px;
      height: 24px;
      line-height: 24px;
      color: #94a3b8;
    }
    .filter-chips {
      display: flex;
      gap: 6px;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
    }
    .chip-filter {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
    }
    .chip-filter.active {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }

    .table-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .survey-table {
      width: 100%;
    }
    .title-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 0;
    }
    .survey-link {
      font-weight: 600;
      color: #0f172a;
      text-decoration: none;
      font-size: 14px;
    }
    .survey-link:hover {
      color: #2563eb;
    }
    .survey-slug {
      font-size: 12px;
      color: #64748b;
      font-family: monospace;
    }
    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-pill.live {
      background: #dcfce7;
      color: #166534;
    }
    .status-pill.draft {
      background: #fef3c7;
      color: #92400e;
    }
    .status-pill.closed {
      background: #f1f5f9;
      color: #475569;
    }
    .progress-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
    }
    .counts {
      font-size: 12px;
      color: #334155;
    }
    .percent {
      color: #64748b;
    }
    .muted {
      color: #94a3b8;
      font-style: italic;
      font-size: 13px;
    }
    .text-right {
      text-align: right;
    }
    .empty-state {
      text-align: center;
      padding: 48px 16px;
      background: #ffffff;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
    }
    .empty-icon {
      font-size: 40px;
      height: 40px;
      width: 40px;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    /* Share Modal */
    .share-modal-backdrop {
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
    .share-modal-card {
      background: #ffffff;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      animation: modalPop 0.15s ease-out;
    }
    @keyframes modalPop {
      from { transform: scale(0.96); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .share-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .share-title-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .share-title-wrap h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    .share-subtitle {
      font-size: 12px;
      color: #64748b;
    }
    .share-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .share-label {
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .link-copy-box {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 8px 6px 14px;
      gap: 10px;
    }
    .url-snippet {
      flex: 1;
      font-family: monospace;
      font-size: 13px;
      color: #0f172a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .direct-share-channels {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .channel-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }
    .channels-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .channel-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      color: #ffffff;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .channel-btn:hover {
      transform: translateY(-1px);
      opacity: 0.95;
    }
    .whatsapp-channel {
      background: #25d366;
    }
    .email-channel {
      background: #2563eb;
    }
    .share-footer {
      padding: 14px 20px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  `]
})
export class AdminSurveyListComponent implements OnInit {
  surveys: SurveyListItem[] = [];
  loading = true;
  displayedColumns = ['title', 'status', 'progress', 'deadline', 'actions'];

  searchQuery = '';
  selectedStatusFilter: 'ALL' | 'LIVE' | 'DRAFT' | 'CLOSED' = 'ALL';
  activeShareSurvey: SurveyListItem | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSurveys();
  }

  loadSurveys(): void {
    this.loading = true;
    this.apiService.getSurveys().subscribe({
      next: data => {
        this.surveys = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get liveSurveys(): SurveyListItem[] {
    return this.surveys.filter(s => s.status === 'LIVE');
  }

  get totalCompletes(): number {
    return this.surveys.reduce((acc, s) => acc + (s.completed_count || 0), 0);
  }

  get totalTarget(): number {
    return this.surveys.reduce((acc, s) => acc + (s.target || 0), 0);
  }

  get overallFulfillment(): number {
    if (this.totalTarget <= 0) return 0;
    return Math.min(100, Math.round((this.totalCompletes / this.totalTarget) * 100));
  }

  get filteredSurveys(): SurveyListItem[] {
    return this.surveys.filter(s => {
      // 1. Status filter
      if (this.selectedStatusFilter !== 'ALL' && s.status !== this.selectedStatusFilter) {
        return false;
      }
      // 2. Query filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
      }
      return true;
    });
  }

  getPercent(s: SurveyListItem): number {
    if (!s.target || s.target <= 0) return 0;
    return Math.min(100, Math.round(((s.completed_count || 0) / s.target) * 100));
  }

  getSurveyPublicUrl(s: SurveyListItem): string {
    return `${window.location.origin}/s/${s.slug}`;
  }

  getWhatsAppShareUrl(s: SurveyListItem): string {
    const url = this.getSurveyPublicUrl(s);
    const text = encodeURIComponent(`Hello! Please take our survey "${s.title}":\n${url}`);
    return `https://api.whatsapp.com/send?text=${text}`;
  }

  getEmailShareUrl(s: SurveyListItem): string {
    const url = this.getSurveyPublicUrl(s);
    const subject = encodeURIComponent(`Survey Invitation: ${s.title}`);
    const body = encodeURIComponent(`Hello,\n\nYou have been invited to participate in the survey "${s.title}".\n\nPlease open this link to respond:\n${url}\n\nThank you!`);
    return `mailto:?subject=${subject}&body=${body}`;
  }

  openShareModal(s: SurveyListItem): void {
    this.activeShareSurvey = s;
  }

  copyLink(url: string): void {
    navigator.clipboard.writeText(url);
    this.snackBar.open('Public link copied to clipboard!', 'Close', { duration: 2500 });
  }

  testSurvey(s: SurveyListItem): void {
    this.apiService.createTestSession(s.id).subscribe({
      next: res => {
        window.open(res.url, '_blank');
      },
      error: () => {
        this.snackBar.open('Could not start preview session.', 'Close', { duration: 2500 });
      }
    });
  }
}
