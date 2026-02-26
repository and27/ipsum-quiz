import type {
  AdminQuestionCreateRequest,
  AdminQuestionsListQuery,
} from "@/lib/domain/contracts";
import {
  mapAuthGuardErrorToResponse,
  requireAdmin,
  requireAuthenticatedUser,
} from "@/lib/usecases/auth";
import {
  createQuestion,
  listQuestions,
  QuestionInputError,
} from "@/lib/usecases/questions";
import {
  createQuestionOption,
  QuestionOptionInputError,
} from "@/lib/usecases/question-options";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const query: AdminQuestionsListQuery = {
      page: parseNumber(request.nextUrl.searchParams.get("page")),
      pageSize: parseNumber(request.nextUrl.searchParams.get("pageSize")),
      includeInactive: request.nextUrl.searchParams.get("includeInactive") !== "false",
    };

    const result = await listQuestions(query);
    return NextResponse.json({
      items: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: "No se pudieron listar las preguntas." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedUser();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Prohibido." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const payload: AdminQuestionCreateRequest = {
      topicId: typeof body.topicId === "string" ? body.topicId : "",
      statement: typeof body.statement === "string" ? body.statement : "",
      imageUrl:
        typeof body.imageUrl === "string" || body.imageUrl === null
          ? body.imageUrl
          : undefined,
      options: Array.isArray(body.options)
        ? body.options
            .filter((option): option is Record<string, unknown> => isObject(option))
            .map((option) => ({
              text: typeof option.text === "string" ? option.text : "",
              isCorrect:
                typeof option.isCorrect === "boolean" ? option.isCorrect : undefined,
              isActive:
                typeof option.isActive === "boolean" ? option.isActive : undefined,
            }))
        : undefined,
    };

    if (payload.options && payload.options.length > 0) {
      if (payload.options.length < 2) {
        return NextResponse.json(
          { error: "Debes crear al menos 2 opciones." },
          { status: 400 },
        );
      }

      const correctCount = payload.options.filter(
        (option) => option.isCorrect === true,
      ).length;

      if (correctCount !== 1) {
        return NextResponse.json(
          { error: "Debes marcar exactamente 1 opcion correcta." },
          { status: 400 },
        );
      }
    }

    const question = await createQuestion({
      ...payload,
      createdBy: session.userId,
    });

    if (payload.options && payload.options.length > 0) {
      try {
        for (const [index, option] of payload.options.entries()) {
          await createQuestionOption(question.id, {
            text: option.text,
            isCorrect: option.isCorrect,
            isActive: option.isActive,
            position: index + 1,
          });
        }
      } catch (error) {
        const supabase = await createClient();
        await supabase.from("questions").delete().eq("id", question.id);

        if (error instanceof QuestionOptionInputError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        throw error;
      }
    }

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof QuestionInputError) {
      if (
        error.code === "invalid_topic_id" ||
        error.code === "invalid_statement"
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.code === "topic_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    if (error instanceof QuestionOptionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo crear la pregunta." },
      { status: 500 },
    );
  }
}


