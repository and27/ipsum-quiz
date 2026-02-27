import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { getAdminStudentDetail } from "@/lib/usecases/reports";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function parseCampus(value: string | undefined): "canar" | "azogues" | undefined {
  if (value === "canar" || value === "azogues") {
    return value;
  }
  return undefined;
}

async function AdminStudentStatsDetailContent({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const { studentId } = await params;
  if (!studentId) {
    redirect("/protected/admin/stats");
  }

  const query = await searchParams;
  const simulatorId = typeof query.simulatorId === "string" ? query.simulatorId : undefined;
  const topicId = typeof query.topicId === "string" ? query.topicId : undefined;
  const campus = parseCampus(typeof query.campus === "string" ? query.campus : undefined);
  const dateFrom = typeof query.dateFrom === "string" ? query.dateFrom : undefined;
  const dateTo = typeof query.dateTo === "string" ? query.dateTo : undefined;

  const detail = await getAdminStudentDetail(studentId, {
    simulatorId,
    topicId,
    campus,
    dateFrom,
    dateTo,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estudiante - {detail.studentName}</h1>
          <p className="text-sm text-muted-foreground">{detail.studentId}</p>
        </div>
        <Link href="/protected/admin/stats" className="text-sm underline">
          Volver a estadisticas
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Intentos</p>
          <p className="mt-2 text-2xl font-bold">{detail.attemptsTotal}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Promedio</p>
          <p className="mt-2 text-2xl font-bold">{detail.averageScorePercent}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Blancos</p>
          <p className="mt-2 text-2xl font-bold">{detail.blankAnswersTotal}</p>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Desglose por tema (acumulado)</h2>
        </div>
        <div className="space-y-2 p-4">
          {detail.topicSummary.map((topic) => (
            <p key={topic.topicId} className="text-sm text-muted-foreground">
              {topic.topicName}: {topic.correctCount}/{topic.totalCount} (en blanco: {topic.blankCount})
            </p>
          ))}
          {detail.topicSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay desglose disponible.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Intentos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Simulador</th>
                <th className="px-4 py-2">Sede</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Puntaje</th>
                <th className="px-4 py-2">Blancos</th>
              </tr>
            </thead>
            <tbody>
              {detail.attempts.map((attempt) => (
                <tr key={attempt.attemptId} className="border-t">
                  <td className="px-4 py-2">{new Date(attempt.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{attempt.simulatorTitle}</td>
                  <td className="px-4 py-2">{attempt.campus === "canar" ? "Cañar" : "Azogues"}</td>
                  <td className="px-4 py-2">{attempt.status}</td>
                  <td className="px-4 py-2">
                    {attempt.scoreTotal}/{attempt.questionsTotal}
                  </td>
                  <td className="px-4 py-2">{attempt.blankCount}</td>
                </tr>
              ))}
              {detail.attempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No hay intentos para este estudiante con los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudentStatsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <AdminStudentStatsDetailContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
