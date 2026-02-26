import type { AdminTopicUpdateRequest } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { TopicInputError, updateTopic } from "@/lib/usecases/topics";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ topicId: string }> },
) {
  try {
    await requireAdmin();

    const { topicId } = await context.params;
    if (!topicId) {
      return NextResponse.json({ error: "ID de tema invalido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;

    if (!isObject(body)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const payload: AdminTopicUpdateRequest = {};
    if (typeof body.name === "string") {
      payload.name = body.name;
    }
    if (typeof body.isActive === "boolean") {
      payload.isActive = body.isActive;
    }

    if (typeof payload.name === "undefined" && typeof payload.isActive === "undefined") {
      return NextResponse.json({ error: "No se proporcionaron cambios." }, { status: 400 });
    }

    const topic = await updateTopic(topicId, payload);
    return NextResponse.json({ topic });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof TopicInputError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "duplicate_active_name") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.code === "invalid_name" || error.code === "no_changes") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "No se pudo actualizar el tema." }, { status: 500 });
  }
}

