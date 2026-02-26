import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import { listVisibleSimulatorsForStudent } from "@/lib/usecases/simulators";
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
      </div>

      <div className="space-y-3">
        {simulators.items.map((simulator) => (
          <div key={simulator.id} className="rounded-lg border p-3">
            <h2 className="font-semibold">{simulator.title}</h2>
            <p className="text-sm text-muted-foreground">
              {simulator.description ?? "No description"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Duration: {simulator.durationMinutes} min | Attempts:{" "}
              {simulator.maxAttempts}
            </p>
          </div>
        ))}
      </div>
      {simulators.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No simulators available.</p>
      ) : null}
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

