import type { StudentVisibleSimulatorsQuery } from "@/lib/domain/contracts";
import type { Simulator } from "@/lib/domain/simulator";
import { createClient } from "@/lib/supabase/server";

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

interface StudentVisibleSimulatorsResult {
  items: Simulator[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

function parseSimulatorRow(row: RawSimulatorRow): Simulator | null {
  if (
    typeof row.id !== "string" ||
    typeof row.title !== "string" ||
    (row.description !== null && typeof row.description !== "string") ||
    (row.access_code_hash !== null && typeof row.access_code_hash !== "string") ||
    typeof row.max_attempts !== "number" ||
    typeof row.duration_minutes !== "number" ||
    typeof row.is_active !== "boolean" ||
    row.status !== "published" ||
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

export async function listVisibleSimulatorsForStudent(
  query: StudentVisibleSimulatorsQuery,
): Promise<StudentVisibleSimulatorsResult> {
  const page = parsePage(query.page);
  const pageSize = parsePageSize(query.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("simulators")
    .select(
      "id, title, description, access_code_hash, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("status", "published")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as RawSimulatorRow[])
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

