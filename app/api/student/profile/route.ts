import { mapAuthGuardErrorToResponse, requireStudent } from "@/lib/usecases/auth";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function normalizeFullName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }
  return normalized;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireStudent();
    const body = (await request.json().catch(() => null)) as
      | { fullName?: unknown }
      | null;

    const fullName = normalizeFullName(body?.fullName);
    if (!fullName) {
      return NextResponse.json(
        { error: "El nombre es obligatorio." },
        { status: 400 },
      );
    }
    if (fullName.length > 200) {
      return NextResponse.json(
        { error: "El nombre debe tener 200 caracteres o menos." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", session.userId)
      .select("id, full_name")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, fullName: data.full_name });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }
    return NextResponse.json(
      { error: "No se pudo actualizar el perfil." },
      { status: 500 },
    );
  }
}
