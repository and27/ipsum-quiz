import type { AttemptResult, AttemptSummary } from "@/lib/domain/simulator";
import type {
  ISODateTimeString,
  PaginatedResult,
  UUID,
} from "@/lib/domain/common";
import type { TopicScore } from "@/lib/domain/simulator";

export interface StudentVisibleSimulator {
  id: UUID;
  title: string;
  description: string | null;
  durationMinutes: number;
  maxAttempts: number;
  hasAccessCode: boolean;
}

export interface StartAttemptRequest {
  simulatorId: UUID;
  accessCode?: string;
}

export interface StartAttemptResponse {
  attemptId: UUID;
  resumed: boolean;
  expiresAt: ISODateTimeString;
  questionsTotal: number;
  simulatorVersionId: UUID;
}

export interface StudentActiveAttemptAnswer {
  simulatorVersionQuestionId: UUID;
  selectedOptionId: UUID | null;
  answeredAt: ISODateTimeString | null;
}

export interface StudentActiveAttemptResponse {
  attemptId: UUID;
  simulatorId: UUID;
  simulatorVersionId: UUID;
  status: "active";
  startedAt: ISODateTimeString;
  expiresAt: ISODateTimeString;
  questionsTotal: number;
  answers: StudentActiveAttemptAnswer[];
}

export interface StudentExamQuestionOption {
  id: UUID;
  position: number;
  text: string;
  imageUrl: string | null;
}

export interface StudentExamQuestion {
  id: UUID;
  position: number;
  topicId: UUID;
  topicName: string;
  statement: string;
  imageUrl: string | null;
  selectedOptionId: UUID | null;
  options: StudentExamQuestionOption[];
}

export interface StudentExamStateResponse {
  attemptId: UUID;
  simulatorId: UUID;
  simulatorTitle: string;
  simulatorVersionId: UUID;
  status: "active";
  startedAt: ISODateTimeString;
  expiresAt: ISODateTimeString;
  questionsTotal: number;
  currentQuestionIndex: number;
  questions: StudentExamQuestion[];
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
  topicScores: TopicScore[];
}

export type StudentAttemptHistoryResponse = PaginatedResult<AttemptSummary>;

export interface StudentAttemptResultResponse {
  attempt: AttemptResult;
}

export interface StudentVisibleSimulatorsQuery {
  page?: number;
  pageSize?: number;
}

export type StudentVisibleSimulatorsResponse = PaginatedResult<StudentVisibleSimulator>;

export interface StudentVerifyAccessCodeRequest {
  accessCode?: string;
}

export interface StudentVerifyAccessCodeResponse {
  ok: true;
}
