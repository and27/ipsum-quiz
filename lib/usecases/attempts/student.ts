import type {
  StartAttemptResponse,
  StudentActiveAttemptAnswer,
  StudentActiveAttemptResponse,
} from "@/lib/domain/contracts";
import { createClient } from "@/lib/supabase/server";
import {
  StudentAccessError,
  verifySimulatorAccessCodeForStudent,
} from "@/lib/usecases/simulators";

export type StudentAttemptErrorCode =
  | "simulator_not_available"
  | "max_attempts_reached"
  | "version_has_no_questions"
  | "active_attempt_not_found";

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

interface RawAttemptRow {
  id: string;
  simulator_id: string;
  simulator_version_id: string;
  status: "active" | "finished" | "expired";
  started_at: string;
  expires_at: string;
  questions_total: number;
}

interface RawAnswerRow {
  simulator_version_question_id: string;
  selected_option_id: string | null;
  answered_at: string | null;
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

function parseActiveAttemptRow(row: unknown): RawAttemptRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const value = row as RawAttemptRow;
  if (
    typeof value.id !== "string" ||
    typeof value.simulator_id !== "string" ||
    typeof value.simulator_version_id !== "string" ||
    value.status !== "active" ||
    typeof value.started_at !== "string" ||
    typeof value.expires_at !== "string" ||
    typeof value.questions_total !== "number"
  ) {
    return null;
  }

  return value;
}

function parseAnswerRows(rows: unknown[]): StudentActiveAttemptAnswer[] {
  return rows
    .map((row) => row as RawAnswerRow)
    .filter(
      (row) =>
        typeof row?.simulator_version_question_id === "string" &&
        (row.selected_option_id === null || typeof row.selected_option_id === "string") &&
        (row.answered_at === null || typeof row.answered_at === "string"),
    )
    .map((row) => ({
      simulatorVersionQuestionId: row.simulator_version_question_id,
      selectedOptionId: row.selected_option_id,
      answeredAt: row.answered_at,
    }));
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

export async function getActiveAttemptForStudent(input: {
  simulatorId: string;
  studentId: string;
}): Promise<StudentActiveAttemptResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, simulator_id, simulator_version_id, status, started_at, expires_at, questions_total",
    )
    .eq("simulator_id", input.simulatorId)
    .eq("student_id", input.studentId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const activeAttempt = parseActiveAttemptRow(data);
  if (!activeAttempt) {
    throw new StudentAttemptError(
      "active_attempt_not_found",
      "No active attempt found for this simulator.",
    );
  }

  const now = Date.now();
  if (Date.parse(activeAttempt.expires_at) <= now) {
    const { error: expireError } = await supabase
      .from("attempts")
      .update({
        status: "expired",
        finished_at: new Date(now).toISOString(),
      })
      .eq("id", activeAttempt.id)
      .eq("status", "active");

    if (expireError) {
      throw new Error(expireError.message);
    }

    throw new StudentAttemptError(
      "active_attempt_not_found",
      "No active attempt found for this simulator.",
    );
  }

  const { data: answerRows, error: answersError } = await supabase
    .from("attempt_answers")
    .select("simulator_version_question_id, selected_option_id, answered_at")
    .eq("attempt_id", activeAttempt.id)
    .order("simulator_version_question_id", { ascending: true });

  if (answersError) {
    throw new Error(answersError.message);
  }

  return {
    attemptId: activeAttempt.id,
    simulatorId: activeAttempt.simulator_id,
    simulatorVersionId: activeAttempt.simulator_version_id,
    status: "active",
    startedAt: activeAttempt.started_at,
    expiresAt: activeAttempt.expires_at,
    questionsTotal: activeAttempt.questions_total,
    answers: parseAnswerRows((answerRows ?? []) as unknown[]),
  };
}

export { StudentAccessError };

