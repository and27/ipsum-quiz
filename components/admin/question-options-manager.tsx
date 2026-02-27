"use client";

import type {
  AdminQuestionOptionCreateRequest,
  AdminQuestionOptionResponse,
  AdminQuestionOptionsListResponse,
  AdminQuestionOptionUpdateRequest,
  QuestionOption,
  QuestionOptionIntegrity,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { BaseModal } from "@/components/ui/base-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

interface QuestionOptionsManagerProps {
  questionId: string;
  initialOptions: QuestionOption[];
  initialIntegrity: QuestionOptionIntegrity;
  initialQuestionIsActive: boolean;
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

function buildEditText(options: QuestionOption[]): Record<string, string> {
  return Object.fromEntries(options.map((option) => [option.id, option.text]));
}

function buildEditPosition(options: QuestionOption[]): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [option.id, String(option.position)]),
  );
}

export function QuestionOptionsManager({
  questionId,
  initialOptions,
  initialIntegrity,
  initialQuestionIsActive,
}: QuestionOptionsManagerProps) {
  const [options, setOptions] = useState<QuestionOption[]>(initialOptions);
  const [integrity, setIntegrity] = useState<QuestionOptionIntegrity>(initialIntegrity);
  const [questionIsActive, setQuestionIsActive] = useState(initialQuestionIsActive);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newIsCorrect, setNewIsCorrect] = useState(false);

  const [editText, setEditText] = useState<Record<string, string>>(
    () => buildEditText(initialOptions),
  );
  const [editPosition, setEditPosition] = useState<Record<string, string>>(
    () => buildEditPosition(initialOptions),
  );

  const statsLabel = useMemo(() => {
    return `${options.length} opciones (${integrity.activeOptionsCount} activas, ${integrity.activeCorrectOptionsCount} correctas activas)`;
  }, [options.length, integrity.activeCorrectOptionsCount, integrity.activeOptionsCount]);

  async function loadOptions(nextIncludeInactive = includeInactive) {
    setIsLoadingList(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/admin/questions/${questionId}/options?includeInactive=${nextIncludeInactive}`,
        { method: "GET", cache: "no-store" },
      );
      const payload = await parseApiResponse<AdminQuestionOptionsListResponse>(response);
      setOptions(payload.items);
      setIntegrity(payload.integrity);
      setQuestionIsActive(payload.questionIsActive);
      setEditText(buildEditText(payload.items));
      setEditPosition(buildEditPosition(payload.items));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron cargar las opciones.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function handleCreateOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: AdminQuestionOptionCreateRequest = {
        text: newText,
        position: newPosition ? Number(newPosition) : undefined,
        isCorrect: newIsCorrect,
      };

      const response = await fetch(`/api/admin/questions/${questionId}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<AdminQuestionOptionResponse>(response);

      setNewText("");
      setNewPosition("");
      setNewIsCorrect(false);
      setIsCreateModalOpen(false);
      setSuccessMessage("Opcion creada.");
      await loadOptions(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la opcion.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateOption(
    option: QuestionOption,
    payload: AdminQuestionOptionUpdateRequest,
  ) {
    setRowBusy((prev) => ({ ...prev, [option.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/questions/${questionId}/options/${option.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await parseApiResponse<AdminQuestionOptionResponse>(response);
      setSuccessMessage("Opcion actualizada.");
      await loadOptions(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la opcion.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [option.id]: false }));
    }
  }

  async function handleDeleteOption(option: QuestionOption) {
    setRowBusy((prev) => ({ ...prev, [option.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/questions/${questionId}/options/${option.id}`,
        { method: "DELETE" },
      );
      await parseApiResponse<{ ok: true }>(response);
      setSuccessMessage("Opcion eliminada.");
      await loadOptions(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo eliminar la opcion.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [option.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-end">
        <BaseModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          title="Crear opcion"
          trigger={<Button type="button">Crear opcion</Button>}
        >
          <form onSubmit={handleCreateOption} className="space-y-3">
            <Input
              placeholder="Texto de la opcion"
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              disabled={isCreating}
            />
            <Input
              type="number"
              min={1}
              placeholder="Posicion (opcional, automatica si vacio)"
              value={newPosition}
              onChange={(event) => setNewPosition(event.target.value)}
              disabled={isCreating}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newIsCorrect}
                onChange={(event) => setNewIsCorrect(event.target.checked)}
                disabled={isCreating}
              />
              Marcar como correcta
            </label>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creando..." : "Crear opcion"}
            </Button>
          </form>
        </BaseModal>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Opciones</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <input
                id="options-include-inactive"
                type="checkbox"
                checked={includeInactive}
                onChange={async (event) => {
                  const checked = event.target.checked;
                  setIncludeInactive(checked);
                  await loadOptions(checked);
                }}
              />
              <label htmlFor="options-include-inactive">Incluir inactivos</label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{statsLabel}</p>
          <p
            className={`text-sm ${
              integrity.isReady ? "text-green-600" : "text-amber-600"
            }`}
          >
            {integrity.isReady
              ? "Estado del banco de preguntas: listo."
              : "Estado del banco de preguntas: no listo (requiere >=2 opciones activas y exactamente 1 correcta activa)."}
          </p>
          {questionIsActive ? (
            <p className="text-sm text-muted-foreground">
              Esta pregunta esta activa. Algunos cambios en opciones estan restringidos para mantenerla valida.
            </p>
          ) : null}

          {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
          {successMessage ? (
            <p className="text-sm text-green-600">{successMessage}</p>
          ) : null}
          {isLoadingList ? (
            <p className="text-sm text-muted-foreground">Cargando opciones...</p>
          ) : null}

          <div className="space-y-3">
            {options.map((option) => {
              const busy = !!rowBusy[option.id];
              const text = editText[option.id] ?? option.text;
              const position = editPosition[option.id] ?? String(option.position);
              const hasChanges =
                text.trim() !== option.text ||
                Number(position) !== option.position;

              return (
                <div key={option.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={option.isActive ? "default" : "secondary"}>
                      {option.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                    <Badge variant={option.isCorrect ? "default" : "outline"}>
                      {option.isCorrect ? "Correcta" : "Incorrecta"}
                    </Badge>
                  </div>

                  <Input
                    value={text}
                    onChange={(event) =>
                      setEditText((prev) => ({ ...prev, [option.id]: event.target.value }))
                    }
                    disabled={busy}
                  />

                  <Input
                    type="number"
                    min={1}
                    value={position}
                    onChange={(event) =>
                      setEditPosition((prev) => ({
                        ...prev,
                        [option.id]: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !hasChanges}
                      onClick={() =>
                        handleUpdateOption(option, {
                          text,
                          position: Number(position),
                        })
                      }
                    >
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant={option.isCorrect ? "secondary" : "default"}
                      disabled={busy || option.isCorrect}
                      onClick={() => handleUpdateOption(option, { isCorrect: true })}
                    >
                      {option.isCorrect ? "Correcta actual" : "Definir correcta"}
                    </Button>
                    <Button
                      type="button"
                      variant={option.isActive ? "secondary" : "default"}
                      disabled={busy}
                      onClick={() =>
                        handleUpdateOption(option, { isActive: !option.isActive })
                      }
                    >
                      {option.isActive ? "Desactivar" : "Activar"}
                    </Button>
                    <ConfirmModal
                      title="Eliminar opcion"
                      description="Esta accion eliminara la opcion de forma permanente."
                      confirmLabel="Eliminar"
                      destructive
                      busy={busy}
                      triggerLabel="Eliminar"
                      triggerVariant="destructive"
                      onConfirm={() => handleDeleteOption(option)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se encontraron opciones.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

