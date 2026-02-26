import { StudentSimulatorCatalog } from "@/components/student/simulator-catalog";
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
      <div>
        <h1 className="text-2xl font-bold">Available Simulators</h1>
        <p className="text-sm text-muted-foreground">
          Only published and active simulators are visible here.
        </p>
        <Link className="mt-1 inline-block text-sm underline" href="/protected/student/attempts">
          Ver historial de intentos
        </Link>
      </div>

      <StudentSimulatorCatalog simulators={simulators.items} />
    </div>
  );
}

export default function StudentSimulatorsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <StudentSimulatorsContent />
    </Suspense>
  );
}
