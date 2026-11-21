import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
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
          {{ question.text }}
          <span *ngIf="question.required" class="required-star" title="Required">*</span>
        </h2>
        <span *ngIf="question.type === 'multi' && question.max" class="hint-text">
          (Choose up to {{ question.max }})
        </span>
      </div>

      <!-- Inline Error Message -->
      <div *ngIf="errorMessage" class="error-msg">
        <mat-icon>error_outline</mat-icon> {{ errorMessage }}
      </div>

      <!-- Input Switcher for 13 Types -->
      <div class="input-area">

        <!-- 1. Single / 11. YesNo / 12. Consent -->
        <div *ngIf="question.type === 'single' || question.type === 'yesno' || question.type === 'consent'" class="options-group">
          <mat-radio-group [(ngModel)]="currentAnswer" class="radio-vertical">
            <div
              *ngFor="let opt of question.options"
              class="option-card"
              [class.selected]="currentAnswer === opt.text"
              (click)="onSelectSingleOption(opt.text)"
            >
              <mat-radio-button [value]="opt.text" class="opt-radio">
                <span class="option-label-text">{{ opt.text }}</span>
              </mat-radio-button>
            </div>
          </mat-radio-group>
          <!-- Other Text Box for Single -->
          <div *ngIf="hasOtherSelected()" class="other-input-wrap">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Please specify</mat-label>
              <input matInput [(ngModel)]="otherText" placeholder="Specify here..." />
            </mat-form-field>
          </div>
        </div>

        <!-- 2. Multi Select -->
        <div *ngIf="question.type === 'multi'" class="options-group">
          <div
            *ngFor="let opt of question.options"
            class="option-card checkbox-card"
            [class.selected]="isMultiOptionChecked(opt.text)"
            (click)="onCardMultiToggle(opt)"
          >
            <mat-checkbox
              [checked]="isMultiOptionChecked(opt.text)"
              class="opt-checkbox"
            >
              <span class="option-label-text">{{ opt.text }}</span>
            </mat-checkbox>
          </div>
          <!-- Other Text Box for Multi -->
          <div *ngIf="isMultiOtherSelected()" class="other-input-wrap">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Please specify</mat-label>
              <input matInput [(ngModel)]="otherText" placeholder="Specify other..." />
            </mat-form-field>
          </div>
        </div>

        <!-- 3. Dropdown with search filter -->
        <div *ngIf="question.type === 'dropdown'" class="dropdown-wrap">
          <mat-form-field appearance="outline" class="full-width">
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
                {{ opt.text }}
              </mat-option>
            </mat-select>
          </mat-form-field>
          <div *ngIf="hasOtherSelected()" class="other-input-wrap">
            <mat-form-field appearance="outline" class="full-width">
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
                  <th *ngFor="let opt of question.options" class="matrix-opt-col">{{ opt.text }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of question.rows">
                  <td class="matrix-row-title">{{ row.text }}</td>
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
          <mat-form-field appearance="outline" class="full-width">
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
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Your answer</mat-label>
            <input matInput [(ngModel)]="currentAnswer" />
            <mat-hint *ngIf="question.minlength">Minimum {{ question.minlength }} characters</mat-hint>
          </mat-form-field>
        </div>

        <!-- 9. Longtext -->
        <div *ngIf="question.type === 'longtext'" class="input-wrap">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Your detailed comments</mat-label>
            <textarea matInput rows="4" [(ngModel)]="currentAnswer"></textarea>
            <mat-hint *ngIf="question.minlength">Minimum {{ question.minlength }} characters</mat-hint>
          </mat-form-field>
        </div>

        <!-- 10. Formatted (pincode, phone, email) -->
        <div *ngIf="question.type === 'formatted'" class="input-wrap">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ getFormattedLabel() }}</mat-label>
            <input matInput [(ngModel)]="currentAnswer" [placeholder]="getFormattedPlaceholder()" />
            <mat-hint>{{ getFormattedHint() }}</mat-hint>
          </mat-form-field>
        </div>

        <!-- 13. Info -->
        <div *ngIf="question.type === 'info'" class="info-content">
          <p class="info-text">{{ question.text }}</p>
        </div>

      </div>

      <!-- Action Footer: Back & Next Button -->
      <div class="nav-footer">
        <button
          *ngIf="question.can_go_back"
          mat-stroked-button
          type="button"
          (click)="onBackClick()"
          class="back-btn"
          [disabled]="submitting"
        >
          <mat-icon>arrow_back</mat-icon> Back
        </button>

        <span class="spacer"></span>

        <button
          mat-raised-button
          color="primary"
          type="button"
          (click)="onNextClick()"
          class="next-btn"
          [disabled]="submitting"
        >
          {{ question.type === 'info' ? 'Continue' : 'Next' }}
          <mat-icon>arrow_forward</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .question-box {
      background: #ffffff;
      border-radius: 12px;
      padding: 24px 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
      width: 100%;
      box-sizing: border-box;
    }
    .question-header {
      margin-bottom: 24px;
    }
    .question-text {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.4;
      color: #0f172a;
      margin: 0;
    }
    .required-star {
      color: #ef4444;
      margin-left: 4px;
    }
    .hint-text {
      display: block;
      margin-top: 6px;
      font-size: 13px;
      color: #64748b;
    }
    .error-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 20px;
      font-size: 14px;
      font-weight: 500;
    }
    .input-area {
      margin-bottom: 32px;
    }
    .full-width {
      width: 100%;
    }
    .options-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .radio-vertical {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .opt-radio, .checkbox-row {
      width: 100%;
    }
    .option-card {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      width: 100%;
      box-sizing: border-box;
    }
    .option-card:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .option-card.selected {
      background: #eff6ff;
      border-color: #2563eb;
      box-shadow: 0 0 0 1px #2563eb;
    }
    .option-card mat-radio-button,
    .option-card mat-checkbox {
      width: 100%;
      pointer-events: none;
    }
    .option-label-text {
      font-size: 15px;
      font-weight: 500;
      color: #1e293b;
      margin-left: 4px;
    }
    .option-card.selected .option-label-text {
      font-weight: 600;
      color: #1d4ed8;
    }
    .other-input-wrap {
      margin-top: 12px;
    }
    .dropdown-wrap {
      max-width: 480px;
    }
    .search-box {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .dropdown-filter-input {
      width: 100%;
      padding: 8px;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 14px;
    }
    .rating-wrap {
      max-width: 440px;
    }
    .rating-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .rating-buttons {
      display: flex;
      gap: 10px;
    }
    .rating-btn {
      flex: 1;
      height: 48px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .rating-btn:hover {
      background: #f1f5f9;
    }
    .rating-btn.selected {
      background: #3b82f6;
      color: #ffffff;
      border-color: #3b82f6;
    }
    .nps-wrap {
      width: 100%;
    }
    .nps-buttons {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    .nps-btn {
      flex: 1;
      min-width: 36px;
      height: 44px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .nps-btn:hover {
      background: #f8fafc;
    }
    .nps-btn.selected {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }
    .nps-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
      margin-top: 8px;
    }
    .matrix-table-wrap {
      overflow-x: auto;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
    }
    .matrix-table th {
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    .matrix-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .matrix-item-col {
      text-align: left;
      min-width: 180px;
    }
    .matrix-row-title {
      text-align: left;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }
    .info-content {
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 16px 20px;
      border-radius: 4px;
    }
    .info-text {
      font-size: 16px;
      color: #334155;
      margin: 0;
      line-height: 1.6;
    }
    .nav-footer {
      display: flex;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }
    .spacer {
      flex: 1;
    }
    .back-btn {
      height: 44px;
      padding: 0 20px;
      font-weight: 600;
    }
    .next-btn {
      height: 44px;
      padding: 0 24px;
      font-weight: 600;
      font-size: 15px;
    }
  `]
})
export class QuestionRendererComponent implements OnChanges {
  @Input() question!: QuestionView;
  @Input() submitting = false;

  @Output() answerSubmitted = new EventEmitter<{ answer: any; otherText?: string }>();
  @Output() backRequested = new EventEmitter<void>();

  currentAnswer: any = null;
  otherText = '';
  multiSelected: string[] = [];
  matrixAnswers: { [row: string]: string } = {};
  dropdownSearch = '';
  errorMessage = '';

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
      // Exclusive option unselects all others
      this.multiSelected = [opt.text];
    } else {
      if (checked) {
        // Remove any exclusive options if regular option checked
        this.multiSelected = this.multiSelected.filter(t => {
          const matching = this.question.options.find(o => o.text === t);
          return !matching?.exclusive;
        });

        // Check max bounds
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
      if (fmt === 'email' && !/^[^@]+@[^@]+\.[^@]+$/.test(s)) {
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
