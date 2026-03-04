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
  | "question_already_consumed"
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
  campus?: string;
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
  topics:
    | { name?: unknown; display_order?: unknown }
    | Array<{ name?: unknown; display_order?: unknown }>
    | null;
}

interface RawVersionTopicOrderRow {
  topic_id: string;
  display_order: number;
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
    campus: row.campus === "azogues" ? "azogues" : "canar",
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
      "id, title, campus, description, access_code_hash, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
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
      "No se encontro el simulador.",
    );
  }

  return simulator;
}

async function initializeVersionTopicOrder(
  versionId: string,
  sourceVersionId?: string,
): Promise<void> {
  const supabase = await createClient();

  let rowsToInsert: Array<{
    simulator_version_id: string;
    topic_id: string;
    display_order: number;
  }> = [];

  if (sourceVersionId) {
    const { data: sourceRows, error: sourceError } = await supabase
      .from("simulator_version_topic_order")
      .select("topic_id, display_order")
      .eq("simulator_version_id", sourceVersionId)
      .order("display_order", { ascending: true });

    if (sourceError) {
      throw new Error(sourceError.message);
    }

    rowsToInsert = ((sourceRows ?? []) as RawVersionTopicOrderRow[])
      .filter(
        (row) =>
          typeof row.topic_id === "string" && typeof row.display_order === "number",
      )
      .map((row) => ({
        simulator_version_id: versionId,
        topic_id: row.topic_id,
        display_order: row.display_order,
      }));
  }

  if (rowsToInsert.length === 0) {
    const { data: topicRows, error: topicError } = await supabase
      .from("topics")
      .select("id")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (topicError) {
      throw new Error(topicError.message);
    }

    rowsToInsert = (topicRows ?? [])
      .filter((row) => typeof row.id === "string")
      .map((row, index) => ({
        simulator_version_id: versionId,
        topic_id: row.id as string,
        display_order: index + 1,
      }));
  }

  if (rowsToInsert.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("simulator_version_topic_order")
    .insert(rowsToInsert);

  if (insertError) {
    throw new Error(insertError.message);
  }
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

  await initializeVersionTopicOrder(parsedCreated.id);

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
      "id, simulator_version_id, position, topic_id, statement, image_url, source_question_id, topics(name, display_order)",
    )
    .eq("simulator_version_id", versionId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const sortedRows = ((data ?? []) as RawVersionQuestionRow[]).sort((a, b) => {
    const aOrder = Array.isArray(a.topics)
      ? a.topics[0]?.display_order
      : a.topics?.display_order;
    const bOrder = Array.isArray(b.topics)
      ? b.topics[0]?.display_order
      : b.topics?.display_order;
    const normalizedAOrder = typeof aOrder === "number" ? aOrder : Number.MAX_SAFE_INTEGER;
    const normalizedBOrder = typeof bOrder === "number" ? bOrder : Number.MAX_SAFE_INTEGER;

    if (normalizedAOrder !== normalizedBOrder) {
      return normalizedAOrder - normalizedBOrder;
    }

    if (a.topic_id !== b.topic_id) {
      return a.topic_id.localeCompare(b.topic_id);
    }

    return a.position - b.position;
  });

  return sortedRows
    .map((row) => parseVersionQuestionRow(row))
    .filter((row): row is SimulatorVersionQuestion => !!row);
}

async function normalizeVersionQuestionPositions(versionId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulator_version_questions")
    .select("id, position, topic_id, topics(display_order)")
    .eq("simulator_version_id", versionId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as Array<{
    id: string;
    position: number;
    topic_id: string;
    topics?: { display_order?: unknown } | Array<{ display_order?: unknown }> | null;
  }>).sort((a, b) => {
    const aOrder = Array.isArray(a.topics)
      ? a.topics[0]?.display_order
      : a.topics?.display_order;
    const bOrder = Array.isArray(b.topics)
      ? b.topics[0]?.display_order
      : b.topics?.display_order;
    const normalizedAOrder = typeof aOrder === "number" ? aOrder : Number.MAX_SAFE_INTEGER;
    const normalizedBOrder = typeof bOrder === "number" ? bOrder : Number.MAX_SAFE_INTEGER;

    if (normalizedAOrder !== normalizedBOrder) {
      return normalizedAOrder - normalizedBOrder;
    }

    if (a.topic_id !== b.topic_id) {
      return a.topic_id.localeCompare(b.topic_id);
    }

    return a.position - b.position;
  });
  const maxPosition = rows.reduce(
    (max, row) => (row.position > max ? row.position : max),
    0,
  );
  for (let index = 0; index < rows.length; index += 1) {
    const { error: tempError } = await supabase
      .from("simulator_version_questions")
      .update({ position: maxPosition + index + 1 })
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
      "La pregunta no existe o esta inactiva.",
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
      "La pregunta debe tener al menos 2 opciones activas y exactamente 1 opcion correcta activa.",
    );
  }

  const { data: consumedRow, error: consumedError } = await supabase
    .from("simulator_version_questions")
    .select("id")
    .eq("source_question_id", sourceQuestionId)
    .limit(1)
    .maybeSingle();

  if (consumedError) {
    throw new Error(consumedError.message);
  }

  if (consumedRow?.id) {
    throw new SimulatorBuilderError(
      "question_already_consumed",
      "La pregunta ya fue asignada a un simulador y no puede reutilizarse.",
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
  const isEditable = !!draftVersion && !draftVersion.hasAttempts;
  const lockReason = draftVersion
    ? draftVersion.hasAttempts
      ? "Esta version esta bloqueada porque ya tiene intentos de estudiantes. Duplicala para seguir editando."
      : null
    : publishedVersion
      ? "No existe un borrador en este momento. Duplica la version publicada para crear uno."
      : null;

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
        "Esta version borrador esta bloqueada porque ya tiene intentos de estudiantes.",
      );
    }
    return draftVersion;
  }

  const publishedVersion = await getLatestPublishedVersion(simulatorId);
  if (publishedVersion) {
    throw new SimulatorBuilderError(
      "draft_not_found",
      "No existe un borrador en este momento. Duplica la version publicada para crear uno.",
    );
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
  const logContext = {
    simulatorId,
    editableVersionId: editableVersion.id,
    sourceQuestionId,
    requestedPosition,
  };

  const { data: duplicate, error: duplicateError } = await supabase
    .from("simulator_version_questions")
    .select("id")
    .eq("simulator_version_id", editableVersion.id)
    .eq("source_question_id", sourceQuestionId)
    .maybeSingle();

  if (duplicateError) {
    console.error("[simulator-builder:add-question] duplicate check failed", {
      ...logContext,
      duplicateError,
    });
    throw new Error(duplicateError.message);
  }

  if (duplicate?.id) {
    throw new SimulatorBuilderError(
      "duplicate_question",
      "La pregunta ya esta agregada en esta version borrador.",
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
    console.error("[simulator-builder:add-question] max position query failed", {
      ...logContext,
      maxPositionError,
    });
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
    console.error("[simulator-builder:add-question] create version question failed", {
      ...logContext,
      createError,
      insertPayload: {
        simulator_version_id: editableVersion.id,
        position: nextPosition,
        topic_id: source.topicId,
        source_question_id: sourceQuestionId,
      },
    });
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
    console.error("[simulator-builder:add-question] source options query failed", {
      ...logContext,
      sourceOptionsError,
    });
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
      console.error("[simulator-builder:add-question] copy options failed", {
        ...logContext,
        versionQuestionId,
        optionsCount: optionRows.length,
        insertOptionsError,
      });
      throw new Error(insertOptionsError.message);
    }
  }

  void requestedPosition;
  await normalizeVersionQuestionPositions(editableVersion.id);

  const finalItems = await listVersionQuestions(editableVersion.id);
  const created = finalItems.find((item) => item.id === versionQuestionId);
  if (!created) {
    console.error("[simulator-builder:add-question] created question not found after insert", {
      ...logContext,
      versionQuestionId,
      finalItemsCount: finalItems.length,
    });
    throw new Error("No se pudo cargar la pregunta creada en la version.");
  }

  return created;
}

