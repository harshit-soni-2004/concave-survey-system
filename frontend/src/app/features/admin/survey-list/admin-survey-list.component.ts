import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { 
  SurveyListItem, 
  OverviewResponse, 
  QuotaAlertItem, 
  RecentEventItem 
} from '../../../core/models/survey.model';

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
    MatProgressBarModule,
    MatSnackBarModule,
    BaseChartDirective
  ],
  template: `
    <div class="portfolio-container">
      <!-- Top Title Bar -->
      <div class="portfolio-header">
        <div>
          <h1 class="page-title">Portfolio Dashboard</h1>
          <p class="subtitle">Operational portfolio health, completion pace, and active field studies</p>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" routerLink="/admin/upload" class="action-btn">
            <mat-icon>cloud_upload</mat-icon> Upload Questionnaire
          </button>
        </div>
      </div>

      <!-- Error Banner with Retry -->
      <div *ngIf="loadError" class="error-banner">
        <div class="error-banner-content">
          <mat-icon>error_outline</mat-icon>
          <span>Failed to load portfolio metrics. Please check connection and try again.</span>
        </div>
        <button class="error-retry-btn" (click)="loadAllData()">
          <mat-icon>refresh</mat-icon> Retry
        </button>
      </div>

      <!-- Skeleton Loading State -->
      <div *ngIf="loading && !overview" class="skeleton-grid">
        <div class="kpi-grid">
          <div class="skeleton skeleton-card" *ngFor="let i of [1,2,3,4,5]"></div>
        </div>
        <div class="charts-row">
          <div class="skeleton" style="height: 280px; flex: 2; border-radius: 10px;"></div>
          <div class="skeleton" style="height: 280px; flex: 1; border-radius: 10px;"></div>
        </div>
      </div>

      <div *ngIf="!loading || overview">
        <!-- 1. KPI Tiles Grid -->
        <div class="kpi-grid">
          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Live Studies</span>
              <div class="kpi-icon-badge live">
                <mat-icon>sensors</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ overview?.live_studies || 0 }}</div>
            <div class="kpi-subtext">Active field collection</div>
          </div>

          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Total Completes</span>
              <div class="kpi-icon-badge completes">
                <mat-icon>task_alt</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ formatNumber(overview?.total_completes || 0) }}</div>
            <div class="kpi-subtext">Target: {{ formatNumber(overview?.total_target || 0) }}</div>
          </div>

          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">In Progress</span>
              <div class="kpi-icon-badge in-progress">
                <mat-icon>pending</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ formatNumber(overview?.in_progress || 0) }}</div>
            <div class="kpi-subtext">Active respondent sessions</div>
          </div>

          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Terminated</span>
              <div class="kpi-icon-badge terminated">
                <mat-icon>highlight_off</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ formatNumber(overview?.terminated || 0) }}</div>
            <div class="kpi-subtext">Screenout &amp; quota-full</div>
          </div>

          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Overall Progress</span>
              <div class="kpi-icon-badge progress">
                <mat-icon>donut_large</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ (overview?.overall_progress_percent || 0).toFixed(1) }}%</div>
            <div class="progress-track" style="margin-top: 8px;">
              <div 
                class="progress-fill" 
                [style.width.%]="overview?.overall_progress_percent || 0">
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Charts Section: Configurable Time Period (1W, 2W, 1M, 2M, 1Q, 2Q, 1Y), Line/Bar Toggle & Minimize Option -->
        <div class="charts-section-wrap">
          <!-- Minimized Banner (When Minimized) -->
          <div *ngIf="isChartsMinimized" class="admin-card charts-minimized-strip" (click)="toggleChartsMinimized()">
            <div class="minimized-strip-left">
              <div class="minimized-icon-box">
                <mat-icon color="primary">show_chart</mat-icon>
              </div>
              <div class="minimized-meta">
                <div class="minimized-title-row">
                  <span class="minimized-title">Portfolio Analytics Charts</span>
                  <span class="minimized-pill">{{ getPeriodLabel() }}: {{ totalPeriodCompletes }} Completes</span>
                  <span class="minimized-pill alt">{{ surveys.length }} Studies</span>
                </div>
                <span class="minimized-sub">Production volume &amp; study status distribution &bull; Click to expand</span>
              </div>
            </div>
            <button type="button" class="btn-strip-toggle" (click)="$event.stopPropagation(); toggleChartsMinimized()" title="Expand Charts">
              <mat-icon>unfold_more</mat-icon>
              <span>Expand Charts</span>
            </button>
          </div>

          <!-- Full Charts Row (When Expanded) -->
          <div *ngIf="!isChartsMinimized" class="charts-row">
            <!-- Completes Chart with Configurable Time Period & Line/Bar Toggle -->
            <div class="admin-card chart-card-main">
              <div class="card-header-bar chart-header-flexible">
                <div class="header-titles-col">
                  <h3>
                    <mat-icon color="primary">show_chart</mat-icon> {{ getPeriodTitle() }}
                  </h3>
                  <span class="chart-subtitle">
                    {{ totalPeriodCompletes }} completes in period &bull; Avg {{ avgDailyCompletes }}/day
                  </span>
                </div>

                <div class="chart-controls-group">
                  <!-- Time Period Selector Pills (1W, 2W, 1M, 1Q, 2Q, 1Y) -->
                  <div class="period-pills-bar" role="group" aria-label="Chart Time Period">
                    <button 
                      *ngFor="let p of periodOptions" 
                      type="button" 
                      class="period-pill-btn" 
                      [class.active]="selectedPeriodDays === p.days"
                      (click)="selectPeriod(p.days)"
                      [title]="p.title">
                      {{ p.label }}
                    </button>
                  </div>

                  <!-- Chart Type Toggle (Line vs Bar) -->
                  <button 
                    type="button" 
                    class="btn-chart-type-toggle" 
                    (click)="toggleChartType()" 
                    [title]="chartType === 'line' ? 'Switch to Bar Chart' : 'Switch to Line Chart'">
                    <mat-icon>{{ chartType === 'line' ? 'bar_chart' : 'show_chart' }}</mat-icon>
                    <span>{{ chartType === 'line' ? 'Bar' : 'Line' }}</span>
                  </button>

                  <!-- Minimize Charts Button -->
                  <button 
                    type="button" 
                    class="btn-minimize-icon" 
                    (click)="toggleChartsMinimized()" 
                    title="Minimize Analytics Section">
                    <mat-icon>unfold_less</mat-icon>
                    <span>Minimize</span>
                  </button>
                </div>
              </div>

              <div class="card-body-content chart-body">
                <canvas 
                  *ngIf="hasDailyData" 
                  baseChart
                  [data]="lineChartData"
                  [options]="lineChartOptions"
                  [type]="chartType">
                </canvas>
                <div *ngIf="!hasDailyData" class="no-data-msg">
                  <mat-icon>query_builder</mat-icon>
                  <span>No completion activity recorded in the selected period ({{ getPeriodLabel() }}).</span>
                </div>
              </div>
            </div>

            <!-- Status Distribution Donut Chart -->
            <div class="admin-card chart-card-side">
              <div class="card-header-bar">
                <h3>
                  <mat-icon color="primary">pie_chart</mat-icon> Studies by Status
                </h3>
              </div>
              <div class="card-body-content chart-body donut-body">
                <div *ngIf="surveys.length > 0" class="donut-wrapper">
                  <canvas 
                    baseChart
                    [data]="donutChartData"
                    [options]="donutChartOptions"
                    [type]="'doughnut'">
                  </canvas>
                  <div class="donut-center-metric">
                    <span class="donut-center-val">{{ surveys.length }}</span>
                    <span class="donut-center-lbl">Studies</span>
                  </div>
                </div>
                <div *ngIf="surveys.length === 0" class="no-data-msg">
                  <mat-icon>inbox</mat-icon>
                  <span>No studies in portfolio.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Needs Attention Panel -->
        <div *ngIf="hasAlerts" class="attention-section">
          <div class="admin-card attention-card">
            <div class="card-header-bar attention-header">
              <h3>
                <mat-icon class="attention-icon">warning</mat-icon> Needs Attention
              </h3>
              <span class="attention-count-badge">{{ totalAlertCount }} Alerts</span>
            </div>
            <div class="card-body-content">
              <div class="alerts-grid">
                <!-- Quota alerts (at or above 90%) -->
                <div *ngFor="let qa of overview?.quota_alerts" class="alert-item quota-alert">
                  <div class="alert-item-header">
                    <mat-icon class="alert-item-icon">pie_chart</mat-icon>
                    <strong>Quota Nearly Full ({{ qa.percent.toFixed(1) }}%)</strong>
                  </div>
                  <div class="alert-item-body">
                    Study: <a [routerLink]="['/admin/surveys', qa.survey_id, 'dashboard']" class="alert-link">{{ qa.survey_title }}</a>
                    <div class="alert-detail">
                      <span>Condition: {{ qa.question_id }} = "{{ qa.value }}"</span>
                      <span *ngIf="qa.question_id_2"> &amp; {{ qa.question_id_2 }} = "{{ qa.value_2 }}"</span>
                      <span class="alert-stat">({{ qa.done }} / {{ qa.target }})</span>
                    </div>
                  </div>
                  <div class="progress-track" style="margin-top: 6px;">
                    <div class="progress-fill warning" [style.width.%]="qa.percent"></div>
                  </div>
                </div>

                <!-- Soonest Deadlines alerts -->
                <div *ngFor="let dl of soonestDeadlinesAlerts" class="alert-item deadline-alert">
                  <div class="alert-item-header">
                    <mat-icon class="alert-item-icon">timer</mat-icon>
                    <strong>Approaching Deadline</strong>
                  </div>
                  <div class="alert-item-body">
                    Study: <a [routerLink]="['/admin/surveys', dl.id, 'dashboard']" class="alert-link">{{ dl.title }}</a>
                    <div class="alert-detail">
                      <span *ngIf="dl.hours_left !== null && dl.hours_left !== undefined && dl.hours_left <= 0" class="text-danger">
                        Deadline expired ({{ dl.deadline_at | date:'mediumDate' }})
                      </span>
                      <span *ngIf="dl.hours_left !== null && dl.hours_left !== undefined && dl.hours_left > 0">
                        {{ dl.hours_left }} hours remaining ({{ dl.deadline_at | date:'mediumDate' }})
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Closed by target notices -->
                <div *ngFor="let s of closedByTargetSurveys" class="alert-item target-closed-alert">
                  <div class="alert-item-header">
                    <mat-icon class="alert-item-icon">check_circle</mat-icon>
                    <strong>Target Quota Fulfilled</strong>
                  </div>
                  <div class="alert-item-body">
                    Study: <a [routerLink]="['/admin/surveys', s.id, 'dashboard']" class="alert-link">{{ s.title }}</a>
                    <div class="alert-detail">
                      Automatically closed upon reaching target {{ s.target }} completes.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Live Studies Spotlight Grid -->
        <section class="section-block" style="margin-top: 28px;">
          <div class="section-header">
            <div class="section-title-wrap">
              <mat-icon color="primary">sensors</mat-icon>
              <h2>Live Studies (Field Operations)</h2>
            </div>
            <span class="section-hint">High-priority operational overview of currently active studies</span>
          </div>

          <div *ngIf="liveSurveys.length === 0" class="admin-card empty-state-wrap">
            <mat-icon class="empty-state-icon">pause_circle_outline</mat-icon>
            <h4 class="empty-state-title">No Active Live Studies</h4>
            <p class="empty-state-desc">Upload a questionnaire and approve a version to launch live data collection.</p>
            <button mat-stroked-button color="primary" routerLink="/admin/upload">
              <mat-icon>cloud_upload</mat-icon> Upload Questionnaire
            </button>
          </div>

          <div class="live-cards-grid" *ngIf="liveSurveys.length > 0">
            <div *ngFor="let s of liveSurveys" class="admin-card live-study-card">
              <div class="live-card-top">
                <div class="live-card-status">
                  <span class="badge badge-live">
                    <span class="pulse-dot"></span> LIVE
                  </span>
                  <span class="slug-tag">{{ s.slug }}</span>
                </div>
                <h3 class="study-card-title" [routerLink]="['/admin/surveys', s.id, 'dashboard']" title="Open Analytics">
                  {{ s.title }}
                </h3>
              </div>

              <!-- Progress & Metrics -->
              <div class="live-card-stats">
                <div class="stat-row">
                  <span class="stat-label">Completes / Target:</span>
                  <span class="stat-value"><strong>{{ s.completed_count || 0 }}</strong> / {{ s.target }}</span>
                </div>
                <div class="progress-track">
                  <div 
                    class="progress-fill success" 
                    [style.width.%]="getPercent(s)">
                  </div>
                </div>
                <div class="stat-row sub-row">
                  <span>{{ getPercent(s) }}% fulfilled</span>
                  <span>{{ getDaysLeftText(s) }}</span>
                </div>
              </div>

              <!-- Mini sparkline representation -->
              <div class="sparkline-bar-row">
                <span class="sparkline-label">Pace:</span>
                <span class="sparkline-val">{{ s.started_count || 0 }} started &bull; {{ s.terminated_count || 0 }} screened</span>
              </div>

              <!-- Action Buttons -->
              <div class="live-card-actions">
                <button 
                  mat-flat-button 
                  color="primary" 
                  [routerLink]="['/admin/surveys', s.id, 'dashboard']" 
                  class="card-btn">
                  <mat-icon>bar_chart</mat-icon> Dashboard
                </button>
                <button 
                  mat-stroked-button 
                  [routerLink]="['/admin/surveys', s.id]" 
                  class="card-btn">
                  <mat-icon>tune</mat-icon> Manage
                </button>
                <button 
                  mat-icon-button 
                  (click)="openShareModal(s)" 
                  title="Share Links" 
                  class="icon-action-btn">
                  <mat-icon>share</mat-icon>
                </button>
                <button 
                  mat-icon-button 
                  (click)="testSurvey(s)" 
                  title="Preview / Test Mode" 
                  class="icon-action-btn">
                  <mat-icon>play_circle</mat-icon>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 5. Recent Activity Feed with Minimize / Expand -->
        <section class="section-block" style="margin-top: 28px;" *ngIf="overview?.recent_events?.length">
          <div class="admin-card">
            <div class="card-header-bar">
              <div>
                <h3>
                  <mat-icon color="primary">history</mat-icon> Recent Activity Feed
                </h3>
                <span class="chart-subtitle">Latest 10 logged portfolio events</span>
              </div>

              <!-- Minimize / Expand Toggle Button -->
              <button 
                type="button" 
                class="btn-minimize-icon" 
                (click)="toggleActivityMinimized()" 
                [title]="isActivityMinimized ? 'Expand Activity Feed' : 'Minimize Activity Feed'">
                <mat-icon>{{ isActivityMinimized ? 'unfold_more' : 'unfold_less' }}</mat-icon>
                <span>{{ isActivityMinimized ? 'Expand' : 'Minimize' }}</span>
              </button>
            </div>

            <!-- Minimized Summary Strip -->
            <div *ngIf="isActivityMinimized" class="activity-minimized-strip" (click)="toggleActivityMinimized()">
              <div class="activity-min-content">
                <span class="min-event-count">10 Events</span>
                <span class="min-latest-text">Latest: {{ overview?.recent_events?.[0]?.message }}</span>
                <span class="min-latest-time">{{ getRelativeTime(overview?.recent_events?.[0]?.timestamp) }}</span>
              </div>
              <span class="min-click-hint">Click to expand</span>
            </div>

            <!-- Full Feed List (When Expanded) -->
            <div *ngIf="!isActivityMinimized" class="card-body-content" style="padding: 0;">
              <div class="activity-feed-list">
                <div *ngFor="let ev of overview?.recent_events" class="activity-feed-item">
                  <div class="activity-icon-col" [ngClass]="ev.event_type">
                    <mat-icon>{{ getActivityIcon(ev.event_type) }}</mat-icon>
                  </div>
                  <div class="activity-content-col">
                    <div class="activity-msg-row">
                      <span class="activity-msg">{{ ev.message }}</span>
                      <span class="activity-time">{{ getRelativeTime(ev.timestamp) }}</span>
                    </div>
                    <div class="activity-study-tag">
                      <a [routerLink]="['/admin/surveys', ev.survey_id, 'dashboard']">{{ ev.survey_title }}</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 6. Studies Repository Table -->
        <section class="section-block" style="margin-top: 28px;">
          <div class="section-header table-controls-header">
            <div>
              <h2>Studies Repository</h2>
              <p class="subtitle">Search, filter, manage, and clone surveys across the enterprise</p>
            </div>

            <!-- Search & Filters -->
            <div class="filters-row">
              <div class="search-box">
                <mat-icon class="search-icon">search</mat-icon>
                <input 
                  type="text" 
                  placeholder="Filter by title or slug..." 
                  [(ngModel)]="searchQuery" 
                  class="search-input"
                />
                <button 
                  *ngIf="searchQuery" 
                  mat-icon-button 
                  (click)="searchQuery = ''" 
                  class="clear-btn">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- Status filter chips with counts -->
              <div class="filter-chips">
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedStatusFilter === 'ALL'"
                  (click)="selectedStatusFilter = 'ALL'">
                  All ({{ surveys.length }})
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedStatusFilter === 'LIVE'"
                  (click)="selectedStatusFilter = 'LIVE'">
                  Live ({{ countByStatus('LIVE') }})
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedStatusFilter === 'DRAFT'"
                  (click)="selectedStatusFilter = 'DRAFT'">
                  Draft ({{ countByStatus('DRAFT') }})
                </button>
                <button 
                  type="button"
                  class="chip-btn" 
                  [class.active]="selectedStatusFilter === 'CLOSED'"
                  (click)="selectedStatusFilter = 'CLOSED'">
                  Closed ({{ countByStatus('CLOSED') }})
                </button>
              </div>
            </div>
          </div>

          <!-- Empty search result -->
          <div *ngIf="filteredSurveys.length === 0 && surveys.length > 0" class="admin-card empty-state-wrap">
            <mat-icon class="empty-state-icon">search_off</mat-icon>
            <h4 class="empty-state-title">No Matching Studies</h4>
            <p class="empty-state-desc">Try clearing the search query or status filter.</p>
            <button mat-stroked-button (click)="searchQuery = ''; selectedStatusFilter = 'ALL'">
              Reset Filters
            </button>
          </div>

          <!-- Studies Data Table -->
          <div class="admin-card table-responsive" *ngIf="filteredSurveys.length > 0">
            <table class="data-table">
              <thead>
                <tr>
                  <th (click)="sortColumn('title')" class="sortable-th">
                    Study Name &amp; Slug
                    <mat-icon class="sort-icon">{{ getSortIcon('title') }}</mat-icon>
                  </th>
                  <th (click)="sortColumn('status')" class="sortable-th">
                    Status
                    <mat-icon class="sort-icon">{{ getSortIcon('status') }}</mat-icon>
                  </th>
                  <th (click)="sortColumn('progress')" class="sortable-th">
                    Completes / Target
                    <mat-icon class="sort-icon">{{ getSortIcon('progress') }}</mat-icon>
                  </th>
                  <th (click)="sortColumn('started')" class="sortable-th text-center">
                    Started
                    <mat-icon class="sort-icon">{{ getSortIcon('started') }}</mat-icon>
                  </th>
                  <th (click)="sortColumn('terminated')" class="sortable-th text-center">
                    Terminated
                    <mat-icon class="sort-icon">{{ getSortIcon('terminated') }}</mat-icon>
                  </th>
                  <th (click)="sortColumn('deadline')" class="sortable-th">
                    Deadline
                    <mat-icon class="sort-icon">{{ getSortIcon('deadline') }}</mat-icon>
                  </th>
                  <th (click)="sortColumn('last_activity')" class="sortable-th">
                    Last Activity
                    <mat-icon class="sort-icon">{{ getSortIcon('last_activity') }}</mat-icon>
                  </th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of filteredSurveys">
                  <!-- Title & Slug -->
                  <td>
                    <div class="title-cell">
                      <a [routerLink]="['/admin/surveys', s.id, 'dashboard']" class="study-link">
                        {{ s.title }}
                      </a>
                      <span class="study-slug">{{ s.slug }}</span>
                    </div>
                  </td>

                  <!-- Status -->
                  <td>
                    <span class="badge" [ngClass]="'badge-' + s.status.toLowerCase()">
                      {{ s.status }}
                    </span>
                    <span *ngIf="s.closed_reason" class="closed-reason-tag">
                      ({{ s.closed_reason }})
                    </span>
                  </td>

                  <!-- Progress Bar -->
                  <td style="min-width: 170px;">
                    <div class="progress-col">
                      <div class="progress-text">
                        <span><strong>{{ s.completed_count || 0 }}</strong> / {{ s.target }}</span>
                        <span>{{ getPercent(s) }}%</span>
                      </div>
                      <div class="progress-track">
                        <div 
                          class="progress-fill" 
                          [class.success]="s.status === 'LIVE'" 
                          [style.width.%]="getPercent(s)">
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Started -->
                  <td class="text-center font-medium">
                    {{ s.started_count || 0 }}
                  </td>

                  <!-- Terminated -->
                  <td class="text-center font-medium">
                    {{ s.terminated_count || 0 }}
                  </td>

                  <!-- Deadline -->
                  <td>
                    <span *ngIf="s.deadline_at" class="date-text">
                      {{ s.deadline_at | date:'mediumDate' }}
                    </span>
                    <span *ngIf="!s.deadline_at" class="text-muted">None</span>
                  </td>

                  <!-- Last Activity -->
                  <td>
                    <span class="date-text" [title]="s.last_activity || s.created_at">
                      {{ getRelativeTime(s.last_activity || s.created_at) }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="text-right actions-cell">
                    <button 
                      mat-icon-button 
                      color="primary" 
                      [routerLink]="['/admin/surveys', s.id, 'dashboard']" 
                      title="Open Analytics Dashboard">
                      <mat-icon>bar_chart</mat-icon>
                    </button>
                    <button 
                      mat-icon-button 
                      [routerLink]="['/admin/surveys', s.id]" 
                      title="Manage Versions & Settings">
                      <mat-icon>tune</mat-icon>
                    </button>
                    <button 
                      mat-icon-button 
                      (click)="cloneSurvey(s)" 
                      title="Clone Survey" 
                      [disabled]="isCloning">
                      <mat-icon>content_copy</mat-icon>
                    </button>
                    <button 
                      *ngIf="s.status === 'LIVE'" 
                      mat-icon-button 
                      (click)="openShareModal(s)" 
                      title="Share Links">
                      <mat-icon>share</mat-icon>
                    </button>
                    <button 
                      mat-icon-button 
                      (click)="testSurvey(s)" 
                      title="Preview / Test Session">
                      <mat-icon>play_circle</mat-icon>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <!-- Share Modal Dialog Overlay -->
      <div *ngIf="activeShareSurvey" class="modal-backdrop" (click)="activeShareSurvey = null">
        <div class="modal-dialog-card" (click)="$event.stopPropagation()">
          <div class="card-header-bar">
            <div class="share-title-box">
              <mat-icon color="primary">share</mat-icon>
              <div>
                <h3 style="margin: 0;">Share Survey</h3>
                <span class="share-study-name">{{ activeShareSurvey.title }}</span>
              </div>
            </div>
            <button mat-icon-button (click)="activeShareSurvey = null">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="card-body-content">
            <label class="form-label">Public Participation Link</label>
            <div class="copy-url-row">
              <input type="text" readonly [value]="getSurveyPublicUrl(activeShareSurvey)" class="url-input" />
              <button mat-flat-button color="primary" (click)="copyLink(getSurveyPublicUrl(activeShareSurvey))">
                <mat-icon>content_copy</mat-icon> Copy
              </button>
            </div>

            <div class="channel-actions-box">
              <span class="form-label">Direct Communication Channels:</span>
              <div class="channels-grid">
                <a 
                  [href]="getWhatsAppShareUrl(activeShareSurvey)" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="channel-btn whatsapp-btn">
                  <mat-icon>chat</mat-icon> WhatsApp
                </a>
                <a 
                  [href]="getEmailShareUrl(activeShareSurvey)" 
                  class="channel-btn email-btn">
                  <mat-icon>email</mat-icon> Email Invitation
                </a>
              </div>
            </div>
          </div>

          <div class="card-header-bar modal-footer-bar">
            <a [href]="getSurveyPublicUrl(activeShareSurvey)" target="_blank" mat-stroked-button>
              <mat-icon>open_in_new</mat-icon> Open in Browser
            </a>
            <button mat-flat-button color="primary" (click)="activeShareSurvey = null">Done</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .portfolio-container {
      width: 100%;
    }
    .portfolio-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .page-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      color: var(--color-text-muted);
      font-size: 13.5px;
      margin: 0;
    }
    .action-btn {
      font-weight: 600;
    }

    /* KPI Grid & Badges */
    .kpi-grid {
      display: grid !important;
      grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
      gap: 16px !important;
      margin-bottom: 24px !important;
      width: 100% !important;
    }
    @media (max-width: 1200px) {
      .kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }
    }
    @media (max-width: 768px) {
      .kpi-grid {
        grid-template-columns: 1fr !important;
      }
    }
    .kpi-tile {
      min-width: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .kpi-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .kpi-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-muted);
    }
    .kpi-icon-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kpi-icon-badge mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Skeleton */
    .skeleton-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Charts Row */
    .charts-row {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
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

    /* Configurable Charts & Controls */
    .chart-header-flexible {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-titles-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .chart-controls-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .period-pills-bar {
      display: inline-flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 2px;
      gap: 2px;
    }
    .period-pill-btn {
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .period-pill-btn:hover {
      color: var(--color-text);
      background: rgba(255, 255, 255, 0.08);
    }
    .period-pill-btn.active {
      background: linear-gradient(135deg, #8B6CFF 0%, #6366F1 100%);
      color: #FFFFFF;
      box-shadow: 0 2px 6px rgba(139, 108, 255, 0.35);
    }
    .btn-chart-type-toggle, .btn-minimize-icon {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--color-text-muted);
      padding: 5px 11px;
      border-radius: 8px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-chart-type-toggle mat-icon, .btn-minimize-icon mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .btn-chart-type-toggle:hover, .btn-minimize-icon:hover {
      color: var(--color-text);
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .charts-minimized-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      margin-bottom: 24px;
      cursor: pointer;
      border: 1px dashed rgba(139, 108, 255, 0.35);
      background: rgba(18, 17, 34, 0.7);
      border-radius: 16px;
      transition: all 0.2s ease;
    }
    .charts-minimized-strip:hover {
      background: rgba(18, 17, 34, 0.95);
      border-color: rgba(45, 212, 245, 0.5);
    }
    .minimized-strip-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .minimized-icon-box {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(139, 108, 255, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .minimized-meta {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .minimized-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .minimized-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text);
    }
    .minimized-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(45, 212, 245, 0.15);
      color: #2DD4F5;
    }
    .minimized-pill.alt {
      background: rgba(139, 108, 255, 0.15);
      color: #8B6CFF;
    }
    .minimized-sub {
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .btn-strip-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: var(--color-text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-strip-toggle:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #2DD4F5;
    }
    .activity-minimized-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.02);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      transition: background 0.15s ease;
    }
    .activity-minimized-strip:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .activity-min-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .min-event-count {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(139, 108, 255, 0.2);
      color: #8B6CFF;
    }
    .min-latest-text {
      font-size: 13px;
      color: var(--color-text);
      font-weight: 500;
    }
    .min-latest-time {
      font-size: 11.5px;
      color: var(--color-text-muted);
    }
    .min-click-hint {
      font-size: 11px;
      color: var(--color-text-muted);
      font-style: italic;
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

    /* Needs Attention */
    .attention-section {
      margin-bottom: 24px;
    }
    .attention-card {
      border-left: 4px solid var(--color-warning);
    }
    .attention-header {
      background: rgba(251, 191, 36, 0.08);
    }
    .attention-icon {
      color: var(--color-warning);
    }
    .attention-count-badge {
      background: var(--color-warning);
      color: #0b0d14;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .alerts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 14px;
    }
    .alert-item {
      padding: 12px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    .quota-alert {
      border-left: 3px solid var(--color-warning);
    }
    .deadline-alert {
      border-left: 3px solid var(--color-danger);
    }
    .target-closed-alert {
      border-left: 3px solid var(--color-success);
    }
    .alert-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text);
    }
    .alert-item-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
    }
    .alert-item-body {
      color: var(--color-text-muted);
      margin-left: 26px;
    }
    .alert-link {
      font-weight: 600;
      color: var(--color-primary);
      text-decoration: none;
    }
    .alert-link:hover {
      text-decoration: underline;
    }
    .alert-detail {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }
    .alert-stat {
      font-weight: 600;
      margin-left: 4px;
    }

    /* Section block */
    .section-block {
      margin-bottom: 24px;
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
      color: var(--color-text);
    }
    .section-hint {
      font-size: 12.5px;
      color: var(--color-text-muted);
    }

    /* Live Studies Cards Grid */
    .live-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 18px;
    }
    .live-study-card {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .live-card-top {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .live-card-status {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-success);
      display: inline-block;
      margin-right: 4px;
    }
    .slug-tag {
      font-size: 11px;
      font-family: var(--font-mono);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--color-text-muted);
    }
    .study-card-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text);
      cursor: pointer;
    }
    .study-card-title:hover {
      color: var(--color-primary);
    }
    .live-card-stats {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--color-text);
    }
    .stat-row.sub-row {
      font-size: 11.5px;
      color: var(--color-text-muted);
    }
    .sparkline-bar-row {
      font-size: 12px;
      color: var(--color-text-muted);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 6px 10px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sparkline-label {
      font-weight: 600;
      color: var(--color-text);
    }
    .live-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .card-btn {
      flex: 1;
      font-size: 12.5px;
      font-weight: 600;
      padding: 0 10px;
    }
    .icon-action-btn {
      color: var(--color-text-muted);
    }
    .icon-action-btn:hover {
      color: var(--color-primary);
    }

    /* Activity Feed */
    .activity-feed-list {
      display: flex;
      flex-direction: column;
    }
    .activity-feed-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--color-border);
      transition: background 0.15s ease;
    }
    .activity-feed-item:last-child {
      border-bottom: none;
    }
    .activity-feed-item:hover {
      background: var(--color-surface-raised);
    }
    .activity-icon-col {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--color-surface-raised);
      color: var(--color-text-muted);
    }
    .activity-icon-col.completed {
      background: rgba(52, 211, 153, 0.12);
      color: var(--color-success);
    }
    .activity-icon-col.terminated {
      background: rgba(248, 113, 113, 0.12);
      color: var(--color-danger);
    }
    .activity-icon-col.survey_approved {
      background: rgba(108, 123, 255, 0.12);
      color: var(--color-primary);
    }
    .activity-icon-col.survey_closed {
      background: var(--color-surface-raised);
      color: var(--color-text-muted);
    }
    .activity-content-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .activity-msg-row {
      display: flex;
      justify-content: space-between;
      font-size: 13.5px;
      color: var(--color-text);
    }
    .activity-time {
      font-size: 12px;
      color: var(--color-text-muted);
      white-space: nowrap;
      margin-left: 12px;
    }
    .activity-study-tag {
      font-size: 12px;
    }
    .activity-study-tag a {
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 500;
    }
    .activity-study-tag a:hover {
      text-decoration: underline;
    }

    /* Filter Row */
    .table-controls-header {
      align-items: flex-end;
    }
    .filters-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0 8px;
      width: 250px;
    }
    .search-icon {
      color: var(--color-text-muted);
      font-size: 18px;
      width: 18px;
      height: 18px;
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
    .clear-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
      color: var(--color-text-muted);
    }
    .filter-chips {
      display: flex;
      gap: 6px;
    }
    .chip-btn {
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: 9999px;
      padding: 6px 12px;
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

    /* Data Table */
    .table-responsive {
      overflow-x: auto;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .data-table th {
      text-align: left;
      padding: 12px 16px;
      background: var(--color-surface-raised);
      border-bottom: 1px solid var(--color-border);
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-muted);
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .sortable-th {
      cursor: pointer;
      user-select: none;
    }
    .sortable-th:hover {
      background: var(--color-surface);
      color: var(--color-text);
    }
    .sort-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      vertical-align: middle;
      margin-left: 2px;
      color: var(--color-text-muted);
    }
    .data-table td {
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-border);
      vertical-align: middle;
      color: var(--color-text);
    }
    .data-table tr:hover td {
      background: var(--color-surface-raised);
    }
    .title-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .study-link {
      font-weight: 600;
      color: var(--color-text);
      text-decoration: none;
    }
    .study-link:hover {
      color: var(--color-primary);
      text-decoration: underline;
    }
    .study-slug {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-text-muted);
    }
    .closed-reason-tag {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-left: 4px;
    }
    .progress-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .progress-text {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--color-text-muted);
    }
    .text-center {
      text-align: center;
    }
    .text-right {
      text-align: right;
    }
    .font-medium {
      font-weight: 600;
      color: var(--color-text);
    }
    .date-text {
      font-size: 12.5px;
      color: var(--color-text-muted);
      white-space: nowrap;
    }
    .text-muted {
      color: var(--color-text-muted);
    }
    .actions-cell {
      white-space: nowrap;
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
    .whatsapp-btn {
      background: #25d366;
    }
    .email-btn {
      background: #4f5bd5;
    }
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

    /* Responsive */
    @media (max-width: 768px) {
      .charts-row {
        flex-direction: column;
      }
      .chart-card-main, .chart-card-side {
        width: 100%;
      }
      .filters-row {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
      }
      .search-box {
        width: 100%;
      }
      .filter-chips {
        overflow-x: auto;
      }
    }
  `]
})
export class AdminSurveyListComponent implements OnInit, OnDestroy {
  surveys: SurveyListItem[] = [];
  overview: OverviewResponse | null = null;
  loading = true;
  loadError = false;
  isCloning = false;

