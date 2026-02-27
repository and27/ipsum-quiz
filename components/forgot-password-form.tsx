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
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(getAuthErrorMessageInSpanish(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Revisa tu correo</CardTitle>
            <CardDescription>
              Se enviaron instrucciones para restablecer la contrasena
            </CardDescription>
          </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Si te registraste con correo y contrasena, recibiras un correo
                para restablecerla.
              </p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isLoading}
                  onClick={async () => {
                    const supabase = createClient();
                    setIsLoading(true);
                    setError(null);
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/auth/update-password`,
                      });
                      if (error) throw error;
                    } catch (err: unknown) {
                      setError(getAuthErrorMessageInSpanish(err));
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  {isLoading ? "Reenviando..." : "Reenviar correo"}
                </Button>
                {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
              </div>
            </CardContent>
          </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Restablece tu contrasena</CardTitle>
            <CardDescription>
              Escribe tu correo y te enviaremos un enlace para restablecer tu
              contrasena
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
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
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Enviando..." : "Enviar correo de recuperacion"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Ya tienes una cuenta?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  Iniciar sesión
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
