import type { AdminQuestionsListQuery } from "@/lib/domain/contracts";
import type { Question } from "@/lib/domain/question";
import { createClient } from "@/lib/supabase/server";

export type QuestionInputErrorCode =
  | "invalid_topic_id"
  | "invalid_statement"
  | "not_found"
  | "topic_not_found"
  | "no_changes";

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

interface QuestionListResult {
  items: Question[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface QuestionCreateInput {
  topicId: string;
  statement: string;
  imageUrl?: string | null;
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

function mapQuestion(row: RawQuestionRow): Question {
  return {
    id: row.id,
    topicId: row.topic_id,
    topicName: extractTopicName(row.topics, row.topic_id),
    statement: row.statement,
    imageUrl: row.image_url,
    isActive: row.is_active,
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

  return {
    items: ((data ?? []) as RawQuestionRow[]).map(mapQuestion),
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
      is_active: true,
      created_by: input.createdBy,
    })
    .select(
      "id, topic_id, statement, image_url, is_active, created_by, created_at, updated_at, topics(name)",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapQuestion(data as RawQuestionRow);
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

  return mapQuestion(data as RawQuestionRow);
}

