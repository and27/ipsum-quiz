import type { StudentActiveAttemptResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  getActiveAttemptForStudent,
  StudentAttemptError,
} from "@/lib/usecases/attempts";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  try {
    const session = await requireStudent();
    const { simulatorId } = await context.params;
    if (!simulatorId) {
      return NextResponse.json({ error: "ID de simulador invalido." }, { status: 400 });
    }

    const attempt = await getActiveAttemptForStudent({
      simulatorId,
      studentId: session.userId,
    });

    const response: StudentActiveAttemptResponse = attempt;
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof StudentAttemptError) {
      if (error.code === "active_attempt_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el intento activo." },
      { status: 500 },
    );
  }
}


