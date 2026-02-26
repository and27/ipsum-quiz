import type {
  StartAttemptResponse,
} from "@/lib/domain/contracts";
import { createClient } from "@/lib/supabase/server";
import {
  StudentAccessError,
  verifySimulatorAccessCodeForStudent,
} from "@/lib/usecases/simulators";

export type StudentAttemptErrorCode =
  | "simulator_not_available"
  | "max_attempts_reached"
  | "version_has_no_questions";

export class StudentAttemptError extends Error {
  readonly code: StudentAttemptErrorCode;

  constructor(code: StudentAttemptErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "StudentAttemptError";
  }
}

interface RawStartOrResumeRow {
  attempt_id: string;
  resumed: boolean;
  expires_at: string;
  questions_total: number;
  simulator_version_id: string;
}

function parseStartOrResumeRow(row: unknown): StartAttemptResponse | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const value = row as RawStartOrResumeRow;

  if (
    typeof value.attempt_id !== "string" ||
    typeof value.resumed !== "boolean" ||
    typeof value.expires_at !== "string" ||
    typeof value.questions_total !== "number" ||
    typeof value.simulator_version_id !== "string"
  ) {
    return null;
  }

  return {
    attemptId: value.attempt_id,
    resumed: value.resumed,
    expiresAt: value.expires_at,
    questionsTotal: value.questions_total,
    simulatorVersionId: value.simulator_version_id,
  };
}

function mapStartRpcError(errorMessage: string): StudentAttemptError {
  if (errorMessage.includes("SIMULATOR_NOT_AVAILABLE")) {
    return new StudentAttemptError(
      "simulator_not_available",
      "Simulator is not currently available.",
    );
  }
  if (errorMessage.includes("MAX_ATTEMPTS_REACHED")) {
    return new StudentAttemptError(
      "max_attempts_reached",
      "You already used the maximum number of attempts for this simulator.",
    );
  }
  if (errorMessage.includes("VERSION_HAS_NO_QUESTIONS")) {
    return new StudentAttemptError(
      "version_has_no_questions",
      "This simulator version has no questions available.",
    );
  }

  return new StudentAttemptError(
    "simulator_not_available",
    "Failed to start attempt.",
  );
}

export async function startOrResumeAttemptForStudent(input: {
  simulatorId: string;
  studentId: string;
  ipAddress: string;
  accessCode?: string;
}): Promise<StartAttemptResponse> {
  await verifySimulatorAccessCodeForStudent({
    simulatorId: input.simulatorId,
    studentId: input.studentId,
    ipAddress: input.ipAddress,
    accessCode: input.accessCode,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_or_resume_attempt", {
    p_simulator_id: input.simulatorId,
  });

  if (error) {
    throw mapStartRpcError(error.message);
  }

  const row = Array.isArray(data) ? data[0] : null;
  const parsed = parseStartOrResumeRow(row);
  if (!parsed) {
    throw new StudentAttemptError(
      "simulator_not_available",
      "Invalid attempt payload returned from database.",
    );
  }

  return parsed;
}

export { StudentAccessError };
