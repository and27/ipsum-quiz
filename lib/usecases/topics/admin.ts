import type { Topic } from "@/lib/domain/topic";
import { createClient } from "@/lib/supabase/server";

export type TopicInputErrorCode =
  | "invalid_name"
  | "duplicate_active_name"
  | "not_found"
  | "no_changes";

export class TopicInputError extends Error {
  readonly code: TopicInputErrorCode;

  constructor(code: TopicInputErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "TopicInputError";
  }
}

interface ListTopicsOptions {
  includeInactive?: boolean;
}

interface UpdateTopicInput {
  name?: string;
  isActive?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTopicRow(row: unknown): Topic | null {
  if (!isRecord(row)) {
    return null;
  }

  const { id, name, is_active, created_at, updated_at } = row;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof is_active !== "boolean" ||
    typeof created_at !== "string" ||
    typeof updated_at !== "string"
  ) {
    return null;
  }

  return {
    id,
    name,
    isActive: is_active,
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

function normalizeTopicName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function validateTopicName(name: string): string {
  const normalized = normalizeTopicName(name);
  if (!normalized) {
    throw new TopicInputError("invalid_name", "Topic name is required.");
  }

  if (normalized.length > 120) {
    throw new TopicInputError(
      "invalid_name",
      "Topic name must be 120 characters or fewer.",
    );
  }

  return normalized;
}

function mapPostgresErrorToTopicInputError(error: unknown): never {
  if (isRecord(error) && error.code === "23505") {
    throw new TopicInputError(
      "duplicate_active_name",
      "An active topic with this name already exists.",
    );
  }

  const message =
    isRecord(error) && typeof error.message === "string"
      ? error.message
      : "Unexpected database error.";

  throw new Error(message);
}

export async function listTopics(
  options: ListTopicsOptions = {},
): Promise<Topic[]> {
  const supabase = await createClient();
  const includeInactive = options.includeInactive ?? true;

  let query = supabase
    .from("topics")
    .select("id, name, is_active, created_at, updated_at")
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(parseTopicRow).filter((topic): topic is Topic => !!topic);
}

export async function createTopic(name: string): Promise<Topic> {
  const normalizedName = validateTopicName(name);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("topics")
    .insert({
      name: normalizedName,
      is_active: true,
    })
    .select("id, name, is_active, created_at, updated_at")
    .single();

  if (error) {
    mapPostgresErrorToTopicInputError(error);
  }

  const topic = parseTopicRow(data);
  if (!topic) {
    throw new Error("Invalid topic payload returned from database.");
  }

  return topic;
}

export async function updateTopic(
  topicId: string,
  input: UpdateTopicInput,
): Promise<Topic> {
  const hasName = typeof input.name === "string";
  const hasActive = typeof input.isActive === "boolean";

  if (!hasName && !hasActive) {
    throw new TopicInputError("no_changes", "No topic changes were provided.");
  }

  const payload: Record<string, unknown> = {};
  if (hasName) {
    payload.name = validateTopicName(input.name as string);
  }
  if (hasActive) {
    payload.is_active = input.isActive;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("topics")
    .update(payload)
    .eq("id", topicId)
    .select("id, name, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    mapPostgresErrorToTopicInputError(error);
  }

  if (!data) {
    throw new TopicInputError("not_found", "Topic was not found.");
  }

  const topic = parseTopicRow(data);
  if (!topic) {
    throw new Error("Invalid topic payload returned from database.");
  }

  return topic;
}

