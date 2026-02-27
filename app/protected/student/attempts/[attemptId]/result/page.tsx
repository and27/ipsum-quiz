import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import { getAttemptResultForStudent, StudentAttemptError } from "@/lib/usecases/attempts";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function StudentAttemptResultContent({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  try {
    const session = await requireStudent();
    const { attemptId } = await params;
    if (!attemptId) {
      redirect("/protected/student/attempts");
    }

    const result = await getAttemptResultForStudent({
      studentId: session.userId,
      attemptId,
    });
    const scoreTotal = result.attempt.scoreTotal ?? 0;
    const blankCount = result.attempt.blankCount ?? 0;
    const incorrectCount = Math.max(
      result.attempt.questionsTotal - scoreTotal - blankCount,
      0,
    );
    const percent =
      result.attempt.questionsTotal > 0
        ? Math.round((scoreTotal / result.attempt.questionsTotal) * 100)
        : 0;

    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Detalle de resultado</h1>
            <p className="text-sm text-muted-foreground">Intento {result.attempt.id}</p>
          </div>
          <Link className="text-sm underline" href="/protected/student/attempts">
            Volver al historial
          </Link>
        </div>

        <div className="rounded-lg border p-4">
          <p className="text-sm">
            Estado: <strong>{result.attempt.status}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Puntaje: {scoreTotal}/{result.attempt.questionsTotal} ({percent}%)
          </p>
          <p className="text-sm text-muted-foreground">
            Correctas: {scoreTotal} | Incorrectas: {incorrectCount} | En blanco: {blankCount}
          </p>
          <p className="text-xs text-muted-foreground">
            Inicio: {new Date(result.attempt.startedAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Cierre:{" "}
            {result.attempt.finishedAt
              ? new Date(result.attempt.finishedAt).toLocaleString()
              : "-"}
          </p>
        </div>

        <div className="rounded-lg border p-4">
          <h2 className="text-base font-semibold">Desglose por tema</h2>
          <div className="mt-3 space-y-2">
            {result.attempt.topicScores.map((topic) => (
              <p key={topic.topicId} className="text-sm text-muted-foreground">
                {topic.topicName}: {topic.correctCount}/{topic.totalCount}
              </p>
            ))}
            {result.attempt.topicScores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin desglose disponible.</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.reason === "unauthenticated") {
        redirect("/auth/login");
      }
      redirect("/protected");
    }
    if (error instanceof StudentAttemptError && error.code === "attempt_not_found") {
      redirect("/protected/student/attempts");
    }
    throw error;
  }
}

export default function StudentAttemptResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <StudentAttemptResultContent params={params} />
    </Suspense>
  );
}
