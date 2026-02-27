import type {
  FinishAttemptResponse,
  FinishAttemptQuestionResult,
  SaveAttemptAnswerResponse,
  StudentAttemptHistoryResponse,
  StudentAttemptResultResponse,
  StudentExamQuestion,
  StudentExamQuestionOption,
  StudentExamStateResponse,
  StartAttemptResponse,
  StudentActiveAttemptAnswer,
  StudentActiveAttemptResponse,
} from "@/lib/domain/contracts";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  StudentAccessError,
  verifySimulatorAccessCodeForStudent,
} from "@/lib/usecases/simulators";

export type StudentAttemptErrorCode =
  | "simulator_not_available"
  | "max_attempts_reached"
  | "version_has_no_questions"
  | "active_attempt_not_found"
  | "attempt_not_found"
  | "attempt_not_active"
  | "attempt_already_closed"
  | "answer_not_found"
  | "option_not_found"
  | "attempt_expired";

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

interface RawAttemptSummaryRow {
  id: string;
  simulator_id: string;
  simulator_version_id: string;
  student_id: string;
  status: "active" | "finished" | "expired";
  started_at: string;
  expires_at: string;
  finished_at: string | null;
  score_total: number | null;
  blank_count: number | null;
  questions_total: number;
}

interface RawAttemptTopicScoreRow {
  topic_id: string;
  correct_count: number;
  blank_count: number | null;
  total_count: number;
  topics: { name?: unknown } | Array<{ name?: unknown }> | null;
}

interface RawAnswerRow {
  simulator_version_question_id: string;
  selected_option_id: string | null;
  answered_at: string | null;
}

interface RawSaveAnswerRow {
  selected_option_id: string | null;
  answered_at: string | null;
}

interface RawScoreRow {
  simulator_version_question_id: string;
  selected_option_id: string | null;
  question_topic_id: string;
  topic_name: string | null;
  correct_option_id: string | null;
}

interface TopicScoreAggregate {
  topicId: string;
  topicName: string;
  totalCount: number;
  correctCount: number;
  blankCount: number;
}

interface RawAttemptAnswerDetailRow {
  simulator_version_question_id: string;
  selected_option_id: string | null;
  is_correct: boolean | null;
  simulator_version_questions:
    | {
        id?: unknown;
        position?: unknown;
        statement?: unknown;
        topic_id?: unknown;
        topics?: { name?: unknown } | Array<{ name?: unknown }> | null;
      }
    | null;
}

type DbClient = SupabaseClient;

interface RawExamQuestionOptionRow {
  id?: unknown;
  position?: unknown;
  text?: unknown;
  image_url?: unknown;
}

interface RawExamQuestionRow {
  id?: unknown;
  position?: unknown;
  topic_id?: unknown;
  statement?: unknown;
  image_url?: unknown;
  topics?: { name?: unknown } | Array<{ name?: unknown }> | null;
  simulator_version_question_options?: RawExamQuestionOptionRow[] | null;
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

function parseAttemptSummaryRow(row: unknown) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const value = row as RawAttemptSummaryRow;
  if (
    typeof value.id !== "string" ||
    typeof value.simulator_id !== "string" ||
    typeof value.simulator_version_id !== "string" ||
    typeof value.student_id !== "string" ||
    (value.status !== "active" &&
      value.status !== "finished" &&
      value.status !== "expired") ||
    typeof value.started_at !== "string" ||
    typeof value.expires_at !== "string" ||
    (value.finished_at !== null && typeof value.finished_at !== "string") ||
    (value.score_total !== null && typeof value.score_total !== "number") ||
    (value.blank_count !== null && typeof value.blank_count !== "number") ||
    typeof value.questions_total !== "number"
  ) {
    return null;
  }

