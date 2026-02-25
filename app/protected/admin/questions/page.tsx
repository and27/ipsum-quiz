import { QuestionsManager } from "@/components/admin/questions-manager";
import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { listQuestions } from "@/lib/usecases/questions";
import { listTopics } from "@/lib/usecases/topics";
import { redirect } from "next/navigation";

export default async function AdminQuestionsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }

    redirect("/protected");
  }

  const [questions, topics] = await Promise.all([
    listQuestions({ page: 1, pageSize: 20, includeInactive: true }),
    listTopics({ includeInactive: false }),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Admin - Questions</h1>
        <p className="text-sm text-muted-foreground">
          Create, edit and activate/deactivate questions.
        </p>
      </div>

      <QuestionsManager
        initialQuestions={{
          items: questions.items,
          meta: {
            page: questions.page,
            pageSize: questions.pageSize,
            total: questions.total,
            totalPages: questions.totalPages,
          },
        }}
        availableTopics={topics}
      />
    </div>
  );
}

