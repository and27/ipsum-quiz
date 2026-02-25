import type { ISODateTimeString, UUID } from "./common";

export type AttemptStatus = "active" | "finished" | "expired";

export interface TopicScore {
  topicId: UUID;
  topicName: string;
  correctCount: number;
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
  questionsTotal: number;
}

export interface AttemptResult extends AttemptSummary {
  topicScores: TopicScore[];
}

