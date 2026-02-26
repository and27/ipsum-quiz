import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import { listAttemptHistoryForStudent } from "@/lib/usecases/attempts";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function StudentAttemptHistoryContent() {
  try {
    const session = await requireStudent();
    const history = await listAttemptHistoryForStudent({
      studentId: session.userId,
      page: 1,
      pageSize: 20,
    });

    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Historial de intentos</h1>
            <p className="text-sm text-muted-foreground">
              Intentos finalizados o expirados.
            </p>
          </div>
          <Link className="text-sm underline" href="/protected/student/simulators">
            Ir a simuladores
          </Link>
        </div>

        <div className="space-y-3">
          {history.items.map((attempt) => (
            <div key={attempt.id} className="rounded-lg border p-3">
              <p className="text-sm">
                Estado: <strong>{attempt.status}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Puntaje: {attempt.scoreTotal ?? 0}/{attempt.questionsTotal}
              </p>
              <p className="text-xs text-muted-foreground">
                Inicio: {new Date(attempt.startedAt).toLocaleString()}
              </p>
              <Link
                href={`/protected/student/attempts/${attempt.id}/result`}
                className="mt-2 inline-block text-sm underline"
              >
                Ver detalle
              </Link>
            </div>
          ))}
          {history.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay intentos todavía.</p>
          ) : null}
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
    throw error;
  }
}

export default function StudentAttemptHistoryPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <StudentAttemptHistoryContent />
    </Suspense>
  );
}

