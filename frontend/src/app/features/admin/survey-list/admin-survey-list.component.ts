import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../../core/services/api.service';
import { SurveyListItem } from '../../../core/models/survey.model';

@Component({
  selector: 'app-admin-survey-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule
  ],
  template: `
    <div class="list-container">
      <div class="header-row">
        <div>
          <h2>Surveys</h2>
          <p class="subtitle">Manage live studies, track completes against targets, and access reports.</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/admin/upload">
          <mat-icon>add</mat-icon> New Survey
        </button>
      </div>

      <div *ngIf="loading" class="loading-state">
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </div>

      <div *ngIf="!loading && surveys.length === 0" class="empty-state">
        <mat-icon class="empty-icon">inbox</mat-icon>
        <h3>No surveys found</h3>
        <p>Get started by uploading your first questionnaire.</p>
        <button mat-flat-button color="primary" routerLink="/admin/upload">Upload Questionnaire</button>
      </div>

      <div class="table-card" *ngIf="!loading && surveys.length > 0">
        <table mat-table [dataSource]="surveys" class="survey-table">
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
                  <strong>{{ s.completed_count }}</strong> / {{ s.target }}
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
              <button mat-icon-button [routerLink]="['/admin/surveys', s.id]" title="Survey Setup">
                <mat-icon>settings</mat-icon>
              </button>
              <button mat-icon-button color="primary" [routerLink]="['/admin/surveys', s.id, 'dashboard']" title="Dashboard">
                <mat-icon>bar_chart</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>
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
    .table-card {
      background: #ffffff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .survey-table {
      width: 100%;
    }
    .title-cell {
      display: flex;
      flex-direction: column;
      padding: 8px 0;
    }
    .survey-link {
      font-weight: 600;
      color: #1e293b;
      text-decoration: none;
      font-size: 15px;
    }
    .survey-link:hover {
      color: #3b82f6;
    }
    .survey-slug {
      font-size: 12px;
      color: #94a3b8;
      font-family: monospace;
    }
    .status-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-pill.live {
      background: #ecfdf5;
      color: #059669;
    }
    .status-pill.draft {
      background: #eff6ff;
      color: #2563eb;
    }
    .status-pill.closed {
      background: #f1f5f9;
      color: #64748b;
    }
    .progress-col {
      min-width: 140px;
      max-width: 200px;
    }
    .counts {
      font-size: 13px;
      margin-bottom: 4px;
    }
    .percent {
      color: #64748b;
      font-size: 12px;
    }
    .text-right {
      text-align: right;
    }
    .muted {
      color: #94a3b8;
    }
    .empty-state {
      text-align: center;
      padding: 64px 16px;
      background: #ffffff;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
    }
    .empty-icon {
      font-size: 48px;
      height: 48px;
      width: 48px;
      color: #94a3b8;
      margin-bottom: 16px;
    }
  `]
})
export class AdminSurveyListComponent implements OnInit {
  surveys: SurveyListItem[] = [];
  loading = true;
  displayedColumns = ['title', 'status', 'progress', 'deadline', 'actions'];

  constructor(private apiService: ApiService) {}

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

  getPercent(s: SurveyListItem): number {
    if (!s.target || s.target <= 0) return 0;
    return Math.min(100, Math.round((s.completed_count / s.target) * 100));
  }
}
