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

function normalizeGradeScore(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return "invalid";
  }

  const rounded = Math.round(parsed * 100) / 100;
  if (rounded < 0 || rounded > 10) {
    return "invalid";
  }

  return rounded;
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireStudent();
    const body = (await request.json().catch(() => null)) as
      | { fullName?: unknown; gradeScore?: unknown }
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

    const gradeScore = normalizeGradeScore(body?.gradeScore);
    if (gradeScore === "invalid") {
      return NextResponse.json(
        { error: "La nota de grado debe estar entre 0 y 10." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, grade_score: gradeScore })
      .eq("id", session.userId)
      .select("id, full_name, grade_score")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      fullName: data.full_name,
      gradeScore:
        typeof data.grade_score === "number"
          ? data.grade_score
          : typeof data.grade_score === "string"
            ? Number(data.grade_score)
            : null,
    });
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
