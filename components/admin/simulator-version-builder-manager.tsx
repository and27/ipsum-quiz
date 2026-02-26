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
import { useMemo, useState } from "react";

interface SimulatorVersionBuilderManagerProps {
  simulatorId: string;
  initialState: AdminSimulatorBuilderStateResponse;
  availableQuestions: Question[];
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
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    availableQuestions[0]?.id ?? "",
  );
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
      setSuccessMessage("Question added to draft version.");
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to add question to draft version.",
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
      setSuccessMessage("Draft question reordered.");
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to reorder draft question.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [item.id]: false }));
    }
  }

  async function handleDelete(item: SimulatorVersionQuestion) {
    const confirmed = window.confirm("Remove this question from draft version?");
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
      setSuccessMessage("Question removed from draft version.");
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to remove question from draft version.",
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
        setSuccessMessage("Draft version is valid for publish.");
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to validate draft version.",
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
        `Draft version v${payload.publishedVersion.versionNumber} published successfully.`,
      );
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to publish draft version.",
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
        `Draft v${payload.draftVersion.versionNumber} created with ${payload.copiedQuestions} copied questions.`,
      );
      await loadState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to duplicate version.",
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
            Version Builder{" "}
            {activeVersion ? `(v${activeVersion.versionNumber} - ${activeVersion.status})` : ""}
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
                  {isDuplicating ? "Duplicating..." : "Duplicate published version"}
                </Button>
              ) : null}
            </div>
          ) : null}
          <form onSubmit={handleAddQuestion} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="builder-source-question" className="text-sm font-medium">
                Question from bank
              </label>
              <select
                id="builder-source-question"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedQuestionId}
                onChange={(event) => setSelectedQuestionId(event.target.value)}
                disabled={isAdding || availableToAdd.length === 0 || !isEditable}
              >
                {availableToAdd.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.topicName} - {question.statement}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="builder-position" className="text-sm font-medium">
                Insert position (optional)
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
              {isAdding ? "Adding..." : "Add question"}
            </Button>
          </form>
          {availableToAdd.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No additional bank-ready active questions available to add.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Draft Questions</CardTitle>
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
                      Move
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !isEditable || index === 0}
                      onClick={() => handleReorder(item, item.position - 1)}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !isEditable || index === items.length - 1}
                      onClick={() => handleReorder(item, item.position + 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy || !isEditable}
                      onClick={() => handleDelete(item)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Draft version has no questions yet.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publish Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleValidateBeforePublish}
              disabled={isValidating || isPublishing || !draftVersion}
            >
              {isValidating ? "Validating..." : "Run validation"}
            </Button>
            <Button
              type="button"
              onClick={handlePublishDraftVersion}
              disabled={isPublishing || isValidating || !draftVersion}
            >
              {isPublishing ? "Publishing..." : "Publish draft version"}
            </Button>
          </div>
          {!draftVersion ? (
            <p className="text-xs text-muted-foreground">
              No draft exists right now. Duplicate the published version to create one.
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
                  ? "Draft version is valid for publish."
                  : "Draft version has validation issues."}
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
