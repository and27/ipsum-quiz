import { redirect } from "next/navigation";

import { InfoIcon } from "lucide-react";
import { FetchDataSteps } from "@/components/tutorial/fetch-data-steps";
import { Suspense } from "react";
import { getCurrentSessionContext } from "@/lib/usecases/auth";
import Link from "next/link";

async function UserDetails() {
  const session = await getCurrentSessionContext();
  if (!session.userId) {
    redirect("/auth/login");
  }

  return JSON.stringify(
    {
      userId: session.userId,
      email: session.email,
      role: session.role,
    },
    null,
    2,
  );
}

async function AdminQuickLinks() {
  const session = await getCurrentSessionContext();
  if (session.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Link
        href="/protected/admin/topics"
        className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
      >
        Manage topics
      </Link>
      <Link
        href="/protected/admin/questions"
        className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
      >
        Manage questions
      </Link>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="w-full">
        <div className="bg-accent text-sm p-3 px-5 rounded-md text-foreground flex gap-3 items-center">
          <InfoIcon size="16" strokeWidth={2} />
          This is a protected page that you can only see as an authenticated
          user
        </div>
      </div>
      <div className="flex flex-col gap-2 items-start">
        <h2 className="font-bold text-2xl mb-4">Your user details</h2>
        <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">
          <Suspense>
            <UserDetails />
          </Suspense>
        </pre>
      </div>
      <Suspense>
        <AdminQuickLinks />
      </Suspense>
      <div>
        <h2 className="font-bold text-2xl mb-4">Next steps</h2>
        <FetchDataSteps />
      </div>
    </div>
  );
}
