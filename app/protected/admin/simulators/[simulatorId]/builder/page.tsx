import { SimulatorVersionBuilderManager } from "@/components/admin/simulator-version-builder-manager";
import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { listUnassignedQuestionsForBuilder } from "@/lib/usecases/questions";
import { getSimulatorBuilderState, SimulatorBuilderError } from "@/lib/usecases/simulators";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AdminSimulatorBuilderContent({
  params,
}: {
  params: Promise<{ simulatorId: string }>;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const { simulatorId } = await params;
  if (!simulatorId) {
    redirect("/protected/admin/simulators");
  }

  let builderState;
  try {
    builderState = await getSimulatorBuilderState(simulatorId);
  } catch (error) {
    if (error instanceof SimulatorBuilderError && error.code === "simulator_not_found") {
      redirect("/protected/admin/simulators");
    }
    throw error;
  }

  const questions = await listUnassignedQuestionsForBuilder(200);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Constructor de simulador</h1>
        <p className="text-sm text-muted-foreground">{builderState.simulator.title}</p>
      </div>

      <SimulatorVersionBuilderManager
        simulatorId={simulatorId}
        initialState={builderState}
        availableQuestions={questions}
      />
    </div>
  );
}

export default function AdminSimulatorBuilderPage({
  params,
}: {
  params: Promise<{ simulatorId: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <AdminSimulatorBuilderContent params={params} />
    </Suspense>
  );
}
