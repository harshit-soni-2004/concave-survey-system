import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { QuestionView, QuestionOption } from '../../../core/models/survey.model';

@Component({
  selector: 'app-question-renderer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatRadioModule,
    MatCheckboxModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="question-box" *ngIf="question">
      <!-- Question Prompt -->
      <div class="question-header">
        <h2 class="question-text">
          <span>{{ getDisplayText() }}</span>
          <span *ngIf="question.required" class="required-badge" title="Required">Required</span>
        </h2>
        <span *ngIf="question.type === 'multi' && question.max" class="hint-text">
          <mat-icon class="hint-icon">info_outline</mat-icon> Select up to {{ question.max }} options
        </span>
        <span *ngIf="question.type === 'multi' && !question.max" class="hint-text">
          <mat-icon class="hint-icon">checklist</mat-icon> Select all that apply
        </span>
        <span *ngIf="question.type === 'single' || question.type === 'yesno' || question.type === 'consent'" class="hint-sub">
          <mat-icon class="hint-icon">touch_app</mat-icon> Select one option or press keyboard shortcut key
        </span>
      </div>

      <!-- Inline Error Message -->
      <div *ngIf="errorMessage" class="error-msg">
        <mat-icon>error_outline</mat-icon>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Input Switcher for 13 Types -->
      <div class="input-area">

        <!-- 1. Single / 11. YesNo / 12. Consent: Modern Tactile Cards with Key Badges -->
        <div *ngIf="question.type === 'single' || question.type === 'yesno' || question.type === 'consent'" class="options-group">
          <div class="options-list">
            <div
              *ngFor="let opt of getEffectiveOptions(); let i = index"
              class="modern-option-card"
              [class.selected]="currentAnswer === opt.text"
              [class.yes-variant]="isPositiveOption(opt.text)"
              [class.no-variant]="isNegativeOption(opt.text)"
              (click)="onSelectSingleOption(opt.text)"
              tabindex="0"
              role="button"
              [attr.aria-pressed]="currentAnswer === opt.text"
            >
              <div class="key-badge">
                <span class="key-letter">{{ getAlphaKey(i) }}</span>
              </div>
              <span class="option-label-text">{{ getOptionText(opt) }}</span>
              <div class="selection-indicator">
                <div class="indicator-inner" *ngIf="currentAnswer === opt.text">
                  <mat-icon class="indicator-check">check</mat-icon>
                </div>
              </div>
            </div>
          </div>

          <!-- Other Text Box for Single -->
          <div *ngIf="hasOtherSelected()" class="other-input-wrap">
            <mat-form-field appearance="outline" class="full-width modern-form-field">
              <mat-label>Please specify</mat-label>
              <input matInput [(ngModel)]="otherText" placeholder="Specify here..." />
            </mat-form-field>
          </div>
        </div>

        <!-- 2. Multi Select: Modern Cards with Key Badges & Check Indicators -->
        <div *ngIf="question.type === 'multi'" class="options-group">
          <div class="options-list">
            <div
              *ngFor="let opt of getEffectiveOptions(); let i = index"
              class="modern-option-card checkbox-variant"
              [class.selected]="isMultiOptionChecked(opt.text)"
              (click)="onCardMultiToggle(opt)"
              tabindex="0"
              role="button"
              [attr.aria-pressed]="isMultiOptionChecked(opt.text)"
            >
              <div class="key-badge">
                <span class="key-letter">{{ getAlphaKey(i) }}</span>
              </div>
              <span class="option-label-text">{{ getOptionText(opt) }}</span>
              <div class="selection-indicator checkbox-indicator">
                <div class="indicator-inner" *ngIf="isMultiOptionChecked(opt.text)">
                  <mat-icon class="indicator-check">check</mat-icon>
                </div>
              </div>
            </div>
          </div>

          <!-- Other Text Box for Multi -->
          <div *ngIf="isMultiOtherSelected()" class="other-input-wrap">
            <mat-form-field appearance="outline" class="full-width modern-form-field">
              <mat-label>Please specify</mat-label>
              <input matInput [(ngModel)]="otherText" placeholder="Specify other..." />
            </mat-form-field>
          </div>
        </div>

        <!-- 3. Dropdown with search filter -->
        <div *ngIf="question.type === 'dropdown'" class="dropdown-wrap">
          <mat-form-field appearance="outline" class="full-width modern-form-field">
            <mat-label>Search & Select an option</mat-label>
            <mat-select [(ngModel)]="currentAnswer">
              <div class="search-box">
                <input
                  type="text"
                  placeholder="Filter options..."
                  [(ngModel)]="dropdownSearch"
                  (click)="$event.stopPropagation()"
                  class="dropdown-filter-input"
                />
              </div>
              <mat-option *ngFor="let opt of filteredDropdownOptions()" [value]="opt.text">
                {{ getOptionText(opt) }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <div *ngIf="hasOtherSelected()" class="other-input-wrap">
            <mat-form-field appearance="outline" class="full-width modern-form-field">
              <mat-label>Please specify</mat-label>
              <input matInput [(ngModel)]="otherText" placeholder="Specify here..." />
            </mat-form-field>
          </div>
        </div>

        <!-- 4. Rating (1..N with low/high labels) -->
        <div *ngIf="question.type === 'rating'" class="rating-wrap">
          <div class="rating-labels">
            <span>{{ question.low_label || '1 - Poor' }}</span>
            <span>{{ question.high_label || '5 - Excellent' }}</span>
          </div>
          <div class="rating-buttons">
            <button
              *ngFor="let star of [1, 2, 3, 4, 5]"
              type="button"
              class="rating-btn"
              [class.selected]="currentAnswer === star"
              (click)="currentAnswer = star"
            >
              {{ star }}
            </button>
          </div>
        </div>

        <!-- 5. NPS (0..10) -->
        <div *ngIf="question.type === 'nps'" class="nps-wrap">
          <div class="nps-buttons">
            <button
              *ngFor="let num of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]"
              type="button"
              class="nps-btn"
              [class.selected]="currentAnswer === num"
              [class.detractor]="num <= 6"
              [class.passive]="num === 7 || num === 8"
              [class.promoter]="num >= 9"
              (click)="currentAnswer = num"
            >
              {{ num }}
            </button>
          </div>
          <div class="nps-labels">
            <span>0 — Not at all likely</span>
            <span>10 — Extremely likely</span>
          </div>
        </div>

        <!-- 6. Matrix (Rows with Options) -->
        <div *ngIf="question.type === 'matrix'" class="matrix-wrap">
          <div class="matrix-table-wrap">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="matrix-item-col"></th>
                  <th *ngFor="let opt of question.options" class="matrix-opt-col">{{ getOptionText(opt) }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of question.rows">
                  <td class="matrix-row-title">{{ getRowText(row) }}</td>
                  <td *ngFor="let opt of question.options" class="matrix-opt-cell">
                    <mat-radio-button
                      [checked]="matrixAnswers[row.text] === opt.text"
                      (change)="onMatrixSelect(row.text, opt.text)"
                      name="row_{{ row.text }}"
                    ></mat-radio-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 7. Number -->
        <div *ngIf="question.type === 'number'" class="input-wrap">
          <mat-form-field appearance="outline" class="full-width modern-form-field">
            <mat-label>Enter a number</mat-label>
            <input
              matInput
              type="number"
              [(ngModel)]="currentAnswer"
              [min]="question.min !== undefined ? question.min : null"
              [max]="question.max !== undefined ? question.max : null"
            />
            <mat-hint *ngIf="question.min !== undefined || question.max !== undefined">
              Range: {{ question.min }} to {{ question.max }}
            </mat-hint>
          </mat-form-field>
        </div>

        <!-- 8. Text -->
        <div *ngIf="question.type === 'text'" class="input-wrap">
          <mat-form-field appearance="outline" class="full-width modern-form-field">
            <mat-label>Your answer</mat-label>
            <input matInput [(ngModel)]="currentAnswer" placeholder="Type your answer here..." />
            <mat-hint *ngIf="question.minlength">Minimum {{ question.minlength }} characters</mat-hint>
          </mat-form-field>
        </div>

        <!-- 9. Longtext -->
        <div *ngIf="question.type === 'longtext'" class="input-wrap">
          <mat-form-field appearance="outline" class="full-width modern-form-field">
            <mat-label>Your detailed comments</mat-label>
            <textarea matInput rows="4" [(ngModel)]="currentAnswer" placeholder="Type your detailed thoughts here..."></textarea>
            <mat-hint *ngIf="question.minlength">Minimum {{ question.minlength }} characters</mat-hint>
          </mat-form-field>
        </div>

        <!-- 10. Formatted (pincode, phone, email) -->
        <div *ngIf="question.type === 'formatted'" class="input-wrap">
          <mat-form-field appearance="outline" class="full-width modern-form-field">
            <mat-label>{{ getFormattedLabel() }}</mat-label>
            <input matInput [(ngModel)]="currentAnswer" [placeholder]="getFormattedPlaceholder()" />
            <mat-hint>{{ getFormattedHint() }}</mat-hint>
          </mat-form-field>
        </div>

        <!-- 13. Info -->
        <div *ngIf="question.type === 'info'" class="info-content">
          <mat-icon class="info-icon-large">info</mat-icon>
          <p class="info-text">{{ getDisplayText() }}</p>
        </div>

      </div>

      <!-- Action Footer: Back & Next Button with Keyboard Hints -->
      <div class="nav-footer">
        <button
          *ngIf="question.can_go_back"
          type="button"
          (click)="onBackClick()"
          class="back-btn"
          [disabled]="submitting"
        >
          <mat-icon class="btn-icon">arrow_back</mat-icon>
          <span>Back</span>
        </button>

        <span class="spacer" *ngIf="!question.can_go_back"></span>

        <button
          type="button"
          (click)="onNextClick()"
          class="next-btn"
          [disabled]="submitting"
        >
          <span>{{ question.type === 'info' ? 'Continue' : 'Next' }}</span>
          <span class="btn-shortcut-hint">↵ Enter</span>
          <mat-icon class="btn-icon">arrow_forward</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .question-box {
      background: #ffffff;
      border-radius: 20px;
      padding: 36px 36px 32px 36px;
      box-shadow: 0 12px 36px -8px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.9);
      width: 100%;
      box-sizing: border-box;
      transition: all 0.25s ease;
    }
    @media (max-width: 640px) {
      .question-box {
        padding: 24px 18px;
        border-radius: 16px;
      }
    }
    .question-header {
      margin-bottom: 26px;
    }
    .question-text {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.35;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .required-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #fee2e2;
      color: #dc2626;
      padding: 3px 8px;
      border-radius: 6px;
      vertical-align: middle;
    }
    .hint-text, .hint-sub {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }
    .hint-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #94a3b8;
    }
    .error-msg {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 14px;
      font-weight: 500;
    }
    .input-area {
      margin-bottom: 12px;
    }
    .full-width {
      width: 100%;
    }
    .options-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .options-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .modern-option-card {
      display: flex;
      align-items: center;
      padding: 14px 18px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      cursor: pointer;
      user-select: none;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
      outline: none;
    }
    .modern-option-card:hover {
      border-color: #cbd5e1;
      background: #f8fafc;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }
    .modern-option-card:focus-visible {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
    }
    .modern-option-card.selected {
      border-color: #4f46e5;
      background: #f5f7ff;
      box-shadow: 0 0 0 1.5px #4f46e5, 0 6px 18px -4px rgba(79, 70, 229, 0.16);
    }
    .key-badge {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 14px;
      flex-shrink: 0;
      transition: all 0.18s ease;
    }
    .key-letter {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .modern-option-card:hover .key-badge {
      background: #e2e8f0;
      color: #334155;
    }
    .modern-option-card.selected .key-badge {
      background: #4f46e5;
      border-color: #4f46e5;
    }
    .modern-option-card.selected .key-letter {
      color: #ffffff;
    }
    .option-label-text {
      flex: 1;
      font-size: 15px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.45;
    }
    .modern-option-card.selected .option-label-text {
      font-weight: 600;
      color: #1e1b4b;
    }
    .selection-indicator {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 14px;
      flex-shrink: 0;
      transition: all 0.18s ease;
      background: #ffffff;
    }
    .modern-option-card.checkbox-variant .selection-indicator {
      border-radius: 6px;
    }
    .modern-option-card.selected .selection-indicator {
      border-color: #4f46e5;
      background: #4f46e5;
    }
    .indicator-inner {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .indicator-check {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #ffffff;
      line-height: 16px;
    }
    .other-input-wrap {
      margin-top: 14px;
    }
    .dropdown-wrap {
      max-width: 520px;
    }
    .search-box {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .dropdown-filter-input {
      width: 100%;
      padding: 8px 12px;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    .dropdown-filter-input:focus {
      border-color: #4f46e5;
    }
    .rating-wrap {
      max-width: 480px;
    }
    .rating-labels {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 12px;
    }
    .rating-buttons {
      display: flex;
      gap: 12px;
    }
    .rating-btn {
      flex: 1;
      height: 52px;
      border-radius: 12px;
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .rating-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateY(-2px);
    }
    .rating-btn.selected {
      background: #4f46e5;
      color: #ffffff;
      border-color: #4f46e5;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      transform: translateY(-2px);
    }
    .nps-wrap {
      width: 100%;
    }
    .nps-buttons {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 4px 0 10px 0;
    }
    .nps-btn {
      flex: 1;
      min-width: 40px;
      height: 48px;
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      cursor: pointer;
      transition: all 0.18s ease;
    }
    .nps-btn:hover {
      background: #f1f5f9;
      transform: translateY(-2px);
    }
    .nps-btn.selected {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
      transform: translateY(-2px);
    }
    .nps-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      margin-top: 8px;
    }
    .matrix-table-wrap {
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
    }
    .matrix-table th {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      background: #f8fafc;
    }
    .matrix-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .matrix-item-col {
      text-align: left;
      min-width: 180px;
    }
    .matrix-row-title {
      text-align: left;
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
    }
    .info-content {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 20px 24px;
      border-radius: 12px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    .info-icon-large {
      color: #3b82f6;
      font-size: 24px;
      width: 24px;
      height: 24px;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .info-text {
      font-size: 16px;
      color: #1e3a8a;
      margin: 0;
      line-height: 1.6;
    }
    .nav-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #f1f5f9;
    }
    .spacer {
      flex: 1;
    }
    .back-btn {
      height: 44px;
      padding: 0 20px;
      border-radius: 12px;
      border: 1.5px solid #cbd5e1;
      color: #475569;
      font-weight: 600;
      font-size: 14px;
      background: #ffffff;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.18s ease;
      outline: none;
    }
    .back-btn:hover:not([disabled]) {
      background: #f8fafc;
      border-color: #94a3b8;
      color: #1e293b;
    }
    .back-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .next-btn {
      height: 46px;
      padding: 0 24px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      color: #ffffff;
      border: none;
      font-weight: 600;
      font-size: 15px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);
      transition: all 0.18s ease;
      outline: none;
    }
    .next-btn:hover:not([disabled]) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
    }
    .next-btn[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }
    .btn-shortcut-hint {
      display: inline-flex;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.22);
      padding: 2px 8px;
      border-radius: 6px;
      letter-spacing: 0.3px;
      margin: 0 2px;
    }
  `]
})
export class QuestionRendererComponent implements OnChanges {
  @Input() question!: QuestionView;
  @Input() submitting = false;
  @Input() currentLang: string = 'en';

  @Output() answerSubmitted = new EventEmitter<{ answer: any; otherText?: string }>();
  @Output() backRequested = new EventEmitter<void>();

  currentAnswer: any = null;
  otherText = '';
  multiSelected: string[] = [];
  matrixAnswers: { [row: string]: string } = {};
  dropdownSearch = '';
  errorMessage = '';

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const tagName = target?.tagName?.toLowerCase();
    const isEditing = tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;

    // If pressing Enter inside an input, advance to next question
    if (event.key === 'Enter') {
      if (tagName !== 'textarea') {
        event.preventDefault();
        this.onNextClick();
      }
      return;
    }

    // Don't trigger letter or navigation shortcuts while actively editing text
    if (isEditing) return;

    // Back shortcut with ArrowLeft or Backspace
    if ((event.key === 'ArrowLeft' || event.key === 'Backspace') && this.question?.can_go_back) {
      event.preventDefault();
      this.onBackClick();
      return;
    }

    // Number shortcuts for rating 1..5
    if (this.question?.type === 'rating') {
      const num = parseInt(event.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        this.currentAnswer = num;
        this.errorMessage = '';
        return;
      }
    }

    // Letter shortcuts (A, B, C, D...) for single/yesno/consent/multi
    const effectiveOpts = this.getEffectiveOptions();
    if (effectiveOpts.length > 0 && (
      this.question.type === 'single' ||
      this.question.type === 'yesno' ||
      this.question.type === 'consent' ||
      this.question.type === 'multi'
    )) {
      const key = event.key.toUpperCase();
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        const idx = key.charCodeAt(0) - 65;
        if (idx >= 0 && idx < effectiveOpts.length) {
          const opt = effectiveOpts[idx];
          if (this.question.type === 'multi') {
            this.onCardMultiToggle(opt);
          } else {
            this.onSelectSingleOption(opt.text);
          }
        }
      }

      // Also allow Y / N keys for yes/no questions
      if (this.question.type === 'yesno' || this.question.type === 'consent') {
        if (event.key.toLowerCase() === 'y') {
          const yesOpt = effectiveOpts.find(o => this.isPositiveOption(o.text));
          if (yesOpt) this.onSelectSingleOption(yesOpt.text);
        } else if (event.key.toLowerCase() === 'n') {
          const noOpt = effectiveOpts.find(o => this.isNegativeOption(o.text));
          if (noOpt) this.onSelectSingleOption(noOpt.text);
        }
      }
    }
  }

  getEffectiveOptions(): QuestionOption[] {
    if (this.question?.options && this.question.options.length > 0) {
      return this.question.options;
    }
    if (this.question?.type === 'consent' || this.question?.type === 'yesno') {
      return [
        { text: 'Yes', translations: {} } as any,
        { text: 'No', translations: {} } as any
      ];
    }
    return [];
  }

  getAlphaKey(index: number): string {
    return String.fromCharCode(65 + index);
  }

  isPositiveOption(text: string): boolean {
    const s = (text || '').toLowerCase().trim();
    return s === 'yes' || s.includes('agree');
  }

  isNegativeOption(text: string): boolean {
    const s = (text || '').toLowerCase().trim();
    return s === 'no' || s.includes('disagree');
  }

  getDisplayText(): string {
    if (this.currentLang && this.currentLang !== 'en' && this.question?.translations?.[this.currentLang]) {
      return this.question.translations[this.currentLang];
    }
    return this.question?.text || '';
  }

  getOptionText(opt: any): string {
    if (this.currentLang && this.currentLang !== 'en' && opt?.translations?.[this.currentLang]) {
      return opt.translations[this.currentLang];
    }
    return opt?.text || '';
  }

  getRowText(row: any): string {
    if (this.currentLang && this.currentLang !== 'en' && row?.translations?.[this.currentLang]) {
      return row.translations[this.currentLang];
    }
    return row?.text || '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['question'] && this.question) {
      this.errorMessage = '';
      this.dropdownSearch = '';
      this.initAnswerState();
    }
  }

  initAnswerState(): void {
    const prev = this.question.current_answer;
    this.otherText = this.question.current_other_text || '';

    if (this.question.type === 'multi') {
      this.multiSelected = Array.isArray(prev) ? [...prev] : [];
      this.currentAnswer = this.multiSelected;
    } else if (this.question.type === 'matrix') {
      this.matrixAnswers = typeof prev === 'object' && prev !== null ? { ...prev } : {};
      this.currentAnswer = this.matrixAnswers;
    } else {
      this.currentAnswer = prev !== undefined && prev !== null ? prev : (this.question.type === 'info' ? 'Viewed' : null);
    }
  }

  isMultiOptionChecked(optText: string): boolean {
    return this.multiSelected.includes(optText);
  }

  onSelectSingleOption(text: string): void {
    this.currentAnswer = text;
    this.errorMessage = '';
  }

  onCardMultiToggle(opt: QuestionOption): void {
    const isChecked = this.isMultiOptionChecked(opt.text);
    this.onMultiToggle(opt, !isChecked);
  }

  onMultiToggle(opt: QuestionOption, checked: boolean): void {
    if (opt.exclusive && checked) {
      this.multiSelected = [opt.text];
    } else {
      if (checked) {
        this.multiSelected = this.multiSelected.filter(t => {
          const matching = this.question.options.find(o => o.text === t);
          return !matching?.exclusive;
        });

        if (this.question.max && this.multiSelected.length >= this.question.max) {
          this.errorMessage = `You can pick up to ${this.question.max} options only.`;
          return;
        }
        this.multiSelected.push(opt.text);
      } else {
        this.multiSelected = this.multiSelected.filter(t => t !== opt.text);
      }
    }
    this.errorMessage = '';
    this.currentAnswer = this.multiSelected;
  }

  hasOtherSelected(): boolean {
    if (!this.currentAnswer) return false;
    const str = String(this.currentAnswer).toLowerCase();
    return str.includes('other');
  }

  isMultiOtherSelected(): boolean {
    return this.multiSelected.some(t => t.toLowerCase().includes('other'));
  }

  filteredDropdownOptions(): QuestionOption[] {
    if (!this.dropdownSearch.trim()) return this.question.options;
    const q = this.dropdownSearch.toLowerCase();
    return this.question.options.filter(o => o.text.toLowerCase().includes(q));
  }

  onMatrixSelect(row: string, opt: string): void {
    this.matrixAnswers[row] = opt;
    this.currentAnswer = this.matrixAnswers;
    this.errorMessage = '';
  }

  getFormattedLabel(): string {
    const f = (this.question.format || '').toLowerCase();
    if (f === 'pincode') return 'Pincode (6 digits)';
    if (f === 'phone') return 'Mobile Phone Number (10 digits)';
    if (f === 'email') return 'Email Address';
    return 'Your answer';
  }

  getFormattedPlaceholder(): string {
    const f = (this.question.format || '').toLowerCase();
    if (f === 'pincode') return 'e.g. 400001';
    if (f === 'phone') return 'e.g. 9876543210';
    if (f === 'email') return 'e.g. name@example.com';
    return '';
  }

  getFormattedHint(): string {
    const f = (this.question.format || '').toLowerCase();
    if (f === 'pincode') return 'Must be exactly 6 numeric digits';
    if (f === 'phone') return 'Must be exactly 10 digits';
    if (f === 'email') return 'Must be a valid email format';
    return '';
  }

  validate(): boolean {
    const q = this.question;
    const val = this.currentAnswer;

    if (q.type === 'info') return true;

    // Required check
    if (q.required) {
      if (val === null || val === undefined || val === '') {
        this.errorMessage = 'Please provide an answer before continuing.';
        return false;
      }
      if (q.type === 'multi' && (!Array.isArray(val) || val.length === 0)) {
        this.errorMessage = 'Please select at least one option.';
        return false;
      }
      if (q.type === 'matrix') {
        const rows = q.rows || [];
        for (const r of rows) {
          if (!this.matrixAnswers[r.text]) {
            this.errorMessage = `Please select an option for "${r.text}".`;
            return false;
          }
        }
      }
    }

    // Number bounds
    if (q.type === 'number' && val !== null && val !== '') {
      const num = Number(val);
      if (isNaN(num)) {
        this.errorMessage = 'Please enter a valid numeric value.';
        return false;
      }
      if (q.min !== undefined && num < q.min) {
        this.errorMessage = `Value must be at least ${q.min}.`;
        return false;
      }
      if (q.max !== undefined && num > q.max) {
        this.errorMessage = `Value cannot exceed ${q.max}.`;
        return false;
      }
    }

    // Minlength for text
    if ((q.type === 'text' || q.type === 'longtext') && val) {
      if (q.minlength && String(val).trim().length < q.minlength) {
        this.errorMessage = `Answer must be at least ${q.minlength} characters long.`;
        return false;
      }
    }

    // Formatted checks
    if (q.type === 'formatted' && val) {
      const fmt = (q.format || '').toLowerCase();
      const s = String(val).trim();
      if (fmt === 'pincode' && !/^\d{6}$/.test(s)) {
        this.errorMessage = 'Pincode must be exactly 6 digits.';
        return false;
      }
      if (fmt === 'phone' && !/^\d{10}$/.test(s)) {
        this.errorMessage = 'Phone number must be a 10-digit number.';
        return false;
      }
      if (fmt === 'email' && !/^[^@]+@[^@]+$/.test(s)) {
        this.errorMessage = 'Please enter a valid email address.';
        return false;
      }
    }

    // Other text requirement
    if (this.hasOtherSelected() || this.isMultiOtherSelected()) {
      if (!this.otherText.trim()) {
        this.errorMessage = 'Please specify other text.';
        return false;
      }
    }

    this.errorMessage = '';
    return true;
  }

  onNextClick(): void {
    if (!this.validate()) return;
    this.answerSubmitted.emit({
      answer: this.currentAnswer,
      otherText: this.otherText.trim() || undefined
    });
  }

  onBackClick(): void {
    this.backRequested.emit();
  }
}
