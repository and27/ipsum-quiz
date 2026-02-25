import type { AdminQuestionUpdateRequest } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { QuestionInputError, updateQuestion } from "@/lib/usecases/questions";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    await requireAdmin();

    const { questionId } = await context.params;
    if (!questionId) {
      return NextResponse.json({ error: "Invalid question id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminQuestionUpdateRequest = {};
    if (typeof body.topicId === "string") {
      payload.topicId = body.topicId;
    }
    if (typeof body.statement === "string") {
      payload.statement = body.statement;
    }
    if (typeof body.imageUrl === "string" || body.imageUrl === null) {
      payload.imageUrl = body.imageUrl;
    }
    if (typeof body.isActive === "boolean") {
      payload.isActive = body.isActive;
    }

    const question = await updateQuestion(questionId, payload);
    return NextResponse.json({ question });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof QuestionInputError) {
      if (
        error.code === "invalid_topic_id" ||
        error.code === "invalid_statement" ||
        error.code === "no_changes"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === "not_found" || error.code === "topic_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update question." },
      { status: 500 },
    );
  }
}

