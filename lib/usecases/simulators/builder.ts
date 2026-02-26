import type {
  PublishValidationIssue,
  Simulator,
  SimulatorPublishValidation,
  SimulatorVersion,
  SimulatorVersionQuestion,
} from "@/lib/domain/simulator";
import { createClient } from "@/lib/supabase/server";

export type SimulatorBuilderErrorCode =
  | "simulator_not_found"
  | "version_not_found"
  | "published_version_not_found"
  | "draft_not_found"
  | "draft_already_exists"
  | "version_locked"
  | "question_not_found"
  | "question_not_eligible"
  | "invalid_position"
  | "not_found"
  | "duplicate_question"
  | "publish_validation_failed";

export class SimulatorBuilderError extends Error {
  readonly code: SimulatorBuilderErrorCode;

  constructor(code: SimulatorBuilderErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "SimulatorBuilderError";
  }
}

interface RawSimulatorRow {
  id: string;
  title: string;
  description: string | null;
  access_code_hash: string | null;
  max_attempts: number;
  duration_minutes: number;
  is_active: boolean;
  status: "draft" | "published";
  published_version_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface RawVersionRow {
  id: string;
  simulator_id: string;
  version_number: number;
  status: "draft" | "published" | "archived";
  created_from_version_id: string | null;
  published_at: string | null;
  has_attempts: boolean;
  created_at: string;
  updated_at: string;
}

interface RawVersionQuestionRow {
  id: string;
  simulator_version_id: string;
  position: number;
  topic_id: string;
  statement: string;
  image_url: string | null;
  source_question_id: string | null;
  topics: { name?: unknown } | Array<{ name?: unknown }> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSimulatorRow(row: unknown): Simulator | null {
  if (!isRecord(row)) {
    return null;
  }

  if (
    typeof row.id !== "string" ||
    typeof row.title !== "string" ||
    (row.description !== null && typeof row.description !== "string") ||
    (row.access_code_hash !== null && typeof row.access_code_hash !== "string") ||
    typeof row.max_attempts !== "number" ||
    typeof row.duration_minutes !== "number" ||
    typeof row.is_active !== "boolean" ||
    (row.status !== "draft" && row.status !== "published") ||
    (row.published_version_id !== null &&
      typeof row.published_version_id !== "string") ||
    typeof row.created_by !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    maxAttempts: row.max_attempts,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    status: row.status,
    publishedVersionId: row.published_version_id,
    hasAccessCode: !!row.access_code_hash,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseVersionRow(row: unknown): SimulatorVersion | null {
  if (!isRecord(row)) {
    return null;
  }

  if (
    typeof row.id !== "string" ||
    typeof row.simulator_id !== "string" ||
    typeof row.version_number !== "number" ||
    (row.status !== "draft" &&
      row.status !== "published" &&
      row.status !== "archived") ||
    (row.created_from_version_id !== null &&
      typeof row.created_from_version_id !== "string") ||
    (row.published_at !== null && typeof row.published_at !== "string") ||
    typeof row.has_attempts !== "boolean" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    simulatorId: row.simulator_id,
    versionNumber: row.version_number,
    status: row.status,
    createdFromVersionId: row.created_from_version_id,
    publishedAt: row.published_at,
    hasAttempts: row.has_attempts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function extractTopicName(
  topics: RawVersionQuestionRow["topics"],
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

function parseVersionQuestionRow(row: unknown): SimulatorVersionQuestion | null {
  if (!isRecord(row)) {
    return null;
  }

  const raw = row as unknown as RawVersionQuestionRow;
  if (
    typeof raw.id !== "string" ||
    typeof raw.simulator_version_id !== "string" ||
    typeof raw.position !== "number" ||
    typeof raw.topic_id !== "string" ||
    typeof raw.statement !== "string" ||
    (raw.image_url !== null && typeof raw.image_url !== "string") ||
    (raw.source_question_id !== null && typeof raw.source_question_id !== "string")
  ) {
    return null;
  }

  return {
    id: raw.id,
    simulatorVersionId: raw.simulator_version_id,
    position: raw.position,
    topicId: raw.topic_id,
    topicName: extractTopicName(raw.topics, raw.topic_id),
    statement: raw.statement,
    imageUrl: raw.image_url,
    sourceQuestionId: raw.source_question_id,
  };
}

async function getSimulatorById(simulatorId: string): Promise<Simulator> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulators")
    .select(
      "id, title, description, access_code_hash, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
    )
    .eq("id", simulatorId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const simulator = parseSimulatorRow(data as RawSimulatorRow);
  if (!simulator) {
    throw new SimulatorBuilderError(
      "simulator_not_found",
      "Simulator was not found.",
    );
  }

  return simulator;
}

async function getOrCreateDraftVersion(simulatorId: string): Promise<SimulatorVersion> {
  const supabase = await createClient();

  const { data: existingDraft, error: draftError } = await supabase
    .from("simulator_versions")
    .select(
      "id, simulator_id, version_number, status, created_from_version_id, published_at, has_attempts, created_at, updated_at",
    )
    .eq("simulator_id", simulatorId)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) {
    throw new Error(draftError.message);
  }

  const parsedDraft = parseVersionRow(existingDraft as RawVersionRow);
  if (parsedDraft) {
    return parsedDraft;
  }

  const { data: latestVersion, error: latestVersionError } = await supabase
    .from("simulator_versions")
    .select("version_number")
    .eq("simulator_id", simulatorId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) {
    throw new Error(latestVersionError.message);
  }

  const nextVersion =
    typeof latestVersion?.version_number === "number"
      ? latestVersion.version_number + 1
      : 1;

  const { data: createdDraft, error: createDraftError } = await supabase
    .from("simulator_versions")
    .insert({
      simulator_id: simulatorId,
      version_number: nextVersion,
      status: "draft",
    })
    .select(
      "id, simulator_id, version_number, status, created_from_version_id, published_at, has_attempts, created_at, updated_at",
    )
    .single();

  if (createDraftError) {
    throw new Error(createDraftError.message);
  }

  const parsedCreated = parseVersionRow(createdDraft as RawVersionRow);
  if (!parsedCreated) {
    throw new Error("Invalid simulator version payload returned from database.");
  }

  return parsedCreated;
}

async function getLatestPublishedVersion(
  simulatorId: string,
): Promise<SimulatorVersion | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulator_versions")
    .select(
      "id, simulator_id, version_number, status, created_from_version_id, published_at, has_attempts, created_at, updated_at",
    )
    .eq("simulator_id", simulatorId)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return parseVersionRow(data as RawVersionRow);
}

async function getLatestDraftVersion(simulatorId: string): Promise<SimulatorVersion | null> {
  const supabase = await createClient();
  const { data: existingDraft, error: draftError } = await supabase
    .from("simulator_versions")
    .select(
      "id, simulator_id, version_number, status, created_from_version_id, published_at, has_attempts, created_at, updated_at",
    )
    .eq("simulator_id", simulatorId)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) {
    throw new Error(draftError.message);
  }

  return parseVersionRow(existingDraft as RawVersionRow);
}

async function listVersionQuestions(
  versionId: string,
): Promise<SimulatorVersionQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulator_version_questions")
    .select(
      "id, simulator_version_id, position, topic_id, statement, image_url, source_question_id, topics(name)",
    )
    .eq("simulator_version_id", versionId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => parseVersionQuestionRow(row))
    .filter((row): row is SimulatorVersionQuestion => !!row);
}

async function normalizeVersionQuestionPositions(versionId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulator_version_questions")
    .select("id")
    .eq("simulator_version_id", versionId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ id: string }>;
  for (let index = 0; index < rows.length; index += 1) {
    const { error: tempError } = await supabase
      .from("simulator_version_questions")
      .update({ position: -(index + 1) })
      .eq("simulator_version_id", versionId)
      .eq("id", rows[index].id);
    if (tempError) {
      throw new Error(tempError.message);
    }
  }

  for (let index = 0; index < rows.length; index += 1) {
    const { error: finalError } = await supabase
      .from("simulator_version_questions")
      .update({ position: index + 1 })
      .eq("simulator_version_id", versionId)
      .eq("id", rows[index].id);
    if (finalError) {
      throw new Error(finalError.message);
    }
  }
}

async function reorderByIds(versionId: string, orderedIds: string[]): Promise<void> {
  const supabase = await createClient();
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error: tempError } = await supabase
      .from("simulator_version_questions")
      .update({ position: -(index + 1) })
      .eq("simulator_version_id", versionId)
      .eq("id", orderedIds[index]);
    if (tempError) {
      throw new Error(tempError.message);
    }
  }

  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error: finalError } = await supabase
      .from("simulator_version_questions")
      .update({ position: index + 1 })
      .eq("simulator_version_id", versionId)
      .eq("id", orderedIds[index]);
    if (finalError) {
      throw new Error(finalError.message);
    }
  }
}

