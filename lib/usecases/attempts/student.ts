import type {
  FinishAttemptResponse,
  SaveAttemptAnswerResponse,
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

async function calculateAndPersistAttemptScores(
  supabase: DbClient,
  attemptId: string,
): Promise<{ scoreTotal: number; topicScores: TopicScoreAggregate[] }> {
  const { data: scoreRows, error: scoreError } = await supabase.rpc(
    "get_attempt_score_rows",
    {
      p_attempt_id: attemptId,
    },
  );

  if (scoreError) {
    throw new Error(scoreError.message);
  }

  const rows = (scoreRows ?? []) as RawScoreRow[];
  const topicMap = new Map<string, TopicScoreAggregate>();
  let scoreTotal = 0;

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

    const key = row.question_topic_id;
    const current = topicMap.get(key) ?? {
      topicId: key,
      topicName:
        row.topic_name && typeof row.topic_name === "string" ? row.topic_name : key,
      totalCount: 0,
      correctCount: 0,
    };
    current.totalCount += 1;
    if (isCorrect) {
      current.correctCount += 1;
      scoreTotal += 1;
    }
    topicMap.set(key, current);
  }

  const topicScores = Array.from(topicMap.values());

  const { error: deleteTopicScoresError } = await supabase
    .from("attempt_topic_scores")
    .delete()
    .eq("attempt_id", attemptId);
  if (deleteTopicScoresError) {
    throw new Error(deleteTopicScoresError.message);
  }

  if (topicScores.length > 0) {
    const { error: insertTopicScoresError } = await supabase
      .from("attempt_topic_scores")
      .insert(
        topicScores.map((topic) => ({
          attempt_id: attemptId,
          topic_id: topic.topicId,
          correct_count: topic.correctCount,
          total_count: topic.totalCount,
        })),
      );
    if (insertTopicScoresError) {
      throw new Error(insertTopicScoresError.message);
    }
  }

  const { error: updateAnswersError } = await supabase.rpc(
    "set_attempt_answers_correctness",
    {
      p_attempt_id: attemptId,
    },
  );
  if (updateAnswersError) {
    throw new Error(updateAnswersError.message);
  }

  return {
    scoreTotal,
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
  questionsTotal: number;
  topicScores: TopicScoreAggregate[];
} | null> {
  const { scoreTotal, topicScores } = await calculateAndPersistAttemptScores(
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
    questionsTotal: closedAttempt.questions_total,
    topicScores,
  };
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
  const { data: attemptRow, error: attemptError } = await supabase
    .from("attempts")
    .select("id, student_id, status, questions_total")
    .eq("id", input.attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(attemptError.message);
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

  return {
    attemptId: finishedAttempt.attemptId,
    status: "finished",
    scoreTotal: finishedAttempt.scoreTotal,
    questionsTotal: finishedAttempt.questionsTotal ?? attemptRow.questions_total,
    topicScores: finishedAttempt.topicScores,
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

export { StudentAccessError };
