export const RESULT_SUBMISSIONS_PREFIX = "mind-compass-lab/result-submissions/";

export interface ResultParticipant {
  name: string;
  birthDate: string;
  age: number | null;
}

export interface ResultTypeScore {
  type: number;
  name: string;
  title: string;
  score: number;
}

export interface ResultCenterScore {
  label: string;
  theme: string;
  score: number;
  percent: number;
}

export interface ResultReportSnapshot {
  title: string;
  tagline: string;
  summary: string;
}

export interface ResultSnapshot {
  primaryType: number;
  primaryTypeName: string;
  primaryTypeTitle: string;
  wingType: number;
  wingCode: string;
  wingName: string;
  wingTitle: string;
  typeScores: Record<number, number>;
  rankedTypes: ResultTypeScore[];
  centers: ResultCenterScore[];
  report: ResultReportSnapshot | null;
}

export interface ResultSubmissionPayload {
  counselorName: string;
  respondentPhone: string;
  participant: ResultParticipant;
  result: ResultSnapshot;
  answers: Record<number, number>;
  submittedFrom?: string;
}

export interface ResultSubmission extends ResultSubmissionPayload {
  id: string;
  createdAt: string;
  blobPathname: string;
  blobUrl?: string;
}

export interface ResultSubmissionListResponse {
  submissions: ResultSubmission[];
  total: number;
  hasFullAccess: boolean;
  accessKeyConfigured: boolean;
}