async function assertSourceQuestionEligible(sourceQuestionId: string): Promise<{
  topicId: string;
  statement: string;
  imageUrl: string | null;
}> {
  const supabase = await createClient();
  const { data: questionRow, error: questionError } = await supabase
    .from("questions")
    .select("id, topic_id, statement, image_url, is_active")
    .eq("id", sourceQuestionId)
    .maybeSingle();

  if (questionError) {
    throw new Error(questionError.message);
  }

  if (
    !questionRow ||
    !questionRow.is_active ||
    typeof questionRow.topic_id !== "string" ||
    typeof questionRow.statement !== "string" ||
    (questionRow.image_url !== null && typeof questionRow.image_url !== "string")
  ) {
    throw new SimulatorBuilderError(
      "question_not_found",
      "Question was not found or is inactive.",
    );
  }

  const { data: options, error: optionsError } = await supabase
    .from("question_options")
    .select("id, position, text, image_url, is_correct, is_active")
    .eq("question_id", sourceQuestionId)
    .eq("is_active", true)
    .order("position", { ascending: true });

  if (optionsError) {
    throw new Error(optionsError.message);
  }

  const activeOptions = options ?? [];
  const activeCorrectCount = activeOptions.filter((option) => option.is_correct).length;
  if (activeOptions.length < 2 || activeCorrectCount !== 1) {
    throw new SimulatorBuilderError(
      "question_not_eligible",
      "Question must have at least 2 active options and exactly 1 active correct option.",
    );
  }

  return {
    topicId: questionRow.topic_id,
    statement: questionRow.statement,
    imageUrl: questionRow.image_url,
  };
}

