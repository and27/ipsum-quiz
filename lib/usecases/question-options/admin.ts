import type {
  QuestionOption,
  QuestionOptionIntegrity,
} from "@/lib/domain/question-option";
import { createClient } from "@/lib/supabase/server";

export type QuestionOptionInputErrorCode =
  | "invalid_text"
  | "invalid_position"
  | "question_not_found"
  | "not_found"
  | "no_changes"
  | "duplicate_position"
  | "duplicate_correct_option"
  | "invalid_correct_state";

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

export interface QuestionOptionsListResult {
  items: QuestionOption[];
  integrity: QuestionOptionIntegrity;
  questionIsActive: boolean;
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

async function getQuestionRow(
  questionId: string,
): Promise<{ id: string; is_active: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("id, is_active")
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data.id !== "string" || typeof data.is_active !== "boolean") {
    throw new QuestionOptionInputError(
      "question_not_found",
      "Question was not found.",
    );
  }

  return { id: data.id, is_active: data.is_active };
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
    const { error: tempError } = await supabase
      .from("question_options")
      .update({ position: -(index + 1) })
      .eq("id", row.id)
      .eq("question_id", questionId);
    if (tempError) {
      throw new Error(tempError.message);
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const { error: finalError } = await supabase
      .from("question_options")
      .update({ position: index + 1 })
      .eq("id", row.id)
      .eq("question_id", questionId);
    if (finalError) {
      throw new Error(finalError.message);
    }
  }
}

