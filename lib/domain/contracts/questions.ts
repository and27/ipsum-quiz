import type { PaginatedResult } from "@/lib/domain/common";
import type { Question } from "@/lib/domain/question";

export interface AdminQuestionsListQuery {
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export type AdminQuestionsListResponse = PaginatedResult<Question>;

export interface AdminQuestionCreateRequest {
  topicId: string;
  statement: string;
  imageUrl?: string | null;
}

export interface AdminQuestionUpdateRequest {
  topicId?: string;
  statement?: string;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface AdminQuestionResponse {
  question: Question;
}

