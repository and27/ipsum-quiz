import type { AdminSimulatorDuplicateVersionResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  duplicatePublishedVersionToDraft,
  SimulatorBuilderError,
} from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  try {
    await requireAdmin();
    const { simulatorId } = await context.params;
    if (!simulatorId) {
      return NextResponse.json({ error: "ID de simulador invalido." }, { status: 400 });
    }

    const result = await duplicatePublishedVersionToDraft(simulatorId);
    const response: AdminSimulatorDuplicateVersionResponse = result;
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (
        error.code === "simulator_not_found" ||
        error.code === "published_version_not_found"
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "draft_already_exists") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo duplicar la version publicada." },
      { status: 500 },
    );
  }
}


