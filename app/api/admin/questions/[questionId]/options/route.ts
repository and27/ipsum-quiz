import type {
  AdminQuestionOptionCreateRequest,
  AdminQuestionOptionsListResponse,
} from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  createQuestionOption,
  listQuestionOptionsWithState,
  QuestionOptionInputError,
} from "@/lib/usecases/question-options";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ questionId: string }> },
) {
  try {
    await requireAdmin();
    const { questionId } = await context.params;
    if (!questionId) {
      return NextResponse.json({ error: "Invalid question id." }, { status: 400 });
    }

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") !== "false";
    const data = await listQuestionOptionsWithState(questionId, includeInactive);
    const response: AdminQuestionOptionsListResponse = {
      items: data.items,
      integrity: data.integrity,
      questionIsActive: data.questionIsActive,
    };
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof QuestionOptionInputError) {
      if (error.code === "question_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to list question options." },
      { status: 500 },
    );
  }
}

export async function POST(
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
    if (!isObject(body) || typeof body.text !== "string") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminQuestionOptionCreateRequest = {
      text: body.text,
      imageUrl:
        typeof body.imageUrl === "string" || body.imageUrl === null
          ? body.imageUrl
          : undefined,
      position: typeof body.position === "number" ? body.position : undefined,
      isCorrect:
        typeof body.isCorrect === "boolean" ? body.isCorrect : undefined,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    };

    const option = await createQuestionOption(questionId, payload);
    return NextResponse.json({ option }, { status: 201 });
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
        error.code === "invalid_correct_state" ||
        error.code === "duplicate_correct_option" ||
        error.code === "duplicate_position"
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create question option." },
      { status: 500 },
    );
  }
}