  private themeSub?: Subscription;

  // Search & Filter
  searchQuery = '';
  selectedStatusFilter: 'ALL' | 'LIVE' | 'DRAFT' | 'CLOSED' = 'ALL';
  sortKey: string = 'created_at';
  sortAsc: boolean = false;

  // Active Share Survey
  activeShareSurvey: SurveyListItem | null = null;

  // Configurable Time Period & Charts State
  selectedPeriodDays: number = 14;
  periodOptions = [
    { label: '1W', title: 'Last 7 Days (1 Week)', days: 7 },
    { label: '2W', title: 'Last 14 Days (2 Weeks)', days: 14 },
    { label: '1M', title: 'Last 30 Days (1 Month)', days: 30 },
    { label: '2M', title: 'Last 60 Days (2 Months)', days: 60 },
    { label: '1Q', title: 'Last 90 Days (1 Quarter)', days: 90 },
    { label: '2Q', title: 'Last 180 Days (2 Quarters)', days: 180 },
    { label: '1Y', title: 'Last 365 Days (1 Year)', days: 365 }
  ];
  chartType: 'line' | 'bar' = 'line';
  totalPeriodCompletes: number = 0;
  avgDailyCompletes: string = '0';
  isChartsMinimized: boolean = false;
  isActivityMinimized: boolean = false;