export async function addQuestionsToDraftVersion(
  simulatorId: string,
  sourceQuestionIds: string[],
  requestedPosition?: number,
): Promise<SimulatorVersionQuestion[]> {
  const normalizedIds = sourceQuestionIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (normalizedIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(normalizedIds));
  const insertedItems: SimulatorVersionQuestion[] = [];
  void requestedPosition;

  for (const sourceQuestionId of uniqueIds) {
    const inserted = await addQuestionToDraftVersion(simulatorId, sourceQuestionId);
    insertedItems.push(inserted);
  }

  return insertedItems;
}

export async function reorderDraftVersionQuestion(
  simulatorId: string,
  versionQuestionId: string,
  position: number,
): Promise<SimulatorVersionQuestion> {
  void simulatorId;
  void versionQuestionId;
  void position;
  throw new SimulatorBuilderError(
    "invalid_position",
    "El orden manual ya no esta disponible. Ajusta el orden de los temas.",
  );
}

export async function removeQuestionFromDraftVersion(
  simulatorId: string,
  versionQuestionId: string,
): Promise<void> {
  await getSimulatorById(simulatorId);
  const editableVersion = await getEditableVersionForMutations(simulatorId);
  const supabase = await createClient();
  const logContext = {
    simulatorId,
    editableVersionId: editableVersion.id,
    versionQuestionId,
  };

  const { data: deletedRow, error: deleteError } = await supabase
    .from("simulator_version_questions")
    .delete()
    .eq("simulator_version_id", editableVersion.id)
    .eq("id", versionQuestionId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("[simulator-builder:remove-question] delete failed", {
      ...logContext,
      deleteError,
    });
    throw new Error(deleteError.message);
  }
  if (!deletedRow) {
    throw new SimulatorBuilderError("not_found", "No se encontro la pregunta del borrador.");
  }

  try {
    await normalizeVersionQuestionPositions(editableVersion.id);
  } catch (error) {
    console.error("[simulator-builder:remove-question] normalize positions failed", {
      ...logContext,
      error,
    });
    throw error;
  }
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
        message: `El orden de preguntas es invalido en la posicion ${expectedPosition}.`,
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
      "No se encontro una version borrador para validar.",
    );
  }
  const items = await listVersionQuestions(draftVersion.id);
  const issues: PublishValidationIssue[] = [];

  if (items.length === 0) {
    issues.push({
      code: "empty_question_set",
      message: "La version borrador debe incluir al menos una pregunta.",
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
        message: "Cada pregunta del borrador debe tener al menos 2 opciones.",
        versionQuestionId: item.id,
        sourceQuestionId: item.sourceQuestionId ?? undefined,
      });
    }

    if (correctCount !== 1) {
      issues.push({
        code: "question_options_correct_count_invalid",
        message: "Cada pregunta del borrador debe tener exactamente una opcion correcta.",
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
      "No se encontro una version borrador para publicar.",
    );
  }

  const validation = await validateDraftVersionBeforePublish(simulator.id);
  if (!validation.isValid) {
    throw new SimulatorBuilderError(
      "publish_validation_failed",
      "La version borrador no es valida para publicar.",
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
      "No se encontro la version borrador.",
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
      "id, title, campus, description, access_code_hash, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
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
      "Ya existe un borrador editable para este simulador.",
    );
  }

  const sourceVersion = await getLatestPublishedVersion(simulatorId);
  if (!sourceVersion) {
    throw new SimulatorBuilderError(
      "published_version_not_found",
      "No se encontro una version publicada para duplicar.",
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
    throw new Error("Payload de version borrador invalido devuelto por la base de datos.");
  }

  await initializeVersionTopicOrder(draftVersion.id, sourceVersion.id);

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
