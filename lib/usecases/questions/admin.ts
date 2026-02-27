import type { AdminQuestionsListQuery } from "@/lib/domain/contracts";
import type { Question } from "@/lib/domain/question";
import { createClient } from "@/lib/supabase/server";

export type QuestionInputErrorCode =
  | "invalid_topic_id"
  | "invalid_statement"
  | "not_found"
  | "topic_not_found"
  | "no_changes"
  | "question_not_ready"
  | "question_in_use";

export class QuestionInputError extends Error {
  readonly code: QuestionInputErrorCode;

  constructor(code: QuestionInputErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "QuestionInputError";
  }
}

interface RawQuestionRow {
  id: string;
  topic_id: string;
  statement: string;
  image_url: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  topics: { name?: unknown } | Array<{ name?: unknown }> | null;
}

interface QuestionOptionStats {
  activeOptionsCount: number;
  activeCorrectOptionsCount: number;
  isBankReady: boolean;
}

interface QuestionListResult {
  items: Question[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

async function listConsumedSourceQuestionIds(questionIds: string[]): Promise<Set<string>> {
  if (questionIds.length === 0) {
    return new Set<string>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulator_version_questions")
    .select("source_question_id")
    .in("source_question_id", questionIds);

  if (error) {
    throw new Error(error.message);
  }

  const consumedIds = new Set<string>();
  for (const row of data ?? []) {
    if (typeof row.source_question_id === "string" && row.source_question_id.length > 0) {
      consumedIds.add(row.source_question_id);
    }
  }
  return consumedIds;
}

interface QuestionCreateInput {
  topicId: string;
  statement: string;
  imageUrl?: string | null;
  isActive?: boolean;
  createdBy: string;
}

interface QuestionUpdateInput {
  topicId?: string;
  statement?: string;
  imageUrl?: string | null;
  isActive?: boolean;
}

function normalizeStatement(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateStatement(statement: string): string {
  const normalized = normalizeStatement(statement);
  if (!normalized) {
    throw new QuestionInputError(
      "invalid_statement",
      "Question statement is required.",
    );
  }

  if (normalized.length > 2000) {
    throw new QuestionInputError(
      "invalid_statement",
      "Question statement must be 2000 characters or fewer.",
    );
  }

  return normalized;
}

function validateTopicId(topicId: string): string {
  const normalized = topicId.trim();
  if (!normalized) {
    throw new QuestionInputError("invalid_topic_id", "Topic id is required.");
  }
  return normalized;
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 2048) {
    throw new QuestionInputError(
      "invalid_statement",
      "Image URL must be 2048 characters or fewer.",
    );
  }

  return trimmed;
}

function extractTopicName(
  topics: RawQuestionRow["topics"],
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

function defaultQuestionOptionStats(): QuestionOptionStats {
  return {
    activeOptionsCount: 0,
    activeCorrectOptionsCount: 0,
    isBankReady: false,
  };
}

function mapQuestion(row: RawQuestionRow, stats?: QuestionOptionStats): Question {
  const optionStats = stats ?? defaultQuestionOptionStats();

  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: extractTopicName(row.topics, row.topic_id),
    statement: row.statement,
    imageUrl: row.image_url,
    isActive: row.is_active,
    activeOptionsCount: optionStats.activeOptionsCount,
    activeCorrectOptionsCount: optionStats.activeCorrectOptionsCount,
    isBankReady: optionStats.isBankReady,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  const parsed = Math.trunc(value);
  return Math.max(1, Math.min(100, parsed));
}

async function assertTopicExists(topicId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id")
    .eq("id", topicId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new QuestionInputError("topic_not_found", "Topic was not found.");
  }
}

async function getQuestionOptionStatsMap(
  questionIds: string[],
): Promise<Map<string, QuestionOptionStats>> {
  const statsMap = new Map<string, QuestionOptionStats>();
  if (questionIds.length === 0) {
    return statsMap;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_options")
    .select("question_id, is_active, is_correct")
    .in("question_id", questionIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    question_id: string;
    is_active: boolean;
    is_correct: boolean;
  }>;

  for (const row of rows) {
    if (!statsMap.has(row.question_id)) {
      statsMap.set(row.question_id, defaultQuestionOptionStats());
    }
    const current = statsMap.get(row.question_id);
    if (!current) {
      continue;
    }

    if (row.is_active) {
      current.activeOptionsCount += 1;
      if (row.is_correct) {
        current.activeCorrectOptionsCount += 1;
      }
    }
  }

  for (const [questionId, current] of statsMap.entries()) {
    statsMap.set(questionId, {
      ...current,
      isBankReady:
        current.activeOptionsCount >= 2 &&
        current.activeCorrectOptionsCount === 1,
    });
  }

  return statsMap;
}

async function getQuestionOptionStats(questionId: string): Promise<QuestionOptionStats> {
  const statsMap = await getQuestionOptionStatsMap([questionId]);
  return statsMap.get(questionId) ?? defaultQuestionOptionStats();
}

export async function listQuestions(
  query: AdminQuestionsListQuery,
): Promise<QuestionListResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const includeInactive = query.includeInactive ?? true;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let dbQuery = supabase
    .from("questions")
    .select(
      "id, topic_id, statement, image_url, is_active, created_by, created_at, updated_at, topics(name)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (!includeInactive) {
    dbQuery = dbQuery.eq("is_active", true);
  }

  const { data, error, count } = await dbQuery;
  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rows = (data ?? []) as RawQuestionRow[];
  const statsMap = await getQuestionOptionStatsMap(rows.map((row) => row.id));

  return {
    items: rows.map((row) => mapQuestion(row, statsMap.get(row.id))),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function createQuestion(input: QuestionCreateInput): Promise<Question> {
  const topicId = validateTopicId(input.topicId);
  const statement = validateStatement(input.statement);
  const imageUrl = normalizeImageUrl(input.imageUrl);

  await assertTopicExists(topicId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      topic_id: topicId,
      statement,
      image_url: imageUrl,
      is_active: input.isActive ?? false,
      created_by: input.createdBy,
    })
    .select(
      "id, topic_id, statement, image_url, is_active, created_by, created_at, updated_at, topics(name)",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapQuestion(data as RawQuestionRow, defaultQuestionOptionStats());
}

export async function listUnassignedQuestionsForBuilder(limit = 200): Promise<Question[]> {
  const list = await listQuestions({
    page: 1,
    pageSize: Math.max(1, Math.min(500, Math.trunc(limit))),
    includeInactive: false,
  });

  const consumedIds = await listConsumedSourceQuestionIds(list.items.map((question) => question.id));
  return list.items.filter((question) => !consumedIds.has(question.id));
}

export async function updateQuestion(
  questionId: string,
  input: QuestionUpdateInput,
): Promise<Question> {
  if (!questionId) {
    throw new QuestionInputError("not_found", "Question was not found.");
  }

  const payload: Record<string, unknown> = {};

  if (typeof input.topicId === "string") {
    const topicId = validateTopicId(input.topicId);
    await assertTopicExists(topicId);
    payload.topic_id = topicId;
  }

  if (typeof input.statement === "string") {
    payload.statement = validateStatement(input.statement);
  }

  if ("imageUrl" in input) {
    payload.image_url = normalizeImageUrl(input.imageUrl);
  }

  if (typeof input.isActive === "boolean") {
    if (input.isActive) {
      const stats = await getQuestionOptionStats(questionId);
      if (!stats.isBankReady) {
        throw new QuestionInputError(
          "question_not_ready",
          "Question cannot be activated until it has at least 2 active options and exactly 1 active correct option.",
        );
      }
    }
    payload.is_active = input.isActive;
  }

  if (Object.keys(payload).length === 0) {
    throw new QuestionInputError("no_changes", "No question changes were provided.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .update(payload)
    .eq("id", questionId)
    .select(
      "id, topic_id, statement, image_url, is_active, created_by, created_at, updated_at, topics(name)",
    )
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new QuestionInputError("not_found", "Question was not found.");
  }

  const stats = await getQuestionOptionStats(questionId);
  return mapQuestion(data as RawQuestionRow, stats);
}

export async function deleteQuestion(questionId: string): Promise<void> {
  if (!questionId) {
    throw new QuestionInputError("not_found", "Question was not found.");
  }

  const supabase = await createClient();

  const { data: usageRow, error: usageError } = await supabase
    .from("simulator_version_questions")
    .select("id")
    .eq("source_question_id", questionId)
    .limit(1)
    .maybeSingle();

  if (usageError) {
    throw new Error(usageError.message);
  }

  if (usageRow?.id) {
    throw new QuestionInputError(
      "question_in_use",
      "No se puede eliminar la pregunta porque ya fue usada en un simulador.",
    );
  }

  const { data, error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new QuestionInputError("not_found", "Question was not found.");
  }
}
