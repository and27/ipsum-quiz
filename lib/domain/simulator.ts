import type { ISODateTimeString, UUID } from "./common";

export type SimulatorStatus = "draft" | "published";
export type AttemptStatus = "active" | "finished" | "expired";
export type SimulatorVersionStatus = "draft" | "published" | "archived";
export type SimulatorCampus = "canar" | "azogues";

export interface Simulator {
  id: UUID;
  title: string;
  description: string | null;
  campus: SimulatorCampus;
  accessCode?: string | null;
  maxAttempts: number;
  durationMinutes: number;
  isActive: boolean;
  status: SimulatorStatus;
  publishedVersionId: UUID | null;
  hasAccessCode: boolean;
  createdBy: UUID;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface SimulatorVersion {
  id: UUID;
  simulatorId: UUID;
  versionNumber: number;
  status: SimulatorVersionStatus;
  createdFromVersionId: UUID | null;
  publishedAt: ISODateTimeString | null;
  hasAttempts: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface SimulatorVersionQuestion {
  id: UUID;
  simulatorVersionId: UUID;
  position: number;
  topicId: UUID;
  topicName: string;
  statement: string;
  imageUrl: string | null;
  sourceQuestionId: UUID | null;
}

export interface PublishValidationIssue {
  code: string;
  message: string;
  versionQuestionId?: UUID;
  sourceQuestionId?: UUID;
}

export interface SimulatorPublishValidation {
  simulatorId: UUID;
  versionId: UUID;
  isValid: boolean;
  issues: PublishValidationIssue[];
}

export interface TopicScore {
  topicId: UUID;
  topicName: string;
  correctCount: number;
  blankCount: number;
  totalCount: number;
}

export interface AttemptSummary {
  id: UUID;
  simulatorId: UUID;
  simulatorVersionId: UUID;
  studentId: UUID;
  status: AttemptStatus;
  startedAt: ISODateTimeString;
  expiresAt: ISODateTimeString;
  finishedAt: ISODateTimeString | null;
  scoreTotal: number | null;
  blankCount: number | null;
  questionsTotal: number;
}

export interface AttemptResult extends AttemptSummary {
  topicScores: TopicScore[];
}
