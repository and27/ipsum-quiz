import { TopicsManager } from "@/components/admin/topics-manager";
import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { listTopics } from "@/lib/usecases/topics";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AdminTopicsContent() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }

    redirect("/protected");
  }

  const topics = await listTopics({ includeInactive: true });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Admin - Temas</h1>
        <p className="text-sm text-muted-foreground">
          Crea, renombra, activa o desactiva temas.
        </p>
      </div>

      <TopicsManager initialTopics={topics} />
    </div>
  );
}

export default function AdminTopicsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <AdminTopicsContent />
    </Suspense>
  );
}