export async function getSimulatorBuilderState(simulatorId: string): Promise<{
  simulator: Simulator;
  activeVersion: SimulatorVersion | null;
  draftVersion: SimulatorVersion | null;
  publishedVersion: SimulatorVersion | null;
  isEditable: boolean;
  lockReason: string | null;
  items: SimulatorVersionQuestion[];
}> {
  const simulator = await getSimulatorById(simulatorId);
  const draftVersion = await getLatestDraftVersion(simulatorId);
  const publishedVersion = await getLatestPublishedVersion(simulatorId);
  const activeVersion = draftVersion ?? publishedVersion;

  let items: SimulatorVersionQuestion[] = [];
  if (!activeVersion) {
    const newDraft = await getOrCreateDraftVersion(simulatorId);
    items = await listVersionQuestions(newDraft.id);
    return {
      simulator,
      activeVersion: newDraft,
      draftVersion: newDraft,
      publishedVersion,
      isEditable: true,
      lockReason: null,
      items,
    };
  }

  items = await listVersionQuestions(activeVersion.id);
  const isEditable = !activeVersion.hasAttempts;
  const lockReason = isEditable
    ? null
    : "This version is locked because it already has student attempts. Duplicate it to continue editing.";

  return {
    simulator,
    activeVersion,
    draftVersion,
    publishedVersion,
    isEditable,
    lockReason,
    items,
  };
}

async function getEditableVersionForMutations(
  simulatorId: string,
): Promise<SimulatorVersion> {
  const draftVersion = await getLatestDraftVersion(simulatorId);
  if (draftVersion) {
    if (draftVersion.hasAttempts) {
      throw new SimulatorBuilderError(
        "version_locked",
        "This draft version is locked because it already has student attempts.",
      );
    }
    return draftVersion;
  }

  const publishedVersion = await getLatestPublishedVersion(simulatorId);
  if (publishedVersion) {
    if (publishedVersion.hasAttempts) {
      throw new SimulatorBuilderError(
        "version_locked",
        "Published version has attempts. Duplicate this version to create a new editable draft.",
      );
    }
    return publishedVersion;
  }

  return getOrCreateDraftVersion(simulatorId);
}

