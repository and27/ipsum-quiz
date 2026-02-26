import type { StartAttemptResponse } from "@/lib/domain/contracts";
import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import {
  startOrResumeAttemptForStudent,
  StudentAccessError,
  StudentAttemptError,
} from "@/lib/usecases/attempts";
import { extractClientIpAddress } from "@/lib/usecases/simulators";
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
      return NextResponse.json({ error: "ID de simulador invalido." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const accessCode =
      typeof body.accessCode === "string" ? body.accessCode : undefined;

    const result = await startOrResumeAttemptForStudent({
      simulatorId,
      studentId: session.userId,
      ipAddress: extractClientIpAddress(request.headers),
      accessCode,
    });

    const response: StartAttemptResponse = result;
    return NextResponse.json(response, { status: 201 });
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

    if (error instanceof StudentAttemptError) {
      if (error.code === "simulator_not_available") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.code === "max_attempts_reached") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.code === "version_has_no_questions") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "No se pudo iniciar el intento." }, { status: 500 });
  }
}

