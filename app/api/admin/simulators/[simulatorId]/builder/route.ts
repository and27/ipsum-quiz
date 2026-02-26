import type {
  AdminSimulatorBuilderAddQuestionRequest,
  AdminSimulatorBuilderStateResponse,
} from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  addQuestionToDraftVersion,
  getSimulatorBuilderState,
  SimulatorBuilderError,
} from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  try {
    await requireAdmin();
    const { simulatorId } = await context.params;
    if (!simulatorId) {
      return NextResponse.json({ error: "Invalid simulator id." }, { status: 400 });
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
      { error: "Failed to load simulator builder state." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  try {
    await requireAdmin();
    const { simulatorId } = await context.params;
    if (!simulatorId) {
      return NextResponse.json({ error: "Invalid simulator id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body) || typeof body.sourceQuestionId !== "string") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminSimulatorBuilderAddQuestionRequest = {
      sourceQuestionId: body.sourceQuestionId,
      position: typeof body.position === "number" ? body.position : undefined,
    };

    const item = await addQuestionToDraftVersion(
      simulatorId,
      payload.sourceQuestionId,
      payload.position,
    );
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (error.code === "simulator_not_found" || error.code === "question_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "duplicate_question") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to add question to draft version." },
      { status: 500 },
    );
  }
}

