"use client";

import type {
  FinishAttemptQuestionResult,
  StudentExamStateResponse,
} from "@/lib/domain/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useRef, useState } from "react";

interface StudentExamRunnerProps {
  initialState: StudentExamStateResponse;
}

interface ApiErrorResponse {
  error?: string;
}

function getOptionLabel(position: number): string {
  const normalized = Math.max(1, Math.trunc(position));
  return String.fromCharCode(96 + normalized);
}

function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPercent(score: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }
  return `${Math.round((score / total) * 100)}%`;
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

export function StudentExamRunner({ initialState }: StudentExamRunnerProps) {
  const [questions, setQuestions] = useState(initialState.questions);
  const [currentIndex, setCurrentIndex] = useState(
    initialState.currentQuestionIndex,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(
      0,
      Math.floor((Date.parse(initialState.expiresAt) - Date.now()) / 1000),
    ),
  );
  const [isFinishing, setIsFinishing] = useState(false);
  const saveRequestVersionRef = useRef<Record<string, number>>({});
  const [finishResult, setFinishResult] = useState<{
    scoreTotal: number;
    blankCount: number;
    incorrectCount: number;
    questionsTotal: number;
    topicScores: Array<{
      topicName: string;
      correctCount: number;
      blankCount: number;
      totalCount: number;
    }>;
    questionResults: FinishAttemptQuestionResult[];
  } | null>(null);

  useEffect(() => {
    const timerId = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const isExpired = remainingSeconds <= 0;
  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => question.selectedOptionId !== null).length,
    [questions],
  );

  async function saveAnswer(
    questionId: string,
    selectedOptionId: string | null,
  ) {
    setErrorMessage(null);
    const previousSelectedOptionId =
      questions.find((question) => question.id === questionId)
        ?.selectedOptionId ?? null;
    const requestVersion = (saveRequestVersionRef.current[questionId] ?? 0) + 1;
    saveRequestVersionRef.current[questionId] = requestVersion;

    // Optimistic UI: reflect selection instantly.
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId
          ? { ...question, selectedOptionId }
          : question,
      ),
    );
    try {
      await parseApiResponse(
        await fetch(`/api/student/attempts/${initialState.attemptId}/answers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            simulatorVersionQuestionId: questionId,
            selectedOptionId,
          }),
        }),
      );
    } catch (error: unknown) {
      if (saveRequestVersionRef.current[questionId] === requestVersion) {
        setQuestions((prev) =>
          prev.map((question) =>
            question.id === questionId
              ? { ...question, selectedOptionId: previousSelectedOptionId }
              : question,
          ),
        );
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la respuesta.",
      );
    }
  }

  async function finishAttempt() {
    setErrorMessage(null);
    setIsFinishing(true);
    try {
      const payload = await parseApiResponse<{
        scoreTotal: number;
        blankCount: number;
        incorrectCount: number;
        questionsTotal: number;
        topicScores: Array<{
          topicName: string;
          correctCount: number;
          blankCount: number;
          totalCount: number;
        }>;
        questionResults: FinishAttemptQuestionResult[];
      }>(
        await fetch(`/api/student/attempts/${initialState.attemptId}/finish`, {
          method: "POST",
        }),
      );
      setFinishResult(payload);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo finalizar el intento.",
      );
    } finally {
      setIsFinishing(false);
    }
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No hay preguntas disponibles para este intento.
        </CardContent>
      </Card>
    );
  }

  if (finishResult) {
    const scorePercent = formatPercent(
      finishResult.scoreTotal,
      finishResult.questionsTotal,
    );
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-2xl">Resultado final</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-primary/5 p-6 text-center">
            <p className="text-sm text-muted-foreground">Tu puntaje</p>
            <p className="mt-1 text-4xl font-bold">
              {finishResult.scoreTotal}/{finishResult.questionsTotal}
            </p>
            <p className="mt-2 text-xl font-semibold text-primary">{scorePercent}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Correctas: {finishResult.scoreTotal} | Incorrectas: {finishResult.incorrectCount} | En blanco: {finishResult.blankCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Desglose por tema</p>
            {finishResult.topicScores.map((topic) => (
              <p
                key={topic.topicName}
                className="text-sm text-muted-foreground"
              >
                {topic.topicName}: {topic.correctCount}/{topic.totalCount}
              </p>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Revision pregunta por pregunta</p>
            <div className="space-y-2">
              {finishResult.questionResults.map((item) => (
                <div
                  key={item.simulatorVersionQuestionId}
                  className="rounded-md border p-3"
                >
                  <p className="text-xs text-muted-foreground">
                    Pregunta {item.position} | Tema: {item.topicName}
                  </p>
                  <p className="mt-1 text-sm font-medium">{item.statement}</p>
                  <p className="mt-2 text-sm">
                    Tu respuesta:{" "}
                    <span className="font-medium">
                      {item.selectedOptionText ?? "Sin responder"}
                    </span>
                  </p>
                  <p className="text-sm">
                    Correcta:{" "}
                    <span className="font-medium">
                      {item.correctOptionText ?? "No disponible"}
                    </span>
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      item.isCorrect
                        ? "text-green-600"
                        : item.isBlank
                          ? "text-amber-600"
                          : "text-red-500"
                    }`}
                  >
                    {item.isCorrect ? "Correcta" : item.isBlank ? "En blanco" : "Incorrecta"}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={() =>
              (window.location.href = "/protected/student/simulators")
            }
          >
            Volver a simuladores
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              Pregunta {currentIndex + 1}/{questions.length}
            </Badge>
            <Badge variant="outline">Tema: {currentQuestion.topicName}</Badge>
            <Badge variant={isExpired ? "destructive" : "secondary"}>
              Tiempo: {formatRemainingTime(remainingSeconds)}
            </Badge>
          </div>
          <CardTitle className="text-xl">{currentQuestion.statement}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? (
            <p className="text-sm text-red-500">{errorMessage}</p>
          ) : null}
          {currentQuestion.imageUrl ? (
            <img
              src={currentQuestion.imageUrl}
              alt="Imagen de la pregunta"
              className="max-h-80 w-full rounded-md border object-contain"
            />
          ) : null}
          <div className="space-y-2">
            {currentQuestion.options.map((option) => {
              const isSelected = currentQuestion.selectedOptionId === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => saveAnswer(currentQuestion.id, option.id)}
                  disabled={isExpired}
                >
                  <span className="block">
                    {getOptionLabel(option.position)}. {option.text}
                  </span>
                  {option.imageUrl ? (
                    <img
                      src={option.imageUrl}
                      alt={`Imagen de la opcion ${getOptionLabel(option.position)}`}
                      className="mt-2 max-h-48 w-full rounded border object-contain"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveAnswer(currentQuestion.id, null)}
              disabled={isExpired || currentQuestion.selectedOptionId === null}
            >
              Limpiar respuesta
            </Button>
            <Button
              type="button"
              onClick={() =>
                setCurrentIndex((prev) =>
                  Math.min(prev + 1, questions.length - 1),
                )
              }
              disabled={isExpired || currentIndex >= questions.length - 1}
            >
              Siguiente
            </Button>
            {currentIndex === questions.length - 1 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={finishAttempt}
                disabled={isExpired || isFinishing}
              >
                {isFinishing ? "Finalizando..." : "Finalizar intento"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progreso (informativo)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Respondidas: {answeredCount}/{questions.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {questions.map((question, index) => {
              const isCurrent = index === currentIndex;
              const isAnswered = question.selectedOptionId !== null;
              return (
                <span
                  key={question.id}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    isCurrent
                      ? "border-primary bg-primary/10"
                      : isAnswered
                        ? "border-green-600 bg-green-50"
                        : "border-border"
                  }`}
                >
                  {index + 1}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
