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
import { BaseModal } from "@/components/ui/base-modal";
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

interface DraftOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

function createDefaultDraftOptions(): DraftOption[] {
  return [
    { id: crypto.randomUUID(), text: "", isCorrect: true },
    { id: crypto.randomUUID(), text: "", isCorrect: false },
    { id: crypto.randomUUID(), text: "", isCorrect: false },
    { id: crypto.randomUUID(), text: "", isCorrect: false },
  ];
}

interface QuestionDetailsFormFieldsProps {
  prefix: string;
  topicId: string;
  statement: string;
  imageUrl: string;
  availableTopics: Topic[];
  disabled: boolean;
  uploadingImage: boolean;
  onTopicChange: (value: string) => void;
  onStatementChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<void>;
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

function QuestionDetailsFormFields({
  prefix,
  topicId,
  statement,
  imageUrl,
  availableTopics,
  disabled,
  uploadingImage,
  onTopicChange,
  onStatementChange,
  onImageUrlChange,
  onUploadImage,
}: QuestionDetailsFormFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-topic`} className="text-sm font-medium">
          Tema
        </label>
        <select
          id={`${prefix}-topic`}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
          value={topicId}
          onChange={(event) => onTopicChange(event.target.value)}
          disabled={disabled}
        >
          {availableTopics.map((topic) => (
            <option
              key={topic.id}
              value={topic.id}
              style={{ backgroundColor: "#ffffff", color: "#111111" }}
            >
              {topic.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={`${prefix}-statement`} className="text-sm font-medium">
          Enunciado
        </label>
        <textarea
          id={`${prefix}-statement`}
          className="min-h-24 w-full rounded-md border border-input bg-transparent p-3 text-sm"
          placeholder="Enunciado de la pregunta"
          value={statement}
          onChange={(event) => onStatementChange(event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`${prefix}-image-url`} className="text-sm font-medium">
          URL de imagen
        </label>
        <Input
          id={`${prefix}-image-url`}
          placeholder="URL de imagen (opcional)"
          value={imageUrl}
          onChange={(event) => onImageUrlChange(event.target.value)}
          disabled={disabled || uploadingImage}
        />
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Vista previa de la pregunta"
          className="max-h-48 rounded border object-contain"
        />
      ) : null}
      <div className="space-y-1">
        <label htmlFor={`${prefix}-image-file`} className="text-sm font-medium">
          Subir imagen
        </label>
        <Input
          id={`${prefix}-image-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || uploadingImage}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) {
              return;
            }
            await onUploadImage(file);
          }}
        />
      </div>
      {uploadingImage ? (
        <p className="text-xs text-muted-foreground">Procesando y subiendo imagen...</p>
      ) : null}
    </>
  );
}

