import type {
  StudentVerifyAccessCodeRequest,
  StudentVerifyAccessCodeResponse,
} from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  extractClientIpAddress,
  StudentAccessError,
  verifySimulatorAccessCodeForStudent,
} from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ simulatorId: string }> },
) {
  try {
    const session = await requireStudent();
    const { simulatorId } = await context.params;

    if (!simulatorId) {
      return NextResponse.json({ error: "Invalid simulator id." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const payload: StudentVerifyAccessCodeRequest = {
      accessCode: typeof body.accessCode === "string" ? body.accessCode : undefined,
    };

    await verifySimulatorAccessCodeForStudent({
      simulatorId,
      studentId: session.userId,
      ipAddress: extractClientIpAddress(request.headers),
      accessCode: payload.accessCode,
    });

    const response: StudentVerifyAccessCodeResponse = { ok: true };
    return NextResponse.json(response);
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof StudentAccessError) {
      if (error.code === "simulator_not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.code === "access_code_rate_limited") {
        const headers =
          typeof error.retryAfterSeconds === "number"
            ? { "Retry-After": String(error.retryAfterSeconds) }
            : undefined;
        return NextResponse.json({ error: error.message }, { status: 429, headers });
      }
      if (error.code === "invalid_access_code") {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to verify access code." },
      { status: 500 },
    );
  }
}

