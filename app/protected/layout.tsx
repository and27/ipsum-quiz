import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AuthButton } from "@/components/auth-button";
import { getCurrentSessionContext } from "@/lib/usecases/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function ProtectedLayoutFallback() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl p-5">
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    </main>
  );
}

async function ProtectedLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSessionContext();
  if (!session.userId) {
    redirect("/auth/login");
  }

  const isAdmin = session.role === "admin";

  return (
    <main className="min-h-screen">
      <div className="flex min-h-screen flex-col">
        <nav className="w-full border-b border-b-foreground/10">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 text-sm">
            <div className="flex items-center gap-4">
              <Link href="/" className="font-semibold">
                Ipsum Solutio
              </Link>
              <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                {isAdmin ? "Administrador" : "Estudiante"}
              </span>
            </div>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>

        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-5 p-5">
          {isAdmin ? <AdminSidebar /> : null}
          <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ProtectedLayoutFallback />}>
      <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
    </Suspense>
  );
}
