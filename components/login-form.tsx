"use client";

import { cn } from "@/lib/utils";
import { getAuthErrorMessageInSpanish } from "@/lib/auth-error-messages";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupSuccess = searchParams.get("signup") === "success";
  const resetSuccess = searchParams.get("reset") === "success";

  const helperMessage = useMemo(() => {
    if (resetSuccess) {
      return "Tu contrasena se actualizo. Inicia sesion con la nueva contrasena.";
    }
    if (signupSuccess) {
      return "Tu cuenta fue creada. Inicia sesion.";
    }
    return null;
  }, [resetSuccess, signupSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/protected");
    } catch (error: unknown) {
      setError(getAuthErrorMessageInSpanish(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <div className="mb-2 flex justify-center">
            <Image
              src="/logo.png"
              alt="Logo Ipsum Solutio"
              width={84}
              height={84}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl">Iniciar sesion</CardTitle>
          <CardDescription>
            Ingresa tu correo para iniciar sesion en tu cuenta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              {helperMessage ? (
                <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700">
                  {helperMessage}
                </p>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Contrasena</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Olvidaste tu contrasena?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              No tienes una cuenta?{" "}
              <Link
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Registrarse
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
