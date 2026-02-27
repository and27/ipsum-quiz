import type {
  AdminSimulatorCreateRequest,
  AdminSimulatorsListQuery,
} from "@/lib/domain/contracts";
import {
  mapAuthGuardErrorToResponse,
  requireAdmin,
  requireAuthenticatedUser,
} from "@/lib/usecases/auth";
import {
  createSimulator,
  listSimulators,
  SimulatorInputError,
} from "@/lib/usecases/simulators";
import { NextRequest, NextResponse } from "next/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const query: AdminSimulatorsListQuery = {
      page: parseNumber(request.nextUrl.searchParams.get("page")),
      pageSize: parseNumber(request.nextUrl.searchParams.get("pageSize")),
      includeInactive: request.nextUrl.searchParams.get("includeInactive") !== "false",
    };

    const result = await listSimulators(query);
    return NextResponse.json({
      items: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: "No se pudieron listar los simuladores." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthenticatedUser();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Prohibido." }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const payload: AdminSimulatorCreateRequest = {
      title: typeof body.title === "string" ? body.title : "",
      campus: body.campus === "canar" || body.campus === "azogues" ? body.campus : undefined,
      description:
        typeof body.description === "string" || body.description === null
          ? body.description
          : undefined,
      maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : undefined,
      durationMinutes:
        typeof body.durationMinutes === "number" ? body.durationMinutes : NaN,
      isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
      accessCode:
        typeof body.accessCode === "string" || body.accessCode === null
          ? body.accessCode
          : undefined,
    };

    const simulator = await createSimulator({
      ...payload,
      createdBy: session.userId,
    });
    return NextResponse.json({ simulator }, { status: 201 });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    if (error instanceof SimulatorInputError) {
      if (error.code === "not_found") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "No se pudo crear el simulador." },
      { status: 500 },
    );
  }
}


