import { AttemptQuestionDetails } from "@/components/admin/attempt-question-details";
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

      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Intentos</h2>
        </div>
        <div className="space-y-4">
          {detail.attempts.map((attempt) => (
            <div key={attempt.attemptId} className="rounded-lg border p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Simulador</p>
                  <p className="text-sm font-medium">{attempt.simulatorTitle}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Inicio</p>
                  <p className="text-sm font-medium">{new Date(attempt.startedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cierre</p>
                  <p className="text-sm font-medium">
                    {attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sede</p>
                  <p className="text-sm font-medium">{attempt.campus === "canar" ? "Cañar" : "Azogues"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                  <p className="text-sm font-medium">{attempt.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Tiempo</p>
                  <p className="text-sm font-medium">{attempt.elapsedMinutes} min</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Puntaje</p>
                  <p className="text-sm font-medium">
                    {attempt.scoreTotal}/{attempt.questionsTotal}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Blancos</p>
                  <p className="text-sm font-medium">{attempt.blankCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Intento ID</p>
                  <p className="text-xs text-muted-foreground">{attempt.attemptId}</p>
                </div>
              </div>

              <AttemptQuestionDetails questionCount={attempt.questionResults.length}>
                  {attempt.questionResults.map((question) => (
                    <div key={question.simulatorVersionQuestionId} className="rounded-md border p-3">
                      <p className="text-xs text-muted-foreground">
                        Pregunta {question.position} | Tema: {question.topicName}
                      </p>
                      <p className="mt-1 text-sm font-medium">{question.statement}</p>
                      <p className="mt-2 text-sm">
                        Respuesta elegida:{" "}
                        <span className="font-medium">
                          {question.selectedOptionText ?? "Sin responder"}
                        </span>
                      </p>
                      <p className="text-sm">
                        Correcta:{" "}
                        <span className="font-medium">
                          {question.correctOptionText ?? "No disponible"}
                        </span>
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          question.isCorrect
                            ? "text-green-600"
                            : question.isBlank
                              ? "text-amber-600"
                              : "text-red-500"
                        }`}
                      >
                        {question.isCorrect
                          ? "Correcta"
                          : question.isBlank
                            ? "En blanco"
                            : "Incorrecta"}
                      </p>
                    </div>
                  ))}
                  {attempt.questionResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay detalle de preguntas para este intento.
                    </p>
                  ) : null}
              </AttemptQuestionDetails>
            </div>
          ))}
          {detail.attempts.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">
              No hay intentos para este estudiante con los filtros seleccionados.
            </div>
          ) : null}
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
