import type { AdminQuestionOptionUpdateRequest } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  deleteQuestionOption,
  QuestionOptionInputError,
  updateQuestionOption,
} from "@/lib/usecases/question-options";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ questionId: string; optionId: string }> },
) {
  try {
    await requireAdmin();
    const { questionId, optionId } = await context.params;
    if (!questionId || !optionId) {
      return NextResponse.json({ error: "Invalid route params." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminQuestionOptionUpdateRequest = {};
    if (typeof body.text === "string") {
      payload.text = body.text;
    }
    if (typeof body.imageUrl === "string" || body.imageUrl === null) {
      payload.imageUrl = body.imageUrl;
    }
    if (typeof body.position === "number") {
      payload.position = body.position;
    }
    if (typeof body.isCorrect === "boolean") {
      payload.isCorrect = body.isCorrect;
    }
    if (typeof body.isActive === "boolean") {
      payload.isActive = body.isActive;
    }

    const option = await updateQuestionOption(questionId, optionId, payload);
    return NextResponse.json({ option });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof QuestionOptionInputError) {
      if (error.code === "question_not_found" || error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.code === "duplicate_correct_option" ||
        error.code === "duplicate_position"
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update question option." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ questionId: string; optionId: string }> },
) {
  try {
    await requireAdmin();
    const { questionId, optionId } = await context.params;
    if (!questionId || !optionId) {
      return NextResponse.json({ error: "Invalid route params." }, { status: 400 });
    }

    await deleteQuestionOption(questionId, optionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof QuestionOptionInputError) {
      if (error.code === "question_not_found" || error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to delete question option." },
      { status: 500 },
    );
  }
}