export async function addQuestionToDraftVersion(
  simulatorId: string,
  sourceQuestionId: string,
  requestedPosition?: number,
): Promise<SimulatorVersionQuestion> {
  await getSimulatorById(simulatorId);
  const editableVersion = await getEditableVersionForMutations(simulatorId);
  const source = await assertSourceQuestionEligible(sourceQuestionId);

  const supabase = await createClient();

  const { data: duplicate, error: duplicateError } = await supabase
    .from("simulator_version_questions")
    .select("id")
    .eq("simulator_version_id", editableVersion.id)
    .eq("source_question_id", sourceQuestionId)
    .maybeSingle();

  if (duplicateError) {
    throw new Error(duplicateError.message);
  }

  if (duplicate?.id) {
    throw new SimulatorBuilderError(
      "duplicate_question",
      "Question is already added to this draft version.",
    );
  }

  const { data: maxPositionRow, error: maxPositionError } = await supabase
    .from("simulator_version_questions")
    .select("position")
    .eq("simulator_version_id", editableVersion.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxPositionError) {
    throw new Error(maxPositionError.message);
  }

  const nextPosition =
    typeof maxPositionRow?.position === "number" ? maxPositionRow.position + 1 : 1;

  const { data: createdVersionQuestion, error: createError } = await supabase
    .from("simulator_version_questions")
    .insert({
      simulator_version_id: editableVersion.id,
      position: nextPosition,
      topic_id: source.topicId,
      statement: source.statement,
      image_url: source.imageUrl,
      source_question_id: sourceQuestionId,
    })
    .select(
      "id, simulator_version_id, position, topic_id, statement, image_url, source_question_id",
    )
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const versionQuestionId = createdVersionQuestion.id as string;

  const { data: sourceOptions, error: sourceOptionsError } = await supabase
    .from("question_options")
    .select("position, text, image_url, is_correct")
    .eq("question_id", sourceQuestionId)
    .eq("is_active", true)
    .order("position", { ascending: true });

  if (sourceOptionsError) {
    throw new Error(sourceOptionsError.message);
  }

  const optionRows = (sourceOptions ?? []).map((option) => ({
    simulator_version_question_id: versionQuestionId,
    position: option.position,
    text: option.text,
    image_url: option.image_url,
    is_correct: option.is_correct,
  }));

  if (optionRows.length > 0) {
    const { error: insertOptionsError } = await supabase
      .from("simulator_version_question_options")
      .insert(optionRows);

    if (insertOptionsError) {
      throw new Error(insertOptionsError.message);
    }
  }

  if (typeof requestedPosition === "number") {
    const normalizedPosition = Math.trunc(requestedPosition);
    if (!Number.isFinite(requestedPosition) || normalizedPosition <= 0) {
      throw new SimulatorBuilderError(
        "invalid_position",
        "Position must be greater than 0.",
      );
    }

    const items = await listVersionQuestions(editableVersion.id);
    const ids = items.map((item) => item.id);
    const index = ids.indexOf(versionQuestionId);
    if (index !== -1) {
      ids.splice(index, 1);
    }
    const targetIndex = Math.min(normalizedPosition - 1, ids.length);
    ids.splice(targetIndex, 0, versionQuestionId);
    await reorderByIds(editableVersion.id, ids);
  } else {
    await normalizeVersionQuestionPositions(editableVersion.id);
  }

  const finalItems = await listVersionQuestions(editableVersion.id);
  const created = finalItems.find((item) => item.id === versionQuestionId);
  if (!created) {
    throw new Error("Failed to load created version question.");
  }

  return created;
}

export async function reorderDraftVersionQuestion(
  simulatorId: string,
  versionQuestionId: string,
  position: number,
): Promise<SimulatorVersionQuestion> {
  await getSimulatorById(simulatorId);
  const editableVersion = await getEditableVersionForMutations(simulatorId);

  if (!Number.isFinite(position) || Math.trunc(position) <= 0) {
    throw new SimulatorBuilderError(
      "invalid_position",
      "Position must be greater than 0.",
    );
  }

  const items = await listVersionQuestions(editableVersion.id);
  const ids = items.map((item) => item.id);
  const fromIndex = ids.indexOf(versionQuestionId);
  if (fromIndex === -1) {
    throw new SimulatorBuilderError("not_found", "Draft question was not found.");
  }

  ids.splice(fromIndex, 1);
  const targetIndex = Math.min(Math.trunc(position) - 1, ids.length);
  ids.splice(targetIndex, 0, versionQuestionId);

  await reorderByIds(editableVersion.id, ids);

  const finalItems = await listVersionQuestions(editableVersion.id);
  const updated = finalItems.find((item) => item.id === versionQuestionId);
  if (!updated) {
    throw new SimulatorBuilderError("not_found", "Draft question was not found.");
  }

  return updated;
}