  return {
    id: value.id,
    simulatorId: value.simulator_id,
    simulatorVersionId: value.simulator_version_id,
    studentId: value.student_id,
    status: value.status,
    startedAt: value.started_at,
    expiresAt: value.expires_at,
    finishedAt: value.finished_at,
    scoreTotal: value.score_total,
    blankCount: value.blank_count,
    questionsTotal: value.questions_total,
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

function extractTopicName(
  topics: RawExamQuestionRow["topics"],
  fallbackTopicId: string,
): string {
  if (!topics) {
    return fallbackTopicId;
  }
  if (Array.isArray(topics)) {
    const candidate = topics[0]?.name;
    return typeof candidate === "string" ? candidate : fallbackTopicId;
  }
  return typeof topics.name === "string" ? topics.name : fallbackTopicId;
}

function parseExamOptionRow(row: RawExamQuestionOptionRow): StudentExamQuestionOption | null {
  if (
    typeof row.id !== "string" ||
    typeof row.position !== "number" ||
    typeof row.text !== "string" ||
    (row.image_url !== null && typeof row.image_url !== "string")
  ) {
    return null;
  }

  return {
    id: row.id,
    position: row.position,
    text: row.text,
    imageUrl: row.image_url,
  };
}

function parseExamQuestionRows(rows: unknown[]): StudentExamQuestion[] {
  return rows
    .map((row) => row as RawExamQuestionRow)
    .filter(
      (row) =>
        typeof row.id === "string" &&
        typeof row.position === "number" &&
        typeof row.topic_id === "string" &&
        typeof row.statement === "string" &&
        (row.image_url === null || typeof row.image_url === "string"),
    )
    .map((row) => ({
      id: row.id as string,
      position: row.position as number,
      topicId: row.topic_id as string,
      topicName: extractTopicName(row.topics, row.topic_id as string),
      statement: row.statement as string,
      imageUrl: row.image_url as string | null,
      selectedOptionId: null,
      options: (row.simulator_version_question_options ?? [])
        .map((option) => parseExamOptionRow(option))
        .filter((option): option is StudentExamQuestionOption => !!option)
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position);
}

function parsePage(value?: number): number {
  if (!value || Number.isNaN(value)) {
    return 1;
  }
  return Math.max(1, Math.trunc(value));
}

function parsePageSize(value?: number): number {
  if (!value || Number.isNaN(value)) {
    return 20;
  }
  return Math.max(1, Math.min(100, Math.trunc(value)));
}

function describeDbError(error: unknown): string {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "UNKNOWN_DB_ERROR";
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  const details =
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    typeof (error as { details?: unknown }).details === "string"
      ? (error as { details: string }).details
      : undefined;
  const hint =
    typeof error === "object" &&
    error !== null &&
    "hint" in error &&
    typeof (error as { hint?: unknown }).hint === "string"
      ? (error as { hint: string }).hint
      : undefined;

  return [message, code, details, hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" | ");
}

function mapStartRpcError(error: unknown): StudentAttemptError {
  const errorMessage =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "UNKNOWN";
  const errorCode =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  const errorDetails =
    typeof error === "object" &&
    error !== null &&
    "details" in error &&
    typeof (error as { details?: unknown }).details === "string"
      ? (error as { details: string }).details
      : undefined;
  const errorHint =
    typeof error === "object" &&
    error !== null &&
    "hint" in error &&
    typeof (error as { hint?: unknown }).hint === "string"
      ? (error as { hint: string }).hint
      : undefined;

  if (errorMessage.includes("SIMULATOR_NOT_AVAILABLE")) {
    return new StudentAttemptError(
      "simulator_not_available",
      "El simulador no esta disponible actualmente.",
    );
  }
  if (errorMessage.includes("MAX_ATTEMPTS_REACHED")) {
    return new StudentAttemptError(
      "max_attempts_reached",
      "Ya usaste el maximo de intentos para este simulador.",
    );
  }
  if (errorMessage.includes("VERSION_HAS_NO_QUESTIONS")) {
    return new StudentAttemptError(
      "version_has_no_questions",
      "La version publicada no tiene preguntas disponibles.",
    );
  }

  const diagnostics = [errorMessage, errorCode, errorDetails, errorHint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" | ");

  return new StudentAttemptError(
    "simulator_not_available",
    diagnostics
      ? `No se pudo iniciar el intento. ${diagnostics}`
      : "No se pudo iniciar el intento.",
  );
}

async function calculateAndPersistAttemptScores(
  supabase: DbClient,
  attemptId: string,
): Promise<{ scoreTotal: number; blankCount: number; topicScores: TopicScoreAggregate[] }> {
  const { data: scoreRows, error: scoreError } = await supabase.rpc(
    "get_attempt_score_rows",
    {
      p_attempt_id: attemptId,
    },
  );

  if (scoreError) {
    console.error("[attempts:finish] get_attempt_score_rows failed", {
      attemptId,
      scoreError,
    });
    throw new Error(describeDbError(scoreError));
  }

  const rows = (scoreRows ?? []) as RawScoreRow[];
  const topicMap = new Map<string, TopicScoreAggregate>();
  let scoreTotal = 0;
  let blankCount = 0;

  for (const row of rows) {
    if (
      typeof row.simulator_version_question_id !== "string" ||
      typeof row.question_topic_id !== "string"
    ) {
      continue;
    }
    const selectedOptionId =
      row.selected_option_id && typeof row.selected_option_id === "string"
        ? row.selected_option_id
        : null;
    const correctOptionId =
      row.correct_option_id && typeof row.correct_option_id === "string"
        ? row.correct_option_id
        : null;
    const isCorrect =
      !!selectedOptionId &&
      !!correctOptionId &&
      selectedOptionId === correctOptionId;
    const isBlank = !selectedOptionId;

    const key = row.question_topic_id;
    const current = topicMap.get(key) ?? {
      topicId: key,
      topicName:
        row.topic_name && typeof row.topic_name === "string" ? row.topic_name : key,
      totalCount: 0,
      correctCount: 0,
      blankCount: 0,
    };
    current.totalCount += 1;
    if (isCorrect) {
      current.correctCount += 1;
      scoreTotal += 1;
    }
    if (isBlank) {
      current.blankCount += 1;
      blankCount += 1;
    }
    topicMap.set(key, current);
  }

  const topicScores = Array.from(topicMap.values());

  const { error: deleteTopicScoresError } = await supabase
    .from("attempt_topic_scores")
    .delete()
    .eq("attempt_id", attemptId);
  if (deleteTopicScoresError) {
    console.error("[attempts:finish] delete attempt_topic_scores failed", {
      attemptId,
      deleteTopicScoresError,
    });
    throw new Error(describeDbError(deleteTopicScoresError));
  }

  if (topicScores.length > 0) {
    const { error: insertTopicScoresError } = await supabase
      .from("attempt_topic_scores")
      .insert(
        topicScores.map((topic) => ({
          attempt_id: attemptId,
          topic_id: topic.topicId,
          correct_count: topic.correctCount,
          blank_count: topic.blankCount,
          total_count: topic.totalCount,
        })),
      );
    if (insertTopicScoresError) {
      console.error("[attempts:finish] insert attempt_topic_scores failed", {
        attemptId,
        insertTopicScoresError,
      });
      throw new Error(describeDbError(insertTopicScoresError));
    }
  }

  const { error: updateAnswersError } = await supabase.rpc(
    "set_attempt_answers_correctness",
    {
      p_attempt_id: attemptId,
    },
  );
  if (updateAnswersError) {
    console.error("[attempts:finish] set_attempt_answers_correctness failed", {
      attemptId,
      updateAnswersError,
    });
    throw new Error(describeDbError(updateAnswersError));
  }

  return {
    scoreTotal,
    blankCount,
    topicScores,
  };
}

async function closeAttemptWithScores(
  supabase: DbClient,
  input: { attemptId: string; status: "finished" | "expired" },
): Promise<{
  attemptId: string;
  status: "finished" | "expired";
  scoreTotal: number;
  blankCount: number;
  questionsTotal: number;
  topicScores: TopicScoreAggregate[];
} | null> {
  const { scoreTotal, blankCount, topicScores } = await calculateAndPersistAttemptScores(
    supabase,
    input.attemptId,
  );

  const nowIso = new Date().toISOString();
  const { data: closedAttempt, error: closeError } = await supabase
    .from("attempts")
    .update({
      status: input.status,
      finished_at: nowIso,
      score_total: scoreTotal,
      blank_count: blankCount,
    })
    .eq("id", input.attemptId)
    .eq("status", "active")
    .select("id, status, score_total, questions_total")
    .maybeSingle();

  if (closeError) {
    throw new Error(closeError.message);
  }
  if (!closedAttempt) {
    return null;
  }

  return {
    attemptId: closedAttempt.id,
    status: input.status,
    scoreTotal:
      typeof closedAttempt.score_total === "number"
        ? closedAttempt.score_total
        : scoreTotal,
    blankCount,
    questionsTotal: closedAttempt.questions_total,
    topicScores,
  };
}

async function loadAttemptQuestionResults(
  supabase: DbClient,
  attemptId: string,
): Promise<FinishAttemptQuestionResult[]> {
  const { data: answerRows, error: answerError } = await supabase
    .from("attempt_answers")
    .select(
      "simulator_version_question_id, selected_option_id, is_correct, simulator_version_questions(id, position, statement, topic_id, topics(name))",
    )
    .eq("attempt_id", attemptId);

  if (answerError) {
    throw new Error(answerError.message);
  }

  const parsedAnswers = ((answerRows ?? []) as RawAttemptAnswerDetailRow[]).filter(
    (row) =>
      typeof row.simulator_version_question_id === "string" &&
      (row.selected_option_id === null || typeof row.selected_option_id === "string") &&
      (row.is_correct === null || typeof row.is_correct === "boolean"),
  );

  const questionIds = parsedAnswers
    .map((row) => row.simulator_version_question_id)
    .filter((id, index, self) => self.indexOf(id) === index);
  const selectedOptionIds = parsedAnswers
    .map((row) => row.selected_option_id)
    .filter((id): id is string => typeof id === "string")
    .filter((id, index, self) => self.indexOf(id) === index);

  const selectedTextByOptionId = new Map<string, string>();
  if (selectedOptionIds.length > 0) {
    const { data: selectedOptionRows, error: selectedOptionError } = await supabase
      .from("simulator_version_question_options")
      .select("id, text")
      .in("id", selectedOptionIds);
    if (selectedOptionError) {
      throw new Error(selectedOptionError.message);
    }
    for (const row of selectedOptionRows ?? []) {
      if (typeof row.id === "string" && typeof row.text === "string") {
        selectedTextByOptionId.set(row.id, row.text);
      }
    }
  }

  const correctTextByQuestionId = new Map<string, string>();
  if (questionIds.length > 0) {
    const { data: correctOptionRows, error: correctOptionError } = await supabase
      .from("simulator_version_question_options")
      .select("simulator_version_question_id, text")
      .in("simulator_version_question_id", questionIds)
      .eq("is_correct", true);
    if (correctOptionError) {
      throw new Error(correctOptionError.message);
    }
    for (const row of correctOptionRows ?? []) {
      if (
        typeof row.simulator_version_question_id === "string" &&
        typeof row.text === "string" &&
        !correctTextByQuestionId.has(row.simulator_version_question_id)
      ) {
        correctTextByQuestionId.set(row.simulator_version_question_id, row.text);
      }
    }
  }

  return parsedAnswers
    .map((row) => {
      const question = row.simulator_version_questions;
      if (
        !question ||
        typeof question.position !== "number" ||
        typeof question.statement !== "string" ||
        typeof question.topic_id !== "string"
      ) {
        return null;
      }

      const selectedOptionText =
        typeof row.selected_option_id === "string"
          ? selectedTextByOptionId.get(row.selected_option_id) ?? null
          : null;

      return {
        simulatorVersionQuestionId: row.simulator_version_question_id,
        position: question.position,
        topicName: extractTopicName(question.topics, question.topic_id),
        statement: question.statement,
        selectedOptionText,
        correctOptionText:
          correctTextByQuestionId.get(row.simulator_version_question_id) ?? null,
        isCorrect: row.is_correct === true,
        isBlank: row.selected_option_id === null,
      } satisfies FinishAttemptQuestionResult;
    })
    .filter((row): row is FinishAttemptQuestionResult => !!row)
    .sort((a, b) => a.position - b.position);
}

async function resolveAttemptBlankCount(
  supabase: DbClient,
  attemptId: string,
  persistedBlankCount: number | null,
): Promise<number> {
  if (typeof persistedBlankCount === "number") {
    return Math.max(0, persistedBlankCount);
  }

  const { count, error } = await supabase
    .from("attempt_answers")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId)
    .is("selected_option_id", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function expireAttemptIfActive(
  supabase: DbClient,
  attemptId: string,
): Promise<void> {
  await closeAttemptWithScores(supabase, {
    attemptId,
    status: "expired",
  });
}

export async function startOrResumeAttemptForStudent(input: {
  simulatorId: string;
  studentId: string;
  ipAddress: string;
  accessCode?: string;
}): Promise<StartAttemptResponse> {
  const logContext = {
    simulatorId: input.simulatorId,
    studentId: input.studentId,
    hasAccessCode: typeof input.accessCode === "string" && input.accessCode.length > 0,
    ipAddress: input.ipAddress,
  };

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
    console.error("[attempts:start-or-resume] rpc failed", {
      ...logContext,
      rpcError: error,
    });
    throw mapStartRpcError(error);
  }

  const row = Array.isArray(data) ? data[0] : null;
  const parsed = parseStartOrResumeRow(row);
  if (!parsed) {
    console.error("[attempts:start-or-resume] invalid rpc payload", {
      ...logContext,
      rpcData: data,
    });
    throw new StudentAttemptError(
      "simulator_not_available",
      "Respuesta invalida al iniciar intento desde la base de datos.",
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
    await expireAttemptIfActive(supabase, activeAttempt.id);

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

export async function saveAttemptAnswerForStudent(input: {
  attemptId: string;
  studentId: string;
  simulatorVersionQuestionId: string;
  selectedOptionId: string | null;
}): Promise<SaveAttemptAnswerResponse> {
  const supabase = await createClient();
  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .select("id, student_id, status, expires_at")
    .eq("id", input.attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(attemptError.message);
  }

  if (!attemptRow || attemptRow.student_id !== input.studentId) {
    throw new StudentAttemptError("attempt_not_found", "Attempt was not found.");
  }

  if (attemptRow.status !== "active") {
    throw new StudentAttemptError(
      "attempt_not_active",
      "Attempt is no longer active.",
    );
  }

  if (Date.parse(attemptRow.expires_at) <= Date.now()) {
    await expireAttemptIfActive(supabase, input.attemptId);

    throw new StudentAttemptError(
      "attempt_not_active",
      "Attempt is no longer active.",
    );
  }

  const { data: answerRow, error: answerError } = await supabase
    .from("attempt_answers")
    .select("attempt_id")
    .eq("attempt_id", input.attemptId)
    .eq("simulator_version_question_id", input.simulatorVersionQuestionId)
    .maybeSingle();

  if (answerError) {
    throw new Error(answerError.message);
  }

  if (!answerRow) {
    throw new StudentAttemptError(
      "answer_not_found",
      "Question does not belong to this attempt.",
    );
  }

  if (input.selectedOptionId) {
    const { data: optionRow, error: optionError } = await supabase
      .from("simulator_version_question_options")
      .select("id")
      .eq("id", input.selectedOptionId)
      .eq("simulator_version_question_id", input.simulatorVersionQuestionId)
      .maybeSingle();

    if (optionError) {
      throw new Error(optionError.message);
    }

    if (!optionRow) {
      throw new StudentAttemptError(
        "option_not_found",
        "Option does not belong to the specified question.",
      );
    }
  }

  const updatePayload = {
    selected_option_id: input.selectedOptionId,
    answered_at: input.selectedOptionId ? new Date().toISOString() : null,
  };

  const { data: updatedAnswer, error: updateError } = await supabase
    .from("attempt_answers")
    .update(updatePayload)
    .eq("attempt_id", input.attemptId)
    .eq("simulator_version_question_id", input.simulatorVersionQuestionId)
    .select("selected_option_id, answered_at")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const parsed = updatedAnswer as RawSaveAnswerRow | null;
  if (
    !parsed ||
    (parsed.selected_option_id !== null &&
      typeof parsed.selected_option_id !== "string") ||
    (parsed.answered_at !== null && typeof parsed.answered_at !== "string")
  ) {
    throw new Error("Invalid attempt answer payload returned from database.");
  }

  return {
    attemptId: input.attemptId,
    simulatorVersionQuestionId: input.simulatorVersionQuestionId,
    selectedOptionId: parsed.selected_option_id,
    answeredAt: parsed.answered_at,
  };
}

export async function getAttemptExamStateForStudent(input: {
  attemptId: string;
  studentId: string;
}): Promise<StudentExamStateResponse> {
  const supabase = await createClient();
  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .select(
      "id, simulator_id, simulator_version_id, status, started_at, expires_at, questions_total, student_id",
    )
    .eq("id", input.attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(attemptError.message);
  }
  if (!attemptRow || attemptRow.student_id !== input.studentId) {
    throw new StudentAttemptError("attempt_not_found", "Attempt was not found.");
  }
  if (attemptRow.status !== "active") {
    throw new StudentAttemptError("attempt_not_active", "Attempt is no longer active.");
  }

  if (Date.parse(attemptRow.expires_at) <= Date.now()) {
    await expireAttemptIfActive(supabase, attemptRow.id);
    throw new StudentAttemptError("attempt_expired", "Attempt has expired.");
  }

  const { data: simulatorRow, error: simulatorError } = await supabase
    .from("simulators")
    .select("id, title")
    .eq("id", attemptRow.simulator_id)
    .maybeSingle();
  if (simulatorError) {
    throw new Error(simulatorError.message);
  }
  if (!simulatorRow || typeof simulatorRow.title !== "string") {
    throw new StudentAttemptError("attempt_not_found", "Simulator was not found.");
  }

  const { data: questionRows, error: questionsError } = await supabase
    .from("simulator_version_questions")
    .select(
      "id, position, topic_id, statement, image_url, topics(name), simulator_version_question_options(id, position, text, image_url)",
    )
    .eq("simulator_version_id", attemptRow.simulator_version_id)
    .order("position", { ascending: true });
  if (questionsError) {
    throw new Error(questionsError.message);
  }

  const questions = parseExamQuestionRows((questionRows ?? []) as unknown[]);

  const { data: answerRows, error: answersError } = await supabase
    .from("attempt_answers")
    .select("simulator_version_question_id, selected_option_id")
    .eq("attempt_id", attemptRow.id);
  if (answersError) {
    throw new Error(answersError.message);
  }

  const selectedByQuestionId = new Map<string, string | null>();
  for (const row of answerRows ?? []) {
    if (
      typeof row.simulator_version_question_id === "string" &&
      (row.selected_option_id === null || typeof row.selected_option_id === "string")
    ) {
      selectedByQuestionId.set(
        row.simulator_version_question_id,
        row.selected_option_id,
      );
    }
  }

  const mergedQuestions = questions.map((question) => ({
    ...question,
    selectedOptionId: selectedByQuestionId.get(question.id) ?? null,
  }));
  const firstUnansweredIndex = mergedQuestions.findIndex(
    (question) => question.selectedOptionId === null,
  );
  const currentQuestionIndex =
    firstUnansweredIndex >= 0
      ? firstUnansweredIndex
      : Math.max(mergedQuestions.length - 1, 0);

  return {
    attemptId: attemptRow.id,
    simulatorId: attemptRow.simulator_id,
    simulatorTitle: simulatorRow.title,
    simulatorVersionId: attemptRow.simulator_version_id,
    status: "active",
    startedAt: attemptRow.started_at,
    expiresAt: attemptRow.expires_at,
    questionsTotal: attemptRow.questions_total,
    currentQuestionIndex,
    questions: mergedQuestions,
  };
}

export async function finishAttemptForStudent(input: {
  attemptId: string;
  studentId: string;
}): Promise<FinishAttemptResponse> {
  const supabase = await createClient();
  const logContext = { attemptId: input.attemptId, studentId: input.studentId };
  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .select("id, student_id, status, questions_total")
    .eq("id", input.attemptId)
    .maybeSingle();

  if (attemptError) {
    console.error("[attempts:finish] load attempt failed", {
      ...logContext,
      attemptError,
    });
    throw new Error(describeDbError(attemptError));
  }
  if (!attemptRow || attemptRow.student_id !== input.studentId) {
    throw new StudentAttemptError("attempt_not_found", "Attempt was not found.");
  }
  if (attemptRow.status === "finished" || attemptRow.status === "expired") {
    throw new StudentAttemptError(
      "attempt_already_closed",
      "Attempt is already closed.",
    );
  }
  if (attemptRow.status !== "active") {
    throw new StudentAttemptError("attempt_not_active", "Attempt is no longer active.");
  }

  const finishedAttempt = await closeAttemptWithScores(supabase, {
    attemptId: input.attemptId,
    status: "finished",
  });
  if (!finishedAttempt) {
    throw new StudentAttemptError(
      "attempt_not_active",
      "Attempt is no longer active.",
    );
  }

  const questionResults = await loadAttemptQuestionResults(supabase, input.attemptId);

  return {
    attemptId: finishedAttempt.attemptId,
    status: "finished",
    scoreTotal: finishedAttempt.scoreTotal,
    blankCount: finishedAttempt.blankCount,
    incorrectCount: Math.max(
      (finishedAttempt.questionsTotal ?? attemptRow.questions_total) -
        finishedAttempt.scoreTotal -
        finishedAttempt.blankCount,
      0,
    ),
    questionsTotal: finishedAttempt.questionsTotal ?? attemptRow.questions_total,
    topicScores: finishedAttempt.topicScores,
    questionResults,
  };
}

export async function expireDueAttempts(input?: {
  supabase?: DbClient;
  nowIso?: string;
  limit?: number;
}): Promise<{ scannedCount: number; expiredCount: number; attemptIds: string[] }> {
  const supabase = input?.supabase ?? (await createClient());
  const nowIso = input?.nowIso ?? new Date().toISOString();
  const limit = input?.limit ?? 200;

  const { data: rows, error } = await supabase
    .from("attempts")
    .select("id")
    .eq("status", "active")
    .lte("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const attemptIds = (rows ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");

  let expiredCount = 0;
  for (const attemptId of attemptIds) {
    const result = await closeAttemptWithScores(supabase, {
      attemptId,
      status: "expired",
    });
    if (result) {
      expiredCount += 1;
    }
  }

  return {
    scannedCount: attemptIds.length,
    expiredCount,
    attemptIds,
  };
}

export async function listAttemptHistoryForStudent(input: {
  studentId: string;
  page?: number;
  pageSize?: number;
}): Promise<StudentAttemptHistoryResponse> {
  const page = parsePage(input.page);
  const pageSize = parsePageSize(input.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("attempts")
    .select(
      "id, simulator_id, simulator_version_id, student_id, status, started_at, expires_at, finished_at, score_total, blank_count, questions_total",
      { count: "exact" },
    )
    .eq("student_id", input.studentId)
    .in("status", ["finished", "expired"])
    .order("started_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as unknown[])
    .map((row) => parseAttemptSummaryRow(row))
    .filter((row): row is NonNullable<ReturnType<typeof parseAttemptSummaryRow>> => !!row);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

export async function getAttemptResultForStudent(input: {
  studentId: string;
  attemptId: string;
}): Promise<StudentAttemptResultResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, simulator_id, simulator_version_id, student_id, status, started_at, expires_at, finished_at, score_total, blank_count, questions_total",
    )
    .eq("id", input.attemptId)
    .eq("student_id", input.studentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  const attempt = parseAttemptSummaryRow(data);
  if (!attempt || (attempt.status !== "finished" && attempt.status !== "expired")) {
    throw new StudentAttemptError(
      "attempt_not_found",
      "Attempt result was not found.",
    );
  }

  const blankCount = await resolveAttemptBlankCount(
    supabase,
    input.attemptId,
    attempt.blankCount,
  );

  const { data: topicRows, error: topicError } = await supabase
    .from("attempt_topic_scores")
    .select("topic_id, correct_count, blank_count, total_count, topics(name)")
    .eq("attempt_id", input.attemptId);

  if (topicError) {
    throw new Error(topicError.message);
  }

  const topicScores = ((topicRows ?? []) as RawAttemptTopicScoreRow[])
    .filter(
      (row) =>
        typeof row.topic_id === "string" &&
        typeof row.correct_count === "number" &&
        typeof row.total_count === "number",
    )
    .map((row) => ({
      topicId: row.topic_id,
      topicName: extractTopicName(row.topics, row.topic_id),
      correctCount: row.correct_count,
      blankCount: typeof row.blank_count === "number" ? row.blank_count : 0,
      totalCount: row.total_count,
    }));

  return {
    attempt: {
      ...attempt,
      blankCount,
      topicScores,
    },
  };
}

export { StudentAccessError };
