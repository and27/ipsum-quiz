"use client";

import type {
  AdminSimulatorCreateRequest,
  AdminSimulatorResponse,
  AdminSimulatorsListResponse,
  AdminSimulatorUpdateRequest,
  PaginationMeta,
  Simulator,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { BaseModal } from "@/components/ui/base-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useMemo, useState } from "react";

interface SimulatorsManagerProps {
  initialSimulators: AdminSimulatorsListResponse;
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

function buildEditTitle(simulators: Simulator[]): Record<string, string> {
  return Object.fromEntries(simulators.map((simulator) => [simulator.id, simulator.title]));
}

function buildEditDescription(simulators: Simulator[]): Record<string, string> {
  return Object.fromEntries(
    simulators.map((simulator) => [simulator.id, simulator.description ?? ""]),
  );
}

function buildEditDuration(simulators: Simulator[]): Record<string, string> {
  return Object.fromEntries(
    simulators.map((simulator) => [simulator.id, String(simulator.durationMinutes)]),
  );
}

function buildEditMaxAttempts(simulators: Simulator[]): Record<string, string> {
  return Object.fromEntries(
    simulators.map((simulator) => [simulator.id, String(simulator.maxAttempts)]),
  );
}

export function SimulatorsManager({
  initialSimulators,
}: SimulatorsManagerProps) {
  const [simulators, setSimulators] = useState<Simulator[]>(initialSimulators.items);
  const [meta, setMeta] = useState<PaginationMeta>(initialSimulators.meta);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDurationMinutes, setNewDurationMinutes] = useState("60");
  const [newMaxAttempts, setNewMaxAttempts] = useState("3");
  const [newAccessCode, setNewAccessCode] = useState("");

  const [editTitle, setEditTitle] = useState<Record<string, string>>(
    () => buildEditTitle(initialSimulators.items),
  );
  const [editDescription, setEditDescription] = useState<Record<string, string>>(
    () => buildEditDescription(initialSimulators.items),
  );
  const [editDuration, setEditDuration] = useState<Record<string, string>>(
    () => buildEditDuration(initialSimulators.items),
  );
  const [editMaxAttempts, setEditMaxAttempts] = useState<Record<string, string>>(
    () => buildEditMaxAttempts(initialSimulators.items),
  );
  const [editAccessCode, setEditAccessCode] = useState<Record<string, string>>({});

  const totalLabel = useMemo(() => {
    const active = simulators.filter((simulator) => simulator.isActive).length;
    return `Mostrando ${simulators.length} de ${meta.total} simuladores (${active} activos en la pagina)`;
  }, [simulators, meta.total]);

  async function loadSimulators(nextPage = meta.page, nextIncludeInactive = includeInactive) {
    setIsLoadingList(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/simulators?page=${nextPage}&pageSize=${meta.pageSize}&includeInactive=${nextIncludeInactive}`,
        { method: "GET", cache: "no-store" },
      );
      const payload = await parseApiResponse<AdminSimulatorsListResponse>(response);
      setSimulators(payload.items);
      setMeta(payload.meta);
      setEditTitle(buildEditTitle(payload.items));
      setEditDescription(buildEditDescription(payload.items));
      setEditDuration(buildEditDuration(payload.items));
      setEditMaxAttempts(buildEditMaxAttempts(payload.items));
      setEditAccessCode({});
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron cargar los simuladores.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function handleCreateSimulator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: AdminSimulatorCreateRequest = {
        title: newTitle,
        description: newDescription || null,
        durationMinutes: Number(newDurationMinutes),
        maxAttempts: Number(newMaxAttempts),
        accessCode: newAccessCode || null,
      };
      const response = await fetch("/api/admin/simulators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await parseApiResponse<AdminSimulatorResponse>(response);
      setNewTitle("");
      setNewDescription("");
      setNewDurationMinutes("60");
      setNewMaxAttempts("3");
      setNewAccessCode("");
      setIsCreateModalOpen(false);
      setSuccessMessage("Simulador creado.");
      await loadSimulators(1, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear el simulador.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateSimulator(
    simulator: Simulator,
    payload: AdminSimulatorUpdateRequest,
  ) {
    setRowBusy((prev) => ({ ...prev, [simulator.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/simulators/${simulator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<AdminSimulatorResponse>(response);
      setSuccessMessage("Simulador actualizado.");
      await loadSimulators(meta.page, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar el simulador.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [simulator.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-end">
        <BaseModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          title="Crear simulador"
          trigger={<Button type="button">Crear simulador</Button>}
        >
          <form onSubmit={handleCreateSimulator} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="new-simulator-title" className="text-sm font-medium">
                Titulo
              </label>
              <Input
                id="new-simulator-title"
                placeholder="Titulo del simulador"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-simulator-description" className="text-sm font-medium">
                Descripcion
              </label>
              <textarea
                id="new-simulator-description"
                className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
                placeholder="Descripcion (opcional)"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="new-simulator-duration" className="text-sm font-medium">
                  Duracion (minutos)
                </label>
                <Input
                  id="new-simulator-duration"
                  type="number"
                  min={1}
                  max={600}
                  placeholder="Duracion en minutos"
                  value={newDurationMinutes}
                  onChange={(event) => setNewDurationMinutes(event.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-simulator-max-attempts" className="text-sm font-medium">
                  Intentos maximos
                </label>
                <Input
                  id="new-simulator-max-attempts"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Intentos maximos"
                  value={newMaxAttempts}
                  onChange={(event) => setNewMaxAttempts(event.target.value)}
                  disabled={isCreating}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="new-simulator-access-code" className="text-sm font-medium">
                Codigo de acceso
              </label>
              <Input
                id="new-simulator-access-code"
                placeholder="Codigo de acceso (opcional)"
                value={newAccessCode}
                onChange={(event) => setNewAccessCode(event.target.value)}
                disabled={isCreating}
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creando..." : "Crear simulador"}
            </Button>
          </form>
        </BaseModal>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Simuladores</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <input
                id="simulators-include-inactive"
                type="checkbox"
                checked={includeInactive}
                onChange={async (event) => {
                  const checked = event.target.checked;
                  setIncludeInactive(checked);
                  await loadSimulators(1, checked);
                }}
              />
              <label htmlFor="simulators-include-inactive">Incluir inactivos</label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">{totalLabel}</div>

          {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
          {successMessage ? (
            <p className="text-sm text-green-600">{successMessage}</p>
          ) : null}

          {isLoadingList ? (
            <p className="text-sm text-muted-foreground">Cargando simuladores...</p>
          ) : null}

          <div className="space-y-4">
            {simulators.map((simulator) => {
              const busy = !!rowBusy[simulator.id];
              const title = editTitle[simulator.id] ?? simulator.title;
              const description = editDescription[simulator.id] ?? simulator.description ?? "";
              const durationMinutes =
                editDuration[simulator.id] ?? String(simulator.durationMinutes);
              const maxAttempts =
                editMaxAttempts[simulator.id] ?? String(simulator.maxAttempts);
              const accessCode = editAccessCode[simulator.id] ?? "";

              const hasChanges =
                title.trim() !== simulator.title ||
                (description || null) !== simulator.description ||
                Number(durationMinutes) !== simulator.durationMinutes ||
                Number(maxAttempts) !== simulator.maxAttempts ||
                accessCode.trim().length > 0;

              return (
                <div key={simulator.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={simulator.isActive ? "default" : "secondary"}>
                      {simulator.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    <Badge variant="outline">{simulator.status}</Badge>
                    <Badge variant={simulator.hasAccessCode ? "default" : "outline"}>
                      {simulator.hasAccessCode ? "Codigo configurado" : "Sin codigo"}
                    </Badge>
                  </div>

                  <Input
                    id={`simulator-title-${simulator.id}`}
                    value={title}
                    onChange={(event) =>
                      setEditTitle((prev) => ({ ...prev, [simulator.id]: event.target.value }))
                    }
                    disabled={busy}
                  />
                  <label
                    htmlFor={`simulator-title-${simulator.id}`}
                    className="sr-only"
                  >
                    Titulo del simulador
                  </label>

                  <textarea
                    id={`simulator-description-${simulator.id}`}
                    className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
                    value={description}
                    onChange={(event) =>
                      setEditDescription((prev) => ({
                        ...prev,
                        [simulator.id]: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                  <label
                    htmlFor={`simulator-description-${simulator.id}`}
                    className="sr-only"
                  >
                    Descripcion del simulador
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      id={`simulator-duration-${simulator.id}`}
                      type="number"
                      min={1}
                      max={600}
                      value={durationMinutes}
                      onChange={(event) =>
                        setEditDuration((prev) => ({
                          ...prev,
                          [simulator.id]: event.target.value,
                        }))
                      }
                      disabled={busy}
                    />
                    <label
                      htmlFor={`simulator-duration-${simulator.id}`}
                      className="sr-only"
                    >
                      Duracion en minutos
                    </label>

                    <Input
                      id={`simulator-max-attempts-${simulator.id}`}
                      type="number"
                      min={1}
                      max={20}
                      value={maxAttempts}
                      onChange={(event) =>
                        setEditMaxAttempts((prev) => ({
                          ...prev,
                          [simulator.id]: event.target.value,
                        }))
                      }
                      disabled={busy}
                    />
                    <label
                      htmlFor={`simulator-max-attempts-${simulator.id}`}
                      className="sr-only"
                    >
                      Intentos maximos
                    </label>
                  </div>

                  <Input
                    id={`simulator-access-code-${simulator.id}`}
                    placeholder="Nuevo codigo de acceso (deja vacio para mantener el actual)"
                    value={accessCode}
                    onChange={(event) =>
                      setEditAccessCode((prev) => ({
                        ...prev,
                        [simulator.id]: event.target.value,
                      }))
                    }
                    disabled={busy}
                  />
                  <label
                    htmlFor={`simulator-access-code-${simulator.id}`}
                    className="sr-only"
                  >
                    Nuevo codigo de acceso
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild type="button" variant="outline" disabled={busy}>
                      <Link href={`/protected/admin/simulators/${simulator.id}/builder`}>
                        Abrir constructor
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !hasChanges}
                      onClick={() =>
                        handleUpdateSimulator(simulator, {
                          title,
                          description: description || null,
                          durationMinutes: Number(durationMinutes),
                          maxAttempts: Number(maxAttempts),
                          accessCode: accessCode || undefined,
                        })
                      }
                    >
                      Guardar
                    </Button>

                    <Button
                      type="button"
                      variant={simulator.isActive ? "secondary" : "default"}
                      disabled={busy}
                      onClick={() =>
                        handleUpdateSimulator(simulator, {
                          isActive: !simulator.isActive,
                        })
                      }
                    >
                      {simulator.isActive ? "Desactivar" : "Activar"}
                    </Button>

                    {simulator.hasAccessCode ? (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={busy}
                        onClick={() =>
                          handleUpdateSimulator(simulator, {
                            accessCode: null,
                          })
                        }
                      >
                        Quitar codigo de acceso
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {simulators.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron simuladores con los filtros actuales.
            </p>
          ) : null}

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Pagina {meta.page} de {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={meta.page <= 1 || isLoadingList}
                onClick={() => loadSimulators(meta.page - 1, includeInactive)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={meta.page >= meta.totalPages || isLoadingList}
                onClick={() => loadSimulators(meta.page + 1, includeInactive)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

