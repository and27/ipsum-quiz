import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { getCurrentSessionContext } from "@/lib/usecases/auth";
import type { SessionContext } from "@/lib/domain/auth";

interface AuthButtonProps {
  session?: SessionContext;
}

export async function AuthButton({ session: initialSession }: AuthButtonProps) {
  const session = initialSession ?? (await getCurrentSessionContext());
  const displayName =
    session.profile?.fullName?.trim() || session.email || "usuario";

  return session.userId ? (
    <div className="flex items-center gap-4">
      Hola, {displayName}!
      {session.role !== "admin" ? (
        <Link
          href="/protected/student/profile"
          className="rounded-md border px-4 py-2  text-muted-foreground hover:border-primary/40"
        >
          Mi perfil
        </Link>
      ) : null}
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Iniciar sesión</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Registrarse</Link>
      </Button>
    </div>
  );
}
