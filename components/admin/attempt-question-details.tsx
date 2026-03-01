"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface AttemptQuestionDetailsProps {
  questionCount: number;
  children: React.ReactNode;
}

export function AttemptQuestionDetails({
  questionCount,
  children,
}: AttemptQuestionDetailsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>Ver preguntas ({questionCount})</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen ? <div className="space-y-2 border-t p-4">{children}</div> : null}
    </div>
  );
}
