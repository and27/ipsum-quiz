import { createClient } from "@/lib/supabase/server";
import { verifyAccessCode } from "./admin";

const ACCESS_CODE_RATE_LIMIT_MAX_FAILURES = 5;
const ACCESS_CODE_RATE_LIMIT_WINDOW_MINUTES = 5;

export type StudentAccessErrorCode =
  | "simulator_not_found"
  | "invalid_access_code"
  | "access_code_required"
  | "access_code_rate_limited";

export class StudentAccessError extends Error {
  readonly code: StudentAccessErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(
    code: StudentAccessErrorCode,
    message?: string,
    retryAfterSeconds?: number,
  ) {
    super(message ?? code);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "StudentAccessError";
  }
}

function normalizeAccessCode(value: string | undefined): string {
  return (value ?? "").trim();
}

function parseIpAddress(rawIp: string | null): string {
  if (!rawIp) {
    return "0.0.0.0";
  }
  const first = rawIp.split(",")[0]?.trim();
  return first || "0.0.0.0";
}

export function extractClientIpAddress(headers: Headers): string {
  return parseIpAddress(
    headers.get("x-forwarded-for") ??
      headers.get("x-real-ip") ??
      headers.get("cf-connecting-ip"),
  );
}

async function getVisibleSimulatorAccessInfo(simulatorId: string): Promise<{
  id: string;
  accessCodeHash: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulators")
    .select("id, access_code_hash, status, is_active")
    .eq("id", simulatorId)
    .eq("status", "published")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data.id !== "string") {
    throw new StudentAccessError(
      "simulator_not_found",
      "No se encontro el simulador.",
    );
  }

  return {
    id: data.id,
    accessCodeHash:
      typeof data.access_code_hash === "string" ? data.access_code_hash : null,
  };
}

async function countFailedAccessAttempts(
  simulatorId: string,
  studentId: string,
  ipAddress: string,
): Promise<number> {
  const supabase = await createClient();
  const windowStart = new Date(
    Date.now() - ACCESS_CODE_RATE_LIMIT_WINDOW_MINUTES * 60_000,
  ).toISOString();

  const { count, error } = await supabase
    .from("access_code_attempts")
    .select("id", { count: "exact", head: true })
    .eq("simulator_id", simulatorId)
    .eq("student_id", studentId)
    .eq("ip", ipAddress)
    .eq("success", false)
    .gte("created_at", windowStart);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function insertAccessCodeAttempt(input: {
  simulatorId: string;
  studentId: string;
  ipAddress: string;
  success: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("access_code_attempts").insert({
    simulator_id: input.simulatorId,
    student_id: input.studentId,
    ip: input.ipAddress,
    success: input.success,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifySimulatorAccessCodeForStudent(input: {
  simulatorId: string;
  studentId: string;
  ipAddress: string;
  accessCode?: string;
}): Promise<void> {
  const simulator = await getVisibleSimulatorAccessInfo(input.simulatorId);

  if (!simulator.accessCodeHash) {
    return;
  }

  const failedAttempts = await countFailedAccessAttempts(
    simulator.id,
    input.studentId,
    input.ipAddress,
  );
  if (failedAttempts >= ACCESS_CODE_RATE_LIMIT_MAX_FAILURES) {
    throw new StudentAccessError(
      "access_code_rate_limited",
      "Demasiados intentos de codigo invalido. Intenta nuevamente en unos minutos.",
      ACCESS_CODE_RATE_LIMIT_WINDOW_MINUTES * 60,
    );
  }

  const accessCode = normalizeAccessCode(input.accessCode);
  if (!accessCode) {
    throw new StudentAccessError(
      "access_code_required",
      "El codigo de acceso es obligatorio para este simulador.",
    );
  }

  const isValid = verifyAccessCode(accessCode, simulator.accessCodeHash);
  await insertAccessCodeAttempt({
    simulatorId: simulator.id,
    studentId: input.studentId,
    ipAddress: input.ipAddress,
    success: isValid,
  });

  if (!isValid) {
    const nextFailures = failedAttempts + 1;
    if (nextFailures >= ACCESS_CODE_RATE_LIMIT_MAX_FAILURES) {
      throw new StudentAccessError(
        "access_code_rate_limited",
        "Demasiados intentos de codigo invalido. Intenta nuevamente en unos minutos.",
        ACCESS_CODE_RATE_LIMIT_WINDOW_MINUTES * 60,
      );
    }

    throw new StudentAccessError(
      "invalid_access_code",
      "El codigo de acceso es invalido.",
    );
  }
}
