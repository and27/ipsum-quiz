import { getCurrentSessionContext } from "@/lib/usecases/auth";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
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
}

