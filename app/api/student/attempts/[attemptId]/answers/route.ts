import type {
  SaveAttemptAnswerRequest,
  SaveAttemptAnswerResponse,
} from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  saveAttemptAnswerForStudent,
  StudentAttemptError,
} from "@/lib/usecases/attempts";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ attemptId: string }> },
) {
  try {
    const session = await requireStudent();
    const { attemptId } = await context.params;
    if (!attemptId) {
      return NextResponse.json({ error: "ID de intento invalido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body) || typeof body.simulatorVersionQuestionId !== "string") {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const selectedOptionId =
      body.selectedOptionId === null
        ? null
        : typeof body.selectedOptionId === "string"
          ? body.selectedOptionId
          : undefined;

    if (typeof selectedOptionId === "undefined") {
      return NextResponse.json(
        { error: "selectedOptionId debe ser string o null." },
        { status: 400 },
      );
    }

    const payload: SaveAttemptAnswerRequest = {
      attemptId,
      simulatorVersionQuestionId: body.simulatorVersionQuestionId,
      selectedOptionId,
    };

    const result = await saveAttemptAnswerForStudent({
      attemptId: payload.attemptId,
      studentId: session.userId,
      simulatorVersionQuestionId: payload.simulatorVersionQuestionId,
      selectedOptionId: payload.selectedOptionId,
    });
    const response: SaveAttemptAnswerResponse = result;
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof StudentAttemptError) {
      if (error.code === "attempt_not_found" || error.code === "answer_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "attempt_not_active") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.code === "option_not_found") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo guardar la respuesta del intento." },
      { status: 500 },
    );
  }
}


