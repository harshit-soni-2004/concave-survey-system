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
  target: number;
  completed_count: number;
  deadline_at?: string;
  created_at: string;
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
  target: number;
  done: number;
  left: number;
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
}

export interface QuestionOption {
  text: string;
  fixed?: boolean;
  other?: boolean;
  exclusive?: boolean;
}

export interface QuestionRow {
  text: string;
}

export interface QuestionView {
  id: string;
  type: string;
  text: string;
  required: boolean;
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
