import type {
  QuestionOption,
  QuestionOptionIntegrity,
} from "@/lib/domain/question-option";

export interface AdminQuestionOptionsListResponse {
  items: QuestionOption[];
  integrity: QuestionOptionIntegrity;
  questionIsActive: boolean;
}

export interface AdminQuestionOptionCreateRequest {
  text: string;
  imageUrl?: string | null;
  position?: number;
  isCorrect?: boolean;
  isActive?: boolean;
}

export interface AdminQuestionOptionUpdateRequest {
  text?: string;
  imageUrl?: string | null;
  position?: number;
  isCorrect?: boolean;
  isActive?: boolean;
}

export interface AdminQuestionOptionResponse {
  option: QuestionOption;
}
