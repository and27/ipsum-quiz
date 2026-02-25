import type { ISODateTimeString, UUID } from "./common";

export interface QuestionOption {
  id: UUID;
  questionId: UUID;
  position: number;
  text: string;
  imageUrl: string | null;
  isCorrect: boolean;
  isActive: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface QuestionOptionIntegrity {
  activeOptionsCount: number;
  activeCorrectOptionsCount: number;
  isReady: boolean;
}
