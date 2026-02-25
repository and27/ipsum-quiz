import type { AttemptResult, AttemptSummary } from "@/lib/domain/simulator";
import type {
  ISODateTimeString,
  PaginatedResult,
  UUID,
} from "@/lib/domain/common";

export interface StartAttemptRequest {
  simulatorId: UUID;
  accessCode?: string;
}

export interface StartAttemptResponse {
  attemptId: UUID;
  resumed: boolean;
  expiresAt: ISODateTimeString;
  questionsTotal: number;
}

export interface SaveAttemptAnswerRequest {
  attemptId: UUID;
  simulatorVersionQuestionId: UUID;
  selectedOptionId: UUID | null;
}

export interface SaveAttemptAnswerResponse {
  attemptId: UUID;
  simulatorVersionQuestionId: UUID;
  selectedOptionId: UUID | null;
  answeredAt: ISODateTimeString | null;
}

export interface FinishAttemptRequest {
  attemptId: UUID;
}

export interface FinishAttemptResponse {
  attemptId: UUID;
  status: "finished" | "expired";
  scoreTotal: number;
  questionsTotal: number;
}

export type StudentAttemptHistoryResponse = PaginatedResult<AttemptSummary>;

export interface StudentAttemptResultResponse {
  attempt: AttemptResult;
}

