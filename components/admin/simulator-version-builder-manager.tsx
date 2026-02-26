"use client";

import type {
  AdminSimulatorDuplicateVersionResponse,
  AdminSimulatorPublishResponse,
  AdminSimulatorBuilderStateResponse,
  AdminSimulatorPublishValidationResponse,
  Question,
  SimulatorVersionQuestion,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";

interface SimulatorVersionBuilderManagerProps {
  simulatorId: string;
  initialState: AdminSimulatorBuilderStateResponse;
  availableQuestions: Question[];
}

interface ApiErrorResponse {
  error?: string;
}

function getUnknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
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

function buildEditPositions(items: SimulatorVersionQuestion[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, String(item.position)]));
}

export function SimulatorVersionBuilderManager({
  simulatorId,
  initialState,
  availableQuestions,
}: SimulatorVersionBuilderManagerProps) {
  const [items, setItems] = useState<SimulatorVersionQuestion[]>(initialState.items);
  const [activeVersion, setActiveVersion] = useState(initialState.activeVersion);
  const [draftVersion, setDraftVersion] = useState(initialState.draftVersion);
  const [publishedVersion, setPublishedVersion] = useState(initialState.publishedVersion);
  const [isEditable, setIsEditable] = useState(initialState.isEditable);
  const [lockReason, setLockReason] = useState(initialState.lockReason);
  const [editPositions, setEditPositions] = useState<Record<string, string>>(
    () => buildEditPositions(initialState.items),
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");
  const [newQuestionPosition, setNewQuestionPosition] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [validationResult, setValidationResult] = useState<
    AdminSimulatorPublishValidationResponse["validation"] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const availableToAdd = useMemo(() => {
    const existingSourceQuestionIds = new Set(
      items.map((item) => item.sourceQuestionId).filter((id): id is string => !!id),
    );
    return availableQuestions.filter(
      (question) => question.isBankReady && !existingSourceQuestionIds.has(question.id),
    );
  }, [availableQuestions, items]);

  useEffect(() => {
    if (availableToAdd.length === 0) {
      if (selectedQuestionId) {
        setSelectedQuestionId("");
      }
      return;
    }

    const stillAvailable = availableToAdd.some(
      (question) => question.id === selectedQuestionId,
    );
    if (!stillAvailable) {
      setSelectedQuestionId(availableToAdd[0].id);
    }
  }, [availableToAdd, selectedQuestionId]);

  async function loadState() {
    const response = await fetch(`/api/admin/simulators/${simulatorId}/builder`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await parseApiResponse<AdminSimulatorBuilderStateResponse>(response);
    setItems(payload.items);
    setEditPositions(buildEditPositions(payload.items));
    setActiveVersion(payload.activeVersion);
    setDraftVersion(payload.draftVersion);
    setPublishedVersion(payload.publishedVersion);
    setIsEditable(payload.isEditable);
    setLockReason(payload.lockReason);
  }

  async function handleAddQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAdding(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationResult(null);

    try {
      if (!selectedQuestionId) {
        throw new Error("Selecciona una pregunta disponible del banco.");
      }
      const isSelectable = availableToAdd.some(
        (question) => question.id === selectedQuestionId,
      );
      if (!isSelectable) {
        throw new Error(
          "La pregunta seleccionada ya no esta disponible. Intenta nuevamente.",
        );
      }

      const response = await fetch(`/api/admin/simulators/${simulatorId}/builder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceQuestionId: selectedQuestionId,
          position: newQuestionPosition ? Number(newQuestionPosition) : undefined,
        }),
      });
      await parseApiResponse<{ item: SimulatorVersionQuestion }>(response);
      setNewQuestionPosition("");
      setSuccessMessage("Pregunta agregada a la version borrador.");
      await loadState();
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("ya esta agregada") ||
          error.message.includes("already added"))
      ) {
        await loadState();
      }
      setErrorMessage(
        getUnknownErrorMessage(
          error,
          "No se pudo agregar la pregunta a la version borrador.",
        ),
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function handleReorder(item: SimulatorVersionQuestion, nextPosition: number) {
    setRowBusy((prev) => ({ ...prev, [item.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationResult(null);

    try {
      const response = await fetch(
        `/api/admin/simulators/${simulatorId}/builder/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: nextPosition }),
        },
      );
      await parseApiResponse<{ item: SimulatorVersionQuestion }>(response);
      setSuccessMessage("Pregunta del borrador reordenada.");
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo reordenar la pregunta del borrador.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleDelete(item: SimulatorVersionQuestion) {
    const confirmed = window.confirm("Quitar esta pregunta de la version borrador?");
    if (!confirmed) {
      return;
    }

    setRowBusy((prev) => ({ ...prev, [item.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationResult(null);

    try {
      const response = await fetch(
        `/api/admin/simulators/${simulatorId}/builder/${item.id}`,
        { method: "DELETE" },
      );
      await parseApiResponse<{ ok: true }>(response);
      setSuccessMessage("Pregunta eliminada de la version borrador.");
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la pregunta de la version borrador.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleValidateBeforePublish() {
    setIsValidating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/simulators/${simulatorId}/validate-publish`,
        { method: "POST" },
      );
      const payload =
        await parseApiResponse<AdminSimulatorPublishValidationResponse>(response);
      setValidationResult(payload.validation);
      if (payload.validation.isValid) {
        setSuccessMessage("La version borrador es valida para publicar.");
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo validar la version borrador.",
      );
    } finally {
      setIsValidating(false);
    }
  }

  async function handlePublishDraftVersion() {
    setIsPublishing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/admin/simulators/${simulatorId}/publish`, {
        method: "POST",
      });
      const payload = await parseApiResponse<AdminSimulatorPublishResponse>(response);
      setValidationResult(payload.validation);
      setSuccessMessage(
        `Version borrador v${payload.publishedVersion.versionNumber} publicada correctamente.`,
      );
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo publicar la version borrador.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleDuplicateVersion() {
    setIsDuplicating(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setValidationResult(null);
    try {
      const response = await fetch(
        `/api/admin/simulators/${simulatorId}/duplicate-version`,
        { method: "POST" },
      );
      const payload =
        await parseApiResponse<AdminSimulatorDuplicateVersionResponse>(response);
      setSuccessMessage(
        `Borrador v${payload.draftVersion.versionNumber} creado con ${payload.copiedQuestions} preguntas copiadas.`,
      );
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo duplicar la version.",
      );
    } finally {
      setIsDuplicating(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Constructor de version{" "}
            {activeVersion
              ? `(v${activeVersion.versionNumber} - ${
                  activeVersion.status === "draft"
                    ? "borrador"
                    : activeVersion.status === "published"
                      ? "publicada"
                      : "archivada"
                })`
              : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isEditable && lockReason ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">{lockReason}</p>
              {publishedVersion && !draftVersion ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDuplicateVersion}
                  disabled={isDuplicating}
                >
                  {isDuplicating ? "Duplicando..." : "Duplicar version publicada"}
                </Button>
              ) : null}
            </div>
          ) : null}
          <form onSubmit={handleAddQuestion} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="builder-source-question" className="text-sm font-medium">
                Pregunta del banco
              </label>
              <select
                id="builder-source-question"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
                value={selectedQuestionId}
                onChange={(event) => setSelectedQuestionId(event.target.value)}
                disabled={isAdding || availableToAdd.length === 0 || !isEditable}
              >
                {availableToAdd.map((question) => (
                  <option
                    key={question.id}
                    value={question.id}
                    className="text-black"
                    style={{ backgroundColor: "#ffffff", color: "#111111" }}
                  >
                    {question.topicName} - {question.statement}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="builder-position" className="text-sm font-medium">
                Posicion de insercion (opcional)
              </label>
              <Input
                id="builder-position"
                type="number"
                min={1}
                value={newQuestionPosition}
                onChange={(event) => setNewQuestionPosition(event.target.value)}
                disabled={isAdding || !isEditable}
              />
            </div>
            <Button
              type="submit"
              disabled={isAdding || availableToAdd.length === 0 || !isEditable}
            >
              {isAdding ? "Agregando..." : "Agregar pregunta"}
            </Button>
          </form>
          {availableToAdd.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay mas preguntas activas y listas para banco para agregar.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preguntas del borrador</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
          {successMessage ? (
            <p className="text-sm text-green-600">{successMessage}</p>
          ) : null}

          <div className="space-y-3">
            {items.map((item, index) => {
              const busy = !!rowBusy[item.id];
              const nextPosition = Number(editPositions[item.id] ?? item.position);

              return (
                <div key={item.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>#{item.position}</Badge>
                    <Badge variant="outline">{item.topicName}</Badge>
                  </div>
                  <p className="text-sm">{item.statement}</p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={editPositions[item.id] ?? String(item.position)}
                      onChange={(event) =>
                        setEditPositions((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      disabled={busy || !isEditable}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        busy ||
                        !isEditable ||
                        !Number.isFinite(nextPosition) ||
                        nextPosition <= 0
                      }
                      onClick={() => handleReorder(item, nextPosition)}
                    >
                      Mover
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !isEditable || index === 0}
                      onClick={() => handleReorder(item, item.position - 1)}
                    >
                      Subir
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !isEditable || index === items.length - 1}
                      onClick={() => handleReorder(item, item.position + 1)}
                    >
                      Bajar
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy || !isEditable}
                      onClick={() => handleDelete(item)}
                    >
                      Quitar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              La version borrador aun no tiene preguntas.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validacion de publicacion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleValidateBeforePublish}
              disabled={isValidating || isPublishing || !draftVersion}
            >
              {isValidating ? "Validando..." : "Ejecutar validacion"}
            </Button>
            <Button
              type="button"
              onClick={handlePublishDraftVersion}
              disabled={isPublishing || isValidating || !draftVersion}
            >
              {isPublishing ? "Publicando..." : "Publicar version borrador"}
            </Button>
          </div>
          {!draftVersion ? (
            <p className="text-xs text-muted-foreground">
              No existe un borrador en este momento. Duplica la version publicada para crear uno.
            </p>
          ) : null}

          {validationResult ? (
            <div className="space-y-2">
              <p
                className={`text-sm ${
                  validationResult.isValid ? "text-green-600" : "text-amber-600"
                }`}
              >
                {validationResult.isValid
                  ? "La version borrador es valida para publicar."
                  : "La version borrador tiene problemas de validacion."}
              </p>
              {validationResult.issues.length > 0 ? (
                <ul className="list-disc pl-5 text-sm">
                  {validationResult.issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.versionQuestionId ?? index}`}>
                      [{issue.code}] {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

