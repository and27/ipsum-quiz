"use client";

import type {
  AdminQuestionOptionCreateRequest,
  AdminQuestionOptionResponse,
  AdminQuestionOptionsListResponse,
  AdminQuestionOptionUpdateRequest,
  QuestionOption,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

interface QuestionOptionsManagerProps {
  questionId: string;
  initialOptions: QuestionOption[];
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

function buildEditText(options: QuestionOption[]): Record<string, string> {
  return Object.fromEntries(options.map((option) => [option.id, option.text]));
}

function buildEditImageUrl(options: QuestionOption[]): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [option.id, option.imageUrl ?? ""]),
  );
}

function buildEditPosition(options: QuestionOption[]): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [option.id, String(option.position)]),
  );
}

export function QuestionOptionsManager({
  questionId,
  initialOptions,
}: QuestionOptionsManagerProps) {
  const [options, setOptions] = useState<QuestionOption[]>(initialOptions);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newIsCorrect, setNewIsCorrect] = useState(false);

  const [editText, setEditText] = useState<Record<string, string>>(
    () => buildEditText(initialOptions),
  );
  const [editImageUrl, setEditImageUrl] = useState<Record<string, string>>(
    () => buildEditImageUrl(initialOptions),
  );
  const [editPosition, setEditPosition] = useState<Record<string, string>>(
    () => buildEditPosition(initialOptions),
  );

  const statsLabel = useMemo(() => {
    const active = options.filter((option) => option.isActive).length;
    const correct = options.filter((option) => option.isCorrect).length;
    return `${options.length} options (${active} active, ${correct} correct)`;
  }, [options]);

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
      setEditText(buildEditText(payload.items));
      setEditImageUrl(buildEditImageUrl(payload.items));
      setEditPosition(buildEditPosition(payload.items));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load options.",
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
        imageUrl: newImageUrl || null,
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
      setNewImageUrl("");
      setNewPosition("");
      setNewIsCorrect(false);
      setSuccessMessage("Option created.");
      await loadOptions(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create option.",
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
      setSuccessMessage("Option updated.");
      await loadOptions(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update option.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [option.id]: false }));
    }
  }

  async function handleDeleteOption(option: QuestionOption) {
    const confirmed = window.confirm("Delete this option?");
    if (!confirmed) {
      return;
    }

    setRowBusy((prev) => ({ ...prev, [option.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/admin/questions/${questionId}/options/${option.id}`,
        { method: "DELETE" },
      );
      await parseApiResponse<{ ok: true }>(response);
      setSuccessMessage("Option deleted.");
      await loadOptions(includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete option.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [option.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Option</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOption} className="space-y-3">
            <Input
              placeholder="Option text"
              value={newText}
              onChange={(event) => setNewText(event.target.value)}
              disabled={isCreating}
            />
            <Input
              placeholder="Image URL (optional)"
              value={newImageUrl}
              onChange={(event) => setNewImageUrl(event.target.value)}
              disabled={isCreating}
            />
            <Input
              type="number"
              min={1}
              placeholder="Position (optional, auto if empty)"
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
              Mark as correct
            </label>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create option"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Options</CardTitle>
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
              <label htmlFor="options-include-inactive">Include inactive</label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{statsLabel}</p>

          {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
          {successMessage ? (
            <p className="text-sm text-green-600">{successMessage}</p>
          ) : null}
          {isLoadingList ? (
            <p className="text-sm text-muted-foreground">Loading options...</p>
          ) : null}

          <div className="space-y-3">
            {options.map((option) => {
              const busy = !!rowBusy[option.id];
              const text = editText[option.id] ?? option.text;
              const imageUrl = editImageUrl[option.id] ?? option.imageUrl ?? "";
              const position = editPosition[option.id] ?? String(option.position);
              const hasChanges =
                text.trim() !== option.text ||
                (imageUrl || null) !== option.imageUrl ||
                Number(position) !== option.position;

              return (
                <div key={option.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={option.isActive ? "default" : "secondary"}>
                      {option.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant={option.isCorrect ? "default" : "outline"}>
                      {option.isCorrect ? "Correct" : "Incorrect"}
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
                    value={imageUrl}
                    placeholder="Image URL (optional)"
                    onChange={(event) =>
                      setEditImageUrl((prev) => ({
                        ...prev,
                        [option.id]: event.target.value,
                      }))
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
                          imageUrl: imageUrl || null,
                          position: Number(position),
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant={option.isCorrect ? "secondary" : "default"}
                      disabled={busy}
                      onClick={() =>
                        handleUpdateOption(option, { isCorrect: !option.isCorrect })
                      }
                    >
                      {option.isCorrect ? "Unset correct" : "Set correct"}
                    </Button>
                    <Button
                      type="button"
                      variant={option.isActive ? "secondary" : "default"}
                      disabled={busy}
                      onClick={() =>
                        handleUpdateOption(option, { isActive: !option.isActive })
                      }
                    >
                      {option.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => handleDeleteOption(option)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No options found.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

