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
  displayOrder?: number;
  isActive?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTopicRow(row: unknown): Topic | null {
  if (!isRecord(row)) {
    return null;
  }

  const { id, name, display_order, is_active, created_at, updated_at } = row;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof display_order !== "number" ||
    typeof is_active !== "boolean" ||
    typeof created_at !== "string" ||
    typeof updated_at !== "string"
  ) {
    return null;
  }

  return {
    id,
    name,
    displayOrder: display_order,
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

function validateDisplayOrder(displayOrder: number): number {
  if (!Number.isFinite(displayOrder)) {
    throw new TopicInputError("invalid_name", "El orden del tema debe ser numerico.");
  }

  const normalized = Math.trunc(displayOrder);
  if (normalized <= 0) {
    throw new TopicInputError("invalid_name", "El orden del tema debe ser mayor que 0.");
  }

  return normalized;
}

async function listTopicRows(): Promise<
  Array<{
    id: string;
    display_order: number;
  }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("id, display_order")
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).filter(
    (row): row is { id: string; display_order: number } =>
      typeof row?.id === "string" && typeof row?.display_order === "number",
  );
}

async function normalizeTopicDisplayOrders(orderedIds: string[]): Promise<void> {
  const supabase = await createClient();
  const maxDisplayOrder = orderedIds.length;

  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error: tempError } = await supabase
      .from("topics")
      .update({ display_order: maxDisplayOrder + index + 1 })
      .eq("id", orderedIds[index]);

    if (tempError) {
      throw new Error(tempError.message);
    }
  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error: finalError } = await supabase
      .from("topics")
      .update({ display_order: index + 1 })
      .eq("id", orderedIds[index]);

    if (finalError) {
      throw new Error(finalError.message);
    }
  }
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
    .select("id, name, display_order, is_active, created_at, updated_at")
    .order("display_order", { ascending: true })
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
  const { data: maxRow, error: maxError } = await supabase
    .from("topics")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    throw new Error(maxError.message);
  }

  const nextDisplayOrder =
    typeof maxRow?.display_order === "number" ? maxRow.display_order + 1 : 1;

  const { data, error } = await supabase
    .from("topics")
    .insert({
      name: normalizedName,
      display_order: nextDisplayOrder,
      is_active: true,
    })
    .select("id, name, display_order, is_active, created_at, updated_at")
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
  const hasDisplayOrder = typeof input.displayOrder === "number";
  const hasActive = typeof input.isActive === "boolean";

  if (!hasName && !hasDisplayOrder && !hasActive) {
    throw new TopicInputError("no_changes", "No topic changes were provided.");
  }

  const payload: Record<string, unknown> = {};
  if (hasName) {
    payload.name = validateTopicName(input.name as string);
  }
  if (hasActive) {
    payload.is_active = input.isActive;
  }

  if (hasDisplayOrder) {
    const targetDisplayOrder = validateDisplayOrder(input.displayOrder as number);
    const rows = await listTopicRows();
    const currentIndex = rows.findIndex((row) => row.id === topicId);

    if (currentIndex === -1) {
      throw new TopicInputError("not_found", "Topic was not found.");
    }

    const orderedIds = rows.map((row) => row.id);
    orderedIds.splice(currentIndex, 1);
    const targetIndex = Math.min(targetDisplayOrder - 1, orderedIds.length);
    orderedIds.splice(targetIndex, 0, topicId);
    await normalizeTopicDisplayOrders(orderedIds);
  }

  const supabase = await createClient();
  const query = supabase
    .from("topics")
    .select("id, name, display_order, is_active, created_at, updated_at")
    .eq("id", topicId);

  const { data, error } =
    Object.keys(payload).length > 0
      ? await supabase
          .from("topics")
          .update(payload)
          .eq("id", topicId)
          .select("id, name, display_order, is_active, created_at, updated_at")
          .maybeSingle()
      : await query.maybeSingle();

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