export function QuestionsManager({
  initialQuestions,
  availableTopics,
}: QuestionsManagerProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions.items);
  const [meta, setMeta] = useState<PaginationMeta>(initialQuestions.meta);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
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
  const [newOptions, setNewOptions] = useState<DraftOption[]>([
    ...createDefaultDraftOptions(),
  ]);

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
    return `Mostrando ${questions.length} de ${meta.total} preguntas (${active} activas en la pagina)`;
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
        error instanceof Error ? error.message : "No se pudieron cargar las preguntas.",
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
      const nonEmptyOptions = newOptions
        .map((option) => ({
          ...option,
          text: option.text.trim(),
        }))
        .filter((option) => option.text.length > 0);

      if (nonEmptyOptions.length < 2) {
        throw new Error("Debes agregar al menos 2 opciones con texto.");
      }

      const correctCount = nonEmptyOptions.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        throw new Error("Debes marcar exactamente 1 opcion correcta.");
      }

      const payload: AdminQuestionCreateRequest = {
        topicId: newTopicId,
        statement: newStatement,
        imageUrl: newImageUrl || null,
        options: nonEmptyOptions.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
          isActive: true,
        })),
      };
      const response = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await parseApiResponse<AdminQuestionResponse>(response);
      setNewStatement("");
      setNewImageUrl("");
      setNewOptions(createDefaultDraftOptions());
      setIsCreateModalOpen(false);
      setSuccessMessage("Pregunta creada.");
      await loadQuestions(1, includeInactive);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la pregunta.",
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
      setSuccessMessage("Imagen subida para la nueva pregunta.");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo subir la imagen.",
      );
    } finally {
      setIsUploadingCreateImage(false);
    }
  }

  function addDraftOption() {
    setNewOptions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: "", isCorrect: false },
    ]);
  }

  function removeDraftOption(id: string) {
    setNewOptions((prev) => {
      if (prev.length <= 2) {
        return prev;
      }
      const next = prev.filter((option) => option.id !== id);
      if (!next.some((option) => option.isCorrect) && next.length > 0) {
        next[0] = { ...next[0], isCorrect: true };
      }
      return next;
    });
  }

  function setDraftOptionCorrect(id: string) {
    setNewOptions((prev) =>
      prev.map((option) => ({ ...option, isCorrect: option.id === id })),
    );
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
      setSuccessMessage("Imagen subida.");
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo subir la imagen.",
      );
    } finally {
      setRowImageBusy((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function handleUpdateQuestion(
    question: Question,
    payload: AdminQuestionUpdateRequest,
  ): Promise<boolean> {
    setRowBusy((prev) => ({ ...prev, [question.id]: true }));
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const parsed = await parseApiResponse<AdminQuestionResponse>(response);
      const updatedQuestion = parsed.question;
      setQuestions((prev) =>
        prev.map((item) => (item.id === updatedQuestion.id ? updatedQuestion : item)),
      );
      setEditStatements((prev) => ({
        ...prev,
        [updatedQuestion.id]: updatedQuestion.statement,
      }));
      setEditTopicIds((prev) => ({
        ...prev,
        [updatedQuestion.id]: updatedQuestion.topicId,
      }));
      setEditImageUrls((prev) => ({
        ...prev,
        [updatedQuestion.id]: updatedQuestion.imageUrl ?? "",
      }));
      setSuccessMessage("Pregunta actualizada.");
      return true;
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la pregunta.",
      );
      return false;
    } finally {
      setRowBusy((prev) => ({ ...prev, [question.id]: false }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex justify-end">
        <BaseModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          title="Crear pregunta"
          trigger={<Button type="button">Crear pregunta</Button>}
        >
          <form onSubmit={handleCreateQuestion} className="space-y-3">
            <QuestionDetailsFormFields
              prefix="new-question"
              topicId={newTopicId}
              statement={newStatement}
              imageUrl={newImageUrl}
              availableTopics={availableTopics}
              disabled={isCreating || !hasTopics}
              uploadingImage={isUploadingCreateImage}
              onTopicChange={setNewTopicId}
              onStatementChange={setNewStatement}
              onImageUrlChange={setNewImageUrl}
              onUploadImage={handleCreateImageUpload}
            />

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Opciones</p>
                <Button type="button" variant="outline" size="sm" onClick={addDraftOption}>
                  Agregar opcion
                </Button>
              </div>

              <div className="space-y-2">
                {newOptions.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="new-question-correct-option"
                      checked={option.isCorrect}
                      onChange={() => setDraftOptionCorrect(option.id)}
                      disabled={isCreating}
                      aria-label={`Marcar opcion ${index + 1} como correcta`}
                    />
                    <Input
                      placeholder={`Texto de opcion ${index + 1}`}
                      value={option.text}
                      onChange={(event) =>
                        setNewOptions((prev) =>
                          prev.map((item) =>
                            item.id === option.id
                              ? { ...item, text: event.target.value }
                              : item,
                          ),
                        )
                      }
                      disabled={isCreating}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeDraftOption(option.id)}
                      disabled={isCreating || newOptions.length <= 2}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Debes crear al menos 2 opciones y marcar 1 como correcta.
              </p>
            </div>

            <Button type="submit" disabled={isCreating || !hasTopics}>
              {isCreating ? "Creando..." : "Crear pregunta"}
            </Button>
            {!hasTopics ? (
              <p className="text-xs text-muted-foreground">
                Crea al menos un tema activo antes de crear preguntas.
              </p>
            ) : null}
          </form>
        </BaseModal>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Preguntas</CardTitle>
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
              <label htmlFor="questions-include-inactive">Incluir inactivos</label>
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
            <p className="text-sm text-muted-foreground">Cargando preguntas...</p>
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
                        {question.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                      <Badge variant={question.isBankReady ? "default" : "outline"}>
                        {question.isBankReady ? "Lista para banco" : "No lista para banco"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Tema: {question.topicName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Opciones activas: {question.activeOptionsCount} | Correctas activas:{" "}
                    {question.activeCorrectOptionsCount}
                  </p>

                  <div className="grid gap-3 rounded-md bg-muted/50 p-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Tema
                      </p>
                      <p className="font-medium">{question.topicName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Enunciado
                      </p>
                      <p className="font-medium">{question.statement}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Imagen
                      </p>
                      <p className="font-medium">
                        {question.imageUrl ? "Configurada" : "Sin imagen"}
                      </p>
                    </div>
                    {question.imageUrl ? (
                      <img
                        src={question.imageUrl}
                        alt="Vista previa de la pregunta"
                        className="max-h-48 rounded border object-contain"
                      />
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <BaseModal
                      open={editingQuestionId === question.id}
                      onOpenChange={(open) =>
                        setEditingQuestionId(open ? question.id : null)
                      }
                      title="Editar pregunta"
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy || uploadingImage}
                          onClick={() => {
                            setEditStatements((prev) => ({
                              ...prev,
                              [question.id]: question.statement,
                            }));
                            setEditTopicIds((prev) => ({
                              ...prev,
                              [question.id]: question.topicId,
                            }));
                            setEditImageUrls((prev) => ({
                              ...prev,
                              [question.id]: question.imageUrl ?? "",
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
                          const didUpdate = await handleUpdateQuestion(question, {
                            topicId: editedTopicId,
                            statement: editedStatement,
                            imageUrl: editedImageUrl || null,
                          });
                          if (didUpdate) {
                            setEditingQuestionId(null);
                          }
                        }}
                      >
                        <QuestionDetailsFormFields
                          prefix={`edit-question-${question.id}`}
                          topicId={editedTopicId}
                          statement={editedStatement}
                          imageUrl={editedImageUrl}
                          availableTopics={availableTopics}
                          disabled={busy}
                          uploadingImage={uploadingImage}
                          onTopicChange={(value) =>
                            setEditTopicIds((prev) => ({
                              ...prev,
                              [question.id]: value,
                            }))
                          }
                          onStatementChange={(value) =>
                            setEditStatements((prev) => ({
                              ...prev,
                              [question.id]: value,
                            }))
                          }
                          onImageUrlChange={(value) =>
                            setEditImageUrls((prev) => ({
                              ...prev,
                              [question.id]: value,
                            }))
                          }
                          onUploadImage={(file) => handleRowImageUpload(question.id, file)}
                        />
                        <Button
                          type="submit"
                          disabled={busy || uploadingImage || !hasChanges}
                        >
                          {busy ? "Guardando..." : "Guardar cambios"}
                        </Button>
                      </form>
                    </BaseModal>
                    <Button asChild type="button" variant="outline" disabled={busy || uploadingImage}>
                      <Link href={`/protected/admin/questions/${question.id}/options`}>
                        Gestionar opciones
                      </Link>
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
                      {question.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                  {!question.isBankReady && !question.isActive ? (
                    <p className="text-xs text-amber-600">
                      Para activar, esta pregunta necesita al menos 2 opciones activas y exactamente 1 opcion correcta activa.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron preguntas con los filtros actuales.
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
                onClick={() => loadQuestions(meta.page - 1, includeInactive)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={meta.page >= meta.totalPages || isLoadingList}
                onClick={() => loadQuestions(meta.page + 1, includeInactive)}
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

