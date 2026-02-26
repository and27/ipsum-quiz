import type { AdminSimulatorsListQuery } from "@/lib/domain/contracts";
import type { Simulator, SimulatorStatus } from "@/lib/domain/simulator";
import { createClient } from "@/lib/supabase/server";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const DEFAULT_MAX_ATTEMPTS = 3;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;
const HASH_PREFIX = "scrypt";

export type SimulatorInputErrorCode =
  | "invalid_title"
  | "invalid_description"
  | "invalid_duration_minutes"
  | "invalid_max_attempts"
  | "invalid_status"
  | "invalid_status_transition"
  | "invalid_access_code"
  | "not_found"
  | "no_changes";

export class SimulatorInputError extends Error {
  readonly code: SimulatorInputErrorCode;

  constructor(code: SimulatorInputErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "SimulatorInputError";
  }
}

interface RawSimulatorRow {
  id: string;
  title: string;
  description: string | null;
  access_code_hash: string | null;
  access_code_plaintext?: string | null;
  max_attempts: number;
  duration_minutes: number;
  is_active: boolean;
  status: SimulatorStatus;
  published_version_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SimulatorListResult {
  items: Simulator[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SimulatorCreateInput {
  title: string;
  description?: string | null;
  maxAttempts?: number;
  durationMinutes: number;
  isActive?: boolean;
  accessCode?: string | null;
  createdBy: string;
}

interface SimulatorUpdateInput {
  title?: string;
  description?: string | null;
  maxAttempts?: number;
  durationMinutes?: number;
  isActive?: boolean;
  status?: SimulatorStatus;
  accessCode?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSimulatorStatus(value: unknown): SimulatorStatus | null {
  return value === "draft" || value === "published" ? value : null;
}

function parseSimulatorRow(row: unknown): Simulator | null {
  if (!isRecord(row)) {
    return null;
  }

  const status = parseSimulatorStatus(row.status);
  if (
    typeof row.id !== "string" ||
    typeof row.title !== "string" ||
    (row.description !== null && typeof row.description !== "string") ||
    (row.access_code_hash !== null && typeof row.access_code_hash !== "string") ||
    (typeof row.access_code_plaintext !== "undefined" &&
      row.access_code_plaintext !== null &&
      typeof row.access_code_plaintext !== "string") ||
    typeof row.max_attempts !== "number" ||
    typeof row.duration_minutes !== "number" ||
    typeof row.is_active !== "boolean" ||
    !status ||
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
    accessCode:
      typeof row.access_code_plaintext === "string" ? row.access_code_plaintext : null,
    maxAttempts: row.max_attempts,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    status,
    publishedVersionId: row.published_version_id,
    hasAccessCode: !!row.access_code_hash,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function validateTitle(value: string): string {
  const title = normalizeTitle(value);
  if (!title) {
    throw new SimulatorInputError("invalid_title", "Title is required.");
  }
  if (title.length > 200) {
    throw new SimulatorInputError(
      "invalid_title",
      "Title must be 200 characters or fewer.",
    );
  }
  return title;
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const description = value.trim().replace(/\s+/g, " ");
  if (!description) {
    return null;
  }

  if (description.length > 2000) {
    throw new SimulatorInputError(
      "invalid_description",
      "Description must be 2000 characters or fewer.",
    );
  }

  return description;
}

function validateDurationMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    throw new SimulatorInputError(
      "invalid_duration_minutes",
      "Duration must be a number.",
    );
  }

  const duration = Math.trunc(value);
  if (duration <= 0 || duration > 600) {
    throw new SimulatorInputError(
      "invalid_duration_minutes",
      "Duration must be between 1 and 600 minutes.",
    );
  }

  return duration;
}

function validateMaxAttempts(value: number): number {
  if (!Number.isFinite(value)) {
    throw new SimulatorInputError(
      "invalid_max_attempts",
      "Max attempts must be a number.",
    );
  }

  const maxAttempts = Math.trunc(value);
  if (maxAttempts <= 0 || maxAttempts > 20) {
    throw new SimulatorInputError(
      "invalid_max_attempts",
      "Max attempts must be between 1 and 20.",
    );
  }

  return maxAttempts;
}

function validateStatus(value: SimulatorStatus): SimulatorStatus {
  if (value !== "draft" && value !== "published") {
    throw new SimulatorInputError("invalid_status", "Invalid simulator status.");
  }
  return value;
}

function normalizeAccessCode(
  value: string | null | undefined,
): string | null | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const code = value.trim();
  if (!code) {
    return null;
  }
  if (code.length < 4 || code.length > 64) {
    throw new SimulatorInputError(
      "invalid_access_code",
      "Access code must be between 4 and 64 characters.",
    );
  }
  return code;
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

export function hashAccessCode(accessCode: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(accessCode, salt, SCRYPT_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    HASH_PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

export function verifyAccessCode(
  accessCode: string,
  accessCodeHash: string | null | undefined,
): boolean {
  if (!accessCodeHash) {
    return false;
  }

  const parts = accessCodeHash.split("$");
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expectedHash = Buffer.from(parts[5], "base64");

  const actualHash = scryptSync(accessCode, salt, expectedHash.length, {
    N: n,
    r,
    p,
  });

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHash);
}

export async function listSimulators(
  query: AdminSimulatorsListQuery,
): Promise<SimulatorListResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const includeInactive = query.includeInactive ?? true;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let dbQuery = supabase
    .from("simulators")
    .select(
      "id, title, description, access_code_hash, access_code_plaintext, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (!includeInactive) {
    dbQuery = dbQuery.eq("is_active", true);
  }

  const { data, error, count } = await dbQuery;
  if (error) {
    console.error("[admin/simulators:list] query failed", { error });
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RawSimulatorRow[];
  const items = rows
    .map((row) => parseSimulatorRow(row))
    .filter((row): row is Simulator => !!row);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function createSimulator(
  input: SimulatorCreateInput,
): Promise<Simulator> {
  const title = validateTitle(input.title);
  const description = normalizeDescription(input.description);
  const durationMinutes = validateDurationMinutes(input.durationMinutes);
  const maxAttempts = validateMaxAttempts(
    input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
  );
  const accessCode = normalizeAccessCode(input.accessCode);

  const payload: Record<string, unknown> = {
    title,
    description,
    duration_minutes: durationMinutes,
    max_attempts: maxAttempts,
    is_active: input.isActive ?? false,
    status: "draft",
    created_by: input.createdBy,
  };

  if (accessCode) {
    payload.access_code_hash = hashAccessCode(accessCode);
    payload.access_code_plaintext = accessCode;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulators")
    .insert(payload)
    .select(
      "id, title, description, access_code_hash, access_code_plaintext, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
    )
    .single();

  if (error) {
    console.error("[admin/simulators:create] insert failed", {
      payload,
      error,
    });
    throw new Error(error.message);
  }

  const simulator = parseSimulatorRow(data);
  if (!simulator) {
    console.error("[admin/simulators:create] parse failed", { data });
    throw new Error("Invalid simulator payload returned from database.");
  }

  return simulator;
}

export async function updateSimulator(
  simulatorId: string,
  input: SimulatorUpdateInput,
): Promise<Simulator> {
  if (!simulatorId) {
    throw new SimulatorInputError("not_found", "Simulator was not found.");
  }

  const payload: Record<string, unknown> = {};

  if (typeof input.title === "string") {
    payload.title = validateTitle(input.title);
  }
  if ("description" in input) {
    payload.description = normalizeDescription(input.description);
  }
  if (typeof input.durationMinutes === "number") {
    payload.duration_minutes = validateDurationMinutes(input.durationMinutes);
  }
  if (typeof input.maxAttempts === "number") {
    payload.max_attempts = validateMaxAttempts(input.maxAttempts);
  }
  if (typeof input.isActive === "boolean") {
    payload.is_active = input.isActive;
  }
  if (typeof input.status === "string") {
    const status = validateStatus(input.status);
    if (status === "published") {
      throw new SimulatorInputError(
        "invalid_status_transition",
        "Publishing simulator is handled by the publish flow.",
      );
    }
    payload.status = status;
  }
  if ("accessCode" in input) {
    const accessCode = normalizeAccessCode(input.accessCode);
    payload.access_code_hash = accessCode ? hashAccessCode(accessCode) : null;
    payload.access_code_plaintext = accessCode;
  }

  if (Object.keys(payload).length === 0) {
    throw new SimulatorInputError("no_changes", "No simulator changes were provided.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("simulators")
    .update(payload)
    .eq("id", simulatorId)
    .select(
      "id, title, description, access_code_hash, access_code_plaintext, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    console.error("[admin/simulators:update] update failed", {
      simulatorId,
      payload,
      error,
    });
    throw new Error(error.message);
  }

  if (!data) {
    throw new SimulatorInputError("not_found", "Simulator was not found.");
  }

  const simulator = parseSimulatorRow(data);
  if (!simulator) {
    console.error("[admin/simulators:update] parse failed", { simulatorId, data });
    throw new Error("Invalid simulator payload returned from database.");
  }

  return simulator;
}
