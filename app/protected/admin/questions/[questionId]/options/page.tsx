import { QuestionOptionsManager } from "@/components/admin/question-options-manager";
import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { listQuestionOptions } from "@/lib/usecases/question-options";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function AdminQuestionOptionsContent({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const { questionId } = await params;
  if (!questionId) {
    redirect("/protected/admin/questions");
  }

  const supabase = await createClient();
  const { data: questionRow } = await supabase
    .from("questions")
    .select("id, statement")
    .eq("id", questionId)
    .maybeSingle();

  if (!questionRow) {
    redirect("/protected/admin/questions");
  }

  const options = await listQuestionOptions(questionId, true);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Admin - Question Options</h1>
        <p className="text-sm text-muted-foreground">
          Configure options for this question.
        </p>
        <p className="mt-2 rounded border p-3 text-sm">
          {questionRow.statement}
        </p>
      </div>

      <QuestionOptionsManager questionId={questionId} initialOptions={options} />
    </div>
  );
}

export default function AdminQuestionOptionsPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
      <AdminQuestionOptionsContent params={params} />
    </Suspense>
  );
}
