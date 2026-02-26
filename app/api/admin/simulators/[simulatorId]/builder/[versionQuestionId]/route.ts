import type { AdminSimulatorBuilderReorderQuestionRequest } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  removeQuestionFromDraftVersion,
  reorderDraftVersionQuestion,
  SimulatorBuilderError,
} from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ simulatorId: string; versionQuestionId: string }> },
) {
  try {
    await requireAdmin();
    const { simulatorId, versionQuestionId } = await context.params;
    if (!simulatorId || !versionQuestionId) {
      return NextResponse.json({ error: "Invalid route params." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body) || typeof body.position !== "number") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminSimulatorBuilderReorderQuestionRequest = {
      position: body.position,
    };

    const item = await reorderDraftVersionQuestion(
      simulatorId,
      versionQuestionId,
      payload.position,
    );
    return NextResponse.json({ item });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (error.code === "simulator_not_found" || error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "version_locked") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to reorder draft question." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ simulatorId: string; versionQuestionId: string }> },
) {
  try {
    await requireAdmin();
    const { simulatorId, versionQuestionId } = await context.params;
    if (!simulatorId || !versionQuestionId) {
      return NextResponse.json({ error: "Invalid route params." }, { status: 400 });
    }

    await removeQuestionFromDraftVersion(simulatorId, versionQuestionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (error.code === "simulator_not_found" || error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "version_locked") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to remove draft question." },
      { status: 500 },
    );
  }
}
