import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SurveyListItem,
  SurveyDetail,
  ValidateResponse,
  DashboardData,
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

  createSurvey(rawContent: string): Observable<SurveyDetail> {
    return this.http.post<SurveyDetail>('/api/surveys', { raw_content: rawContent });
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

  // Dashboard & Exports
  getDashboard(surveyId: number): Observable<DashboardData> {
    return this.http.get<DashboardData>(`/api/surveys/${surveyId}/dashboard`);
  }

  getExportCsv(surveyId: number): Observable<Blob> {
    return this.http.get(`/api/surveys/${surveyId}/export?format=csv`, { responseType: 'blob' });
  }

  getExportXlsx(surveyId: number): Observable<Blob> {
    return this.http.get(`/api/surveys/${surveyId}/export?format=xlsx`, { responseType: 'blob' });
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
}
