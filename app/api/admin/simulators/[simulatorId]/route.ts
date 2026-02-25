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
  try {
    await requireAdmin();

    const { simulatorId } = await context.params;
    if (!simulatorId) {
      return NextResponse.json({ error: "Invalid simulator id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: AdminSimulatorUpdateRequest = {};
    if (typeof body.title === "string") {
      payload.title = body.title;
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

    return NextResponse.json(
      { error: "Failed to update simulator." },
      { status: 500 },
    );
  }
}

