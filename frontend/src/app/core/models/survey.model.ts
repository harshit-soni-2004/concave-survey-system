export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'researcher';
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ValidationError {
  line: number;
  message: string;
}

export interface ValidateResponse {
  valid: boolean;
  errors: ValidationError[];
}

export interface QuotaItem {
  id?: number;
  question_id: string;
  value: string;
  question_id_2?: string;
  value_2?: string;
  target: number;
}

export interface VersionItem {
  id: number;
  version_number: number;
  status: 'DRAFT' | 'APPROVED';
  created_at: string;
  approved_at?: string;
  approved_by?: number;
  raw_content?: string;
  target?: number;
}

export interface SurveyListItem {
  id: number;
  slug: string;
  title: string;
  status: 'DRAFT' | 'LIVE' | 'CLOSED';
  closed_reason?: string;
  target: number;
  completed_count: number;
  started_count?: number;
  terminated_count?: number;
  last_activity?: string;
  deadline_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface SurveyDetail {
  id: number;
  slug: string;
  title: string;
  status: 'DRAFT' | 'LIVE' | 'CLOSED';
  target: number;
  deadline_at?: string;
  closed_at?: string;
  closed_reason?: string;
  created_at: string;
  updated_at: string;
  versions: VersionItem[];
  quotas: QuotaItem[];
}

export interface QuotaProgress {
  id: number;
  question_id: string;
  value: string;
  question_id_2?: string;
  value_2?: string;
  target: number;
  done: number;
  left: number;
}

export interface QualityFlags {
  speeders: number;
  straight_liners: number;
  total_flagged: number;
}

export interface DropoffItem {
  question_id: string;
  question_text: string;
  question_type: string;
  reached: number;
  stopped: number;
  dropoff_rate: number;
}

export interface DropoffReport {
  survey_id: number;
  survey_title: string;
  total_respondents: number;
  questions: DropoffItem[];
}

export interface TerminationReasonItem {
  reason: string;
  count: number;
}

export interface DashboardData {
  survey_id: number;
  survey_title: string;
  survey_slug: string;
  survey_status: string;
  closed_reason?: string;
  target: number;
  started: number;
  completed: number;
  terminated: number;
  in_progress: number;
  quotas: QuotaProgress[];
  terminations: TerminationReasonItem[];
  quality_flags?: QualityFlags;
}

export interface QuestionOption {
  text: string;
  translations?: Record<string, string>;
  fixed?: boolean;
  other?: boolean;
  exclusive?: boolean;
}

export interface QuestionRow {
  text: string;
  translations?: Record<string, string>;
}

export interface QuestionView {
  id: string;
  type: string;
  text: string;
  required: boolean;
  translations?: Record<string, string>;
  active_language?: string;
  options: QuestionOption[];
  rows: QuestionRow[];
  min?: number;
  max?: number;
  minlength?: number;
  low_label?: string;
  high_label?: string;
  format?: string;
  current_answer?: any;
  current_other_text?: string;
  can_go_back: boolean;
  progress_percentage: number;
}

export interface RespondentSession {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'TERMINATED' | 'CLOSED';
  token: string;
  survey_id?: number;
  survey_title: string;
  survey_slug: string;
  is_test: boolean;
  screen: 'Question' | 'Completed' | 'Not eligible' | 'Survey closed' | 'Already completed';
  termination_reason?: string;
  is_silent: boolean;
  question?: QuestionView;
}

export interface TokenItem {
  token: string;
  url: string;
}

export interface BatchTokensResponse {
  survey_id: number;
  tokens: TokenItem[];
}

export interface DailyCountItem {
  date: string;
  count: number;
}

export interface DeadlineItem {
  id: number;
  title: string;
  slug: string;
  status: string;
  deadline_at: string;
  days_left?: number;
  hours_left?: number;
}

export interface QuotaAlertItem {
  survey_id: number;
  survey_title: string;
  survey_slug: string;
  question_id: string;
  value: string;
  question_id_2?: string;
  value_2?: string;
  target: number;
  done: number;
  percent: number;
}

export interface RecentEventItem {
  event_type: string;
  survey_id: number;
  survey_title: string;
  survey_slug: string;
  message: string;
  timestamp: string;
}

export interface OverviewResponse {
  live_studies: number;
  total_completes: number;
  total_target: number;
  overall_progress_percent: number;
  in_progress: number;
  terminated: number;
  completes_per_day: DailyCountItem[];
  status_counts: Record<string, number>;
  soonest_deadlines: DeadlineItem[];
  quota_alerts: QuotaAlertItem[];
  recent_events: RecentEventItem[];
}

export interface AnalyticsDailyTrendItem {
  date: string;
  started: number;
  completed: number;
  terminated: number;
  cumulative_completes: number;
  target_pace: number;
}

export interface AnalyticsAlerts {
  quota_at_or_above_90: QuotaAlertItem[];
  deadline_within_48h: boolean;
  projected_finish_after_deadline: boolean;
  speeder_rate_above_15: boolean;
  speeder_rate_percent: number;
  summary: string[];
}

export interface SurveyAnalyticsResponse {
  survey_id: number;
  survey_title: string;
  survey_slug: string;
  survey_status: string;
  closed_reason?: string;
  version_number: number;
  target: number;
  started: number;
  completed: number;
  terminated: number;
  in_progress: number;
  completion_rate: number;
  incidence_rate: number;
  median_completion_time_seconds?: number;
  average_completion_time_seconds?: number;
  projected_finish_date?: string;
  days_left_to_deadline?: number;
  daily_trends: AnalyticsDailyTrendItem[];
  question_analytics: any[];
  top_termination_reasons: TerminationReasonItem[];
  dropoff: DropoffItem[];
  alerts: AnalyticsAlerts;
  quality_flags: QualityFlags;
}

export interface RespondentListItem {
  id: string;
  masked_id: string;
  token: string;
  status: string;
  version: number;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  quality_flag?: string;
  termination_reason?: string;
  current_question_id?: string;
}

export interface SurveyRespondentsResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: RespondentListItem[];
}

export interface HealthStatusResponse {
  status: string;
  service: string;
  version: string;
  database?: string;
  database_engine?: string;
}
