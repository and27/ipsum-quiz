"use client";

import type { StudentVisibleSimulator } from "@/lib/domain/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        : "Request failed.";
    throw new Error(message);
  }
  return payload as T;
}

export function StudentSimulatorCatalog({ simulators }: StudentSimulatorCatalogProps) {
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
      setErrorMessage(error instanceof Error ? error.message : "Failed to start attempt.");
      setBusySimulatorId(null);
    }
  }

  return (
    <div className="space-y-3">
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      {simulators.map((simulator) => {
        const busy = busySimulatorId === simulator.id;
        return (
          <div key={simulator.id} className="rounded-lg border p-3">
            <h2 className="font-semibold">{simulator.title}</h2>
            <p className="text-sm text-muted-foreground">
              {simulator.description ?? "No description"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Duration: {simulator.durationMinutes} min | Attempts: {simulator.maxAttempts} |
              Access code: {simulator.hasAccessCode ? "Required" : "Not required"}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {simulator.hasAccessCode ? (
                <Input
                  placeholder="Access code"
                  value={accessCodes[simulator.id] ?? ""}
                  onChange={(event) =>
                    setAccessCodes((prev) => ({
                      ...prev,
                      [simulator.id]: event.target.value,
                    }))
                  }
                  className="w-full max-w-xs"
                  disabled={busy}
                />
              ) : null}
              <Button type="button" disabled={busy} onClick={() => handleStart(simulator.id)}>
                {busy ? "Starting..." : "Start / Resume"}
              </Button>
            </div>
          </div>
        );
      })}
      {simulators.length === 0 ? (
        <p className="text-sm text-muted-foreground">No simulators available.</p>
      ) : null}
    </div>
  );
}

