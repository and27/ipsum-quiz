import { StudentSimulatorCatalog } from "@/components/student/simulator-catalog";
import { Button } from "@/components/ui/button";
import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import { listVisibleSimulatorsForStudent } from "@/lib/usecases/simulators";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function StudentSimulatorsContent() {
  try {
    await requireStudent();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const simulators = await listVisibleSimulatorsForStudent({
    page: 1,
    pageSize: 20,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Simuladores disponibles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige un simulador y comienza tu intento cuando estes listo.
            </p>
          </div>
          <Button asChild type="button" variant="outline">
            <Link href="/protected/student/attempts">Ver historial</Link>
          </Button>
        </div>
      </div>

      <StudentSimulatorCatalog simulators={simulators.items} />
    </div>
  );
}

export default function StudentSimulatorsPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Cargando...</div>
      }
    >
      <StudentSimulatorsContent />
    </Suspense>
  );
}
