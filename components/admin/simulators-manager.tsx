"use client";

import type {
  AdminSimulatorCreateRequest,
  AdminSimulatorResponse,
  AdminSimulatorsListResponse,
  AdminSimulatorUpdateRequest,
  PaginationMeta,
  Simulator,
  SimulatorCampus,
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

function buildEditAccessCode(simulators: Simulator[]): Record<string, string> {
  return Object.fromEntries(
    simulators.map((simulator) => [simulator.id, simulator.accessCode ?? ""]),
  );
}

function buildEditCampus(simulators: Simulator[]): Record<string, SimulatorCampus> {
  return Object.fromEntries(
    simulators.map((simulator) => [simulator.id, simulator.campus]),
  );
}

interface SimulatorFormFieldsProps {
  prefix: string;
  title: string;
  description: string;
  durationMinutes: string;
  maxAttempts: string;
  campus: SimulatorCampus;
  accessCode: string;
  disabled: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onMaxAttemptsChange: (value: string) => void;
  onCampusChange: (value: SimulatorCampus) => void;
  onAccessCodeChange: (value: string) => void;
}

function SimulatorFormFields({
  prefix,
  title,
  description,
  durationMinutes,
  maxAttempts,
  campus,
  accessCode,
  disabled,
  onTitleChange,
  onDescriptionChange,
  onDurationChange,
  onMaxAttemptsChange,
  onCampusChange,
  onAccessCodeChange,
}: SimulatorFormFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-title`} className="text-sm font-medium">
          Titulo
        </label>
        <Input
          id={`${prefix}-title`}
          placeholder="Titulo del simulador"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-description`} className="text-sm font-medium">
          Descripcion
        </label>
        <textarea
          id={`${prefix}-description`}
          className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
          placeholder="Descripcion (opcional)"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${prefix}-duration`} className="text-sm font-medium">
            Duracion (minutos)
          </label>
          <Input
            id={`${prefix}-duration`}
            type="number"
            min={1}
            max={600}
            placeholder="Duracion en minutos"
            value={durationMinutes}
            onChange={(event) => onDurationChange(event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${prefix}-max-attempts`} className="text-sm font-medium">
            Intentos maximos
          </label>
          <Input
            id={`${prefix}-max-attempts`}
            type="number"
            min={1}
            max={20}
            placeholder="Intentos maximos"
            value={maxAttempts}
            onChange={(event) => onMaxAttemptsChange(event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-campus`} className="text-sm font-medium">
          Sede
        </label>
        <select
          id={`${prefix}-campus`}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
          value={campus}
          onChange={(event) => onCampusChange(event.target.value as SimulatorCampus)}
          disabled={disabled}
        >
          <option value="canar" style={{ backgroundColor: "#ffffff", color: "#111111" }}>
            Cañar
          </option>
          <option value="azogues" style={{ backgroundColor: "#ffffff", color: "#111111" }}>
            Azogues
          </option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-access-code`} className="text-sm font-medium">
          Codigo de acceso
        </label>
        <Input
          id={`${prefix}-access-code`}
          placeholder="Codigo de acceso (opcional)"
          value={accessCode}
          onChange={(event) => onAccessCodeChange(event.target.value)}
          disabled={disabled}
        />
      </div>
    </>
  );
}

