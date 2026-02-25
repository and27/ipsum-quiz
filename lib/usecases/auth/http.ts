import { NextResponse } from "next/server";
import { AuthGuardError } from "./guards";

export function mapAuthGuardErrorToResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthGuardError)) {
    return null;
  }

  if (error.reason === "unauthenticated") {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

