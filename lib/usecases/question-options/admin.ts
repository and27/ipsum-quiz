import type { QuestionOption } from "@/lib/domain/question-option";
import { createClient } from "@/lib/supabase/server";

export type QuestionOptionInputErrorCode =
  | "invalid_text"
  | "invalid_position"
  | "question_not_found"
  | "not_found"
  | "no_changes"
  | "duplicate_position"
  | "duplicate_correct_option";

export class QuestionOptionInputError extends Error {
  readonly code: QuestionOptionInputErrorCode;

  constructor(code: QuestionOptionInputErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "QuestionOptionInputError";
  }
}

interface QuestionOptionCreateInput {
  text: string;
  imageUrl?: string | null;
  position?: number;
  isCorrect?: boolean;
  isActive?: boolean;
}

interface QuestionOptionUpdateInput {
  text?: string;
  imageUrl?: string | null;
  position?: number;
  isCorrect?: boolean;
  isActive?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function validateText(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new QuestionOptionInputError(
      "invalid_text",
      "Option text is required.",
    );
  }
  if (normalized.length > 500) {
    throw new QuestionOptionInputError(
      "invalid_text",
      "Option text must be 500 characters or fewer.",
    );
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
    throw new QuestionOptionInputError(
      "invalid_text",
      "Image URL must be 2048 characters or fewer.",
    );
  }

  return trimmed;
}

function normalizePosition(position: number): number {
  if (!Number.isFinite(position)) {
    throw new QuestionOptionInputError(
      "invalid_position",
      "Option position must be a number.",
    );
  }

  const normalized = Math.trunc(position);
  if (normalized <= 0) {
    throw new QuestionOptionInputError(
      "invalid_position",
      "Option position must be greater than 0.",
    );
  }

  return normalized;
}

function parseOptionRow(row: unknown): QuestionOption | null {
  if (!isRecord(row)) {
    return null;
  }

  const {
    id,
    question_id,
    position,
    text,
    image_url,
    is_correct,
    is_active,
    created_at,
    updated_at,
  } = row;

  if (
    typeof id !== "string" ||
    typeof question_id !== "string" ||
    typeof position !== "number" ||
    typeof text !== "string" ||
    (image_url !== null && typeof image_url !== "string") ||
    typeof is_correct !== "boolean" ||
    typeof is_active !== "boolean" ||
    typeof created_at !== "string" ||
    typeof updated_at !== "string"
  ) {
    return null;
  }

  return {
    id,
    questionId: question_id,
    position,
    text,
    imageUrl: image_url,
    isCorrect: is_correct,
    isActive: is_active,
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

async function assertQuestionExists(questionId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new QuestionOptionInputError(
      "question_not_found",
      "Question was not found.",
    );
  }
}

function mapDatabaseError(error: unknown): never {
  if (isRecord(error)) {
    if (error.code === "23505") {
      if (typeof error.constraint === "string") {
        if (error.constraint.includes("question_id_position")) {
          throw new QuestionOptionInputError(
            "duplicate_position",
            "Another option already uses this position.",
          );
        }

        if (error.constraint.includes("one_correct")) {
          throw new QuestionOptionInputError(
            "duplicate_correct_option",
            "Only one option can be marked as correct.",
          );
        }
      }
    }

    if (typeof error.message === "string") {
      throw new Error(error.message);
    }
  }

  throw new Error("Unexpected database error.");
}

async function normalizePositions(questionId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_options")
    .select("id")
    .eq("question_id", questionId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ id: string }>;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    await supabase
      .from("question_options")
      .update({ position: -(index + 1) })
      .eq("id", row.id)
      .eq("question_id", questionId);
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    await supabase
      .from("question_options")
      .update({ position: index + 1 })
      .eq("id", row.id)
      .eq("question_id", questionId);
  }
}

export async function listQuestionOptions(
  questionId: string,
  includeInactive = true,
): Promise<QuestionOption[]> {
  await assertQuestionExists(questionId);

  const supabase = await createClient();
  let query = supabase
    .from("question_options")
    .select(
      "id, question_id, position, text, image_url, is_correct, is_active, created_at, updated_at",
    )
    .eq("question_id", questionId)
    .order("position", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => parseOptionRow(row))
    .filter((option): option is QuestionOption => !!option);
}

export async function createQuestionOption(
  questionId: string,
  input: QuestionOptionCreateInput,
): Promise<QuestionOption> {
  await assertQuestionExists(questionId);

  const supabase = await createClient();
  let nextPosition = 1;

  if (typeof input.position === "number") {
    nextPosition = normalizePosition(input.position);
  } else {
    const { data: maxRow, error: maxError } = await supabase
      .from("question_options")
      .select("position")
      .eq("question_id", questionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) {
      throw new Error(maxError.message);
    }

    nextPosition = typeof maxRow?.position === "number" ? maxRow.position + 1 : 1;
  }

  const { data, error } = await supabase
    .from("question_options")
    .insert({
      question_id: questionId,
      position: nextPosition,
      text: validateText(input.text),
      image_url: normalizeImageUrl(input.imageUrl),
      is_correct: input.isCorrect ?? false,
      is_active: input.isActive ?? true,
    })
    .select(
      "id, question_id, position, text, image_url, is_correct, is_active, created_at, updated_at",
    )
    .single();

  if (error) {
    mapDatabaseError(error);
  }

  const option = parseOptionRow(data);
  if (!option) {
    throw new Error("Invalid option payload returned from database.");
  }

  return option;
}

export async function updateQuestionOption(
  questionId: string,
  optionId: string,
  input: QuestionOptionUpdateInput,
): Promise<QuestionOption> {
  await assertQuestionExists(questionId);

  const payload: Record<string, unknown> = {};
  if (typeof input.text === "string") {
    payload.text = validateText(input.text);
  }
  if ("imageUrl" in input) {
    payload.image_url = normalizeImageUrl(input.imageUrl);
  }
  if (typeof input.position === "number") {
    payload.position = normalizePosition(input.position);
  }
  if (typeof input.isCorrect === "boolean") {
    payload.is_correct = input.isCorrect;
  }
  if (typeof input.isActive === "boolean") {
    payload.is_active = input.isActive;
  }

  if (Object.keys(payload).length === 0) {
    throw new QuestionOptionInputError(
      "no_changes",
      "No option changes were provided.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_options")
    .update(payload)
    .eq("id", optionId)
    .eq("question_id", questionId)
    .select(
      "id, question_id, position, text, image_url, is_correct, is_active, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    mapDatabaseError(error);
  }

  if (!data) {
    throw new QuestionOptionInputError("not_found", "Option was not found.");
  }

  const option = parseOptionRow(data);
  if (!option) {
    throw new Error("Invalid option payload returned from database.");
  }

  return option;
}

export async function deleteQuestionOption(
  questionId: string,
  optionId: string,
): Promise<void> {
  await assertQuestionExists(questionId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_options")
    .delete()
    .eq("id", optionId)
    .eq("question_id", questionId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new QuestionOptionInputError("not_found", "Option was not found.");
  }

  await normalizePositions(questionId);
}
