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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
        : "Request failed.";
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
    return `Showing ${simulators.length} of ${meta.total} simulators (${active} active on page)`;
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
        error instanceof Error ? error.message : "Failed to load simulators.",
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
      setSuccessMessage("Simulator created.");
      await loadSimulators(1, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create simulator.",
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
      setSuccessMessage("Simulator updated.");
      await loadSimulators(meta.page, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update simulator.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [simulator.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Simulator</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSimulator} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="new-simulator-title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="new-simulator-title"
                placeholder="Simulator title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-simulator-description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="new-simulator-description"
                className="min-h-20 w-full rounded-md border border-input bg-transparent p-3 text-sm"
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="new-simulator-duration" className="text-sm font-medium">
                  Duration (minutes)
                </label>
                <Input
                  id="new-simulator-duration"
                  type="number"
                  min={1}
                  max={600}
                  placeholder="Duration minutes"
                  value={newDurationMinutes}
                  onChange={(event) => setNewDurationMinutes(event.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-simulator-max-attempts" className="text-sm font-medium">
                  Max attempts
                </label>
                <Input
                  id="new-simulator-max-attempts"
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Max attempts"
                  value={newMaxAttempts}
                  onChange={(event) => setNewMaxAttempts(event.target.value)}
                  disabled={isCreating}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="new-simulator-access-code" className="text-sm font-medium">
                Access code
              </label>
              <Input
                id="new-simulator-access-code"
                placeholder="Access code (optional)"
                value={newAccessCode}
                onChange={(event) => setNewAccessCode(event.target.value)}
                disabled={isCreating}
              />
            </div>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create simulator"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Simulators</CardTitle>
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
              <label htmlFor="simulators-include-inactive">Include inactive</label>
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
            <p className="text-sm text-muted-foreground">Loading simulators...</p>
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
                      {simulator.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{simulator.status}</Badge>
                    <Badge variant={simulator.hasAccessCode ? "default" : "outline"}>
                      {simulator.hasAccessCode ? "Access code set" : "No access code"}
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
                    Simulator title
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
                    Simulator description
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
                      Duration minutes
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
                      Max attempts
                    </label>
                  </div>

                  <Input
                    id={`simulator-access-code-${simulator.id}`}
                    placeholder="New access code (leave empty to keep current)"
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
                    New access code
                  </label>

                  <div className="flex flex-wrap gap-2">
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
                      Save
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
                      {simulator.isActive ? "Deactivate" : "Activate"}
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
                        Remove access code
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {simulators.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No simulators found for current filters.
            </p>
          ) : null}

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={meta.page <= 1 || isLoadingList}
                onClick={() => loadSimulators(meta.page - 1, includeInactive)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={meta.page >= meta.totalPages || isLoadingList}
                onClick={() => loadSimulators(meta.page + 1, includeInactive)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
