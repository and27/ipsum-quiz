import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { getAdminDashboardStats } from "@/lib/usecases/reports";
import { NextRequest, NextResponse } from "next/server";

function parseCampus(value: string | null): "canar" | "azogues" | undefined {
  if (value === "canar" || value === "azogues") {
    return value;
  }
  return undefined;
}

function escapeCsvValue(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const simulatorId = request.nextUrl.searchParams.get("simulatorId") || undefined;
    const topicId = request.nextUrl.searchParams.get("topicId") || undefined;
    const campus = parseCampus(request.nextUrl.searchParams.get("campus"));
    const dateFrom = request.nextUrl.searchParams.get("dateFrom") || undefined;
    const dateTo = request.nextUrl.searchParams.get("dateTo") || undefined;

    const dashboard = await getAdminDashboardStats({
      simulatorId,
      topicId,
      campus,
      dateFrom,
      dateTo,
    });

    const header = [
      "Estudiante",
      "Intentos",
      "Finalizados",
      "Expirados",
      "Promedio",
      "Blancos",
      "Ultimo intento",
    ];

    const rows = dashboard.studentRows.map((row) => [
      row.studentName,
      row.attempts,
      row.finished,
      row.expired,
      `${row.averageScorePercent}%`,
      row.blankAnswersTotal,
      row.latestAttemptAt ? new Date(row.latestAttemptAt).toLocaleString() : "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="admin-students-report.csv"',
      },
    });
  } catch (error) {
    const authResponse = mapAuthGuardErrorToResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: "No se pudo exportar el reporte de estudiantes." },
      { status: 500 },
    );
  }
}
