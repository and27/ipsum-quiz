import type {
  StudentVisibleSimulator,
  StudentVisibleSimulatorsQuery,
} from "@/lib/domain/contracts";
import { createClient } from "@/lib/supabase/server";

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

interface StudentVisibleSimulatorsResult {
  items: StudentVisibleSimulator[];
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

function parseCampus(value: unknown): "canar" | "azogues" {
  return value === "azogues" ? "azogues" : "canar";
}

function parseSimulatorRow(row: RawSimulatorRow): StudentVisibleSimulator | null {
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
    campus: parseCampus(row.campus),
    description: row.description,
    maxAttempts: row.max_attempts,
    durationMinutes: row.duration_minutes,
    hasAccessCode: !!row.access_code_hash,
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
  let dbQuery = supabase
    .from("simulators")
    .select(
      "id, title, campus, description, access_code_hash, max_attempts, duration_minutes, is_active, status, published_version_id, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("status", "published")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (query.campus === "canar" || query.campus === "azogues") {
    dbQuery = dbQuery.eq("campus", query.campus);
  }

  const { data, error, count } = await dbQuery;

  if (error) {
    throw new Error(error.message);
  }

  const items = ((data ?? []) as RawSimulatorRow[])
    .map((row) => parseSimulatorRow(row))
    .filter((row): row is StudentVisibleSimulator => !!row);
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
