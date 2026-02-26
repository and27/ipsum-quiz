import { createAdminClient } from "@/lib/supabase/admin";
import { expireDueAttempts } from "@/lib/usecases/attempts";
import { NextRequest, NextResponse } from "next/server";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return false;
  }
  const provided = header.slice("Bearer ".length).trim();
  return provided === secret;
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(1, Math.min(1000, Math.trunc(value)));
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const adminClient = createAdminClient();
  const result = await expireDueAttempts({ supabase: adminClient, limit });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await handle(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la expiracion de intentos." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo ejecutar la expiracion de intentos." },
      { status: 500 },
    );
  }
}