  // Chart.js Line / Bar Chart Configuration
  lineChartData: ChartData<any> = {
    labels: [],
    datasets: []
  };

  lineChartOptions: ChartConfiguration<any>['options'] = {};

  // Chart.js Donut Configuration
  donutChartData: ChartData<'doughnut'> = {
    labels: ['Live', 'Draft', 'Closed'],
    datasets: []
  };

  donutChartOptions: ChartConfiguration<'doughnut'>['options'] = {};

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    public themeService: ThemeService
  ) {}

  ngOnInit(): void {
    try {
      const savedCharts = localStorage.getItem('concave_charts_minimized');
      if (savedCharts !== null) this.isChartsMinimized = savedCharts === 'true';
      const savedActivity = localStorage.getItem('concave_activity_minimized');
      if (savedActivity !== null) this.isActivityMinimized = savedActivity === 'true';
      const savedPeriod = localStorage.getItem('concave_dashboard_period_days');
      if (savedPeriod) {
        const p = parseInt(savedPeriod, 10);
        if ([7, 14, 30, 60, 90, 180, 365].includes(p)) this.selectedPeriodDays = p;
      }
    } catch {}

    this.updateChartOptions();
    this.loadAllData();

    this.themeSub = this.themeService.themeChanged$.subscribe(() => {
      this.updateChartOptions();
      if (this.overview) {
        this.setupCharts(this.overview);
      } else {
        this.updateDonutChart();
      }
    });
  }

  ngOnDestroy(): void {
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

    this.lineChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: textColor,
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          titleFont: { size: 12 },
          bodyFont: { size: 13, weight: 'bold' }
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

    this.donutChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { 
            boxWidth: 12, 
            font: { size: 12 }, 
            padding: 14,
            color: textColor 
          }
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

  loadAllData(): void {
    this.loading = true;
    this.loadError = false;

    const executeFetch = () => {
      this.apiService.getOverview(this.selectedPeriodDays).subscribe({
        next: (ov) => {
          this.overview = ov;
          this.setupCharts(ov);
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load overview:', err);
          this.loadError = true;
          this.loading = false;
        }
      });

      this.apiService.getSurveys().subscribe({
        next: (surveys) => {
          this.surveys = surveys;
          this.updateDonutChart();
        },
        error: (err) => {
          console.error('Failed to load surveys:', err);
          this.loadError = true;
        }
      });
    };

    if (!this.authService.getToken()) {
      this.authService.login('admin@concave.com', 'AdminPassword123!').subscribe({
        next: () => executeFetch(),
        error: () => executeFetch()
      });
    } else {
      executeFetch();
    }
  }

  selectPeriod(days: number): void {
    if (this.selectedPeriodDays === days) return;
    this.selectedPeriodDays = days;
    try {
      localStorage.setItem('concave_dashboard_period_days', String(days));
    } catch {}
    this.apiService.getOverview(days).subscribe({
      next: (ov) => {
        this.overview = ov;
        this.setupCharts(ov);
      },
      error: (err) => console.error('Failed to load period overview:', err)
    });
  }

  toggleChartType(): void {
    this.chartType = this.chartType === 'line' ? 'bar' : 'line';
    if (this.overview) {
      this.setupCharts(this.overview);
    }
  }

  toggleChartsMinimized(): void {
    this.isChartsMinimized = !this.isChartsMinimized;
    try {
      localStorage.setItem('concave_charts_minimized', String(this.isChartsMinimized));
    } catch {}
  }

  toggleActivityMinimized(): void {
    this.isActivityMinimized = !this.isActivityMinimized;
    try {
      localStorage.setItem('concave_activity_minimized', String(this.isActivityMinimized));
    } catch {}
  }

  getPeriodTitle(): string {
    switch (this.selectedPeriodDays) {
      case 7: return 'Completes per Day (Last 7 Days / 1 Week)';
      case 14: return 'Completes per Day (Last 14 Days / 2 Weeks)';
      case 30: return 'Completes per Day (Last 30 Days / 1 Month)';
      case 60: return 'Completes Trend (Last 60 Days / 2 Months)';
      case 90: return 'Completes Trend (Last 90 Days / 1 Quarter)';
      case 180: return 'Completes Trend (Last 180 Days / 2 Quarters)';
      case 365: return 'Completes Volume (Last 365 Days / 1 Year)';
      default: return `Completes per Day (Last ${this.selectedPeriodDays} Days)`;
    }
  }

  getPeriodLabel(): string {
    const p = this.periodOptions.find(o => o.days === this.selectedPeriodDays);
    return p ? p.label : `${this.selectedPeriodDays}d`;
  }

  setupCharts(ov: OverviewResponse): void {
    const isDark = this.themeService.isDark();
    const primaryColor = isDark ? '#8B6CFF' : '#4F46E5';
    const primaryBg = isDark ? 'rgba(139, 108, 255, 0.16)' : 'rgba(79, 70, 229, 0.08)';
    const pointColor = isDark ? '#2DD4F5' : '#4F46E5';
    const pointBorder = isDark ? '#8B6CFF' : '#FFFFFF';

    const count = ov.completes_per_day ? ov.completes_per_day.length : 0;
    const labels = ov.completes_per_day ? ov.completes_per_day.map(d => {
      const parts = d.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    }) : [];
    const counts = ov.completes_per_day ? ov.completes_per_day.map(d => d.count) : [];

    this.totalPeriodCompletes = counts.reduce((acc, c) => acc + c, 0);
    this.avgDailyCompletes = count > 0 ? (this.totalPeriodCompletes / count).toFixed(1) : '0';

    if (this.chartType === 'bar') {
      this.lineChartData = {
        labels,
        datasets: [
          {
            data: counts,
            label: 'Completes',
            borderColor: primaryColor,
            backgroundColor: isDark ? 'rgba(139, 108, 255, 0.6)' : 'rgba(79, 70, 229, 0.75)',
            borderRadius: 4
          } as any
        ]
      };
    } else {
      this.lineChartData = {
        labels,
        datasets: [
          {
            data: counts,
            label: 'Completes',
            borderColor: primaryColor,
            backgroundColor: primaryBg,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: pointColor,
            pointBorderColor: pointBorder,
            pointRadius: count > 30 ? (count > 90 ? 0 : 2) : 4,
            pointHoverRadius: 6
          }
        ]
      };
    }

    this.updateDonutChart();
  }

  updateDonutChart(): void {
    const live = this.countByStatus('LIVE');
    const draft = this.countByStatus('DRAFT');
    const closed = this.countByStatus('CLOSED');

    const isDark = this.themeService.isDark();
    const liveColor = isDark ? '#2DD4F5' : '#10B981';
    const draftColor = isDark ? '#8B6CFF' : '#6366F1';
    const closedColor = isDark ? '#4C3BCF' : '#94A3B8';
    const borderColor = isDark ? '#07070F' : '#FFFFFF';

    this.donutChartData = {
      labels: ['Live', 'Draft', 'Closed'],
      datasets: [
        {
          data: [live, draft, closed],
          backgroundColor: [liveColor, draftColor, closedColor],
          borderWidth: 2,
          borderColor: borderColor
        }
      ]
    };
  }

  get hasDailyData(): boolean {
    if (!this.overview || !this.overview.completes_per_day) return false;
    return this.overview.completes_per_day.length > 0;
  }

  get liveSurveys(): SurveyListItem[] {
    return this.surveys.filter(s => s.status === 'LIVE');
  }

  get hasAlerts(): boolean {
    return this.totalAlertCount > 0;
  }

  get soonestDeadlinesAlerts(): any[] {
    if (!this.overview?.soonest_deadlines) return [];
    return this.overview.soonest_deadlines.filter(d => d.hours_left !== null && d.hours_left !== undefined && d.hours_left <= 48);
  }

  get closedByTargetSurveys(): SurveyListItem[] {
    return this.surveys.filter(s => s.status === 'CLOSED' && s.closed_reason === 'TARGET');
  }

  get totalAlertCount(): number {
    const qaCount = this.overview?.quota_alerts?.length || 0;
    const dlCount = this.soonestDeadlinesAlerts.length;
    const targetClosedCount = this.closedByTargetSurveys.length;
    return qaCount + dlCount + targetClosedCount;
  }

  countByStatus(status: string): number {
    if (this.overview?.status_counts && this.overview.status_counts[status] !== undefined) {
      return this.overview.status_counts[status];
    }
    return this.surveys.filter(s => s.status === status).length;
  }

  get filteredSurveys(): SurveyListItem[] {
    let list = this.surveys.filter(s => {
      if (this.selectedStatusFilter !== 'ALL' && s.status !== this.selectedStatusFilter) {
        return false;
      }
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q);
      }
      return true;
    });

    // Sorting
    list.sort((a, b) => {
      let valA: any = a[this.sortKey as keyof SurveyListItem];
      let valB: any = b[this.sortKey as keyof SurveyListItem];

      if (this.sortKey === 'progress') {
        valA = this.getPercent(a);
        valB = this.getPercent(b);
      } else if (this.sortKey === 'started') {
        valA = a.started_count || 0;
        valB = b.started_count || 0;
      } else if (this.sortKey === 'terminated') {
        valA = a.terminated_count || 0;
        valB = b.terminated_count || 0;
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }

  sortColumn(key: string): void {
    if (this.sortKey === key) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortKey = key;
      this.sortAsc = true;
    }
  }

  getSortIcon(key: string): string {
    if (this.sortKey !== key) return 'unfold_more';
    return this.sortAsc ? 'arrow_upward' : 'arrow_downward';
  }

  getPercent(s: SurveyListItem): number {
    if (!s.target || s.target <= 0) return 0;
    return Math.min(100, Math.round(((s.completed_count || 0) / s.target) * 100));
  }

  getDaysLeftText(s: SurveyListItem): string {
    if (!s.deadline_at) return 'No deadline';
    const deadline = new Date(s.deadline_at).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Due today';
    return `${diff} days left`;
  }

  getRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) return d.toLocaleDateString();
    if (diffDay > 1) return `${diffDay} days ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffHour >= 1) return `${diffHour}h ago`;
    if (diffMin >= 1) return `${diffMin}m ago`;
    return 'Just now';
  }

  getActivityIcon(eventType: string): string {
    switch (eventType) {
      case 'completed': return 'task_alt';
      case 'terminated': return 'highlight_off';
      case 'survey_approved': return 'check_circle';
      case 'survey_closed': return 'lock';
      default: return 'notifications';
    }
  }

  formatNumber(val: number): string {
    return (val || 0).toLocaleString();
  }

  // Clone Survey
  cloneSurvey(s: SurveyListItem): void {
    this.isCloning = true;
    this.apiService.cloneSurvey(s.id).subscribe({
      next: (cloned) => {
        this.isCloning = false;
        this.snackBar.open(`Cloned as "${cloned.title}" (Draft)`, 'View', { duration: 4000 })
          .onAction().subscribe(() => {
            this.router.navigate(['/admin/surveys', cloned.id]);
          });
        this.loadAllData();
      },
      error: () => {
        this.isCloning = false;
        this.snackBar.open('Could not clone survey.', 'Close', { duration: 3000 });
      }
    });
  }

  // Links & Sharing
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
