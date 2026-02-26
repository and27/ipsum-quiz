import { getCurrentSessionContext } from "@/lib/usecases/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function HomePageContent() {
  const session = await getCurrentSessionContext();

  if (!session.userId) {
    redirect("/auth/login");
  }

  if (session.role === "admin") {
    redirect("/protected/admin/simulators");
  }

  if (session.role === "student") {
    redirect("/protected/student/simulators");
  }

  redirect("/auth/login");
  return null;
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
