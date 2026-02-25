import { SimulatorsManager } from "@/components/admin/simulators-manager";
import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { listSimulators } from "@/lib/usecases/simulators";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AdminSimulatorsContent() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const simulators = await listSimulators({
    page: 1,
    pageSize: 20,
    includeInactive: true,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Admin - Simulators</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage simulators.
        </p>
      </div>

      <SimulatorsManager
        initialSimulators={{
          items: simulators.items,
          meta: {
            page: simulators.page,
            pageSize: simulators.pageSize,
            total: simulators.total,
            totalPages: simulators.totalPages,
          },
        }}
      />
    </div>
  );
}

export default function AdminSimulatorsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <AdminSimulatorsContent />
    </Suspense>
  );
}