async function getOptionRow(
  questionId: string,
  optionId: string,
): Promise<{ id: string; is_active: boolean; is_correct: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_options")
    .select("id, is_active, is_correct")
    .eq("question_id", questionId)
    .eq("id", optionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (
    !data ||
    typeof data.id !== "string" ||
    typeof data.is_active !== "boolean" ||
    typeof data.is_correct !== "boolean"
  ) {
    throw new QuestionOptionInputError("not_found", "Option was not found.");
  }

  return data;
}

export async function getQuestionOptionIntegrity(
  questionId: string,
): Promise<QuestionOptionIntegrity> {
  await getQuestionRow(questionId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_options")
    .select("is_active, is_correct")
    .eq("question_id", questionId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ is_active: boolean; is_correct: boolean }>;
  const activeOptionsCount = rows.filter((row) => row.is_active).length;
  const activeCorrectOptionsCount = rows.filter(
    (row) => row.is_active && row.is_correct,
  ).length;

  return {
    activeOptionsCount,
    activeCorrectOptionsCount,
    isReady: activeOptionsCount >= 2 && activeCorrectOptionsCount === 1,
  };
}

async function assertActiveQuestionIntegrityOnOptionUpdate(
  questionId: string,
  option: { is_active: boolean; is_correct: boolean },
  input: QuestionOptionUpdateInput,
): Promise<void> {
  const question = await getQuestionRow(questionId);
  if (!question.is_active) {
    return;
  }

  if (input.isCorrect === false) {
    throw new QuestionOptionInputError(
      "invalid_correct_state",
      "Cannot unset the correct option on an active question. Set another active option as correct.",
    );
  }

  const integrity = await getQuestionOptionIntegrity(questionId);
  const nextIsActive =
    typeof input.isActive === "boolean" ? input.isActive : option.is_active;

  if (option.is_active && !nextIsActive) {
    if (integrity.activeOptionsCount <= 2) {
      throw new QuestionOptionInputError(
        "invalid_correct_state",
        "Active questions must keep at least 2 active options.",
      );
    }

    if (option.is_correct && input.isCorrect !== true) {
      throw new QuestionOptionInputError(
        "invalid_correct_state",
        "Active questions must keep exactly one active correct option.",
      );
    }
  }
}

async function assertActiveQuestionIntegrityOnOptionDelete(
  questionId: string,
  option: { is_active: boolean; is_correct: boolean },
): Promise<void> {
  const question = await getQuestionRow(questionId);
  if (!question.is_active) {
    return;
  }

  if (!option.is_active) {
    return;
  }

  const integrity = await getQuestionOptionIntegrity(questionId);
  if (integrity.activeOptionsCount <= 2) {
    throw new QuestionOptionInputError(
      "invalid_correct_state",
      "Active questions must keep at least 2 active options.",
    );
  }

  if (option.is_correct) {
    throw new QuestionOptionInputError(
      "invalid_correct_state",
      "Active questions must keep exactly one active correct option.",
    );
  }
}

export async function listQuestionOptions(
  questionId: string,
  includeInactive = true,
): Promise<QuestionOption[]> {
  await getQuestionRow(questionId);

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

export async function listQuestionOptionsWithState(
  questionId: string,
  includeInactive = true,
): Promise<QuestionOptionsListResult> {
  const question = await getQuestionRow(questionId);
  const [items, integrity] = await Promise.all([
    listQuestionOptions(questionId, includeInactive),
    getQuestionOptionIntegrity(questionId),
  ]);

  return {
    items,
    integrity,
    questionIsActive: question.is_active,
  };
}

export async function createQuestionOption(
  questionId: string,
  input: QuestionOptionCreateInput,
): Promise<QuestionOption> {
  await getQuestionRow(questionId);

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

  if (input.isCorrect === true && input.isActive === false) {
    throw new QuestionOptionInputError(
      "invalid_correct_state",
      "Correct option must be active.",
    );
  }

  const { data, error } = await supabase
    .from("question_options")
    .insert({
      question_id: questionId,
      position: nextPosition,
      text: validateText(input.text),
      image_url: normalizeImageUrl(input.imageUrl),
      is_correct: false,
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

  if (input.isCorrect) {
    const { error: rpcError } = await supabase.rpc("set_question_option_correct", {
      p_question_id: questionId,
      p_option_id: option.id,
    });

    if (rpcError) {
      if (rpcError.message.includes("Correct option must be active")) {
        throw new QuestionOptionInputError(
          "invalid_correct_state",
          "Correct option must be active.",
        );
      }
      throw new Error(rpcError.message);
    }

    const { data: correctedData, error: correctedError } = await supabase
      .from("question_options")
      .select(
        "id, question_id, position, text, image_url, is_correct, is_active, created_at, updated_at",
      )
      .eq("id", option.id)
      .eq("question_id", questionId)
      .single();

    if (correctedError) {
      throw new Error(correctedError.message);
    }

    const correctedOption = parseOptionRow(correctedData);
    if (!correctedOption) {
      throw new Error("Invalid option payload returned from database.");
    }

    return correctedOption;
  }

  return option;
}

export async function updateQuestionOption(
  questionId: string,
  optionId: string,
  input: QuestionOptionUpdateInput,
): Promise<QuestionOption> {
  await getQuestionRow(questionId);
  const currentOption = await getOptionRow(questionId, optionId);
  await assertActiveQuestionIntegrityOnOptionUpdate(
    questionId,
    currentOption,
    input,
  );

  if (input.isCorrect === false) {
    throw new QuestionOptionInputError(
      "invalid_correct_state",
      "Cannot unset the correct option directly. Set another active option as correct.",
    );
  }

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
  if (typeof input.isActive === "boolean") {
    payload.is_active = input.isActive;
  }

  if (input.isCorrect === true && payload.is_active === false) {
    throw new QuestionOptionInputError(
      "invalid_correct_state",
      "Correct option must be active.",
    );
  }

  const hasPayloadUpdates = Object.keys(payload).length > 0;
  if (!hasPayloadUpdates && input.isCorrect !== true) {
    throw new QuestionOptionInputError(
      "no_changes",
      "No option changes were provided.",
    );
  }

  const supabase = await createClient();
  if (hasPayloadUpdates) {
    const { error } = await supabase
      .from("question_options")
      .update(payload)
      .eq("id", optionId)
      .eq("question_id", questionId);

    if (error) {
      mapDatabaseError(error);
    }
  }

  if (input.isCorrect === true) {
    const { error: rpcError } = await supabase.rpc("set_question_option_correct", {
      p_question_id: questionId,
      p_option_id: optionId,
    });

    if (rpcError) {
      if (rpcError.message.includes("Correct option must be active")) {
        throw new QuestionOptionInputError(
          "invalid_correct_state",
          "Correct option must be active.",
        );
      }
      throw new Error(rpcError.message);
    }
  }

  const { data: updatedData, error: updatedError } = await supabase
    .from("question_options")
    .select(
      "id, question_id, position, text, image_url, is_correct, is_active, created_at, updated_at",
    )
    .eq("id", optionId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (updatedError) {
    throw new Error(updatedError.message);
  }

  if (!updatedData) {
    throw new QuestionOptionInputError("not_found", "Option was not found.");
  }

  const option = parseOptionRow(updatedData);
  if (!option) {
    throw new Error("Invalid option payload returned from database.");
  }

  return option;
}

export async function deleteQuestionOption(
  questionId: string,
  optionId: string,
): Promise<void> {
  await getQuestionRow(questionId);
  const currentOption = await getOptionRow(questionId, optionId);
  await assertActiveQuestionIntegrityOnOptionDelete(questionId, currentOption);

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
