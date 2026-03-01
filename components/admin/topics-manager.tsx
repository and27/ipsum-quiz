"use client";

import type {
  AdminTopicCreateRequest,
  AdminTopicResponse,
  AdminTopicsListResponse,
  AdminTopicUpdateRequest,
  Topic,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { BaseModal } from "@/components/ui/base-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

interface TopicsManagerProps {
  initialTopics: Topic[];
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

function buildEditNames(topics: Topic[]): Record<string, string> {
  return Object.fromEntries(topics.map((topic) => [topic.id, topic.name]));
}

function buildEditOrders(topics: Topic[]): Record<string, string> {
  return Object.fromEntries(
    topics.map((topic) => [topic.id, String(topic.displayOrder)]),
  );
}

export function TopicsManager({ initialTopics }: TopicsManagerProps) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [editNames, setEditNames] = useState<Record<string, string>>(
    () => buildEditNames(initialTopics),
  );
  const [editOrders, setEditOrders] = useState<Record<string, string>>(
    () => buildEditOrders(initialTopics),
  );
  const [newTopicName, setNewTopicName] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const topicCountLabel = useMemo(() => {
    const active = topics.filter((topic) => topic.isActive).length;
    return `${topics.length} temas (${active} activos)`;
  }, [topics]);

  async function loadTopics(nextIncludeInactive = includeInactive) {
    setIsLoadingList(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/topics?includeInactive=${nextIncludeInactive}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const payload = await parseApiResponse<AdminTopicsListResponse>(response);
      setTopics(payload.items);
      setEditNames(buildEditNames(payload.items));
      setEditOrders(buildEditOrders(payload.items));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los temas.");
    } finally {
      setIsLoadingList(false);
    }
  }

  async function handleCreateTopic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: AdminTopicCreateRequest = { name: newTopicName };
      const response = await fetch("/api/admin/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<AdminTopicResponse>(response);
      setNewTopicName("");
      setIsCreateModalOpen(false);
      setSuccessMessage("Tema creado.");
      await loadTopics(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el tema.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateTopic(topic: Topic, payload: AdminTopicUpdateRequest) {
    setRowBusy((prev) => ({ ...prev, [topic.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/topics/${topic.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<AdminTopicResponse>(response);
      setSuccessMessage("Tema actualizado.");
      await loadTopics(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar el tema.");
    } finally {
      setRowBusy((prev) => ({ ...prev, [topic.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-end">
        <BaseModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          title="Crear tema"
          trigger={<Button type="button">Crear tema</Button>}
        >
          <form onSubmit={handleCreateTopic} className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="e.g. Matematicas"
              value={newTopicName}
              onChange={(event) => setNewTopicName(event.target.value)}
              disabled={isCreating}
            />
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creando..." : "Crear"}
            </Button>
          </form>
        </BaseModal>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Temas</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <input
                id="include-inactive"
                type="checkbox"
                checked={includeInactive}
                onChange={async (event) => {
                  const checked = event.target.checked;
                  setIncludeInactive(checked);
                  await loadTopics(checked);
                }}
              />
              <label htmlFor="include-inactive">Incluir inactivos</label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">{topicCountLabel}</div>

          {errorMessage ? (
            <p className="text-sm text-red-500">{errorMessage}</p>
          ) : null}
          {successMessage ? (
            <p className="text-sm text-green-600">{successMessage}</p>
          ) : null}

          {isLoadingList ? (
            <p className="text-sm text-muted-foreground">Cargando temas...</p>
          ) : null}

          <div className="space-y-3">
            {topics.map((topic) => {
              const pending = !!rowBusy[topic.id];
              const currentName = editNames[topic.id] ?? topic.name;
              const currentOrder = editOrders[topic.id] ?? String(topic.displayOrder);
              const canSaveName =
                currentName.trim().length > 0 &&
                (currentName.trim() !== topic.name ||
                  Number(currentOrder) !== topic.displayOrder);

              return (
                <div
                  key={topic.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-20">
                    <Badge variant={topic.isActive ? "default" : "secondary"}>
                      {topic.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>

                  <div className="w-full sm:w-24">
                    <Input
                      type="number"
                      min={1}
                      aria-label={`Orden del tema ${topic.name}`}
                      value={currentOrder}
                      onChange={(event) =>
                        setEditOrders((prev) => ({
                          ...prev,
                          [topic.id]: event.target.value,
                        }))
                      }
                      disabled={pending}
                    />
                  </div>

                  <div className="flex-1">
                    <Input
                      value={currentName}
                      onChange={(event) =>
                        setEditNames((prev) => ({
                          ...prev,
                          [topic.id]: event.target.value,
                        }))
                      }
                      disabled={pending}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending || !canSaveName}
                      onClick={() =>
                        handleUpdateTopic(topic, {
                          name: currentName,
                          displayOrder: Number(currentOrder),
                        })
                      }
                    >
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant={topic.isActive ? "secondary" : "default"}
                      disabled={pending}
                      onClick={() =>
                        handleUpdateTopic(topic, {
                          isActive: !topic.isActive,
                        })
                      }
                    >
                      {topic.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No se encontraron temas con los filtros actuales.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


