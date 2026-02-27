import type {
  AdminSimulatorBuilderAddQuestionRequest,
  AdminSimulatorBuilderStateResponse,
} from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  addQuestionsToDraftVersion,
  addQuestionToDraftVersion,
  getSimulatorBuilderState,
  SimulatorBuilderError,
} from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSourceQuestionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  try {
    await requireAdmin();
    const { simulatorId } = await context.params;
    if (!simulatorId) {
      return NextResponse.json({ error: "ID de simulador invalido." }, { status: 400 });
    }

    const state = await getSimulatorBuilderState(simulatorId);
    const response: AdminSimulatorBuilderStateResponse = state;
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (error.code === "simulator_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo cargar el estado del constructor del simulador." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  let simulatorIdForLog = "";
  let payloadForLog: AdminSimulatorBuilderAddQuestionRequest | null = null;
  try {
    await requireAdmin();
    const { simulatorId } = await context.params;
    simulatorIdForLog = simulatorId;
    if (!simulatorId) {
      return NextResponse.json({ error: "ID de simulador invalido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const sourceQuestionIds = parseSourceQuestionIds(body.sourceQuestionIds);
    const sourceQuestionId =
      typeof body.sourceQuestionId === "string" ? body.sourceQuestionId : "";

    if (!sourceQuestionId && sourceQuestionIds.length === 0) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const payload: AdminSimulatorBuilderAddQuestionRequest = {
      sourceQuestionId,
      sourceQuestionIds: sourceQuestionIds.length > 0 ? sourceQuestionIds : undefined,
      position: typeof body.position === "number" ? body.position : undefined,
    };
    payloadForLog = payload;

    if (sourceQuestionIds.length > 0) {
      const items = await addQuestionsToDraftVersion(
        simulatorId,
        sourceQuestionIds,
        payload.position,
      );
      return NextResponse.json(
        {
          items,
          addedCount: items.length,
        },
        { status: 201 },
      );
    }

    const item = await addQuestionToDraftVersion(simulatorId, sourceQuestionId, payload.position);
    return NextResponse.json({ item, items: [item], addedCount: 1 }, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (error.code === "simulator_not_found" || error.code === "question_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "version_locked") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.code === "duplicate_question") {
        return NextResponse.json(
          { error: "La pregunta ya esta agregada en esta version borrador." },
          { status: 409 },
        );
      }
      if (error.code === "question_already_consumed") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[admin/builder:POST] add question failed", {
      simulatorId: simulatorIdForLog,
      payload: payloadForLog,
      error,
    });

    const message =
      error instanceof Error
        ? error.message
        : "No se pudo agregar la pregunta a la version borrador.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

