import type { PaginationQuery, PaginatedResult, UUID } from "@/lib/domain/common";
import type { SimulatorCampus } from "@/lib/domain/simulator";

export interface ReportFilters extends PaginationQuery {
  simulatorId?: UUID;
  studentId?: UUID;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportTopicBreakdown {
  topicId: UUID;
  topicName: string;
  averageScore: number;
  attemptsCount: number;
}

export interface SimulatorReportItem {
  simulatorId: UUID;
  simulatorTitle: string;
  attemptsCount: number;
  averageScore: number;
  topicBreakdown: ReportTopicBreakdown[];
}

export interface StudentReportItem {
  studentId: UUID;
  studentEmail: string | null;
  attemptsCount: number;
  averageScore: number;
  latestAttemptAt: string | null;
  topicBreakdown: ReportTopicBreakdown[];
}

export type AdminSimulatorReportsResponse = PaginatedResult<SimulatorReportItem>;

export type AdminStudentReportsResponse = PaginatedResult<StudentReportItem>;

export interface AdminDashboardFilters {
  simulatorId?: UUID;
  campus?: SimulatorCampus;
  topicId?: UUID;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminDashboardKpis {
  attemptsTotal: number;
  finishedCount: number;
  expiredCount: number;
  averageScorePercent: number;
  blankAnswersTotal: number;
}

export interface AdminDashboardSimulatorRow {
  simulatorId: UUID;
  simulatorTitle: string;
  campus: SimulatorCampus;
  attempts: number;
  finished: number;
  expired: number;
  averageScorePercent: number;
  blankAnswersTotal: number;
}

export interface AdminDashboardStudentRow {
  studentId: UUID;
  studentName: string;
  attempts: number;
  finished: number;
  expired: number;
  averageScorePercent: number;
  blankAnswersTotal: number;
  latestAttemptAt: string | null;
}

export interface AdminDashboardTopicRow {
  topicId: UUID;
  topicName: string;
  correctCount: number;
  blankCount: number;
  totalCount: number;
  averageScorePercent: number;
}

export interface AdminDashboardResponse {
  filters: AdminDashboardFilters;
  kpis: AdminDashboardKpis;
  rows: AdminDashboardSimulatorRow[];
  studentRows: AdminDashboardStudentRow[];
  topicRows: AdminDashboardTopicRow[];
}

export interface AdminStudentTopicSummary {
  topicId: UUID;
  topicName: string;
  correctCount: number;
  blankCount: number;
  totalCount: number;
}

export interface AdminStudentAttemptRow {
  attemptId: UUID;
  simulatorId: UUID;
  simulatorTitle: string;
  campus: SimulatorCampus;
  status: "finished" | "expired";
  startedAt: string;
  finishedAt: string | null;
  elapsedMinutes: number;
  scoreTotal: number;
  blankCount: number;
  questionsTotal: number;
  questionResults: AdminStudentAttemptQuestionRow[];
}

export interface AdminStudentAttemptQuestionRow {
  simulatorVersionQuestionId: UUID;
  position: number;
  topicName: string;
  statement: string;
  selectedOptionText: string | null;
  correctOptionText: string | null;
  isCorrect: boolean;
  isBlank: boolean;
}

export interface AdminStudentDetailResponse {
  studentId: UUID;
  studentName: string;
  filters: AdminDashboardFilters;
  attemptsTotal: number;
  averageScorePercent: number;
  blankAnswersTotal: number;
  attempts: AdminStudentAttemptRow[];
  topicSummary: AdminStudentTopicSummary[];
}

export interface AdminStudentExportTopicColumn {
  topicId: UUID;
  topicName: string;
}

export interface AdminStudentExportRow {
  studentId: UUID;
  studentName: string;
  attempts: number;
  finished: number;
  expired: number;
  averageScorePercent: number;
  totalCorrectAnswers: number;
  totalQuestions: number;
  averageElapsedMinutes: number;
  blankAnswersTotal: number;
  latestAttemptAt: string | null;
  topicBreakdown: Record<
    UUID,
    {
      correctCount: number;
      totalCount: number;
    }
  >;
}

export interface AdminStudentExportData {
  filters: AdminDashboardFilters;
  topicColumns: AdminStudentExportTopicColumn[];
  rows: AdminStudentExportRow[];
}
