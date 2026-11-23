import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { 
  SurveyListItem, 
  SurveyAnalyticsResponse 
} from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="analytics-hub-container">
      <!-- Top Title & Study Selector Banner -->
      <header class="hub-header-card admin-card">
        <div class="header-main-row">
          <div class="header-left">
            <div class="badge-row">
              <span class="hub-pill">
                <mat-icon class="pill-icon">insights</mat-icon> QUESTIONNAIRE INTELLIGENCE
              </span>
            </div>
            <h1 class="hub-title">In-Depth Questionnaire Analytics</h1>
            <p class="hub-subtitle">
              Comprehensive question-level response distributions, sentiment indicators, and respondent funnel metrics.
            </p>
          </div>

          <!-- Study Picker Dropdown -->
          <div class="study-selector-wrap" *ngIf="surveys.length > 0">
            <label class="selector-label">Select Questionnaire / Study:</label>
            <mat-form-field appearance="outline" class="study-select-field">
              <mat-select 
                [ngModel]="selectedSurveyId" 
                (ngModelChange)="onSurveyChange($event)"
                panelClass="custom-select-panel"
              >
                <mat-option *ngFor="let s of surveys" [value]="s.id">
                  <div class="study-option-item">
                    <span class="opt-title">{{ s.title }}</span>
                    <span class="opt-badge" [ngClass]="s.status.toLowerCase()">{{ s.status }}</span>
                    <span class="opt-count" *ngIf="s.completed_count !== undefined">({{ s.completed_count }} completes)</span>
                  </div>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- Quick Action Bar -->
        <div class="header-bottom-bar" *ngIf="analytics">
          <div class="study-meta-tags">
            <span class="meta-tag slug-tag">
              <mat-icon class="meta-icon">tag</mat-icon> {{ analytics.survey_slug }}
            </span>
            <span class="meta-tag status-tag" [ngClass]="analytics.survey_status.toLowerCase()">
              {{ analytics.survey_status }}
            </span>
            <span class="meta-tag version-tag">
              v{{ analytics.version_number }}
            </span>
            <span class="meta-tag q-count-tag" *ngIf="analytics.question_analytics">
              {{ analytics.question_analytics.length }} Questions
            </span>
          </div>

          <div class="export-actions">
            <button mat-stroked-button (click)="loadAnalytics(selectedSurveyId!)" class="action-btn" [disabled]="loading">
              <mat-icon [class.spin]="loading">refresh</mat-icon> Refresh
            </button>
            <button mat-stroked-button (click)="exportFile('csv')" class="action-btn">
              <mat-icon>description</mat-icon> Export CSV
            </button>
            <button mat-stroked-button (click)="exportFile('xlsx')" class="action-btn">
              <mat-icon>table_view</mat-icon> Export Excel
            </button>
            <button mat-flat-button color="primary" [routerLink]="['/admin/surveys', selectedSurveyId]" class="action-btn detail-link-btn">
              <mat-icon>tune</mat-icon> Study Settings
            </button>
          </div>
        </div>
      </header>

      <!-- Skeleton Loading State -->
      <div *ngIf="loading && !analytics" class="skeleton-wrap">
        <div class="skeleton kpi-skeleton"></div>
        <div class="skeleton card-skeleton"></div>
        <div class="skeleton card-skeleton"></div>
      </div>

      <!-- Main Content Stage -->
      <main *ngIf="analytics && !loading" class="analytics-content-stage">

        <!-- Executive KPI Metrics Strip -->
        <div class="kpi-grid">
          <!-- Total Completes -->
          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Completes / Target</span>
              <div class="kpi-icon-badge completes">
                <mat-icon>task_alt</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ analytics.completed }} / {{ analytics.target }}</div>
            <div class="progress-track" style="margin-top: 8px;">
              <div 
                class="progress-fill completes-fill" 
                [style.width.%]="getProgressPercent(analytics.completed, analytics.target)">
              </div>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-sub">{{ getProgressPercent(analytics.completed, analytics.target).toFixed(1) }}% fulfilled</span>
              <span class="kpi-sub-muted">{{ analytics.in_progress }} in progress</span>
            </div>
          </div>

          <!-- Completion Rate -->
          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Completion Rate</span>
              <div class="kpi-icon-badge live">
                <mat-icon>trending_up</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ (analytics.completion_rate * 100).toFixed(1) }}%</div>
            <div class="progress-track" style="margin-top: 8px;">
              <div class="progress-fill live-fill" [style.width.%]="analytics.completion_rate * 100"></div>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-sub">{{ analytics.started }} total started</span>
              <span class="kpi-sub-muted">{{ analytics.terminated }} screened out</span>
            </div>
          </div>

          <!-- Incidence Rate -->
          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Incidence Rate</span>
              <div class="kpi-icon-badge progress">
                <mat-icon>pie_chart</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ (analytics.incidence_rate * 100).toFixed(1) }}%</div>
            <div class="progress-track" style="margin-top: 8px;">
              <div class="progress-fill" style="background: #38bdf8;" [style.width.%]="analytics.incidence_rate * 100"></div>
            </div>
            <div class="kpi-sub-row">
              <span class="kpi-sub">Qualification ratio</span>
              <span class="kpi-sub-muted">{{ analytics.completed }} qualified</span>
            </div>
          </div>

          <!-- Median Completion Duration -->
          <div class="kpi-tile">
            <div class="kpi-header-row">
              <span class="kpi-title">Median Duration</span>
              <div class="kpi-icon-badge in-progress">
                <mat-icon>timer</mat-icon>
              </div>
            </div>
            <div class="kpi-value">{{ formatDuration(analytics.median_completion_time_seconds) }}</div>
            <div class="kpi-sub-row" style="margin-top: 18px;">
              <span class="kpi-sub">Avg: {{ formatDuration(analytics.average_completion_time_seconds) }}</span>
              <span class="kpi-sub-muted" *ngIf="analytics.quality_flags">
                {{ analytics.quality_flags.speeders }} speeders
              </span>
            </div>
          </div>
        </div>

        <!-- Filter & Search Controls Bar -->
        <div class="controls-card admin-card">
          <div class="controls-row">
            <div class="search-box">
              <mat-icon class="search-icon">search</mat-icon>
              <input 
                type="text" 
                placeholder="Search questions by ID (e.g. q1) or prompt text..." 
                [(ngModel)]="searchQuery" 
                class="search-input"
              />
              <button *ngIf="searchQuery" class="clear-search-btn" (click)="searchQuery = ''">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Type Filter Chips -->
            <div class="filter-chips">
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="selectedType === 'ALL'" 
                (click)="selectedType = 'ALL'">
                All Types ({{ analytics.question_analytics.length }})
              </button>
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="selectedType === 'single'" 
                (click)="selectedType = 'single'">
                Single Choice
              </button>
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="selectedType === 'multi'" 
                (click)="selectedType = 'multi'">
                Multiple Choice
              </button>
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="selectedType === 'nps'" 
                (click)="selectedType = 'nps'">
                NPS
              </button>
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="selectedType === 'rating'" 
                (click)="selectedType = 'rating'">
                Rating
              </button>
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="selectedType === 'matrix'" 
                (click)="selectedType = 'matrix'">
                Matrix
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State if filter returns 0 -->
        <div *ngIf="filteredQuestions.length === 0" class="admin-card empty-state-box">
          <mat-icon class="empty-icon">find_in_page</mat-icon>
          <h3>No matching questions found</h3>
          <p>Try clearing your search query or switching to "All Types".</p>
          <button mat-stroked-button (click)="searchQuery = ''; selectedType = 'ALL'">Reset Filters</button>
        </div>

        <!-- Question-by-Question Deep Analytics Cards -->
        <div class="questions-stream">
          <article 
            *ngFor="let q of filteredQuestions; let idx = index" 
            class="admin-card question-detail-card"
          >
            <!-- Question Card Top Header -->
            <div class="q-card-header">
              <div class="q-title-group">
                <div class="q-meta-line">
                  <span class="q-index-badge">#{{ idx + 1 }}</span>
                  <code class="q-id-pill">{{ q.question_id }}</code>
                  <span class="q-type-pill" [ngClass]="'type-' + q.type">{{ q.type | uppercase }}</span>
                  <span class="q-base-pill">
                    <mat-icon class="base-icon">people</mat-icon> Base: {{ q.base }} respondents
                  </span>
                </div>
                <h2 class="q-prompt-text">{{ q.text }}</h2>
              </div>

              <!-- Question Dropoff Indicator -->
              <div class="q-dropoff-badge" *ngIf="getQuestionDropoff(q.question_id) as drop">
                <span class="drop-label">Drop-off:</span>
                <span class="drop-val" [class.warning]="drop.rate > 10">{{ drop.rate.toFixed(1) }}%</span>
                <span class="drop-count">({{ drop.stopped }} exited)</span>
              </div>
            </div>

            <!-- Card Body: Dynamic Data Visualizations based on Question Type -->
            <div class="q-card-body">

              <!-- CASE 1: NPS Question Type -->
              <div *ngIf="q.type === 'nps'" class="nps-analytic-panel">
                <div class="nps-hero-row">
                  <div class="nps-score-box" [ngClass]="getNpsScoreClass(q.nps_score)">
                    <span class="nps-big-number">{{ q.nps_score > 0 ? '+' + q.nps_score : q.nps_score }}</span>
                    <span class="nps-score-label">Net Promoter Score</span>
                  </div>

                  <div class="nps-sentiment-breakdown">
                    <div class="sentiment-item promoter">
                      <div class="sentiment-header">
                        <span class="sentiment-name">Promoters (9-10)</span>
                        <strong>{{ q.base > 0 ? ((q.promoters / q.base) * 100).toFixed(1) : 0 }}%</strong>
                      </div>
                      <div class="sentiment-bar-track">
                        <div class="sentiment-bar-fill promoter-fill" [style.width.%]="q.base > 0 ? (q.promoters / q.base) * 100 : 0"></div>
                      </div>
                      <span class="sentiment-count">{{ q.promoters }} respondents</span>
                    </div>

                    <div class="sentiment-item passive">
                      <div class="sentiment-header">
                        <span class="sentiment-name">Passives (7-8)</span>
                        <strong>{{ q.base > 0 ? ((q.passives / q.base) * 100).toFixed(1) : 0 }}%</strong>
                      </div>
                      <div class="sentiment-bar-track">
                        <div class="sentiment-bar-fill passive-fill" [style.width.%]="q.base > 0 ? (q.passives / q.base) * 100 : 0"></div>
                      </div>
                      <span class="sentiment-count">{{ q.passives }} respondents</span>
                    </div>

                    <div class="sentiment-item detractor">
                      <div class="sentiment-header">
                        <span class="sentiment-name">Detractors (0-6)</span>
                        <strong>{{ q.base > 0 ? ((q.detractors / q.base) * 100).toFixed(1) : 0 }}%</strong>
                      </div>
                      <div class="sentiment-bar-track">
                        <div class="sentiment-bar-fill detractor-fill" [style.width.%]="q.base > 0 ? (q.detractors / q.base) * 100 : 0"></div>
                      </div>
                      <span class="sentiment-count">{{ q.detractors }} respondents</span>
                    </div>
                  </div>
                </div>

                <!-- 0 to 10 Scale Distribution -->
                <div class="nps-scale-strip" *ngIf="q.distribution">
                  <div *ngFor="let score of [0,1,2,3,4,5,6,7,8,9,10]" class="scale-point">
                    <span class="point-num">{{ score }}</span>
                    <div class="point-bar-wrap">
                      <div 
                        class="point-bar" 
                        [ngClass]="score >= 9 ? 'promoter-bar' : (score >= 7 ? 'passive-bar' : 'detractor-bar')"
                        [style.height.%]="getScaleBarHeight(q.distribution[score.toString()], q.base)">
                      </div>
                    </div>
                    <span class="point-cnt">{{ q.distribution[score.toString()] || 0 }}</span>
                  </div>
                </div>
              </div>

              <!-- CASE 2: Rating Question Type (1..5) -->
              <div *ngIf="q.type === 'rating'" class="rating-analytic-panel">
                <div class="rating-hero-row">
                  <div class="rating-score-box">
                    <span class="rating-big-num">{{ q.average ? q.average.toFixed(2) : '0.0' }}</span>
                    <div class="stars-visual">
                      <mat-icon *ngFor="let star of [1,2,3,4,5]" class="star-icon" [class.filled]="q.average >= star">
                        {{ q.average >= star ? 'star' : (q.average >= star - 0.5 ? 'star_half' : 'star_border') }}
                      </mat-icon>
                    </div>
                    <span class="rating-score-label">Average Score (out of 5)</span>
                    <span class="rating-anchors">{{ q.low_label }} &rarr; {{ q.high_label }}</span>
                  </div>

                  <div class="rating-bars-list" *ngIf="q.distribution">
                    <div *ngFor="let star of [5,4,3,2,1]" class="rating-dist-row">
                      <span class="star-row-label">{{ star }} Star{{ star > 1 ? 's' : '' }}</span>
                      <div class="dist-track">
                        <div 
                          class="dist-fill" 
                          [style.width.%]="q.base > 0 ? ((q.distribution[star.toString()] || 0) / q.base) * 100 : 0">
                        </div>
                      </div>
                      <span class="dist-stat">
                        <strong>{{ q.distribution[star.toString()] || 0 }}</strong>
                        ({{ q.base > 0 ? (((q.distribution[star.toString()] || 0) / q.base) * 100).toFixed(1) : 0 }}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CASE 3: Single Choice, Dropdown, Yes/No, Consent, Multiple Choice -->
              <div *ngIf="q.type === 'single' || q.type === 'multi' || q.type === 'dropdown' || q.type === 'yesno' || q.type === 'consent'" class="options-analytic-panel">
                <div class="options-breakdown-list">
                  <div *ngFor="let opt of q.options; let optIdx = index" class="opt-breakdown-row">
                    <div class="opt-left">
                      <span class="opt-letter-tag">{{ getAlpha(optIdx) }}</span>
                      <span class="opt-text">{{ opt.option }}</span>
                    </div>

                    <div class="opt-track-wrap">
                      <div class="opt-progress-track">
                        <div class="opt-progress-fill" [style.width.%]="opt.percent"></div>
                      </div>
                    </div>

                    <div class="opt-stats">
                      <span class="opt-percent">{{ opt.percent.toFixed(1) }}%</span>
                      <span class="opt-count">({{ opt.count }} respondents)</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- CASE 4: Matrix Question Type -->
              <div *ngIf="q.type === 'matrix'" class="matrix-analytic-panel">
                <div class="matrix-table-scroll">
                  <table class="matrix-analytic-table">
                    <thead>
                      <tr>
                        <th class="matrix-row-head">Statement / Sub-Question</th>
                        <th *ngFor="let scale of q.scale_options" class="matrix-scale-head">{{ scale }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of q.rows">
                        <td class="matrix-row-title-cell">
                          <strong>{{ row.row }}</strong>
                        </td>
                        <td *ngFor="let scale of q.scale_options" class="matrix-scale-cell">
                          <div class="cell-stack">
                            <span class="cell-percent">{{ (row.percents[scale] || 0).toFixed(1) }}%</span>
                            <div class="cell-track">
                              <div class="cell-fill" [style.width.%]="row.percents[scale] || 0"></div>
                            </div>
                            <span class="cell-cnt">n = {{ row.counts[scale] || 0 }}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CASE 5: Text / Formatted / Info -->
              <div *ngIf="q.type === 'text' || q.type === 'longtext' || q.type === 'formatted' || q.type === 'number' || q.type === 'info'" class="text-analytic-panel">
                <div class="text-stat-box">
                  <mat-icon class="text-stat-icon">subject</mat-icon>
                  <div>
                    <h4>Open-ended / Numeric Input Question</h4>
                    <p>Total recorded qualitative/numeric responses: <strong>{{ q.base }}</strong></p>
                  </div>
                </div>
              </div>

            </div>
          </article>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .analytics-hub-container {
      width: 100%;
      padding-bottom: 48px;
    }
    .hub-header-card {
      padding: 28px;
      margin-bottom: 24px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
    }
    .header-main-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      flex-wrap: wrap;
    }
    .badge-row {
      margin-bottom: 8px;
    }
    .hub-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(139, 108, 255, 0.14);
      color: var(--accent-violet);
      border: 1px solid rgba(139, 108, 255, 0.28);
      padding: 4px 10px;
      border-radius: 9999px;
    }
    .pill-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }
    .hub-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--color-text);
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }
    .hub-subtitle {
      font-size: 14px;
      color: var(--color-text-muted);
      margin: 0;
      max-width: 620px;
      line-height: 1.5;
    }
    .study-selector-wrap {
      min-width: 340px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .selector-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
      letter-spacing: 0.5px;
    }
    .study-select-field {
      width: 100%;
    }
    .study-option-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
    }
    .opt-title {
      font-weight: 600;
      color: var(--color-text);
    }
    .opt-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .opt-badge.live {
      background: rgba(52, 211, 153, 0.15);
      color: var(--color-success);
    }
    .opt-badge.draft {
      background: rgba(251, 191, 36, 0.15);
      color: var(--color-warning);
    }
    .opt-badge.closed {
      background: var(--color-surface-raised);
      color: var(--color-text-muted);
    }
    .opt-count {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-left: auto;
    }
    .header-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid var(--color-border);
      flex-wrap: wrap;
      gap: 16px;
    }
    .study-meta-tags {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .meta-tag {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      color: var(--color-text);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .meta-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .status-tag.live {
      color: var(--color-success);
      border-color: rgba(52, 211, 153, 0.3);
      background: rgba(52, 211, 153, 0.1);
    }
    .status-tag.draft {
      color: var(--color-warning);
      border-color: rgba(251, 191, 36, 0.3);
      background: rgba(251, 191, 36, 0.1);
    }
    .export-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .action-btn {
      height: 38px;
      font-size: 13px;
      font-weight: 600;
    }
    .detail-link-btn {
      background: linear-gradient(135deg, #8B6CFF 0%, #4C3BCF 100%) !important;
      color: #FFFFFF !important;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-tile {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 18px 20px;
      box-shadow: var(--shadow-sm);
    }
    .kpi-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .kpi-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--color-text-muted);
    }
    .kpi-value {
      font-size: 26px;
      font-weight: 800;
      color: var(--color-text);
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }
    .progress-track {
      width: 100%;
      height: 6px;
      background: var(--color-surface-raised);
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.3s ease;
    }
    .completes-fill {
      background: linear-gradient(90deg, #8B6CFF, #2DD4F5);
    }
    .live-fill {
      background: #34D399;
    }
    .kpi-sub-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-top: 8px;
    }
    .kpi-sub {
      color: var(--color-text);
      font-weight: 600;
    }
    .kpi-sub-muted {
      color: var(--color-text-muted);
    }
    .controls-card {
      padding: 16px 20px;
      margin-bottom: 24px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
    }
    .controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .search-box {
      display: flex;
      align-items: center;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: 10px;
      padding: 0 12px;
      height: 42px;
      min-width: 320px;
      flex: 1;
    }
    .search-icon {
      color: var(--color-text-muted);
      margin-right: 8px;
    }
    .search-input {
      background: transparent;
      border: none;
      color: var(--color-text);
      font-size: 14px;
      width: 100%;
      outline: none;
    }
    .clear-search-btn {
      background: transparent;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .filter-chips {
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }
    .chip-btn {
      height: 36px;
      padding: 0 14px;
      border-radius: 20px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-raised);
      color: var(--color-text-muted);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .chip-btn:hover {
      background: rgba(var(--color-primary-rgb), 0.1);
      color: var(--color-text);
      border-color: var(--color-primary);
    }
    .chip-btn.active {
      background: var(--color-primary);
      color: #FFFFFF;
      border-color: var(--color-primary);
      box-shadow: 0 2px 8px rgba(var(--color-primary-rgb), 0.3);
    }
    .questions-stream {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .question-detail-card {
      padding: 24px 28px;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-card);
      transition: all 0.2s ease;
    }
    .question-detail-card:hover {
      border-color: var(--color-border-hover);
    }
    .q-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 16px;
    }
    .q-title-group {
      flex: 1;
    }
    .q-meta-line {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }
    .q-index-badge {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-primary);
      background: rgba(var(--color-primary-rgb), 0.12);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .q-id-pill {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text);
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      padding: 2px 8px;
      border-radius: 4px;
    }
    .q-type-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .type-single, .type-dropdown { background: rgba(45, 212, 245, 0.12); color: #2DD4F5; }
    .type-multi { background: rgba(139, 108, 255, 0.12); color: #8B6CFF; }
    .type-nps { background: rgba(251, 191, 36, 0.12); color: #FBBF24; }
    .type-rating { background: rgba(244, 114, 182, 0.12); color: #F472B6; }
    .type-matrix { background: rgba(52, 211, 153, 0.12); color: #34D399; }
    .q-base-pill {
      font-size: 12px;
      color: var(--color-text-muted);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .base-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .q-prompt-text {
      font-size: 17px;
      font-weight: 700;
      color: var(--color-text);
      margin: 0;
      line-height: 1.45;
    }
    .q-dropoff-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      background: var(--color-surface-raised);
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      flex-shrink: 0;
    }
    .drop-label { font-size: 11px; color: var(--color-text-muted); text-transform: uppercase; }
    .drop-val { font-size: 14px; font-weight: 700; color: var(--color-text); }
    .drop-val.warning { color: var(--semantic-danger); }
    .drop-count { font-size: 11px; color: var(--color-text-muted); }

    /* NPS Panel */
    .nps-hero-row {
      display: flex;
      gap: 24px;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .nps-score-box {
      padding: 16px 24px;
      border-radius: 14px;
      text-align: center;
      min-width: 130px;
      border: 1px solid var(--color-border);
    }
    .nps-big-number {
      display: block;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 4px;
    }
    .nps-score-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .nps-positive { background: rgba(52, 211, 153, 0.12); color: #34D399; border-color: rgba(52, 211, 153, 0.3); }
    .nps-neutral { background: rgba(251, 191, 36, 0.12); color: #FBBF24; border-color: rgba(251, 191, 36, 0.3); }
    .nps-negative { background: rgba(251, 113, 133, 0.12); color: #FB7185; border-color: rgba(251, 113, 133, 0.3); }

    .nps-sentiment-breakdown {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 260px;
    }
    .sentiment-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sentiment-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--color-text);
    }
    .sentiment-bar-track {
      height: 8px;
      background: var(--color-surface-raised);
      border-radius: 4px;
      overflow: hidden;
    }
    .sentiment-bar-fill {
      height: 100%;
      border-radius: 4px;
    }
    .promoter-fill { background: #34D399; }
    .passive-fill { background: #FBBF24; }
    .detractor-fill { background: #FB7185; }
    .sentiment-count {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    .nps-scale-strip {
      display: flex;
      gap: 6px;
      justify-content: space-between;
      padding-top: 14px;
      border-top: 1px solid var(--color-border);
      overflow-x: auto;
    }
    .scale-point {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 32px;
    }
    .point-num { font-size: 12px; font-weight: 700; color: var(--color-text); }
    .point-bar-wrap {
      width: 16px;
      height: 50px;
      background: var(--color-surface-raised);
      border-radius: 4px;
      display: flex;
      align-items: flex-end;
      overflow: hidden;
    }
    .point-bar { width: 100%; border-radius: 4px; }
    .promoter-bar { background: #34D399; }
    .passive-bar { background: #FBBF24; }
    .detractor-bar { background: #FB7185; }
    .point-cnt { font-size: 10px; color: var(--color-text-muted); }

    /* Rating Panel */
    .rating-hero-row {
      display: flex;
      gap: 28px;
      align-items: center;
      flex-wrap: wrap;
    }
    .rating-score-box {
      padding: 20px 24px;
      border-radius: 14px;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      text-align: center;
      min-width: 170px;
    }
    .rating-big-num {
      font-size: 38px;
      font-weight: 800;
      color: var(--color-text);
      line-height: 1;
      display: block;
      margin-bottom: 6px;
    }
    .stars-visual {
      display: flex;
      justify-content: center;
      gap: 2px;
      margin-bottom: 6px;
    }
    .star-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
    }
    .star-icon.filled {
      color: #FBBF24;
    }
    .rating-score-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--color-text-muted);
      display: block;
    }
    .rating-anchors {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 4px;
      display: block;
    }
    .rating-bars-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 260px;
    }
    .rating-dist-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .star-row-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text);
      min-width: 60px;
    }
    .dist-track {
      flex: 1;
      height: 8px;
      background: var(--color-surface-raised);
      border-radius: 4px;
      overflow: hidden;
    }
    .dist-fill {
      height: 100%;
      background: #F472B6;
      border-radius: 4px;
    }
    .dist-stat {
      font-size: 12px;
      color: var(--color-text-muted);
      min-width: 90px;
      text-align: right;
    }

    /* Options Breakdown */
    .options-breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .opt-breakdown-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .opt-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 200px;
      max-width: 280px;
    }
    .opt-letter-tag {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      font-size: 11px;
      font-weight: 700;
      color: var(--color-text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .opt-text {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text);
      line-height: 1.4;
    }
    .opt-track-wrap {
      flex: 1;
    }
    .opt-progress-track {
      height: 10px;
      background: var(--color-surface-raised);
      border-radius: 5px;
      overflow: hidden;
    }
    .opt-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #8B6CFF 0%, #2DD4F5 100%);
      border-radius: 5px;
      transition: width 0.3s ease;
    }
    .opt-stats {
      min-width: 130px;
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .opt-percent {
      font-size: 15px;
      font-weight: 700;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }
    .opt-count {
      font-size: 11px;
      color: var(--color-text-muted);
    }

    /* Matrix Breakdown */
    .matrix-table-scroll {
      overflow-x: auto;
      border: 1px solid var(--color-border);
      border-radius: 10px;
    }
    .matrix-analytic-table {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
    }
    .matrix-analytic-table th {
      padding: 12px 14px;
      background: var(--color-surface-raised);
      border-bottom: 2px solid var(--color-border);
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .matrix-row-head {
      text-align: left;
      min-width: 220px;
    }
    .matrix-analytic-table td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--color-border);
    }
    .matrix-row-title-cell {
      text-align: left;
      font-size: 14px;
      color: var(--color-text);
    }
    .cell-stack {
      display: flex;
      flex-direction: column;
      gap: 3px;
      align-items: center;
      min-width: 90px;
    }
    .cell-percent {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-text);
    }
    .cell-track {
      width: 100%;
      height: 4px;
      background: var(--color-surface-raised);
      border-radius: 2px;
      overflow: hidden;
    }
    .cell-fill {
      height: 100%;
      background: #34D399;
      border-radius: 2px;
    }
    .cell-cnt {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    /* Text & Info */
    .text-stat-box {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: var(--color-surface-raised);
      border-radius: 10px;
      border: 1px solid var(--color-border);
    }
    .text-stat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--accent-cyan);
    }
    .text-stat-box h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      color: var(--color-text);
    }
    .text-stat-box p {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-muted);
    }

    /* Skeleton Loading */
    .skeleton-wrap {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .skeleton {
      background: linear-gradient(90deg, var(--color-surface-raised) 25%, rgba(255, 255, 255, 0.08) 50%, var(--color-surface-raised) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-md);
    }
    .kpi-skeleton { height: 110px; }
    .card-skeleton { height: 280px; }
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .empty-state-box {
      padding: 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
    }
    .empty-state-box h3 {
      font-size: 18px;
      color: var(--color-text);
      margin: 0;
    }
    .empty-state-box p {
      font-size: 14px;
      color: var(--color-text-muted);
      margin: 0;
    }
    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class AdminAnalyticsComponent implements OnInit, OnDestroy {
  surveys: SurveyListItem[] = [];
  selectedSurveyId: number | null = null;
  analytics: SurveyAnalyticsResponse | null = null;
  loading = false;
  searchQuery = '';
  selectedType = 'ALL';
  private sub?: Subscription;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSurveysList();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadSurveysList(): void {
    this.loading = true;
    this.api.getSurveys().subscribe({
      next: (surveys) => {
        this.surveys = surveys;
        // Listen to route params
        this.sub = this.route.paramMap.subscribe(params => {
          const idParam = params.get('id');
          if (idParam) {
            this.selectedSurveyId = Number(idParam);
          } else if (surveys.length > 0) {
            // Default to first live study or first survey
            const liveSurvey = surveys.find(s => s.status === 'LIVE');
            this.selectedSurveyId = liveSurvey ? liveSurvey.id : surveys[0].id;
          }

          if (this.selectedSurveyId) {
            this.loadAnalytics(this.selectedSurveyId);
          } else {
            this.loading = false;
          }
        });
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load surveys portfolio.', 'Close', { duration: 3000 });
      }
    });
  }

  onSurveyChange(newId: number): void {
    this.selectedSurveyId = newId;
    this.router.navigate(['/admin/analytics', newId]);
  }

  loadAnalytics(surveyId: number): void {
    this.loading = true;
    this.api.getSurveyAnalytics(surveyId).subscribe({
      next: (data) => {
        this.analytics = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load question analytics for this survey.', 'Close', { duration: 3000 });
      }
    });
  }

  get filteredQuestions(): any[] {
    if (!this.analytics?.question_analytics) return [];
    let list = this.analytics.question_analytics;

    if (this.selectedType !== 'ALL') {
      list = list.filter(q => q.type === this.selectedType);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      list = list.filter(q => 
        (q.question_id && q.question_id.toLowerCase().includes(query)) ||
        (q.text && q.text.toLowerCase().includes(query))
      );
    }

    return list;
  }

  getQuestionDropoff(qid: string): { rate: number; stopped: number } | null {
    if (!this.analytics?.dropoff) return null;
    const item = this.analytics.dropoff.find(d => d.question_id === qid);
    if (!item) return null;
    return {
      rate: item.dropoff_rate || 0,
      stopped: item.stopped || 0
    };
  }

  getProgressPercent(completed: number, target: number): number {
    if (!target || target <= 0) return 0;
    return Math.min(100, Math.round((completed / target) * 1000) / 10);
  }

  formatDuration(seconds?: number): string {
    if (!seconds || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  getNpsScoreClass(score: number): string {
    if (score > 20) return 'nps-positive';
    if (score >= -10) return 'nps-neutral';
    return 'nps-negative';
  }

  getScaleBarHeight(count: number, base: number): number {
    if (!count || !base || base <= 0) return 4;
    return Math.max(8, Math.min(100, Math.round((count / base) * 100)));
  }

  getAlpha(idx: number): string {
    return String.fromCharCode(65 + (idx % 26));
  }

  exportFile(fmt: 'csv' | 'xlsx'): void {
    if (!this.selectedSurveyId) return;
    this.snackBar.open(`Downloading ${fmt.toUpperCase()} export...`, 'Close', { duration: 2500 });
    const req$ = fmt === 'csv' 
      ? this.api.getExportCsv(this.selectedSurveyId)
      : this.api.getExportXlsx(this.selectedSurveyId);

    req$.subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.analytics?.survey_slug || 'survey'}_responses.${fmt}`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open(`Failed to download ${fmt.toUpperCase()} file.`, 'Close', { duration: 3000 });
      }
    });
  }
}