export async function removeQuestionFromDraftVersion(
  simulatorId: string,
  versionQuestionId: string,
): Promise<void> {
  await getSimulatorById(simulatorId);
  const editableVersion = await getEditableVersionForMutations(simulatorId);
  const supabase = await createClient();

  const { data: deletedRow, error: deleteError } = await supabase
    .from("simulator_version_questions")
    .delete()
    .eq("simulator_version_id", editableVersion.id)
    .eq("id", versionQuestionId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    throw new Error(deleteError.message);
  }
  if (!deletedRow) {
    throw new SimulatorBuilderError("not_found", "Draft question was not found.");
  }

  await normalizeVersionQuestionPositions(editableVersion.id);
}

function validateOrderContiguous(
  items: SimulatorVersionQuestion[],
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const expectedPosition = index + 1;
    if (items[index].position !== expectedPosition) {
      issues.push({
        code: "order_not_contiguous",
        message: `Question order is invalid at position ${expectedPosition}.`,
        versionQuestionId: items[index].id,
        sourceQuestionId: items[index].sourceQuestionId ?? undefined,
      });
      break;
    }
  }
  return issues;
}

export async function validateDraftVersionBeforePublish(
  simulatorId: string,
): Promise<SimulatorPublishValidation> {
  await getSimulatorById(simulatorId);
  const draftVersion = await getLatestDraftVersion(simulatorId);
  if (!draftVersion) {
    throw new SimulatorBuilderError(
      "draft_not_found",
      "No draft version found to validate.",
    );
  }
  const items = await listVersionQuestions(draftVersion.id);
  const issues: PublishValidationIssue[] = [];

  if (items.length === 0) {
    issues.push({
      code: "empty_question_set",
      message: "Draft version must include at least one question.",
    });
  }

  issues.push(...validateOrderContiguous(items));

  const supabase = await createClient();
  for (const item of items) {
    const { data: optionRows, error: optionsError } = await supabase
      .from("simulator_version_question_options")
      .select("id, is_correct")
      .eq("simulator_version_question_id", item.id);

    if (optionsError) {
      throw new Error(optionsError.message);
    }

    const optionCount = (optionRows ?? []).length;
    const correctCount = (optionRows ?? []).filter((row) => row.is_correct).length;

    if (optionCount < 2) {
      issues.push({
        code: "question_options_insufficient",
        message: "Each draft question must have at least 2 options.",
        versionQuestionId: item.id,
        sourceQuestionId: item.sourceQuestionId ?? undefined,
      });
    }

    if (correctCount !== 1) {
      issues.push({
        code: "question_options_correct_count_invalid",
        message: "Each draft question must have exactly one correct option.",
        versionQuestionId: item.id,
        sourceQuestionId: item.sourceQuestionId ?? undefined,
      });
    }
  }

  return {
    simulatorId,
    versionId: draftVersion.id,
    isValid: issues.length === 0,
    issues,
  };
}

export async function publishDraftVersion(simulatorId: string): Promise<{
  simulator: Simulator;
  publishedVersion: SimulatorVersion;
  validation: SimulatorPublishValidation;
}> {
  const simulator = await getSimulatorById(simulatorId);
  const draftVersion = await getLatestDraftVersion(simulator.id);
  if (!draftVersion) {
    throw new SimulatorBuilderError(
      "draft_not_found",
      "No draft version found to publish.",
    );
  }

  const validation = await validateDraftVersionBeforePublish(simulator.id);
  if (!validation.isValid) {
    throw new SimulatorBuilderError(
      "publish_validation_failed",
      "Draft version is not valid for publish.",
    );
  }

  const supabase = await createClient();

  const { error: archiveError } = await supabase
    .from("simulator_versions")
    .update({ status: "archived" })
    .eq("simulator_id", simulator.id)
    .eq("status", "published");
  if (archiveError) {
    throw new Error(archiveError.message);
  }

  const { data: publishedVersionRow, error: publishVersionError } = await supabase
    .from("simulator_versions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", draftVersion.id)
    .eq("simulator_id", simulator.id)
    .select(
      "id, simulator_id, version_number, status, created_from_version_id, published_at, has_attempts, created_at, updated_at",
    )
    .maybeSingle();
  if (publishVersionError) {
    throw new Error(publishVersionError.message);
  }
  const publishedVersion = parseVersionRow(publishedVersionRow as RawVersionRow);
  if (!publishedVersion) {
    throw new SimulatorBuilderError(
      "version_not_found",
      "Draft version was not found.",
    );
  }

  const { data: updatedSimulatorRow, error: updateSimulatorError } = await supabase
    .from("simulators")
    .update({
      status: "published",
      published_version_id: publishedVersion.id,
    })
    .eq("id", simulator.id)
    .select(
      "id, title, description, access_code_hash, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
    )
    .single();
  if (updateSimulatorError) {
    throw new Error(updateSimulatorError.message);
  }

  const updatedSimulator = parseSimulatorRow(updatedSimulatorRow as RawSimulatorRow);
  if (!updatedSimulator) {
    throw new Error("Invalid simulator payload returned from database.");
  }

  return {
    simulator: updatedSimulator,
    publishedVersion,
    validation,
  };
}