export function SimulatorsManager({
  initialSimulators,
}: SimulatorsManagerProps) {
  const [simulators, setSimulators] = useState<Simulator[]>(initialSimulators.items);
  const [meta, setMeta] = useState<PaginationMeta>(initialSimulators.meta);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSimulatorId, setEditingSimulatorId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDurationMinutes, setNewDurationMinutes] = useState("60");
  const [newMaxAttempts, setNewMaxAttempts] = useState("3");
  const [newCampus, setNewCampus] = useState<SimulatorCampus>("canar");
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
  const [editAccessCode, setEditAccessCode] = useState<Record<string, string>>(
    () => buildEditAccessCode(initialSimulators.items),
  );
  const [editCampus, setEditCampus] = useState<Record<string, SimulatorCampus>>(
    () => buildEditCampus(initialSimulators.items),
  );

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
      setEditAccessCode(buildEditAccessCode(payload.items));
      setEditCampus(buildEditCampus(payload.items));
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
        campus: newCampus,
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
      setNewCampus("canar");
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
  ): Promise<boolean> {
    setRowBusy((prev) => ({ ...prev, [simulator.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/simulators/${simulator.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await parseApiResponse<AdminSimulatorResponse>(response);
      const updatedSimulator = parsed.simulator;
      setSimulators((prev) =>
        prev.map((item) => (item.id === updatedSimulator.id ? updatedSimulator : item)),
      );
      setEditTitle((prev) => ({ ...prev, [updatedSimulator.id]: updatedSimulator.title }));
      setEditDescription((prev) => ({
        ...prev,
        [updatedSimulator.id]: updatedSimulator.description ?? "",
      }));
      setEditDuration((prev) => ({
        ...prev,
        [updatedSimulator.id]: String(updatedSimulator.durationMinutes),
      }));
      setEditMaxAttempts((prev) => ({
        ...prev,
        [updatedSimulator.id]: String(updatedSimulator.maxAttempts),
      }));
      setEditAccessCode((prev) => ({
        ...prev,
        [updatedSimulator.id]: updatedSimulator.accessCode ?? "",
      }));
      setEditCampus((prev) => ({
        ...prev,
        [updatedSimulator.id]: updatedSimulator.campus,
      }));
      if (typeof payload.isActive === "boolean") {
        setSuccessMessage(payload.isActive ? "Simulador reactivado." : "Simulador archivado.");
      } else {
        setSuccessMessage("Simulador actualizado.");
      }
      return true;
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar el simulador.",
      );
      return false;
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
            <SimulatorFormFields
              prefix="new-simulator"
              title={newTitle}
              description={newDescription}
              durationMinutes={newDurationMinutes}
              maxAttempts={newMaxAttempts}
              campus={newCampus}
              accessCode={newAccessCode}
              disabled={isCreating}
              onTitleChange={setNewTitle}
              onDescriptionChange={setNewDescription}
              onDurationChange={setNewDurationMinutes}
              onMaxAttemptsChange={setNewMaxAttempts}
              onCampusChange={setNewCampus}
              onAccessCodeChange={setNewAccessCode}
            />
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
              <label htmlFor="simulators-include-inactive">Incluir archivados</label>
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
              const campus = editCampus[simulator.id] ?? simulator.campus;
              const normalizedAccessCode = accessCode.trim();
              const currentAccessCode = simulator.accessCode ?? "";
              const accessCodeChanged = normalizedAccessCode !== currentAccessCode;

              const hasChanges =
                title.trim() !== simulator.title ||
                campus !== simulator.campus ||
                (description || null) !== simulator.description ||
                Number(durationMinutes) !== simulator.durationMinutes ||
                Number(maxAttempts) !== simulator.maxAttempts ||
                accessCodeChanged;

              return (
                <div key={simulator.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={simulator.isActive ? "default" : "secondary"}>
                      {simulator.isActive ? "Activo" : "Archivado"}
                    </Badge>
                    <Badge variant="outline">{simulator.status}</Badge>
                    <Badge variant={simulator.hasAccessCode ? "default" : "outline"}>
                      {simulator.hasAccessCode ? "Codigo configurado" : "Sin codigo"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Titulo
                      </p>
                      <p className="font-medium">{simulator.title}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Sede
                      </p>
                      <p className="font-medium">
                        {simulator.campus === "canar" ? "Cañar" : "Azogues"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Codigo de acceso
                      </p>
                      <p className="font-medium">
                        {simulator.accessCode && simulator.accessCode.length > 0
                          ? simulator.accessCode
                          : "No configurado"}
                      </p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Descripcion
                      </p>
                      <p className="font-medium">
                        {simulator.description && simulator.description.length > 0
                          ? simulator.description
                          : "Sin descripcion"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Duracion
                      </p>
                      <p className="font-medium">{simulator.durationMinutes} minutos</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Intentos maximos
                      </p>
                      <p className="font-medium">{simulator.maxAttempts}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <BaseModal
                      open={editingSimulatorId === simulator.id}
                      onOpenChange={(open) =>
                        setEditingSimulatorId(open ? simulator.id : null)
                      }
                      title="Editar simulador"
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setEditTitle((prev) => ({ ...prev, [simulator.id]: simulator.title }));
                            setEditDescription((prev) => ({
                              ...prev,
                              [simulator.id]: simulator.description ?? "",
                            }));
                            setEditDuration((prev) => ({
                              ...prev,
                              [simulator.id]: String(simulator.durationMinutes),
                            }));
                            setEditMaxAttempts((prev) => ({
                              ...prev,
                              [simulator.id]: String(simulator.maxAttempts),
                            }));
                            setEditCampus((prev) => ({
                              ...prev,
                              [simulator.id]: simulator.campus,
                            }));
                            setEditAccessCode((prev) => ({
                              ...prev,
                              [simulator.id]: simulator.accessCode ?? "",
                            }));
                          }}
                        >
                          Editar
                        </Button>
                      }
                    >
                      <form
                        className="space-y-3"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const didUpdate = await handleUpdateSimulator(simulator, {
                            title,
                            campus,
                            description: description || null,
                            durationMinutes: Number(durationMinutes),
                            maxAttempts: Number(maxAttempts),
                            accessCode:
                              accessCodeChanged
                                ? normalizedAccessCode.length > 0
                                  ? normalizedAccessCode
                                  : null
                                : undefined,
                          });
                          if (didUpdate) {
                            setEditingSimulatorId(null);
                          }
                        }}
                      >
                        <SimulatorFormFields
                          prefix={`edit-simulator-${simulator.id}`}
                          title={title}
                          description={description}
                          durationMinutes={durationMinutes}
                          maxAttempts={maxAttempts}
                          campus={campus}
                          accessCode={accessCode}
                          disabled={busy}
                          onTitleChange={(value) =>
                            setEditTitle((prev) => ({ ...prev, [simulator.id]: value }))
                          }
                          onDescriptionChange={(value) =>
                            setEditDescription((prev) => ({
                              ...prev,
                              [simulator.id]: value,
                            }))
                          }
                          onDurationChange={(value) =>
                            setEditDuration((prev) => ({ ...prev, [simulator.id]: value }))
                          }
                          onMaxAttemptsChange={(value) =>
                            setEditMaxAttempts((prev) => ({
                              ...prev,
                              [simulator.id]: value,
                            }))
                          }
                          onCampusChange={(value) =>
                            setEditCampus((prev) => ({
                              ...prev,
                              [simulator.id]: value,
                            }))
                          }
                          onAccessCodeChange={(value) =>
                            setEditAccessCode((prev) => ({
                              ...prev,
                              [simulator.id]: value,
                            }))
                          }
                        />
                        <Button type="submit" disabled={busy || !hasChanges}>
                          {busy ? "Guardando..." : "Guardar cambios"}
                        </Button>
                      </form>
                    </BaseModal>
                    <Button asChild type="button" variant="outline" disabled={busy}>
                      <Link href={`/protected/admin/simulators/${simulator.id}/builder`}>
                        Abrir constructor
                      </Link>
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
                      {simulator.isActive ? "Archivar" : "Reactivar"}
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

