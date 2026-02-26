import type { AdminSimulatorPublishValidationResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import {
  SimulatorBuilderError,
  validateDraftVersionBeforePublish,
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
      return NextResponse.json({ error: "Invalid simulator id." }, { status: 400 });
    }

    const validation = await validateDraftVersionBeforePublish(simulatorId);
    const response: AdminSimulatorPublishValidationResponse = { validation };
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorBuilderError) {
      if (error.code === "simulator_not_found" || error.code === "draft_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to validate draft version for publish." },
      { status: 500 },
    );
  }
}
