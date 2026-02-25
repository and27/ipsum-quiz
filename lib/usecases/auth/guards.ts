import type {
  AppRole,
  AuthenticatedSessionContext,
  SessionContext,
  UserProfile,
} from "@/lib/domain/auth";
import { isAppRole } from "@/lib/domain/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthGuardReason = "unauthenticated" | "missing_profile" | "forbidden";

export class AuthGuardError extends Error {
  readonly reason: AuthGuardReason;

  constructor(reason: AuthGuardReason, message?: string) {
    super(message ?? reason);
    this.reason = reason;
    this.name = "AuthGuardError";
  }
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClaims(data: unknown): { userId: string; email: string | null } | null {
  if (!isObjectLike(data)) {
    return null;
  }

  const claims = data.claims;
  if (!isObjectLike(claims)) {
    return null;
  }

  const sub = claims.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }

  const email = claims.email;

  return {
    userId: sub,
    email: typeof email === "string" ? email : null,
  };
}

function parseProfileRow(row: unknown): UserProfile | null {
  if (!isObjectLike(row)) {
    return null;
  }

  const id = row.id;
  const role = row.role;
  const fullName = row.full_name;
  const createdAt = row.created_at;
  const updatedAt = row.updated_at;

  if (typeof id !== "string") {
    return null;
  }

  if (!isAppRole(role)) {
    return null;
  }

  if (typeof createdAt !== "string" || typeof updatedAt !== "string") {
    return null;
  }

  if (fullName !== null && typeof fullName !== "string") {
    return null;
  }

  return {
    id,
    role,
    fullName,
    createdAt,
    updatedAt,
  };
}

export async function getCurrentSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();

  const claimsResponse = await supabase.auth.getClaims();
  const parsedClaims = parseClaims(claimsResponse.data);

  if (!parsedClaims) {
    return {
      userId: null,
      email: null,
      profile: null,
      role: null,
    };
  }

  const profileResponse = await supabase
    .from("profiles")
    .select("id, role, full_name, created_at, updated_at")
    .eq("id", parsedClaims.userId)
    .maybeSingle();

  const profile = parseProfileRow(profileResponse.data);

  return {
    userId: parsedClaims.userId,
    email: parsedClaims.email,
    profile,
    role: profile?.role ?? null,
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const session = await getCurrentSessionContext();
  return session.profile;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedSessionContext> {
  const session = await getCurrentSessionContext();

  if (!session.userId) {
    throw new AuthGuardError("unauthenticated");
  }

  if (!session.profile || !session.role) {
    throw new AuthGuardError("missing_profile");
  }

  return session as AuthenticatedSessionContext;
}

export async function requireRole(role: AppRole): Promise<AuthenticatedSessionContext> {
  const session = await requireAuthenticatedUser();

  if (session.role !== role) {
    throw new AuthGuardError("forbidden");
  }

  return session;
}

export async function requireAdmin(): Promise<AuthenticatedSessionContext> {
  return requireRole("admin");
}

export async function requireStudent(): Promise<AuthenticatedSessionContext> {
  return requireRole("student");
}

