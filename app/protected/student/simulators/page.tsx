import { StudentSimulatorCatalog } from "@/components/student/simulator-catalog";
import { Button } from "@/components/ui/button";
import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import { listVisibleSimulatorsForStudent } from "@/lib/usecases/simulators";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type Campus = "canar" | "azogues";

function parseCampus(value: string | undefined): Campus | null {
  if (value === "canar" || value === "azogues") {
    return value;
  }
  return null;
}

function campusLabel(campus: Campus): string {
  return campus === "canar" ? "Cañar" : "Azogues";
}

async function StudentSimulatorsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireStudent();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const resolvedSearchParams = await searchParams;
  const campusParam = resolvedSearchParams.campus;
  const selectedCampus = parseCampus(
    typeof campusParam === "string" ? campusParam : undefined,
  );

  if (!selectedCampus) {
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Selecciona tu sede</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Elige Cañar o Azogues para ver los simuladores correspondientes.
              </p>
            </div>
            <Button asChild type="button" variant="outline">
              <Link href="/protected/student/attempts">Ver historial</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/protected/student/simulators?campus=canar"
            className="rounded-xl border bg-card p-6 transition hover:border-primary/50 hover:bg-primary/5"
          >
            <h2 className="text-2xl font-bold">Simuladores Cañar</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ver simuladores disponibles para la sede Cañar.
            </p>
          </Link>
          <Link
            href="/protected/student/simulators?campus=azogues"
            className="rounded-xl border bg-card p-6 transition hover:border-primary/50 hover:bg-primary/5"
          >
            <h2 className="text-2xl font-bold">Simuladores Azogues</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ver simuladores disponibles para la sede Azogues.
            </p>
          </Link>
        </div>
      </div>
    );
  }

  const simulators = await listVisibleSimulatorsForStudent({
    page: 1,
    pageSize: 20,
    campus: selectedCampus,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Simuladores {campusLabel(selectedCampus)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige un simulador y comienza tu intento cuando estes listo.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild type="button" variant="outline">
              <Link href="/protected/student/simulators">Cambiar sede</Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/protected/student/attempts">Ver historial</Link>
            </Button>
          </div>
        </div>
      </div>

      <StudentSimulatorCatalog simulators={simulators.items} />
    </div>
  );
}

export default function StudentSimulatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground">Cargando...</div>
      }
    >
      <StudentSimulatorsContent searchParams={searchParams} />
    </Suspense>
  );
}
