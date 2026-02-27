import type { AdminSimulatorUpdateRequest } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { SimulatorInputError, updateSimulator } from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  let simulatorIdForLog = "";
  let payloadForLog: AdminSimulatorUpdateRequest = {};
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

    const payload: AdminSimulatorUpdateRequest = {};
    if (typeof body.title === "string") {
      payload.title = body.title;
    }
    if (body.campus === "canar" || body.campus === "azogues") {
      payload.campus = body.campus;
    }
    if (typeof body.description === "string" || body.description === null) {
      payload.description = body.description;
    }
    if (typeof body.maxAttempts === "number") {
      payload.maxAttempts = body.maxAttempts;
    }
    if (typeof body.durationMinutes === "number") {
      payload.durationMinutes = body.durationMinutes;
    }
    if (typeof body.isActive === "boolean") {
      payload.isActive = body.isActive;
    }
    if (body.status === "draft" || body.status === "published") {
      payload.status = body.status;
    }
    if (typeof body.accessCode === "string" || body.accessCode === null) {
      payload.accessCode = body.accessCode;
    }
    payloadForLog = payload;

    const simulator = await updateSimulator(simulatorId, payload);
    return NextResponse.json({ simulator });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorInputError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.code === "invalid_status_transition") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[api/admin/simulators/:id PATCH] unexpected error", {
      simulatorId: simulatorIdForLog,
      payload: payloadForLog,
      error,
    });
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el simulador.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


