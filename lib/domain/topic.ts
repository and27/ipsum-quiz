import type { ISODateTimeString, UUID } from "./common";

export interface Topic {
  id: UUID;
  name: string;
  isActive: boolean;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

