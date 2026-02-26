import { StudentExamRunner } from "@/components/student/exam-runner";
import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import { getAttemptExamStateForStudent, StudentAttemptError } from "@/lib/usecases/attempts";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function StudentExamPageContent({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  try {
    const session = await requireStudent();
    const { attemptId } = await params;
    if (!attemptId) {
      redirect("/protected/student/simulators");
    }

    const examState = await getAttemptExamStateForStudent({
      attemptId,
      studentId: session.userId,
    });

    return (
      <div className="flex w-full flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">Examen en curso</h1>
          <p className="text-sm text-muted-foreground">
            Navegacion solo hacia adelante.
          </p>
        </div>
        <StudentExamRunner initialState={examState} />
      </div>
    );
  } catch (error) {
    if (error instanceof AuthGuardError) {
      if (error.reason === "unauthenticated") {
        redirect("/auth/login");
      }
      redirect("/protected");
    }

    if (error instanceof StudentAttemptError) {
      redirect("/protected/student/simulators");
    }

    throw error;
  }
}

export default function StudentExamPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <StudentExamPageContent params={params} />
    </Suspense>
  );
}
