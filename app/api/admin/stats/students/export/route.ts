import { mapAuthGuardErrorToResponse, requireAdmin } from "@/lib/usecases/auth";
import { getAdminStudentExportData } from "@/lib/usecases/reports";
import { NextRequest, NextResponse } from "next/server";

function parseCampus(value: string | null): "canar" | "azogues" | undefined {
  if (value === "canar" || value === "azogues") {
    return value;
  }
  return undefined;
}

function parseGradeSort(value: string | null): "desc" | "asc" | undefined {
  if (value === "desc" || value === "asc") {
    return value;
  }
  return undefined;
}

function escapeCsvValue(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  const stringValue = String(value);
  if (/[";\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

function formatExcelRatioText(value: string): string {
  // Force Excel to keep ratios like 8/9 as text instead of dates.
  return `="${value}"`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const simulatorId = request.nextUrl.searchParams.get("simulatorId") || undefined;
    const topicId = request.nextUrl.searchParams.get("topicId") || undefined;
    const campus = parseCampus(request.nextUrl.searchParams.get("campus"));
    const dateFrom = request.nextUrl.searchParams.get("dateFrom") || undefined;
    const dateTo = request.nextUrl.searchParams.get("dateTo") || undefined;
    const gradeSort = parseGradeSort(request.nextUrl.searchParams.get("gradeSort"));

    const exportData = await getAdminStudentExportData({
      simulatorId,
      topicId,
      campus,
      dateFrom,
      dateTo,
    });

    const sortedRows = [...exportData.rows].sort((left, right) => {
      if (!gradeSort) {
        return 0;
      }
      if (left.gradeScore === null && right.gradeScore === null) {
        return 0;
      }
      if (left.gradeScore === null) {
        return 1;
      }
      if (right.gradeScore === null) {
        return -1;
      }
      return gradeSort === "asc"
        ? left.gradeScore - right.gradeScore
        : right.gradeScore - left.gradeScore;
    });

    const header = [
      "Estudiante",
      "Nota de grado",
      "Nota examen",
      "Nota postulacion",
      "Intentos",
      "Finalizados",
      "Expirados",
      "Nota",
      "Aciertos",
      "Total preguntas",
      "Tiempo promedio (min)",
      "Blancos",
      "Ultimo intento",
      ...exportData.topicColumns.map((topic) => `Aciertos ${topic.topicName}`),
    ];

    const rows = sortedRows.map((row) => [
      row.studentName,
      row.gradeScore ?? "",
      row.latestExamScore ?? "",
      row.latestPostulationScore ?? "",
      row.attempts,
      row.finished,
      row.expired,
      `${row.averageScorePercent}%`,
      row.totalCorrectAnswers,
      row.totalQuestions,
      row.averageElapsedMinutes,
      row.blankAnswersTotal,
      row.latestAttemptAt ? new Date(row.latestAttemptAt).toLocaleString() : "",
      ...exportData.topicColumns.map((topic) => {
        const breakdown = row.topicBreakdown[topic.topicId];
        const ratio = breakdown
          ? `${breakdown.correctCount}/${breakdown.totalCount}`
          : "0/0";
        return formatExcelRatioText(ratio);
      }),
    ]);

    const csvBody = [header, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(";"))
      .join("\r\n");
    const csv = `\uFEFFsep=;\r\n${csvBody}`;

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
