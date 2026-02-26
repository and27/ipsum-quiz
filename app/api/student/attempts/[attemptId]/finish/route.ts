import type { FinishAttemptResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  finishAttemptForStudent,
  StudentAttemptError,
} from "@/lib/usecases/attempts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const session = await requireStudent();
    const { attemptId } = await context.params;
    if (!attemptId) {
      return NextResponse.json({ error: "Invalid attempt id." }, { status: 400 });
    }

    const result = await finishAttemptForStudent({
      attemptId,
      studentId: session.userId,
    });
    const response: FinishAttemptResponse = result;
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof StudentAttemptError) {
      if (error.code === "attempt_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.code === "attempt_not_active" ||
        error.code === "attempt_already_closed" ||
        error.code === "attempt_expired"
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to finish attempt." },
      { status: 500 },
    );
  }
}

