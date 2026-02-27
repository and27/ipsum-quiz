import { StudentProfileForm } from "@/components/student/student-profile-form";
import { AuthGuardError, requireStudent } from "@/lib/usecases/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function StudentProfileContent() {
  try {
    const session = await requireStudent();
    return (
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mi perfil</h1>
            <p className="text-sm text-muted-foreground">
              Actualiza tus datos de estudiante.
            </p>
          </div>
          <Link href="/protected/student/simulators" className="text-sm underline">
            Volver a simuladores
          </Link>
        </div>
        <StudentProfileForm
          initialFullName={session.profile.fullName ?? ""}
          email={session.email}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <StudentProfileContent />
    </Suspense>
  );
}
