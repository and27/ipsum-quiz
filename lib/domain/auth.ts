import type { ISODateTimeString, UUID } from "./common";

export const APP_ROLES = ["admin", "student"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface UserProfile {
  id: UUID;
  role: AppRole;
  fullName: string | null;
  gradeScore: number | null;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface SessionContext {
  userId: UUID | null;
  email: string | null;
  profile: UserProfile | null;
  role: AppRole | null;
}

export interface AuthenticatedSessionContext extends SessionContext {
  userId: UUID;
  profile: UserProfile;
  role: AppRole;
}

export function isAppRole(value: unknown): value is AppRole {
  return APP_ROLES.some((role) => role === value);
}
