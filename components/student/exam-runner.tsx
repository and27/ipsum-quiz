"use client";

import type { StudentExamStateResponse } from "@/lib/domain/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";

interface StudentExamRunnerProps {
  initialState: StudentExamStateResponse;
}

interface ApiErrorResponse {
  error?: string;
}

function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

export function StudentExamRunner({ initialState }: StudentExamRunnerProps) {
  const [questions, setQuestions] = useState(initialState.questions);
  const [currentIndex, setCurrentIndex] = useState(initialState.currentQuestionIndex);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.parse(initialState.expiresAt) - Date.now()) / 1000)),
  );

  useEffect(() => {
    const timerId = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const isExpired = remainingSeconds <= 0;
  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(
    () => questions.filter((question) => question.selectedOptionId !== null).length,
    [questions],
  );

  async function saveAnswer(questionId: string, selectedOptionId: string | null) {
    setErrorMessage(null);
    setSavingQuestionId(questionId);
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

      setQuestions((prev) =>
        prev.map((question) =>
          question.id === questionId ? { ...question, selectedOptionId } : question,
        ),
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save answer.",
      );
    } finally {
      setSavingQuestionId(null);
    }
  }

  if (!currentQuestion) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No questions available for this attempt.
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
          {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
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
                  disabled={isExpired || savingQuestionId === currentQuestion.id}
                >
                  {option.position}. {option.text}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => saveAnswer(currentQuestion.id, null)}
              disabled={
                isExpired ||
                savingQuestionId === currentQuestion.id ||
                currentQuestion.selectedOptionId === null
              }
            >
              Limpiar respuesta
            </Button>
            <Button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))}
              disabled={isExpired || currentIndex >= questions.length - 1}
            >
              Siguiente
            </Button>
          </div>
          {currentIndex >= questions.length - 1 ? (
            <p className="text-xs text-muted-foreground">
              Ultima pregunta. La finalizacion manual se implementa en el siguiente ticket.
            </p>
          ) : null}
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
          <p className="text-xs text-muted-foreground">
            Este tablero no permite navegar hacia atras.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

