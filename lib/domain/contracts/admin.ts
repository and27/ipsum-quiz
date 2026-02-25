import type { PaginationQuery, PaginatedResult, UUID } from "@/lib/domain/common";

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

