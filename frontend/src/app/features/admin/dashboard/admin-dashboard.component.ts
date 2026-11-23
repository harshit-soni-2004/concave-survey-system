import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { 
  SurveyAnalyticsResponse, 
  SurveyDetail, 
  DashboardData,
  SurveyRespondentsResponse, 
  RespondentListItem,
  TokenItem
} from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    BaseChartDirective
  ],
  template: `
    <div class="survey-dashboard-container" *ngIf="analytics || loading">
      <!-- Error Banner -->
      <div *ngIf="loadError" class="error-banner">
        <div class="error-banner-content">
          <mat-icon>error_outline</mat-icon>
          <span>Failed to load survey analytics. Please check backend connection.</span>
        </div>
        <button class="error-retry-btn" (click)="loadAllData()">
          <mat-icon>refresh</mat-icon> Retry
        </button>
      </div>

      <!-- Top Header Bar -->
      <header class="dash-header-card admin-card" *ngIf="analytics">
        <div class="header-main-row">
          <div class="header-left">
            <button mat-button routerLink="/admin/surveys" class="back-link">
              <mat-icon>arrow_back</mat-icon> All Studies
            </button>
            <div class="title-status-wrap">
              <h1 class="survey-dash-title">{{ analytics.survey_title }}</h1>
              <div class="badge-strip">
                <span class="badge" [ngClass]="'badge-' + analytics.survey_status.toLowerCase()">
                  {{ analytics.survey_status }}
                </span>
                <span *ngIf="analytics.closed_reason" class="closed-reason-pill">
                  Reason: {{ analytics.closed_reason }}
                </span>
                <span class="version-pill">
                  v{{ analytics.version_number }}
                </span>
                <span class="deadline-pill" [class.overdue]="isOverdue">
                  <mat-icon class="pill-icon">schedule</mat-icon>
                  {{ deadlineText }}
                </span>
              </div>
            </div>
            <div class="meta-slug">
              <code>slug: {{ analytics.survey_slug }}</code> &bull; 
              <span>Updated: {{ lastUpdatedText }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="header-actions-group">
            <button mat-stroked-button (click)="loadAllData()" [disabled]="refreshing" class="hdr-btn">
              <mat-icon [class.spin]="refreshing">refresh</mat-icon> Refresh
            </button>
            <button mat-stroked-button (click)="exportFile('csv')" class="hdr-btn">
              <mat-icon>description</mat-icon> Export CSV
            </button>
            <button mat-stroked-button (click)="exportFile('xlsx')" class="hdr-btn">
              <mat-icon>table_view</mat-icon> Export Excel
            </button>
            <button mat-flat-button color="primary" (click)="openShareModal = true" class="hdr-btn">
              <mat-icon>share</mat-icon> Share Links
            </button>
            <button 
              *ngIf="authService.isAdmin() && analytics.survey_status === 'LIVE'" 
              mat-stroked-button 
              color="warn" 
              (click)="closeSurveyAdmin()"
              class="hdr-btn danger-btn">
              <mat-icon>lock</mat-icon> Close Survey
            </button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="nav-tabs-bar">
          <button 
            type="button"
            class="tab-btn" 
            [class.active]="activeTab === 'overview'" 
            (click)="activeTab = 'overview'">
            <mat-icon>dashboard</mat-icon> Overview
          </button>
          <button 
            type="button"
            class="tab-btn" 
            [class.active]="activeTab === 'results'" 
            (click)="activeTab = 'results'">
            <mat-icon>insights</mat-icon> Results &amp; Distributions
          </button>
          <button 
            type="button"
            class="tab-btn" 
            [class.active]="activeTab === 'respondents'" 
            (click)="activeTab = 'respondents'">
            <mat-icon>people</mat-icon> Respondents
          </button>
          <button 
            type="button"
            class="tab-btn" 
            [class.active]="activeTab === 'settings'" 
            (click)="activeTab = 'settings'">
            <mat-icon>settings</mat-icon> Versions &amp; Settings
          </button>
        </nav>
      </header>

      <!-- Skeleton Loading State -->
      <div *ngIf="loading && !analytics" class="skeleton-wrap">
        <div class="skeleton" style="height: 140px; margin-bottom: 20px;"></div>
        <div class="skeleton" style="height: 350px;"></div>
      </div>

      <!-- Main Content Stage -->
      <main *ngIf="analytics" class="tab-content-stage">

        <!-- ================= TAB 1: OVERVIEW ================= -->
        <div *ngIf="activeTab === 'overview'" class="tab-pane">
          <!-- 1. KPI Tiles Grid -->
          <div class="kpi-grid">
            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Completes / Target</span>
                <mat-icon class="kpi-icon text-success">task_alt</mat-icon>
              </div>
              <div class="kpi-value">{{ analytics.completed }} / {{ analytics.target }}</div>
              <div class="progress-track" style="margin-top: 6px;">
                <div class="progress-fill success" [style.width.%]="completionPercent"></div>
              </div>
              <div class="kpi-subtext">{{ completionPercent.toFixed(1) }}% of quota achieved</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Started</span>
                <mat-icon class="kpi-icon text-primary">play_arrow</mat-icon>
              </div>
              <div class="kpi-value">{{ analytics.started }}</div>
              <div class="kpi-subtext">Total participation attempts</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>In Progress</span>
                <mat-icon class="kpi-icon text-warning">pending</mat-icon>
              </div>
              <div class="kpi-value">{{ analytics.in_progress }}</div>
              <div class="kpi-subtext">Active unsubmitted sessions</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Terminated</span>
                <mat-icon class="kpi-icon text-danger">highlight_off</mat-icon>
              </div>
              <div class="kpi-value">{{ analytics.terminated }}</div>
              <div class="kpi-subtext">Screenout &amp; quota-full</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Completion Rate</span>
                <mat-icon class="kpi-icon text-info">trending_up</mat-icon>
              </div>
              <div class="kpi-value">{{ (analytics.completion_rate * 100).toFixed(1) }}%</div>
              <div class="kpi-subtext">Completed / Started</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Incidence Rate</span>
                <mat-icon class="kpi-icon text-info">how_to_reg</mat-icon>
              </div>
              <div class="kpi-value">{{ (analytics.incidence_rate * 100).toFixed(1) }}%</div>
              <div class="kpi-subtext">Completed / (Comp + Term)</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Median Duration</span>
                <mat-icon class="kpi-icon text-neutral">timer</mat-icon>
              </div>
              <div class="kpi-value">{{ formatDuration(analytics.median_completion_time_seconds) }}</div>
              <div class="kpi-subtext">Avg: {{ formatDuration(analytics.average_completion_time_seconds) }}</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Quality Flags</span>
                <mat-icon class="kpi-icon text-warning">flag</mat-icon>
              </div>
              <div class="kpi-value">{{ analytics.quality_flags.total_flagged }}</div>
              <div class="kpi-subtext">{{ analytics.quality_flags.speeders }} speeders, {{ analytics.quality_flags.straight_liners }} straight-liners</div>
            </div>

            <div class="kpi-tile">
              <div class="kpi-label">
                <span>Projected Finish</span>
                <mat-icon class="kpi-icon text-primary">event_available</mat-icon>
              </div>
              <div class="kpi-value" style="font-size: 20px;">
                {{ analytics.projected_finish_date ? (analytics.projected_finish_date | date:'mediumDate') : 'Calculating...' }}
              </div>
              <div class="kpi-subtext">Based on 3-day completion pace</div>
            </div>
          </div>

          <!-- 2. Alerts Panel -->
          <div *ngIf="analytics.alerts.summary.length > 0" class="alert-strip warning" style="margin-bottom: 24px;">
            <mat-icon>warning</mat-icon>
            <div class="alert-content">
              <strong>Attention Required:</strong>
              <ul style="margin: 4px 0 0 16px; padding: 0;">
                <li *ngFor="let s of analytics.alerts.summary">{{ s }}</li>
              </ul>
            </div>
          </div>

          <!-- 3. Charts: Trends & Pace + Status Donut -->
          <div class="charts-row">
            <!-- Daily Trends & Cumulative Pace Chart -->
            <div class="admin-card chart-card-main">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">show_chart</mat-icon> Daily Production &amp; Cumulative Target Pace
                </h3>
                <span class="chart-subtitle">Last 14 Days</span>
              </div>
              <div class="card-body-content chart-body">
                <canvas 
                  *ngIf="trendChartData.labels?.length" 
                  baseChart
                  [data]="trendChartData"
                  [options]="trendChartOptions"
                  [type]="'line'">
                </canvas>
                <div *ngIf="!trendChartData.labels?.length" class="no-data-msg">
                  <mat-icon>timeline</mat-icon>
                  <span>No trend data recorded.</span>
                </div>
              </div>
            </div>

            <!-- Respondent Status Donut -->
            <div class="admin-card chart-card-side">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">pie_chart</mat-icon> Session Status Breakdown
                </h3>
              </div>
              <div class="card-body-content chart-body donut-body">
                <div *ngIf="analytics.started > 0" class="donut-wrapper">
                  <canvas 
                    baseChart
                    [data]="statusDonutData"
                    [options]="statusDonutOptions"
                    [type]="'doughnut'">
                  </canvas>
                  <div class="donut-center-metric">
                    <span class="donut-center-val">{{ analytics.started }}</span>
                    <span class="donut-center-lbl">Sessions</span>
                  </div>
                </div>
                <div *ngIf="analytics.started === 0" class="no-data-msg">
                  <mat-icon>inbox</mat-icon>
                  <span>No respondents yet.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Quotas Progress & Disqualifications Grid -->
          <div class="grid-2col" style="margin-top: 24px;">
            <!-- Quotas Table -->
            <div class="admin-card">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">tune</mat-icon> Quota Fulfillment
                </h3>
                <span class="chart-subtitle">Single &amp; Nested Quotas</span>
              </div>
              <div class="card-body-content">
                <div *ngIf="quotasProgress.length === 0" class="empty-state-wrap" style="padding: 24px;">
                  <mat-icon class="empty-state-icon">tune</mat-icon>
                  <p class="empty-state-desc">No quotas configured for this survey.</p>
                </div>

                <div *ngIf="quotasProgress.length > 0" class="quota-list">
                  <div *ngFor="let q of quotasProgress" class="quota-row-item">
                    <div class="quota-info-row">
                      <div class="quota-condition">
                        <code>{{ q.question_id }} = "{{ q.value }}"</code>
                        <span *ngIf="q.question_id_2">
                          &amp; <code>{{ q.question_id_2 }} = "{{ q.value_2 }}"</code>
                          <span class="badge badge-nested">Nested</span>
                        </span>
                      </div>
                      <div class="quota-numbers">
                        <span><strong>{{ q.done }}</strong> / {{ q.target }}</span>
                        <span class="quota-left" [class.full]="q.left <= 0">({{ q.left }} left)</span>
                      </div>
                    </div>
                    <div class="progress-track" style="margin-top: 6px;">
                      <div 
                        class="progress-fill" 
                        [class.success]="q.done >= q.target"
                        [class.warning]="q.done < q.target && (q.done / q.target) >= 0.9"
                        [style.width.%]="getQuotaPercent(q)">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Termination Reasons -->
            <div class="admin-card">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">highlight_off</mat-icon> Disqualifications &amp; Screenouts
                </h3>
                <span class="chart-subtitle">Top Dropout Points</span>
              </div>
              <div class="card-body-content">
                <div *ngIf="analytics.top_termination_reasons.length === 0" class="empty-state-wrap" style="padding: 24px;">
                  <mat-icon class="empty-state-icon">check_circle_outline</mat-icon>
                  <p class="empty-state-desc">No respondents terminated so far.</p>
                </div>

                <div *ngIf="analytics.top_termination_reasons.length > 0" class="term-list">
                  <div *ngFor="let tr of analytics.top_termination_reasons" class="term-row-item">
                    <div class="term-info">
                      <span class="term-reason">{{ tr.reason }}</span>
                      <span class="term-count text-danger font-bold">{{ tr.count }}</span>
                    </div>
                    <div class="progress-track">
                      <div 
                        class="progress-fill danger" 
                        [style.width.%]="getTermPercent(tr.count)">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Drop-off Funnel Chart -->
          <div class="admin-card" style="margin-top: 24px;" *ngIf="analytics.dropoff.length > 0">
            <div class="card-header-bar">
              <h3>
                <mat-icon color="primary">filter_alt</mat-icon> Question Drop-off Funnel
              </h3>
              <span class="chart-subtitle">Respondent retention and loss per question</span>
            </div>
            <div class="card-body-content">
              <div class="dropoff-funnel-list">
                <div *ngFor="let d of analytics.dropoff" class="funnel-step">
                  <div class="funnel-meta">
                    <span class="step-id"><code>{{ d.question_id }}</code></span>
                    <span class="step-text">{{ d.question_text }}</span>
                    <span class="step-stats">
                      <strong>{{ d.reached }}</strong> reached &bull; 
                      <span class="text-danger">{{ d.stopped }} dropped ({{ d.dropoff_rate }}%)</span>
                    </span>
                  </div>
                  <div class="progress-track" style="height: 10px;">
                    <div 
                      class="progress-fill" 
                      style="background: #3b82f6;" 
                      [style.width.%]="getDropoffReachedPercent(d.reached)">
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= TAB 2: RESULTS & DISTRIBUTIONS ================= -->
        <div *ngIf="activeTab === 'results'" class="tab-pane">
          <!-- Filter & Search Controls -->
          <div class="results-controls admin-card" style="padding: 16px; margin-bottom: 20px;">
            <div class="controls-row">
              <div class="search-box">
                <mat-icon class="search-icon">search</mat-icon>
                <input 
                  type="text" 
                  placeholder="Filter question by ID or text..." 
                  [(ngModel)]="questionSearchQuery" 
                  class="search-input"
                />
              </div>

              <!-- Question Type Filter -->
              <div class="filter-chips">
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedQuestionType === 'ALL'"
                  (click)="selectedQuestionType = 'ALL'">
                  All Types
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedQuestionType === 'single'"
                  (click)="selectedQuestionType = 'single'">
                  Single Choice
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedQuestionType === 'multi'"
                  (click)="selectedQuestionType = 'multi'">
                  Multiple Choice
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedQuestionType === 'nps'"
                  (click)="selectedQuestionType = 'nps'">
                  NPS
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedQuestionType === 'rating'"
                  (click)="selectedQuestionType = 'rating'">
                  Rating
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedQuestionType === 'matrix'"
                  (click)="selectedQuestionType = 'matrix'">
                  Matrix
                </button>
              </div>
            </div>
          </div>

          <!-- Empty Questions Message -->
          <div *ngIf="filteredQuestions.length === 0" class="admin-card empty-state-wrap">
            <mat-icon class="empty-state-icon">find_in_page</mat-icon>
            <h4 class="empty-state-title">No Matching Questions</h4>
            <p class="empty-state-desc">Try clearing the search query or question type filter.</p>
          </div>

          <!-- Question Cards List -->
          <div class="question-analytics-grid">
            <div *ngFor="let q of filteredQuestions" class="admin-card question-analytic-card">
              <!-- Question Header -->
              <div class="card-header-bar">
                <div>
                  <div class="q-meta-line">
                    <code>{{ q.id }}</code>
                    <span class="q-type-badge">{{ q.type | uppercase }}</span>
                    <span class="q-sample-n">n = {{ q.n }} respondents</span>
                  </div>
                  <h3 class="q-text-title">{{ q.text }}</h3>
                </div>
              </div>

              <div class="card-body-content">
                <!-- Case 1: NPS Question -->
                <div *ngIf="q.type === 'nps'" class="nps-breakdown">
                  <div class="nps-score-badge-row">
                    <div class="nps-big-score" [ngClass]="getNpsClass(q.score)">
                      <span class="nps-num">{{ q.score > 0 ? '+' + q.score : q.score }}</span>
                      <span class="nps-lbl">NPS Score</span>
                    </div>
                    <div class="nps-sentiment-bars">
                      <div class="nps-seg promoter" [style.flex]="q.promoters || 1">
                        <span>Promoters ({{ q.promoters }})</span>
                        <strong>{{ q.n > 0 ? ((q.promoters / q.n) * 100).toFixed(0) : 0 }}%</strong>
                      </div>
                      <div class="nps-seg passive" [style.flex]="q.passives || 1">
                        <span>Passives ({{ q.passives }})</span>
                        <strong>{{ q.n > 0 ? ((q.passives / q.n) * 100).toFixed(0) : 0 }}%</strong>
                      </div>
                      <div class="nps-seg detractor" [style.flex]="q.detractors || 1">
                        <span>Detractors ({{ q.detractors }})</span>
                        <strong>{{ q.n > 0 ? ((q.detractors / q.n) * 100).toFixed(0) : 0 }}%</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Case 2: Rating Question -->
                <div *ngIf="q.type === 'rating'" class="rating-breakdown">
                  <div class="rating-summary-row">
                    <div class="rating-mean-badge">
                      <span class="mean-num">{{ q.mean_score }}</span>
                      <span class="mean-lbl">Average Rating (out of {{ q.max || 5 }})</span>
                    </div>
                    <div class="rating-bars-list">
                      <div *ngFor="let opt of q.distribution" class="dist-row">
                        <span class="dist-opt-label">{{ opt.value }} Star{{ opt.value > 1 ? 's' : '' }}</span>
                        <div class="progress-track" style="flex: 1;">
                          <div class="progress-fill" [style.width.%]="opt.percent"></div>
                        </div>
                        <span class="dist-stat"><strong>{{ opt.count }}</strong> ({{ opt.percent }}%)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Case 3: Matrix Question -->
                <div *ngIf="q.type === 'matrix'" class="matrix-breakdown">
                  <div class="matrix-rows-list">
                    <div *ngFor="let row of q.rows" class="matrix-row-analytic">
                      <div class="matrix-row-title">
                        <strong>{{ row.row_text }}</strong>
                        <span class="text-muted">(n = {{ row.n }})</span>
                      </div>
                      <div class="matrix-stacked-bar">
                        <div 
                          *ngFor="let opt of row.distribution; let idx = index" 
                          class="matrix-stack-seg"
                          [style.flex]="opt.count || 0.1"
                          [style.background]="getMatrixColor(idx)"
                          [title]="opt.option + ': ' + opt.count + ' (' + opt.percent + '%)'">
                          <span *ngIf="opt.percent >= 10">{{ opt.percent }}%</span>
                        </div>
                      </div>
                      <div class="matrix-legend-row">
                        <span *ngFor="let opt of row.distribution; let idx = index" class="matrix-legend-item">
                          <span class="matrix-dot" [style.background]="getMatrixColor(idx)"></span>
                          {{ opt.option }}: <strong>{{ opt.count }}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Case 4: Single, Multi, Dropdown, Yes/No Question -->
                <div *ngIf="q.type !== 'nps' && q.type !== 'rating' && q.type !== 'matrix'" class="categorical-breakdown">
                  <div class="dist-bars-list">
                    <div *ngFor="let opt of q.distribution" class="dist-row">
                      <span class="dist-opt-label">{{ opt.option }}</span>
                      <div class="progress-track" style="flex: 1;">
                        <div class="progress-fill" [style.width.%]="opt.percent"></div>
                      </div>
                      <span class="dist-stat"><strong>{{ opt.count }}</strong> ({{ opt.percent }}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= TAB 3: RESPONDENTS ================= -->
        <div *ngIf="activeTab === 'respondents'" class="tab-pane">
          <div class="admin-card">
            <!-- Filter Strip & Pagination Controls -->
            <div class="card-header-bar table-controls-header">
              <div class="filter-chips">
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="respondentStatusFilter === ''"
                  (click)="setRespondentFilter('')">
                  All
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="respondentStatusFilter === 'COMPLETED'"
                  (click)="setRespondentFilter('COMPLETED')">
                  Completed
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="respondentStatusFilter === 'TERMINATED'"
                  (click)="setRespondentFilter('TERMINATED')">
                  Terminated
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="respondentStatusFilter === 'IN_PROGRESS'"
                  (click)="setRespondentFilter('IN_PROGRESS')">
                  In Progress
                </button>
              </div>

              <div class="pagination-right">
                <span class="page-size-label">Page size:</span>
                <select [(ngModel)]="respondentPageSize" (change)="loadRespondents()" class="select-box">
                  <option [value]="10">10</option>
                  <option [value]="25">25</option>
                  <option [value]="50">50</option>
                </select>
                <span class="page-info">
                  Page {{ respondentPage }} of {{ respondentTotalPages || 1 }} ({{ respondentTotal }} total)
                </span>
                <button 
                  mat-icon-button 
                  (click)="changeRespondentPage(-1)" 
                  [disabled]="respondentPage <= 1">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <button 
                  mat-icon-button 
                  (click)="changeRespondentPage(1)" 
                  [disabled]="respondentPage >= respondentTotalPages">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            </div>

            <div class="card-body-content" style="padding: 0;">
              <!-- Table -->
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Masked ID</th>
                      <th>Status</th>
                      <th>Version</th>
                      <th>Started At</th>
                      <th>Completed At</th>
                      <th>Duration</th>
                      <th>Quality Flag</th>
                      <th>Termination Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of respondents">
                      <td><code>{{ r.masked_id }}</code></td>
                      <td>
                        <span class="badge" [ngClass]="'badge-' + r.status.toLowerCase()">
                          {{ r.status }}
                        </span>
                      </td>
                      <td>v{{ r.version }}</td>
                      <td>{{ r.started_at ? (r.started_at | date:'short') : '-' }}</td>
                      <td>{{ r.completed_at ? (r.completed_at | date:'short') : '-' }}</td>
                      <td>{{ formatDuration(r.duration_seconds) }}</td>
                      <td>
                        <span *ngIf="r.quality_flag" class="badge badge-alert">
                          <mat-icon style="font-size: 14px; width: 14px; height: 14px;">flag</mat-icon>
                          {{ r.quality_flag }}
                        </span>
                        <span *ngIf="!r.quality_flag" class="text-muted">-</span>
                      </td>
                      <td>
                        <span *ngIf="r.termination_reason" class="text-danger font-medium">
                          {{ r.termination_reason }}
                        </span>
                        <span *ngIf="!r.termination_reason" class="text-muted">-</span>
                      </td>
                    </tr>
                    <tr *ngIf="respondents.length === 0">
                      <td colspan="8" class="text-center" style="padding: 32px;">
                        <mat-icon class="empty-state-icon">people_outline</mat-icon>
                        <p class="empty-state-desc">No respondents found matching filter.</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= TAB 4: VERSIONS & SETTINGS ================= -->
        <div *ngIf="activeTab === 'settings'" class="tab-pane">
          <div class="grid-2col">
            <!-- Version History -->
            <div class="admin-card">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">history</mat-icon> Version History
                </h3>
              </div>
              <div class="card-body-content">
                <div class="version-history-list" *ngIf="surveyDetail">
                  <div *ngFor="let v of surveyDetail.versions" class="version-item-row">
                    <div class="v-main">
                      <strong>Version {{ v.version_number }}</strong>
                      <span class="badge" [ngClass]="v.status === 'APPROVED' ? 'badge-live' : 'badge-draft'">
                        {{ v.status }}
                      </span>
                    </div>
                    <div class="v-meta">
                      <span>Created: {{ v.created_at | date:'medium' }}</span>
                      <span *ngIf="v.approved_at"> &bull; Approved: {{ v.approved_at | date:'medium' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Deadline & Schedule Settings -->
            <div class="admin-card">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">event</mat-icon> Study Deadline
                </h3>
              </div>
              <div class="card-body-content">
                <label class="form-label">Active Fieldwork Deadline</label>
                <div class="deadline-form-row">
                  <input 
                    type="datetime-local" 
                    [(ngModel)]="newDeadlineValue" 
                    class="date-input"
                  />
                  <button 
                    mat-flat-button 
                    color="primary" 
                    (click)="saveDeadline()" 
                    [disabled]="isUpdatingDeadline">
                    Save Deadline
                  </button>
                </div>
                <p class="field-hint">Setting a deadline automatically monitors quota completion pace and triggers approaching-deadline alerts.</p>
              </div>
            </div>
          </div>

          <!-- Token Generator -->
          <div class="admin-card" style="margin-top: 24px;">
            <div class="card-header-bar">
              <h3>
                <mat-icon color="primary">vpn_key</mat-icon> Generate Private Invite Links
              </h3>
              <span class="chart-subtitle">Create one-time authenticated respondent tokens</span>
            </div>
            <div class="card-body-content">
              <div class="token-gen-row">
                <label class="form-label" style="margin: 0;">Number of Links:</label>
                <input type="number" min="1" max="100" [(ngModel)]="tokenCountToGenerate" class="num-input" />
                <button mat-flat-button color="primary" (click)="generateInviteTokens()" [disabled]="isGeneratingTokens">
                  <mat-icon>add_link</mat-icon> Generate Links
                </button>
              </div>

              <!-- Generated tokens box -->
              <div *ngIf="generatedTokens.length > 0" class="generated-tokens-box" style="margin-top: 16px;">
                <div class="tokens-header">
                  <strong>Generated {{ generatedTokens.length }} Links:</strong>
                  <button mat-button color="primary" (click)="copyAllTokens()">
                    <mat-icon>content_copy</mat-icon> Copy All
                  </button>
                </div>
                <div class="tokens-list">
                  <div *ngFor="let t of generatedTokens" class="token-item">
                    <code>{{ t.url }}</code>
                    <button mat-icon-button (click)="copyLink(t.url)" title="Copy link">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      <!-- Share Modal Dialog -->
      <div *ngIf="openShareModal && analytics" class="modal-backdrop" (click)="openShareModal = false">
        <div class="modal-dialog-card" (click)="$event.stopPropagation()">
          <div class="card-header-bar">
            <div class="share-title-box">
              <mat-icon color="primary">share</mat-icon>
              <div>
                <h3 style="margin: 0;">Share Survey</h3>
                <span class="share-study-name">{{ analytics.survey_title }}</span>
              </div>
            </div>
            <button mat-icon-button (click)="openShareModal = false">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="card-body-content">
            <label class="form-label">Public Participation Link</label>
            <div class="copy-url-row">
              <input type="text" readonly [value]="getPublicUrl()" class="url-input" />
              <button mat-flat-button color="primary" (click)="copyLink(getPublicUrl())">
                <mat-icon>content_copy</mat-icon> Copy
              </button>
            </div>

            <div class="channel-actions-box">
              <span class="form-label">Direct Communication Channels:</span>
              <div class="channels-grid">
                <a 
                  [href]="getWhatsAppShareUrl()" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="channel-btn whatsapp-btn">
                  <mat-icon>chat</mat-icon> WhatsApp
                </a>
                <a 
                  [href]="getEmailShareUrl()" 
                  class="channel-btn email-btn">
                  <mat-icon>email</mat-icon> Email Invitation
                </a>
              </div>
            </div>
          </div>

          <div class="card-header-bar modal-footer-bar">
            <a [href]="getPublicUrl()" target="_blank" mat-stroked-button>
              <mat-icon>open_in_new</mat-icon> Open in Browser
            </a>
            <button mat-flat-button color="primary" (click)="openShareModal = false">Done</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .survey-dashboard-container {
      width: 100%;
    }
    .kpi-grid {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 16px !important;
      margin-bottom: 24px !important;
      width: 100% !important;
    }
    @media (max-width: 1200px) {
      .kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }
    }
    @media (max-width: 640px) {
      .kpi-grid {
        grid-template-columns: 1fr !important;
      }
    }
    .dash-header-card {
      margin-bottom: 24px;
      padding: 20px 24px 0 24px;
    }
    .header-main-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
    }
    .back-link {
      margin-left: -8px;
      margin-bottom: 6px;
      color: var(--color-text-muted);
      font-size: 13px;
    }
    .title-status-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .survey-dash-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--color-text);
      margin: 0;
      letter-spacing: -0.4px;
    }
    .badge-strip {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .closed-reason-pill {
      font-size: 11px;
      font-weight: 700;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 3px 8px;
      border-radius: 9999px;
      color: var(--color-text-muted);
    }
    .version-pill {
      font-size: 11px;
      font-weight: 700;
      background: rgba(108, 123, 255, 0.12);
      color: var(--color-primary);
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid rgba(108, 123, 255, 0.25);
    }
    .deadline-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      color: var(--color-text);
      padding: 3px 8px;
      border-radius: 9999px;
    }
    .deadline-pill.overdue {
      background: rgba(248, 113, 113, 0.12);
      border-color: rgba(248, 113, 113, 0.3);
      color: var(--color-danger);
    }
    .pill-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .meta-slug {
      font-size: 12.5px;
      color: var(--color-text-muted);
      margin-top: 6px;
    }
    .meta-slug code {
      font-family: var(--font-mono);
      background: var(--color-surface-raised);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--color-border);
    }
    .header-actions-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hdr-btn {
      font-size: 12.5px;
      font-weight: 600;
    }
    .danger-btn {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
    .danger-btn:hover {
      background: rgba(248, 113, 113, 0.12);
    }

    /* Tabs */
    .nav-tabs-bar {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--color-border);
      margin-top: 12px;
      overflow-x: auto;
    }
    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 10px 18px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .tab-btn:hover {
      color: var(--color-text);
    }
    .tab-btn.active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
    }

    /* Charts Row */
    .charts-row {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .chart-card-main {
      flex: 2;
      min-width: 320px;
    }
    .chart-card-side {
      flex: 1;
      min-width: 280px;
    }
    .chart-subtitle {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .chart-body {
      height: 270px;
      position: relative;
    }
    .donut-body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .donut-wrapper {
      position: relative;
      width: 100%;
      height: 260px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .donut-center-metric {
      position: absolute;
      top: 42%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      pointer-events: none;
    }
    .donut-center-val {
      font-size: 28px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
      letter-spacing: -0.03em;
      color: var(--color-text);
      line-height: 1;
    }
    .donut-center-lbl {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-text-muted);
      margin-top: 4px;
    }
    .no-data-msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--color-text-muted);
      gap: 8px;
      font-size: 13px;
    }

    /* 2-Col Grid */
    .grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .grid-2col {
        grid-template-columns: 1fr;
      }
    }

    /* Quota list */
    .quota-list, .term-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .quota-row-item, .term-row-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .quota-info-row, .term-info {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--color-text);
    }
    .quota-condition code {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .badge-nested {
      background: rgba(167, 139, 250, 0.12);
      color: var(--color-secondary);
      border: 1px solid rgba(167, 139, 250, 0.25);
      font-size: 10px;
      margin-left: 6px;
    }
    .quota-numbers {
      font-size: 12.5px;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .quota-left {
      color: var(--color-text-muted);
      margin-left: 4px;
    }
    .quota-left.full {
      color: var(--color-danger);
      font-weight: 700;
    }

    /* Drop-off Funnel */
    .dropoff-funnel-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .funnel-step {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .funnel-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .step-id code {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-family: var(--font-mono);
    }
    .step-text {
      flex: 1;
      margin: 0 12px;
      color: var(--color-text);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .step-stats {
      font-size: 12px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }

    /* Results Tab */
    .results-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0 8px;
      width: 280px;
    }
    .search-icon {
      color: var(--color-text-muted);
      font-size: 18px;
      margin-right: 6px;
    }
    .search-input {
      border: none;
      outline: none;
      font-size: 13px;
      width: 100%;
      height: 36px;
      background: transparent;
      color: var(--color-text);
    }
    .filter-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .chip-btn {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: 9999px;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .chip-btn:hover {
      background: var(--color-surface);
      color: var(--color-text);
    }
    .chip-btn.active {
      background: var(--color-primary);
      color: #ffffff;
      border-color: var(--color-primary);
    }

    /* Question cards */
    .question-analytics-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .question-analytic-card {
      border-radius: var(--radius-md);
    }
    .q-meta-line {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .q-meta-line code {
      font-family: var(--font-mono);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .q-type-badge {
      font-size: 10.5px;
      font-weight: 700;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .q-sample-n {
      font-size: 12px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .q-text-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text);
      margin: 0;
    }

    /* NPS Card */
    .nps-breakdown {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .nps-score-badge-row {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }
    .nps-big-score {
      padding: 16px 24px;
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 120px;
    }
    .nps-big-score.excellent {
      background: rgba(52, 211, 153, 0.12);
      color: var(--color-success);
      border: 1px solid rgba(52, 211, 153, 0.3);
    }
    .nps-big-score.good {
      background: rgba(108, 123, 255, 0.12);
      color: var(--color-primary);
      border: 1px solid rgba(108, 123, 255, 0.3);
    }
    .nps-big-score.poor {
      background: rgba(248, 113, 113, 0.12);
      color: var(--color-danger);
      border: 1px solid rgba(248, 113, 113, 0.3);
    }
    .nps-num {
      font-size: 34px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .nps-lbl {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .nps-sentiment-bars {
      flex: 1;
      display: flex;
      height: 48px;
      border-radius: var(--radius-sm);
      overflow: hidden;
      min-width: 250px;
    }
    .nps-seg {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 11.5px;
      padding: 0 8px;
      color: #ffffff;
      transition: flex 0.3s ease;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .nps-seg.promoter { background: var(--color-success); }
    .nps-seg.passive { background: var(--color-warning); color: #0b0d14; }
    .nps-seg.detractor { background: var(--color-danger); }

    /* Rating Card */
    .rating-summary-row {
      display: flex;
      gap: 24px;
      align-items: center;
      flex-wrap: wrap;
    }
    .rating-mean-badge {
      background: rgba(230, 194, 122, 0.12);
      border: 1px solid rgba(230, 194, 122, 0.3);
      color: var(--color-highlight);
      padding: 16px 20px;
      border-radius: var(--radius-md);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 140px;
    }
    .mean-num {
      font-size: 34px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .mean-lbl {
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;
      text-align: center;
    }
    .rating-bars-list, .dist-bars-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 250px;
    }
    .dist-row {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .dist-opt-label {
      width: 140px;
      color: var(--color-text);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dist-stat {
      width: 100px;
      text-align: right;
      font-size: 12px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }

    /* Matrix Card */
    .matrix-rows-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .matrix-row-analytic {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .matrix-row-title {
      font-size: 13.5px;
      display: flex;
      gap: 8px;
      color: var(--color-text);
    }
    .matrix-stacked-bar {
      display: flex;
      height: 22px;
      border-radius: 4px;
      overflow: hidden;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
    }
    .matrix-stack-seg {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .matrix-legend-row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .matrix-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .matrix-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    /* Respondents Tab */
    .table-controls-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .pagination-right {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum";
    }
    .select-box {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      color: var(--color-text);
    }
    .table-responsive {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th {
      text-align: left;
      padding: 10px 14px;
      background: var(--color-surface-raised);
      border-bottom: 1px solid var(--color-border);
      font-size: 11.5px;
      font-weight: 700;
      color: var(--color-text-muted);
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .data-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-border);
      vertical-align: middle;
      color: var(--color-text);
    }
    .data-table tr:hover td {
      background: var(--color-surface-raised);
    }

    /* Versions & Settings Tab */
    .version-history-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .version-item-row {
      padding: 12px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-raised);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .v-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--color-text);
    }
    .v-meta {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .deadline-form-row {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .date-input {
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      background: var(--color-surface-raised);
      color: var(--color-text);
    }
    .field-hint {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 8px;
    }
    .token-gen-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .num-input {
      width: 80px;
      padding: 6px 10px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      background: var(--color-surface-raised);
      color: var(--color-text);
    }
    .generated-tokens-box {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface-raised);
      padding: 12px;
    }
    .tokens-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--color-text);
    }
    .tokens-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
    }
    .token-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-surface);
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid var(--color-border);
      font-size: 12px;
      color: var(--color-text);
    }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal-dialog-card {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      width: 100%;
      max-width: 520px;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      color: var(--color-text);
    }
    .share-title-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .share-study-name {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .form-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: block;
      margin-bottom: 6px;
    }
    .copy-url-row {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .url-input {
      flex: 1;
      font-family: var(--font-mono);
      font-size: 12.5px;
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text);
    }
    .channel-actions-box {
      border-top: 1px solid var(--color-border);
      padding-top: 16px;
    }
    .channels-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .channel-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      text-decoration: none;
      transition: opacity 0.15s ease;
    }
    .channel-btn:hover {
      opacity: 0.9;
    }
    .whatsapp-btn { background: #25d366; }
    .email-btn { background: #4f5bd5; }
    .modal-footer-bar { 
      background: var(--color-surface); 
      border-top: 1px solid var(--color-border);
    }

    /* Colors */
    .text-primary { color: var(--color-primary); }
    .text-success { color: var(--color-success); }
    .text-warning { color: var(--color-warning); }
    .text-danger { color: var(--color-danger); }
    .text-info { color: var(--color-accent); }
    .text-neutral { color: var(--color-text-muted); }

    /* Utility */
    .spin { animation: spinAnim 1s linear infinite; }
    @keyframes spinAnim { 100% { transform: rotate(360deg); } }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  surveyId!: number;
  analytics: SurveyAnalyticsResponse | null = null;
  surveyDetail: SurveyDetail | null = null;
  dashboardData: DashboardData | null = null;

  loading = true;
  refreshing = false;
  loadError = false;
  lastUpdated: Date = new Date();

  activeTab: 'overview' | 'results' | 'respondents' | 'settings' = 'overview';
  openShareModal = false;

  // Auto-refresh timer subscription
  private autoRefreshSub?: Subscription;
  private themeSub?: Subscription;

  // Results Tab Filter
  selectedQuestionType: string = 'ALL';
  questionSearchQuery: string = '';

  // Respondents Tab State
  respondents: RespondentListItem[] = [];
  respondentStatusFilter: string = '';
  respondentPage: number = 1;
  respondentPageSize: number = 10;
  respondentTotal: number = 0;
  respondentTotalPages: number = 1;

  // Settings Tab State
  newDeadlineValue: string = '';
  isUpdatingDeadline = false;
  tokenCountToGenerate = 5;
  isGeneratingTokens = false;
  generatedTokens: TokenItem[] = [];

  // Line Chart: Daily Trends & Pace Line
  trendChartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };

  trendChartOptions: ChartConfiguration<'line'>['options'] = {};

  // Donut: Session Status
  statusDonutData: ChartData<'doughnut'> = {
    labels: ['Completed', 'In Progress', 'Terminated'],
    datasets: []
  };

  statusDonutOptions: ChartConfiguration<'doughnut'>['options'] = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    public authService: AuthService,
    public themeService: ThemeService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.updateChartOptions();

    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.surveyId = Number(idStr);
        this.loadAllData();
      }
    });

    // Theme changes listener
    this.themeSub = this.themeService.themeChanged$.subscribe(() => {
      this.updateChartOptions();
      if (this.analytics) {
        this.setupCharts(this.analytics);
      }
    });

    // Auto-refresh every 30 seconds
    this.autoRefreshSub = interval(30000).subscribe(() => {
      if (this.surveyId && !this.loading) {
        this.loadAllData(true);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.autoRefreshSub) {
      this.autoRefreshSub.unsubscribe();
    }
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
  }

  updateChartOptions(): void {
    const isDark = this.themeService.isDark();
    const textColor = isDark ? '#F8F8FC' : '#0F172A';
    const mutedColor = isDark ? '#9A9AB5' : '#64748B';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)';
    const tooltipBg = isDark ? '#0C0B1A' : '#FFFFFF';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

    this.trendChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11 }, color: textColor }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0, color: mutedColor },
          grid: { color: gridColor }
        },
        x: {
          ticks: { color: mutedColor },
          grid: { display: false }
        }
      }
    };

    this.statusDonutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 }, color: textColor }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10
        }
      }
    };
  }

  loadAllData(isSilent: boolean = false): void {
    if (!isSilent) this.loading = true;
    this.refreshing = true;
    this.loadError = false;

    this.apiService.getSurveyAnalytics(this.surveyId, 14).subscribe({
      next: (data) => {
        this.analytics = data;
        this.lastUpdated = new Date();
        this.setupCharts(data);
        this.loading = false;
        this.refreshing = false;
      },
      error: () => {
        this.loadError = true;
        this.loading = false;
        this.refreshing = false;
      }
    });

    this.apiService.getSurvey(this.surveyId).subscribe({
      next: (detail) => {
        this.surveyDetail = detail;
        if (detail.deadline_at) {
          this.newDeadlineValue = detail.deadline_at.slice(0, 16);
        }
      }
    });

    this.apiService.getDashboard(this.surveyId).subscribe({
      next: (dash) => {
        this.dashboardData = dash;
      }
    });

    this.loadRespondents();
  }

  setupCharts(data: SurveyAnalyticsResponse): void {
    const isDark = this.themeService.isDark();
    const completedColor = isDark ? '#34D399' : '#059669';
    const startedColor = isDark ? '#2DD4F5' : '#4F46E5';
    const cumColor = isDark ? '#8B6CFF' : '#7C3AED';
    const paceColor = isDark ? '#FBBF24' : '#D97706';

    const inProgressColor = isDark ? '#FBBF24' : '#F59E0B';
    const terminatedColor = isDark ? '#FB7185' : '#EF4444';
    const donutBorder = isDark ? '#07070F' : '#FFFFFF';

    // 1. Line Chart: Daily started, daily completed, cumulative completes, target pace
    const dates = data.daily_trends.map(d => {
      const p = d.date.split('-');
      return `${p[1]}/${p[2]}`;
    });

    this.trendChartData = {
      labels: dates,
      datasets: [
        {
          label: 'Completed / Day',
          data: data.daily_trends.map(d => d.completed),
          borderColor: completedColor,
          backgroundColor: 'rgba(52, 211, 153, 0.12)',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Started / Day',
          data: data.daily_trends.map(d => d.started),
          borderColor: startedColor,
          backgroundColor: 'rgba(45, 212, 245, 0.12)',
          fill: false,
          tension: 0.3
        },
        {
          label: 'Cumulative Completes',
          data: data.daily_trends.map(d => d.cumulative_completes),
          borderColor: cumColor,
          borderWidth: 2,
          fill: false,
          tension: 0.2
        },
        {
          label: 'Target Pace',
          data: data.daily_trends.map(d => d.target_pace),
          borderColor: paceColor,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    };

    // 2. Donut: Completed, In Progress, Terminated
    this.statusDonutData = {
      labels: ['Completed', 'In Progress', 'Terminated'],
      datasets: [
        {
          data: [data.completed, data.in_progress, data.terminated],
          backgroundColor: [completedColor, inProgressColor, terminatedColor],
          borderWidth: 2,
          borderColor: donutBorder
        }
      ]
    };
  }

  loadRespondents(): void {
    this.apiService.getSurveyRespondents(
      this.surveyId,
      this.respondentStatusFilter,
      this.respondentPage,
      this.respondentPageSize
    ).subscribe({
      next: (res) => {
        this.respondents = res.items;
        this.respondentTotal = res.total;
        this.respondentTotalPages = res.total_pages;
      }
    });
  }

  setRespondentFilter(status: string): void {
    this.respondentStatusFilter = status;
    this.respondentPage = 1;
    this.loadRespondents();
  }

  changeRespondentPage(delta: number): void {
    const target = this.respondentPage + delta;
    if (target >= 1 && target <= this.respondentTotalPages) {
      this.respondentPage = target;
      this.loadRespondents();
    }
  }

  get completionPercent(): number {
    if (!this.analytics || !this.analytics.target || this.analytics.target <= 0) return 0;
    return Math.min(100, (this.analytics.completed / this.analytics.target) * 100);
  }

  get quotasProgress(): any[] {
    return this.dashboardData?.quotas || [];
  }

  getQuotaPercent(q: any): number {
    if (!q.target || q.target <= 0) return 0;
    return Math.min(100, (q.done / q.target) * 100);
  }

  getTermPercent(count: number): number {
    if (!this.analytics || !this.analytics.terminated || this.analytics.terminated <= 0) return 0;
    return Math.min(100, (count / this.analytics.terminated) * 100);
  }

  getDropoffReachedPercent(reached: number): number {
    if (!this.analytics || !this.analytics.started || this.analytics.started <= 0) return 0;
    return Math.min(100, (reached / this.analytics.started) * 100);
  }

  get filteredQuestions(): any[] {
    if (!this.analytics || !this.analytics.question_analytics) return [];
    return this.analytics.question_analytics.filter(q => {
      if (this.selectedQuestionType !== 'ALL' && q.type !== this.selectedQuestionType) {
        return false;
      }
      if (this.questionSearchQuery.trim()) {
        const query = this.questionSearchQuery.toLowerCase();
        return q.id.toLowerCase().includes(query) || q.text.toLowerCase().includes(query);
      }
      return true;
    });
  }

  getNpsClass(score: number): string {
    if (score >= 50) return 'excellent';
    if (score >= 0) return 'good';
    return 'poor';
  }

  getMatrixColor(index: number): string {
    const isDark = this.themeService.isDark();
    const darkPalette = ['#6C7BFF', '#2DD4BF', '#A78BFA', '#E6C27A', '#F472B6', '#38BDF8'];
    const lightPalette = ['#4F5BD5', '#0E9F8E', '#7C5CE0', '#B8892E', '#F472B6', '#38BDF8'];
    const colors = isDark ? darkPalette : lightPalette;
    return colors[index % colors.length];
  }

  get isOverdue(): boolean {
    if (!this.analytics || this.analytics.days_left_to_deadline === null || this.analytics.days_left_to_deadline === undefined) return false;
    return this.analytics.days_left_to_deadline < 0;
  }

  get deadlineText(): string {
    if (!this.analytics || this.analytics.days_left_to_deadline === null || this.analytics.days_left_to_deadline === undefined) {
      return 'No deadline set';
    }
    if (this.analytics.days_left_to_deadline < 0) return 'Deadline expired';
    if (this.analytics.days_left_to_deadline === 0) return 'Due today';
    return `${this.analytics.days_left_to_deadline} days left`;
  }

  get lastUpdatedText(): string {
    return this.lastUpdated.toLocaleTimeString();
  }

  formatDuration(sec?: number | null): string {
    if (sec === null || sec === undefined) return '-';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  }

  saveDeadline(): void {
    if (!this.newDeadlineValue) return;
    this.isUpdatingDeadline = true;
    this.apiService.updateSurveyDeadline(this.surveyId, this.newDeadlineValue).subscribe({
      next: () => {
        this.isUpdatingDeadline = false;
        this.snackBar.open('Deadline updated successfully.', 'Close', { duration: 2500 });
        this.loadAllData(true);
      },
      error: () => {
        this.isUpdatingDeadline = false;
        this.snackBar.open('Could not update deadline.', 'Close', { duration: 3000 });
      }
    });
  }

  closeSurveyAdmin(): void {
    if (confirm('Are you sure you want to CLOSE this live survey? Further respondents will be prevented.')) {
      this.apiService.updateSurveyStatus(this.surveyId, 'CLOSED', 'ADMIN').subscribe({
        next: () => {
          this.snackBar.open('Survey has been closed.', 'Close', { duration: 2500 });
          this.loadAllData();
        },
        error: () => {
          this.snackBar.open('Could not close survey.', 'Close', { duration: 3000 });
        }
      });
    }
  }

  generateInviteTokens(): void {
    this.isGeneratingTokens = true;
    this.apiService.generateTokens(this.surveyId, this.tokenCountToGenerate).subscribe({
      next: (res) => {
        this.isGeneratingTokens = false;
        this.generatedTokens = res.tokens;
        this.snackBar.open(`Generated ${res.tokens.length} private invite tokens!`, 'Close', { duration: 3000 });
      },
      error: () => {
        this.isGeneratingTokens = false;
        this.snackBar.open('Could not generate tokens.', 'Close', { duration: 3000 });
      }
    });
  }

  copyAllTokens(): void {
    const urls = this.generatedTokens.map(t => t.url).join('\n');
    navigator.clipboard.writeText(urls);
    this.snackBar.open('All invite links copied to clipboard!', 'Close', { duration: 2500 });
  }

  exportFile(format: 'csv' | 'xlsx'): void {
    const observable = format === 'csv' 
      ? this.apiService.getExportCsv(this.surveyId) 
      : this.apiService.getExportXlsx(this.surveyId);

    observable.subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.analytics?.survey_slug || 'survey'}_export.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open(`Failed to download ${format.toUpperCase()} export.`, 'Close', { duration: 3000 });
      }
    });
  }

  getPublicUrl(): string {
    return `${window.location.origin}/s/${this.analytics?.survey_slug}`;
  }

  getWhatsAppShareUrl(): string {
    const url = this.getPublicUrl();
    const text = encodeURIComponent(`Hello! Please take our survey "${this.analytics?.survey_title}":\n${url}`);
    return `https://api.whatsapp.com/send?text=${text}`;
  }

  getEmailShareUrl(): string {
    const url = this.getPublicUrl();
    const subject = encodeURIComponent(`Survey Invitation: ${this.analytics?.survey_title}`);
    const body = encodeURIComponent(`Hello,\n\nYou have been invited to participate in the survey "${this.analytics?.survey_title}".\n\nPlease open this link to respond:\n${url}\n\nThank you!`);
    return `mailto:?subject=${subject}&body=${body}`;
  }

  copyLink(url: string): void {
    navigator.clipboard.writeText(url);
    this.snackBar.open('Link copied to clipboard!', 'Close', { duration: 2500 });
  }
}
