import type { ISODateTimeString, UUID } from "./common";

export interface Question {
  id: UUID;
  topicId: UUID;
  topicName: string;
  statement: string;
  imageUrl: string | null;
  isActive: boolean;
  activeOptionsCount: number;
  activeCorrectOptionsCount: number;
  isBankReady: boolean;
  createdBy: UUID;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
