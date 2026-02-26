import type { StudentAttemptResultResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  getAttemptResultForStudent,
  StudentAttemptError,
} from "@/lib/usecases/attempts";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const session = await requireStudent();
    const { attemptId } = await context.params;
    if (!attemptId) {
      return NextResponse.json({ error: "ID de intento invalido." }, { status: 400 });
    }

    const response: StudentAttemptResultResponse = await getAttemptResultForStudent({
      studentId: session.userId,
      attemptId,
    });

    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }
    if (error instanceof StudentAttemptError && error.code === "attempt_not_found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "No se pudo cargar el resultado del intento." },
      { status: 500 },
    );
  }
}


