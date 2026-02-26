import type {
  StudentVisibleSimulatorsQuery,
  StudentVisibleSimulatorsResponse,
} from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import { listVisibleSimulatorsForStudent } from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function parseNumber(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireStudent();

    const query: StudentVisibleSimulatorsQuery = {
      page: parseNumber(request.nextUrl.searchParams.get("page")),
      pageSize: parseNumber(request.nextUrl.searchParams.get("pageSize")),
    };

    const result = await listVisibleSimulatorsForStudent(query);
    const response: StudentVisibleSimulatorsResponse = {
      items: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: "Failed to list visible simulators." },
      { status: 500 },
    );
  }
}

