"use client";
/* eslint-disable @next/next/no-img-element */

import type {
  AdminImageUploadResponse,
  AdminQuestionCreateRequest,
  AdminQuestionResponse,
  AdminQuestionsListResponse,
  AdminQuestionUpdateRequest,
  PaginationMeta,
  Question,
  Topic,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prepareImageForUpload } from "@/lib/usecases/images/client";
import Link from "next/link";
import { useMemo, useState } from "react";

interface QuestionsManagerProps {
  initialQuestions: AdminQuestionsListResponse;
  availableTopics: Topic[];
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

function buildEditStatements(questions: Question[]): Record<string, string> {
  return Object.fromEntries(questions.map((question) => [question.id, question.statement]));
}

function buildEditTopicIds(questions: Question[]): Record<string, string> {
  return Object.fromEntries(questions.map((question) => [question.id, question.topicId]));
}

function buildEditImageUrls(questions: Question[]): Record<string, string> {
  return Object.fromEntries(
    questions.map((question) => [question.id, question.imageUrl ?? ""]),
  );
}

async function uploadAdminImage(
  entityType: "question" | "option",
  file: File,
): Promise<string> {
  const prepared = await prepareImageForUpload(file);
  const formData = new FormData();
  formData.set("entityType", entityType);
  formData.set("original", prepared.originalFile);
  formData.set("processedWebp", prepared.processedWebpFile);
  formData.set("processedJpeg", prepared.processedJpegFile);

  const response = await fetch("/api/admin/images/upload", {
    method: "POST",
    body: formData,
  });
  const payload = await parseApiResponse<AdminImageUploadResponse>(response);
  return payload.asset.finalUrl;
}

export function QuestionsManager({
  initialQuestions,
  availableTopics,
}: QuestionsManagerProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions.items);
  const [meta, setMeta] = useState<PaginationMeta>(initialQuestions.meta);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingCreateImage, setIsUploadingCreateImage] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [rowImageBusy, setRowImageBusy] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newTopicId, setNewTopicId] = useState<string>(availableTopics[0]?.id ?? "");
  const [newStatement, setNewStatement] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

  const [editStatements, setEditStatements] = useState<Record<string, string>>(
    () => buildEditStatements(initialQuestions.items),
  );
  const [editTopicIds, setEditTopicIds] = useState<Record<string, string>>(
    () => buildEditTopicIds(initialQuestions.items),
  );
  const [editImageUrls, setEditImageUrls] = useState<Record<string, string>>(
    () => buildEditImageUrls(initialQuestions.items),
  );

  const totalLabel = useMemo(() => {
    const active = questions.filter((question) => question.isActive).length;
    return `Showing ${questions.length} of ${meta.total} questions (${active} active on page)`;
  }, [questions, meta.total]);
  const hasTopics = availableTopics.length > 0;

  async function loadQuestions(nextPage = meta.page, nextIncludeInactive = includeInactive) {
    setIsLoadingList(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/admin/questions?page=${nextPage}&pageSize=${meta.pageSize}&includeInactive=${nextIncludeInactive}`,
        { method: "GET", cache: "no-store" },
      );
      const payload = await parseApiResponse<AdminQuestionsListResponse>(response);
      setQuestions(payload.items);
      setMeta(payload.meta);
      setEditStatements(buildEditStatements(payload.items));
      setEditTopicIds(buildEditTopicIds(payload.items));
      setEditImageUrls(buildEditImageUrls(payload.items));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load questions.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function handleCreateQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: AdminQuestionCreateRequest = {
        topicId: newTopicId,
        statement: newStatement,
        imageUrl: newImageUrl || null,
      };
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await parseApiResponse<AdminQuestionResponse>(response);
      setNewStatement("");
      setNewImageUrl("");
      setSuccessMessage("Question created.");
      await loadQuestions(1, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create question.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleCreateImageUpload(file: File) {
    setIsUploadingCreateImage(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const imageUrl = await uploadAdminImage("question", file);
      setNewImageUrl(imageUrl);
      setSuccessMessage("Image uploaded for new question.");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to upload image.",
      );
    } finally {
      setIsUploadingCreateImage(false);
    }
  }

  async function handleRowImageUpload(questionId: string, file: File) {
    setRowImageBusy((prev) => ({ ...prev, [questionId]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const imageUrl = await uploadAdminImage("question", file);
      setEditImageUrls((prev) => ({
        ...prev,
        [questionId]: imageUrl,
      }));
      setSuccessMessage("Image uploaded.");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to upload image.",
      );
    } finally {
      setRowImageBusy((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleUpdateQuestion(
    question: Question,
    payload: AdminQuestionUpdateRequest,
  ) {
    setRowBusy((prev) => ({ ...prev, [question.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await parseApiResponse<AdminQuestionResponse>(response);
      setSuccessMessage("Question updated.");
      await loadQuestions(meta.page, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update question.",
      );
    } finally {
      setRowBusy((prev) => ({ ...prev, [question.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateQuestion} className="space-y-3">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={newTopicId}
              onChange={(event) => setNewTopicId(event.target.value)}
              disabled={isCreating || !hasTopics}
            >
              {availableTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>

            <textarea
              className="min-h-24 w-full rounded-md border border-input bg-transparent p-3 text-sm"
              placeholder="Question statement"
              value={newStatement}
              onChange={(event) => setNewStatement(event.target.value)}
              disabled={isCreating}
            />

            <Input
              placeholder="Image URL (optional)"
              value={newImageUrl}
              onChange={(event) => setNewImageUrl(event.target.value)}
              disabled={isCreating || isUploadingCreateImage}
            />
            {newImageUrl ? (
              <img
                src={newImageUrl}
                alt="Question preview"
                className="max-h-48 rounded border object-contain"
              />
            ) : null}
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isCreating || isUploadingCreateImage}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  return;
                }
                await handleCreateImageUpload(file);
              }}
            />
            {isUploadingCreateImage ? (
              <p className="text-xs text-muted-foreground">
                Processing and uploading image...
              </p>
            ) : null}

            <Button type="submit" disabled={isCreating || !hasTopics}>
              {isCreating ? "Creating..." : "Create question"}
            </Button>
            {!hasTopics ? (
              <p className="text-xs text-muted-foreground">
                Create at least one active topic before creating questions.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Questions</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <input
                id="questions-include-inactive"
                type="checkbox"
                checked={includeInactive}
                onChange={async (event) => {
                  const checked = event.target.checked;
                  setIncludeInactive(checked);
                  await loadQuestions(1, checked);
                }}
              />
              <label htmlFor="questions-include-inactive">Include inactive</label>
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
            <p className="text-sm text-muted-foreground">Loading questions...</p>
          ) : null}

          <div className="space-y-4">
            {questions.map((question) => {
              const busy = !!rowBusy[question.id];
              const uploadingImage = !!rowImageBusy[question.id];
              const editedStatement = editStatements[question.id] ?? question.statement;
              const editedTopicId = editTopicIds[question.id] ?? question.topicId;
              const editedImageUrl = editImageUrls[question.id] ?? question.imageUrl ?? "";

              const hasChanges =
                editedStatement.trim() !== question.statement ||
                editedTopicId !== question.topicId ||
                (editedImageUrl || null) !== question.imageUrl;

              return (
                <div key={question.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={question.isActive ? "default" : "secondary"}>
                        {question.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant={question.isBankReady ? "default" : "outline"}>
                        {question.isBankReady ? "Bank Ready" : "Bank Not Ready"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Topic: {question.topicName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active options: {question.activeOptionsCount} | Active correct:{" "}
                    {question.activeCorrectOptionsCount}
                  </p>

                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={editedTopicId}
                    onChange={(event) =>
                      setEditTopicIds((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                    disabled={busy || uploadingImage}
                  >
                    {availableTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>

                  <textarea
                    className="min-h-24 w-full rounded-md border border-input bg-transparent p-3 text-sm"
                    value={editedStatement}
                    onChange={(event) =>
                      setEditStatements((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                    disabled={busy || uploadingImage}
                  />

                  <Input
                    placeholder="Image URL (optional)"
                    value={editedImageUrl}
                    onChange={(event) =>
                      setEditImageUrls((prev) => ({
                        ...prev,
                        [question.id]: event.target.value,
                      }))
                    }
                    disabled={busy || uploadingImage}
                  />
                  {editedImageUrl ? (
                    <img
                      src={editedImageUrl}
                      alt="Question preview"
                      className="max-h-48 rounded border object-contain"
                    />
                  ) : null}
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy || uploadingImage}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) {
                        return;
                      }
                      await handleRowImageUpload(question.id, file);
                    }}
                  />
                  {uploadingImage ? (
                    <p className="text-xs text-muted-foreground">
                      Processing and uploading image...
                    </p>
                  ) : null}

                  <div className="flex gap-2">
                    <Button asChild type="button" variant="outline" disabled={busy || uploadingImage}>
                      <Link href={`/protected/admin/questions/${question.id}/options`}>
                        Manage options
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || uploadingImage || !hasChanges}
                      onClick={() =>
                        handleUpdateQuestion(question, {
                          topicId: editedTopicId,
                          statement: editedStatement,
                          imageUrl: editedImageUrl || null,
                        })
                      }
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant={question.isActive ? "secondary" : "default"}
                      disabled={
                        busy ||
                        uploadingImage ||
                        (!question.isActive && !question.isBankReady)
                      }
                      onClick={() =>
                        handleUpdateQuestion(question, {
                          isActive: !question.isActive,
                        })
                      }
                    >
                      {question.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                  {!question.isBankReady && !question.isActive ? (
                    <p className="text-xs text-amber-600">
                      To activate, this question needs at least 2 active options and exactly 1 active correct option.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions found for current filters.
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
                onClick={() => loadQuestions(meta.page - 1, includeInactive)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={meta.page >= meta.totalPages || isLoadingList}
                onClick={() => loadQuestions(meta.page + 1, includeInactive)}
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
