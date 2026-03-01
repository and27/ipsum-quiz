"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface StudentProfileFormProps {
  initialFullName: string;
  initialGradeScore: number | null;
  email: string | null;
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

function formatGradeScoreValue(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

export function StudentProfileForm({
  initialFullName,
  initialGradeScore,
  email,
}: StudentProfileFormProps) {
  const [savedFullName, setSavedFullName] = useState(initialFullName);
  const [savedGradeScoreInput, setSavedGradeScoreInput] = useState(
    formatGradeScoreValue(initialGradeScore),
  );
  const [fullName, setFullName] = useState(initialFullName);
  const [gradeScoreInput, setGradeScoreInput] = useState(
    formatGradeScoreValue(initialGradeScore),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasChanges =
    fullName.trim() !== savedFullName.trim() ||
    gradeScoreInput.trim() !== savedGradeScoreInput.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = await parseApiResponse<{
        ok: true;
        fullName: string;
        gradeScore: number | null;
      }>(
        await fetch("/api/student/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName,
            gradeScore:
              gradeScoreInput.trim().length === 0 ? null : Number(gradeScoreInput),
          }),
        }),
      );
      setSavedFullName(payload.fullName);
      setSavedGradeScoreInput(formatGradeScoreValue(payload.gradeScore));
      setFullName(payload.fullName);
      setGradeScoreInput(formatGradeScoreValue(payload.gradeScore));
      setSuccessMessage("Perfil actualizado.");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar el perfil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <label htmlFor="student-profile-email" className="text-sm font-medium">
          Correo
        </label>
        <Input id="student-profile-email" value={email ?? "-"} readOnly />
      </div>
      <div className="space-y-1">
        <label htmlFor="student-profile-name" className="text-sm font-medium">
          Nombre completo
        </label>
        <Input
          id="student-profile-name"
          value={fullName}
          placeholder="Tu nombre completo"
          onChange={(event) => setFullName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="student-profile-grade-score" className="text-sm font-medium">
          Nota de grado
        </label>
        <Input
          id="student-profile-grade-score"
          type="number"
          min="0"
          max="100"
          step="0.01"
          inputMode="decimal"
          value={gradeScoreInput}
          placeholder="Ej. 92.50"
          onChange={(event) => setGradeScoreInput(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Campo opcional. Ingresa una nota entre 0 y 100.
        </p>
      </div>
      {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-green-600">{successMessage}</p> : null}
      <Button type="submit" disabled={isSaving || !hasChanges}>
        {isSaving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