export async function duplicatePublishedVersionToDraft(simulatorId: string): Promise<{
  draftVersion: SimulatorVersion;
  copiedQuestions: number;
}> {
  await getSimulatorById(simulatorId);

  const existingDraft = await getLatestDraftVersion(simulatorId);
  if (existingDraft) {
    throw new SimulatorBuilderError(
      "draft_already_exists",
      "There is already an editable draft for this simulator.",
    );
  }

  const sourceVersion = await getLatestPublishedVersion(simulatorId);
  if (!sourceVersion) {
    throw new SimulatorBuilderError(
      "published_version_not_found",
      "No published version was found to duplicate.",
    );
  }

  const supabase = await createClient();

  const { data: latestVersion, error: latestVersionError } = await supabase
    .from("simulator_versions")
    .select("version_number")
    .eq("simulator_id", simulatorId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionError) {
    throw new Error(latestVersionError.message);
  }

  const nextVersion =
    typeof latestVersion?.version_number === "number"
      ? latestVersion.version_number + 1
      : 1;

  const { data: draftRow, error: createDraftError } = await supabase
    .from("simulator_versions")
    .insert({
      simulator_id: simulatorId,
      version_number: nextVersion,
      status: "draft",
      created_from_version_id: sourceVersion.id,
    })
    .select(
      "id, simulator_id, version_number, status, created_from_version_id, published_at, has_attempts, created_at, updated_at",
    )
    .single();

  if (createDraftError) {
    throw new Error(createDraftError.message);
  }

  const draftVersion = parseVersionRow(draftRow as RawVersionRow);
  if (!draftVersion) {
    throw new Error("Invalid draft version payload returned from database.");
  }

  const sourceQuestions = await listVersionQuestions(sourceVersion.id);
  let copiedQuestions = 0;

  for (const sourceQuestion of sourceQuestions) {
    const { data: insertedQuestion, error: insertQuestionError } = await supabase
      .from("simulator_version_questions")
      .insert({
        simulator_version_id: draftVersion.id,
        position: sourceQuestion.position,
        topic_id: sourceQuestion.topicId,
        statement: sourceQuestion.statement,
        image_url: sourceQuestion.imageUrl,
        source_question_id: sourceQuestion.sourceQuestionId,
      })
      .select("id")
      .single();

    if (insertQuestionError) {
      throw new Error(insertQuestionError.message);
    }

    const newVersionQuestionId = insertedQuestion.id as string;
    const { data: sourceOptions, error: sourceOptionsError } = await supabase
      .from("simulator_version_question_options")
      .select("position, text, image_url, is_correct")
      .eq("simulator_version_question_id", sourceQuestion.id)
      .order("position", { ascending: true });

    if (sourceOptionsError) {
      throw new Error(sourceOptionsError.message);
    }

    const optionRows = (sourceOptions ?? []).map((option) => ({
      simulator_version_question_id: newVersionQuestionId,
      position: option.position,
      text: option.text,
      image_url: option.image_url,
      is_correct: option.is_correct,
    }));

    if (optionRows.length > 0) {
      const { error: insertOptionsError } = await supabase
        .from("simulator_version_question_options")
        .insert(optionRows);

      if (insertOptionsError) {
        throw new Error(insertOptionsError.message);
      }
    }

    copiedQuestions += 1;
  }

  return {
    draftVersion,
    copiedQuestions,
  };
}
