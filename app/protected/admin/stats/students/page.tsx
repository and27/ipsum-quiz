import { AuthGuardError, requireAdmin } from "@/lib/usecases/auth";
import { getAdminDashboardStats } from "@/lib/usecases/reports";
import { listSimulators } from "@/lib/usecases/simulators";
import { listTopics } from "@/lib/usecases/topics";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

function parseCampus(value: string | undefined): "canar" | "azogues" | undefined {
  if (value === "canar" || value === "azogues") {
    return value;
  }
  return undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.trunc(parsed));
}

async function AdminStatsStudentsContent({
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
  const page = parsePositiveInt(
    typeof params.page === "string" ? params.page : undefined,
    1,
  );
  const pageSize = parsePositiveInt(
    typeof params.pageSize === "string" ? params.pageSize : undefined,
    20,
  );

  const dashboard = await getAdminDashboardStats({
    simulatorId,
    topicId,
    campus,
    dateFrom,
    dateTo,
  });
  const [simulators, topics] = await Promise.all([
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

  const totalStudents = dashboard.studentRows.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;
  const pagedStudentRows = dashboard.studentRows.slice(from, to);

  const prevQuery = new URLSearchParams(detailsQuery);
  prevQuery.set("page", String(Math.max(1, safePage - 1)));
  prevQuery.set("pageSize", String(pageSize));
  const nextQuery = new URLSearchParams(detailsQuery);
  nextQuery.set("page", String(Math.min(totalPages, safePage + 1)));
  nextQuery.set("pageSize", String(pageSize));

  const detailsQuerySuffix = detailsQuery.toString()
    ? `?${detailsQuery.toString()}`
    : "";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin - Estudiantes</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de resultados por estudiante.
          </p>
        </div>
        <Link href={`/protected/admin/stats${detailsQuerySuffix}`} className="text-sm underline">
          Volver a resumen
        </Link>
      </div>

      <form className="grid gap-3 rounded-lg border p-4 md:grid-cols-6">
        <div className="space-y-1">
          <label htmlFor="students-date-from" className="text-xs font-medium text-muted-foreground">
            Desde
          </label>
          <input
            id="students-date-from"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="students-date-to" className="text-xs font-medium text-muted-foreground">
            Hasta
          </label>
          <input
            id="students-date-to"
            name="dateTo"
            type="date"
            defaultValue={dateTo}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="students-campus" className="text-xs font-medium text-muted-foreground">
            Sede
          </label>
          <select
            id="students-campus"
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
          <label htmlFor="students-simulator-id" className="text-xs font-medium text-muted-foreground">
            Simulador
          </label>
          <select
            id="students-simulator-id"
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
          <label htmlFor="students-topic-id" className="text-xs font-medium text-muted-foreground">
            Tema
          </label>
          <select
            id="students-topic-id"
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
            href="/protected/admin/stats/students"
            className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            Limpiar
          </a>
        </div>
      </form>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-base font-semibold">Resumen por estudiante</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Estudiante</th>
                <th className="px-4 py-2">Intentos</th>
                <th className="px-4 py-2">Finalizados</th>
                <th className="px-4 py-2">Expirados</th>
                <th className="px-4 py-2">Promedio</th>
                <th className="px-4 py-2">Blancos</th>
                <th className="px-4 py-2">Ultimo intento</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pagedStudentRows.map((row) => (
                <tr key={row.studentId} className="border-t">
                  <td className="px-4 py-2">{row.studentName}</td>
                  <td className="px-4 py-2">{row.attempts}</td>
                  <td className="px-4 py-2">{row.finished}</td>
                  <td className="px-4 py-2">{row.expired}</td>
                  <td className="px-4 py-2">{row.averageScorePercent}%</td>
                  <td className="px-4 py-2">{row.blankAnswersTotal}</td>
                  <td className="px-4 py-2">
                    {row.latestAttemptAt ? new Date(row.latestAttemptAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      className="underline"
                      href={`/protected/admin/stats/students/${row.studentId}${detailsQuerySuffix}`}
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
              {pagedStudentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    No hay datos de estudiantes para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <p className="text-xs text-muted-foreground">
            Pagina {safePage} de {totalPages} ({totalStudents} estudiantes)
          </p>
          <div className="flex gap-2">
            <Link
              href={`/protected/admin/stats/students?${prevQuery.toString()}`}
              className={`inline-flex h-9 items-center rounded-md border px-4 text-sm ${
                safePage <= 1 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Anterior
            </Link>
            <Link
              href={`/protected/admin/stats/students?${nextQuery.toString()}`}
              className={`inline-flex h-9 items-center rounded-md border px-4 text-sm ${
                safePage >= totalPages ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Siguiente
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminStatsStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
      <AdminStatsStudentsContent searchParams={searchParams} />
    </Suspense>
  );
}
