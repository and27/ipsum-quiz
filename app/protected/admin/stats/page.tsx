import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { listSimulators } from "@/lib/usecases/simulators";
import { listTopics } from "@/lib/usecases/topics";
import { getAdminDashboardStats } from "@/lib/usecases/reports";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function parseCampus(value: string | undefined): "canar" | "azogues" | undefined {
  if (value === "canar" || value === "azogues") {
    return value;
  }
  return undefined;
}

async function AdminStatsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthGuardError && error.reason === "unauthenticated") {
      redirect("/auth/login");
    }
    redirect("/protected");
  }

  const params = await searchParams;
  const simulatorId = typeof params.simulatorId === "string" ? params.simulatorId : undefined;
  const topicId = typeof params.topicId === "string" ? params.topicId : undefined;
  const campus = parseCampus(typeof params.campus === "string" ? params.campus : undefined);
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : undefined;
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : undefined;

  const [dashboard, simulators, topics] = await Promise.all([
    getAdminDashboardStats({
      simulatorId,
      topicId,
      campus,
      dateFrom,
      dateTo,
    }),
    listSimulators({
      page: 1,
      pageSize: 200,
      includeInactive: true,
    }),
    listTopics({ includeInactive: false }),
  ]);
  const detailsQuery = new URLSearchParams();
  if (dateFrom) {
    detailsQuery.set("dateFrom", dateFrom);
  }
  if (dateTo) {
    detailsQuery.set("dateTo", dateTo);
  }
  if (campus) {
    detailsQuery.set("campus", campus);
  }
  if (simulatorId) {
    detailsQuery.set("simulatorId", simulatorId);
  }
  if (topicId) {
    detailsQuery.set("topicId", topicId);
  }
  const detailsQuerySuffix = detailsQuery.toString()
    ? `?${detailsQuery.toString()}`
    : "";

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Admin - Estadisticas</h1>
        <p className="text-sm text-muted-foreground">
          KPIs globales y resumen por simulador.
        </p>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
        <div className="space-y-1">
          <label htmlFor="date-from" className="text-xs font-medium text-muted-foreground">
            Desde
          </label>
          <input
            id="date-from"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="date-to" className="text-xs font-medium text-muted-foreground">
            Hasta
          </label>
          <input
            id="date-to"
            name="dateTo"
            type="date"
            defaultValue={dateTo}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="campus" className="text-xs font-medium text-muted-foreground">
            Sede
          </label>
          <select
            id="campus"
            name="campus"
            defaultValue={campus ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Todas</option>
            <option value="canar">Cañar</option>
            <option value="azogues">Azogues</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label htmlFor="simulator-id" className="text-xs font-medium text-muted-foreground">
            Simulador
          </label>
          <select
            id="simulator-id"
            name="simulatorId"
            defaultValue={simulatorId ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Todos</option>
            {simulators.items.map((simulator) => (
              <option key={simulator.id} value={simulator.id}>
                {simulator.title} ({simulator.campus === "canar" ? "Cañar" : "Azogues"})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="topic-id" className="text-xs font-medium text-muted-foreground">
            Tema
          </label>
          <select
            id="topic-id"
            name="topicId"
            defaultValue={topicId ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Todos</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-6 flex gap-2">
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Aplicar filtros
          </button>
          <a
            href="/protected/admin/stats"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Limpiar
          </a>
          <Link
            href={`/protected/admin/stats/students${detailsQuerySuffix}`}
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Ver estudiantes
          </Link>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Intentos</p>
          <p className="mt-2 text-2xl font-bold">{dashboard.kpis.attemptsTotal}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Promedio</p>
          <p className="mt-2 text-2xl font-bold">{dashboard.kpis.averageScorePercent}%</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Finalizados</p>
          <p className="mt-2 text-2xl font-bold">{dashboard.kpis.finishedCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expirados</p>
          <p className="mt-2 text-2xl font-bold">{dashboard.kpis.expiredCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Respuestas en blanco</p>
          <p className="mt-2 text-2xl font-bold">{dashboard.kpis.blankAnswersTotal}</p>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Resumen por simulador</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Simulador</th>
                <th className="px-4 py-2">Sede</th>
                <th className="px-4 py-2">Intentos</th>
                <th className="px-4 py-2">Finalizados</th>
                <th className="px-4 py-2">Expirados</th>
                <th className="px-4 py-2">Promedio</th>
                <th className="px-4 py-2">Blancos</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.rows.map((row) => (
                <tr key={row.simulatorId} className="border-t">
                  <td className="px-4 py-2">{row.simulatorTitle}</td>
                  <td className="px-4 py-2">{row.campus === "canar" ? "Cañar" : "Azogues"}</td>
                  <td className="px-4 py-2">{row.attempts}</td>
                  <td className="px-4 py-2">{row.finished}</td>
                  <td className="px-4 py-2">{row.expired}</td>
                  <td className="px-4 py-2">{row.averageScorePercent}%</td>
                  <td className="px-4 py-2">{row.blankAnswersTotal}</td>
                </tr>
              ))}
              {dashboard.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    No hay datos para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">General por categorias (temas)</h2>
        </div>
        <div className="space-y-2 p-4">
          {dashboard.topicRows.map((topic) => (
            <p key={topic.topicId} className="text-sm text-muted-foreground">
              {topic.topicName}: {topic.correctCount}/{topic.totalCount} ({topic.averageScorePercent}%)
            </p>
          ))}
          {dashboard.topicRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay datos por tema para los filtros seleccionados.
            </p>
          ) : null}
        </div>
      </div>

    </div>
  );
}

export default function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <AdminStatsContent searchParams={searchParams} />
    </Suspense>
  );
}
