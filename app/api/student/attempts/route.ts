import type { StudentAttemptHistoryResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  listAttemptHistoryForStudent,
} from "@/lib/usecases/attempts";
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
    const session = await requireStudent();
    const response: StudentAttemptHistoryResponse = await listAttemptHistoryForStudent({
      studentId: session.userId,
      page: parseNumber(request.nextUrl.searchParams.get("page")),
      pageSize: parseNumber(request.nextUrl.searchParams.get("pageSize")),
    });

    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }
    return NextResponse.json(
      { error: "Failed to load attempt history." },
      { status: 500 },
    );
  }
}

