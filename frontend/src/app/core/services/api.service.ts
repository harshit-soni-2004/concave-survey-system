import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SurveyListItem,
  SurveyDetail,
  ValidateResponse,
  DashboardData,
  DropoffReport,
  BatchTokensResponse,
  RespondentSession
} from '../models/survey.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(private http: HttpClient) {}

  // Survey Management
  getSurveys(): Observable<SurveyListItem[]> {
    return this.http.get<SurveyListItem[]>('/api/surveys');
  }

  getSurvey(id: number): Observable<SurveyDetail> {
    return this.http.get<SurveyDetail>(`/api/surveys/${id}`);
  }

  createSurvey(payload: string | { raw_content: string; title?: string; slug?: string; target?: number; deadline_at?: string }): Observable<SurveyDetail> {
    const body = typeof payload === 'string' ? { raw_content: payload } : payload;
    return this.http.post<SurveyDetail>('/api/surveys', body);
  }

  extractFile(file: File): Observable<{ filename: string; size: number; content: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ filename: string; size: number; content: string }>('/api/surveys/extract-file', formData);
  }

  validateSurvey(rawContent: string): Observable<ValidateResponse> {
    return this.http.post<ValidateResponse>('/api/surveys/validate', { raw_content: rawContent });
  }

  uploadVersion(surveyId: number, rawContent: string): Observable<SurveyDetail> {
    return this.http.post<SurveyDetail>(`/api/surveys/${surveyId}/versions`, { raw_content: rawContent });
  }

  approveVersion(surveyId: number, versionId: number): Observable<SurveyDetail> {
    return this.http.post<SurveyDetail>(`/api/surveys/${surveyId}/versions/${versionId}/approve`, {});
  }

  updateSurveyStatus(surveyId: number, status: string, closedReason?: string): Observable<SurveyDetail> {
    return this.http.patch<SurveyDetail>(`/api/surveys/${surveyId}/status`, { status, closed_reason: closedReason });
  }

  updateSurveyDeadline(surveyId: number, deadlineAt: string): Observable<SurveyDetail> {
    return this.http.patch<SurveyDetail>(`/api/surveys/${surveyId}/deadline`, { deadline_at: deadlineAt });
  }

  generateTokens(surveyId: number, count: number): Observable<BatchTokensResponse> {
    return this.http.post<BatchTokensResponse>(`/api/surveys/${surveyId}/tokens`, { count });
  }

  createTestSession(surveyId: number): Observable<{ token: string; survey_slug: string; url: string }> {
    return this.http.post<{ token: string; survey_slug: string; url: string }>(`/api/surveys/${surveyId}/test-session`, {});
  }

  cloneSurvey(id: number): Observable<SurveyDetail> {
    return this.http.post<SurveyDetail>(`/api/surveys/${id}/clone`, {});
  }

  // Dashboard & Exports
  getDashboard(surveyId: number): Observable<DashboardData> {
    return this.http.get<DashboardData>(`/api/surveys/${surveyId}/dashboard`);
  }

  getDropoffReport(surveyId: number): Observable<DropoffReport> {
    return this.http.get<DropoffReport>(`/api/surveys/${surveyId}/dropoff`);
  }

  getExportCsv(surveyId: number): Observable<Blob> {
    return this.http.get(`/api/surveys/${surveyId}/export?format=csv`, { responseType: 'blob' });
  }

  getExportXlsx(surveyId: number): Observable<Blob> {
    return this.http.get(`/api/surveys/${surveyId}/export?format=xlsx`, { responseType: 'blob' });
  }

  // Analytics & Health
  getOverview(): Observable<import('../models/survey.model').OverviewResponse> {
    return this.http.get<import('../models/survey.model').OverviewResponse>('/api/overview');
  }

  getSurveyAnalytics(id: number, days: number = 14): Observable<import('../models/survey.model').SurveyAnalyticsResponse> {
    return this.http.get<import('../models/survey.model').SurveyAnalyticsResponse>(`/api/surveys/${id}/analytics?days=${days}`);
  }

  getSurveyRespondents(
    id: number,
    status: string = '',
    page: number = 1,
    pageSize: number = 10
  ): Observable<import('../models/survey.model').SurveyRespondentsResponse> {
    let url = `/api/surveys/${id}/respondents?page=${page}&page_size=${pageSize}`;
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    return this.http.get<import('../models/survey.model').SurveyRespondentsResponse>(url);
  }

  getHealth(): Observable<import('../models/survey.model').HealthStatusResponse> {
    return this.http.get<import('../models/survey.model').HealthStatusResponse>('/api/health');
  }

  // Respondent Endpoints
  joinSurvey(slug: string): Observable<{ token: string; survey_slug: string; url: string }> {
    return this.http.post<{ token: string; survey_slug: string; url: string }>(`/api/surveys/${slug}/join`, {});
  }

  getRespondentSession(token: string): Observable<RespondentSession> {
    return this.http.get<RespondentSession>(`/api/respondent/${token}/session`);
  }

  submitAnswer(token: string, questionId: string, answerValue: any, otherText?: string): Observable<RespondentSession> {
    return this.http.post<RespondentSession>(`/api/respondent/${token}/answer`, {
      question_id: questionId,
      answer_value: answerValue,
      other_text: otherText
    });
  }

  goBack(token: string): Observable<RespondentSession> {
    return this.http.post<RespondentSession>(`/api/respondent/${token}/back`, {});
  }

  updateLanguage(token: string, language: string): Observable<RespondentSession> {
    return this.http.post<RespondentSession>(`/api/respondent/${token}/language`, { language });
  }
}
