import { NextResponse } from "next/server";
import { AuthGuardError } from "./guards";

export function mapAuthGuardErrorToResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthGuardError)) {
    return null;
  }

  if (error.reason === "unauthenticated") {
    return NextResponse.json({ error: "Autenticacion requerida." }, { status: 401 });
  }

  return NextResponse.json({ error: "Prohibido." }, { status: 403 });
}
