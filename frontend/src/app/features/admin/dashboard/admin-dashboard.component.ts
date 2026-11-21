import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../../core/services/api.service';
import { DashboardData } from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule
  ],
  template: `
    <div class="dashboard-container" *ngIf="dashboard">
      <div class="dash-top">
        <div>
          <button mat-button [routerLink]="['/admin/surveys', dashboard.survey_id]">
            <mat-icon>arrow_back</mat-icon> Back to Survey Setup
          </button>
          <h2>{{ dashboard.survey_title }} — Live Dashboard</h2>
          <p class="subtitle">Slug: <code>{{ dashboard.survey_slug }}</code> | Status: <strong [ngClass]="dashboard.survey_status.toLowerCase()">{{ dashboard.survey_status }}</strong></p>
        </div>

        <div class="export-btns">
          <button mat-stroked-button (click)="refresh()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
          <button mat-raised-button color="primary" (click)="download('csv')">
            <mat-icon>download</mat-icon> Export CSV
          </button>
          <button mat-raised-button color="accent" (click)="download('xlsx')">
            <mat-icon>table_chart</mat-icon> Export Excel
          </button>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stat-grid">
        <mat-card class="stat-card">
          <span class="stat-num">{{ dashboard.started }}</span>
          <span class="stat-title">Started</span>
        </mat-card>

        <mat-card class="stat-card highlight">
          <span class="stat-num text-success">{{ dashboard.completed }}</span>
          <span class="stat-title">Completed (Target: {{ dashboard.target }})</span>
          <mat-progress-bar mode="determinate" [value]="getPercent(dashboard.completed, dashboard.target)"></mat-progress-bar>
        </mat-card>

        <mat-card class="stat-card">
          <span class="stat-num text-warning">{{ dashboard.in_progress }}</span>
          <span class="stat-title">In Progress</span>
        </mat-card>

        <mat-card class="stat-card">
          <span class="stat-num text-danger">{{ dashboard.terminated }}</span>
          <span class="stat-title">Terminated</span>
        </mat-card>
      </div>

      <!-- 2-Col Data: Quotas & Termination Reasons -->
      <div class="grid-2col">
        <!-- Quotas -->
        <mat-card class="data-card">
          <mat-card-header>
            <mat-card-title>Quota Progress</mat-card-title>
            <mat-card-subtitle>Live completion counts computed from verified answers</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="dashboard.quotas.length === 0" class="empty-note">
              No quotas configured for this survey.
            </div>

            <table mat-table [dataSource]="dashboard.quotas" class="quota-table" *ngIf="dashboard.quotas.length > 0">
              <ng-container matColumnDef="rule">
                <th mat-header-cell *matHeaderCellDef>Condition</th>
                <td mat-cell *matCellDef="let q">
                  <code>{{ q.question_id }} = "{{ q.value }}"</code>
                </td>
              </ng-container>

              <ng-container matColumnDef="target">
                <th mat-header-cell *matHeaderCellDef class="text-right">Target</th>
                <td mat-cell *matCellDef="let q" class="text-right">{{ q.target }}</td>
              </ng-container>

              <ng-container matColumnDef="done">
                <th mat-header-cell *matHeaderCellDef class="text-right">Done</th>
                <td mat-cell *matCellDef="let q" class="text-right font-bold text-success">{{ q.done }}</td>
              </ng-container>

              <ng-container matColumnDef="left">
                <th mat-header-cell *matHeaderCellDef class="text-right">Left</th>
                <td mat-cell *matCellDef="let q" class="text-right font-bold" [class.text-danger]="q.left <= 0">
                  {{ q.left }}
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="['rule', 'target', 'done', 'left']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['rule', 'target', 'done', 'left'];"></tr>
            </table>
          </mat-card-content>
        </mat-card>

        <!-- Terminations -->
        <mat-card class="data-card">
          <mat-card-header>
            <mat-card-title>Disqualifications & Screenouts</mat-card-title>
            <mat-card-subtitle>Recorded termination triggers and quota dropouts</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="dashboard.terminations.length === 0" class="empty-note">
              No terminations recorded yet.
            </div>

            <table mat-table [dataSource]="dashboard.terminations" class="term-table" *ngIf="dashboard.terminations.length > 0">
              <ng-container matColumnDef="reason">
                <th mat-header-cell *matHeaderCellDef>Reason</th>
                <td mat-cell *matCellDef="let t">{{ t.reason }}</td>
              </ng-container>

              <ng-container matColumnDef="count">
                <th mat-header-cell *matHeaderCellDef class="text-right">Dropouts</th>
                <td mat-cell *matCellDef="let t" class="text-right font-bold text-danger">{{ t.count }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="['reason', 'count']"></tr>
              <tr mat-row *matRowDef="let row; columns: ['reason', 'count'];"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .dash-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .dash-top h2 {
      margin: 8px 0 4px 0;
      font-size: 24px;
    }
    .subtitle {
      margin: 0;
      color: #64748b;
    }
    .export-btns {
      display: flex;
      gap: 10px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      padding: 20px;
      text-align: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .stat-card.highlight {
      border-color: #3b82f6;
    }
    .stat-num {
      display: block;
      font-size: 32px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .stat-title {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .text-success { color: #16a34a !important; }
    .text-warning { color: #ca8a04 !important; }
    .text-danger { color: #dc2626 !important; }
    .font-bold { font-weight: 700; }
    .text-right { text-align: right; }
    .grid-2col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 24px;
    }
    .data-card {
      padding: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
    }
    .quota-table, .term-table {
      width: 100%;
      margin-top: 12px;
    }
    .empty-note {
      padding: 24px 0;
      text-align: center;
      color: #94a3b8;
      font-size: 14px;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  dashboard: DashboardData | null = null;
  surveyId = 0;

  constructor(private route: ActivatedRoute, private apiService: ApiService) {}

  ngOnInit(): void {
    this.surveyId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.surveyId) {
      this.refresh();
    }
  }

  refresh(): void {
    this.apiService.getDashboard(this.surveyId).subscribe(data => {
      this.dashboard = data;
    });
  }

  getPercent(done: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((done / total) * 100));
  }

  download(fmt: 'csv' | 'xlsx'): void {
    const fetch$ = fmt === 'csv'
      ? this.apiService.getExportCsv(this.surveyId)
      : this.apiService.getExportXlsx(this.surveyId);

    fetch$.subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.dashboard?.survey_slug}_dashboard.${fmt}`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }
}
