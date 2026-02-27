"use client";

import type { StudentVisibleSimulator } from "@/lib/domain/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { useState } from "react";

interface StudentSimulatorCatalogProps {
  simulators: StudentVisibleSimulator[];
}

interface ApiErrorResponse {
  error?: string;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ApiErrorResponse;
  if (!response.ok) {
    const message =
      typeof (payload as ApiErrorResponse).error === "string"
        ? (payload as ApiErrorResponse).error
        : "La solicitud fallo.";
    throw new Error(message);
  }
  return payload as T;
}

export function StudentSimulatorCatalog({
  simulators,
}: StudentSimulatorCatalogProps) {
  const [accessCodes, setAccessCodes] = useState<Record<string, string>>({});
  const [busySimulatorId, setBusySimulatorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleStart(simulatorId: string) {
    setErrorMessage(null);
    setBusySimulatorId(simulatorId);
    try {
      const payload = await parseApiResponse<{ attemptId: string }>(
        await fetch(`/api/student/simulators/${simulatorId}/attempts/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessCode: accessCodes[simulatorId] || undefined,
          }),
        }),
      );

      window.location.href = `/protected/student/attempts/${payload.attemptId}/exam`;
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo iniciar el intento.",
      );
      setBusySimulatorId(null);
    }
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}
      {simulators.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {simulators.map((simulator) => {
            const busy = busySimulatorId === simulator.id;
            return (
              <Card key={simulator.id} className="h-full">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      Duracion: {simulator.durationMinutes} min
                    </Badge>
                    <Badge variant="outline">
                      Intentos: {simulator.maxAttempts}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{simulator.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {simulator.description ?? "Sin descripcion"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {simulator.hasAccessCode ? (
                    <div className="space-y-2 rounded-md border bg-muted/50 p-3">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Lock size={14} />
                        Codigo de acceso requerido
                      </p>
                      <Input
                        placeholder="Ingresa tu código"
                        value={accessCodes[simulator.id] ?? ""}
                        onChange={(event) =>
                          setAccessCodes((prev) => ({
                            ...prev,
                            [simulator.id]: event.target.value,
                          }))
                        }
                        disabled={busy}
                      />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={busy}
                    onClick={() => handleStart(simulator.id)}
                  >
                    {busy ? "Iniciando..." : "Iniciar simulador"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
      {simulators.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay simuladores disponibles.
        </p>
      ) : null}
    </div>
  );
}
