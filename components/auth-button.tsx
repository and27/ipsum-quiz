import Link from "next/link";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";
import { getCurrentSessionContext } from "@/lib/usecases/auth";

export async function AuthButton() {
  const session = await getCurrentSessionContext();

  return session.userId ? (
    <div className="flex items-center gap-4">
      Hola, {session.email ?? "usuario"}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Iniciar sesion</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Registrarse</Link>
      </Button>
    </div>
  );
}
