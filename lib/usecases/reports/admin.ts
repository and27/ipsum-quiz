import type {
  AdminStudentExportData,
  AdminDashboardFilters,
  AdminDashboardKpis,
  AdminDashboardResponse,
  AdminDashboardSimulatorRow,
  AdminDashboardStudentRow,
  AdminDashboardTopicRow,
  AdminStudentAttemptRow,
  AdminStudentDetailResponse,
  AdminStudentTopicSummary,
} from "@/lib/domain/contracts";
import { createClient } from "@/lib/supabase/server";

interface RawAttemptWithSimulatorRow {
  id: string;
  student_id: string;
  simulator_id: string;
  status: "active" | "finished" | "expired";
  score_total: number | null;
  questions_total: number;
  blank_count: number | null;
  started_at: string;
  finished_at: string | null;
  expires_at: string;
  simulators:
    | {
        id?: unknown;
        title?: unknown;
        campus?: unknown;
      }
    | Array<{
        id?: unknown;
        title?: unknown;
        campus?: unknown;
      }>
    | null;
}

interface RawProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface RawAttemptTopicScoreRow {
  attempt_id: string;
  topic_id: string;
  correct_count: number;
  blank_count: number | null;
  total_count: number;
  topics:
    | {
        name?: unknown;
      }
    | Array<{
        name?: unknown;
      }>
    | null;
}

function parseDateStartIso(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function parseDateEndIso(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

function toRoundedPercent(score: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((score / total) * 1000) / 10;
}

function getSimulatorMeta(row: RawAttemptWithSimulatorRow): {
  id: string;
  title: string;
  campus: "canar" | "azogues";
} | null {
  const simulator = Array.isArray(row.simulators) ? row.simulators[0] : row.simulators;
  if (!simulator || typeof simulator.id !== "string" || typeof simulator.title !== "string") {
    return null;
  }

  return {
    id: simulator.id,
    title: simulator.title,
    campus: simulator.campus === "azogues" ? "azogues" : "canar",
  };
}

function extractTopicName(
  topics: RawAttemptTopicScoreRow["topics"],
  fallbackTopicId: string,
): string {
  if (!topics) {
    return fallbackTopicId;
  }
  if (Array.isArray(topics)) {
    const candidate = topics[0]?.name;
    return typeof candidate === "string" ? candidate : fallbackTopicId;
  }
  return typeof topics.name === "string" ? topics.name : fallbackTopicId;
}

async function loadAttemptsWithFilters(filters: AdminDashboardFilters): Promise<RawAttemptWithSimulatorRow[]> {
  const supabase = await createClient();
  const dateFromIso = parseDateStartIso(filters.dateFrom);
  const dateToIso = parseDateEndIso(filters.dateTo);

  let query = supabase
    .from("attempts")
    .select(
      "id, student_id, simulator_id, status, score_total, questions_total, blank_count, started_at, finished_at, expires_at, simulators!inner(id, title, campus)",
    )
    .in("status", ["finished", "expired"])
    .order("started_at", { ascending: false });

  if (filters.simulatorId) {
    query = query.eq("simulator_id", filters.simulatorId);
  }
  if (filters.campus) {
    query = query.eq("simulators.campus", filters.campus);
  }
  if (dateFromIso) {
    query = query.gte("started_at", dateFromIso);
  }
  if (dateToIso) {
    query = query.lte("started_at", dateToIso);
  }

  if (filters.topicId) {
    const { data: attemptTopicRows, error: attemptTopicError } = await supabase
      .from("attempt_topic_scores")
      .select("attempt_id")
      .eq("topic_id", filters.topicId);

    if (attemptTopicError) {
      throw new Error(attemptTopicError.message);
    }

    const attemptIds = (attemptTopicRows ?? [])
      .map((row) => row.attempt_id)
      .filter((id): id is string => typeof id === "string");

    if (attemptIds.length === 0) {
      return [];
    }
    query = query.in("id", attemptIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RawAttemptWithSimulatorRow[];
}

async function loadStudentLabels(studentIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  if (studentIds.length === 0) {
    return labels;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", studentIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as RawProfileRow[]) {
    const fullName = row.full_name?.trim() ?? "";
    const email = row.email?.trim() ?? "";
    labels.set(row.id, fullName || email || row.id.slice(0, 8));
  }

  return labels;
}

export async function getAdminDashboardStats(
  filters: AdminDashboardFilters,
): Promise<AdminDashboardResponse> {
  const rows = await loadAttemptsWithFilters(filters);
  const supabase = await createClient();
  const bySimulator = new Map<string, {
    simulatorId: string;
    simulatorTitle: string;
    campus: "canar" | "azogues";
    attempts: number;
    finished: number;
    expired: number;
    scoreSum: number;
    questionsSum: number;
    blankAnswersTotal: number;
  }>();
  const byStudent = new Map<string, {
    studentId: string;
    attempts: number;
    finished: number;
    expired: number;
    scoreSum: number;
    questionsSum: number;
    blankAnswersTotal: number;
    latestAttemptAt: string | null;
  }>();
  const topicSummaryMap = new Map<string, AdminDashboardTopicRow>();

  let attemptsTotal = 0;
  let finishedCount = 0;
  let expiredCount = 0;
  let scoreSum = 0;
  let questionsSum = 0;
  let blankAnswersTotal = 0;

  for (const row of rows) {
    const simulator = getSimulatorMeta(row);
    if (!simulator) {
      continue;
    }

    attemptsTotal += 1;
    if (row.status === "finished") {
      finishedCount += 1;
    }
    if (row.status === "expired") {
      expiredCount += 1;
    }

    const safeScore = typeof row.score_total === "number" ? row.score_total : 0;
    const safeQuestions = typeof row.questions_total === "number" ? row.questions_total : 0;
    const safeBlank =
      typeof row.blank_count === "number"
        ? row.blank_count
        : Math.max(safeQuestions - safeScore, 0);

    scoreSum += safeScore;
    questionsSum += safeQuestions;
    blankAnswersTotal += safeBlank;

    const current = bySimulator.get(simulator.id) ?? {
      simulatorId: simulator.id,
      simulatorTitle: simulator.title,
      campus: simulator.campus,
      attempts: 0,
      finished: 0,
      expired: 0,
      scoreSum: 0,
      questionsSum: 0,
      blankAnswersTotal: 0,
    };

    current.attempts += 1;
    if (row.status === "finished") {
      current.finished += 1;
    }
    if (row.status === "expired") {
      current.expired += 1;
    }
    current.scoreSum += safeScore;
    current.questionsSum += safeQuestions;
    current.blankAnswersTotal += safeBlank;

    bySimulator.set(simulator.id, current);

    const currentStudent = byStudent.get(row.student_id) ?? {
      studentId: row.student_id,
      attempts: 0,
      finished: 0,
      expired: 0,
      scoreSum: 0,
      questionsSum: 0,
      blankAnswersTotal: 0,
      latestAttemptAt: null,
    };
    currentStudent.attempts += 1;
    if (row.status === "finished") {
      currentStudent.finished += 1;
    }
    if (row.status === "expired") {
      currentStudent.expired += 1;
    }
    currentStudent.scoreSum += safeScore;
    currentStudent.questionsSum += safeQuestions;
    currentStudent.blankAnswersTotal += safeBlank;
    if (!currentStudent.latestAttemptAt || row.started_at > currentStudent.latestAttemptAt) {
      currentStudent.latestAttemptAt = row.started_at;
    }
    byStudent.set(row.student_id, currentStudent);
  }

  const simulatorRows: AdminDashboardSimulatorRow[] = Array.from(bySimulator.values())
    .map((row) => ({
      simulatorId: row.simulatorId,
      simulatorTitle: row.simulatorTitle,
      campus: row.campus,
      attempts: row.attempts,
      finished: row.finished,
      expired: row.expired,
      averageScorePercent: toRoundedPercent(row.scoreSum, row.questionsSum),
      blankAnswersTotal: row.blankAnswersTotal,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const kpis: AdminDashboardKpis = {
    attemptsTotal,
    finishedCount,
    expiredCount,
    averageScorePercent: toRoundedPercent(scoreSum, questionsSum),
    blankAnswersTotal,
  };

  const studentNames = await loadStudentLabels(Array.from(byStudent.keys()));
  const studentRows: AdminDashboardStudentRow[] = Array.from(byStudent.values())
    .map((row) => ({
      studentId: row.studentId,
      studentName: studentNames.get(row.studentId) ?? row.studentId.slice(0, 8),
      attempts: row.attempts,
      finished: row.finished,
      expired: row.expired,
      averageScorePercent: toRoundedPercent(row.scoreSum, row.questionsSum),
      blankAnswersTotal: row.blankAnswersTotal,
      latestAttemptAt: row.latestAttemptAt,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const attemptIds = rows.map((row) => row.id);
  if (attemptIds.length > 0) {
    const { data: topicRows, error: topicRowsError } = await supabase
      .from("attempt_topic_scores")
      .select("attempt_id, topic_id, correct_count, blank_count, total_count, topics(name)")
      .in("attempt_id", attemptIds);

    if (topicRowsError) {
      throw new Error(topicRowsError.message);
    }

    for (const row of (topicRows ?? []) as RawAttemptTopicScoreRow[]) {
      if (
        typeof row.topic_id !== "string" ||
        typeof row.correct_count !== "number" ||
        typeof row.total_count !== "number"
      ) {
        continue;
      }
      const current = topicSummaryMap.get(row.topic_id) ?? {
        topicId: row.topic_id,
        topicName: extractTopicName(row.topics, row.topic_id),
        correctCount: 0,
        blankCount: 0,
        totalCount: 0,
        averageScorePercent: 0,
      };

      current.correctCount += row.correct_count;
      current.blankCount += typeof row.blank_count === "number" ? row.blank_count : 0;
      current.totalCount += row.total_count;
      current.averageScorePercent = toRoundedPercent(current.correctCount, current.totalCount);

      topicSummaryMap.set(row.topic_id, current);
    }
  }

  return {
    filters,
    kpis,
    rows: simulatorRows,
    studentRows,
    topicRows: Array.from(topicSummaryMap.values()).sort(
      (a, b) => b.totalCount - a.totalCount,
    ),
  };
}

export async function getAdminStudentDetail(
  studentId: string,
  filters: AdminDashboardFilters,
): Promise<AdminStudentDetailResponse> {
  const rows = (await loadAttemptsWithFilters(filters)).filter(
    (row) => row.student_id === studentId,
  );
  const studentNames = await loadStudentLabels([studentId]);
  const studentName = studentNames.get(studentId) ?? studentId.slice(0, 8);

  let scoreSum = 0;
  let questionsSum = 0;
  let blankAnswersTotal = 0;
  const attempts: AdminStudentAttemptRow[] = [];

  for (const row of rows) {
    const simulator = getSimulatorMeta(row);
    if (!simulator) {
      continue;
    }
    const safeScore = typeof row.score_total === "number" ? row.score_total : 0;
    const safeQuestions = typeof row.questions_total === "number" ? row.questions_total : 0;
    const safeBlank =
      typeof row.blank_count === "number"
        ? row.blank_count
        : Math.max(safeQuestions - safeScore, 0);

    scoreSum += safeScore;
    questionsSum += safeQuestions;
    blankAnswersTotal += safeBlank;

    attempts.push({
      attemptId: row.id,
      simulatorId: simulator.id,
      simulatorTitle: simulator.title,
      campus: simulator.campus,
      status: row.status === "expired" ? "expired" : "finished",
      startedAt: row.started_at,
      scoreTotal: safeScore,
      blankCount: safeBlank,
      questionsTotal: safeQuestions,
    });
  }

  attempts.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  const supabase = await createClient();
  const attemptIds = attempts.map((item) => item.attemptId);
  const topicSummaryMap = new Map<string, AdminStudentTopicSummary>();
  if (attemptIds.length > 0) {
    const { data, error } = await supabase
      .from("attempt_topic_scores")
      .select("attempt_id, topic_id, correct_count, blank_count, total_count, topics(name)")
      .in("attempt_id", attemptIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as RawAttemptTopicScoreRow[]) {
      if (
        typeof row.topic_id !== "string" ||
        typeof row.correct_count !== "number" ||
        typeof row.total_count !== "number"
      ) {
        continue;
      }
      const current = topicSummaryMap.get(row.topic_id) ?? {
        topicId: row.topic_id,
        topicName: extractTopicName(row.topics, row.topic_id),
        correctCount: 0,
        blankCount: 0,
        totalCount: 0,
      };
      current.correctCount += row.correct_count;
      current.blankCount += typeof row.blank_count === "number" ? row.blank_count : 0;
      current.totalCount += row.total_count;
      topicSummaryMap.set(row.topic_id, current);
    }
  }

  return {
    studentId,
    studentName,
    filters,
    attemptsTotal: attempts.length,
    averageScorePercent: toRoundedPercent(scoreSum, questionsSum),
    blankAnswersTotal,
    attempts,
    topicSummary: Array.from(topicSummaryMap.values()).sort((a, b) =>
      a.topicName.localeCompare(b.topicName),
    ),
  };
}

function getElapsedSeconds(row: RawAttemptWithSimulatorRow): number {
  const startedAt = Date.parse(row.started_at);
  const endedAt = Date.parse(row.finished_at ?? row.expires_at);

  if (Number.isNaN(startedAt) || Number.isNaN(endedAt)) {
    return 0;
  }

  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

export async function getAdminStudentExportData(
  filters: AdminDashboardFilters,
): Promise<AdminStudentExportData> {
  const rows = await loadAttemptsWithFilters(filters);
  const studentNames = await loadStudentLabels(
    Array.from(new Set(rows.map((row) => row.student_id))),
  );

  const attemptsById = new Map<string, RawAttemptWithSimulatorRow>();
  const byStudent = new Map<
    string,
    {
      studentId: string;
      attempts: number;
      finished: number;
      expired: number;
      scoreSum: number;
      questionsSum: number;
      blankAnswersTotal: number;
      elapsedSecondsSum: number;
      latestAttemptAt: string | null;
      topicBreakdown: Map<
        string,
        {
          topicId: string;
          topicName: string;
          correctCount: number;
          totalCount: number;
        }
      >;
    }
  >();

  for (const row of rows) {
    attemptsById.set(row.id, row);
    const safeScore = typeof row.score_total === "number" ? row.score_total : 0;
    const safeQuestions = typeof row.questions_total === "number" ? row.questions_total : 0;
    const safeBlank =
      typeof row.blank_count === "number"
        ? row.blank_count
        : Math.max(safeQuestions - safeScore, 0);

    const current = byStudent.get(row.student_id) ?? {
      studentId: row.student_id,
      attempts: 0,
      finished: 0,
      expired: 0,
      scoreSum: 0,
      questionsSum: 0,
      blankAnswersTotal: 0,
      elapsedSecondsSum: 0,
      latestAttemptAt: null,
      topicBreakdown: new Map(),
    };

    current.attempts += 1;
    if (row.status === "finished") {
      current.finished += 1;
    }
    if (row.status === "expired") {
      current.expired += 1;
    }
    current.scoreSum += safeScore;
    current.questionsSum += safeQuestions;
    current.blankAnswersTotal += safeBlank;
    current.elapsedSecondsSum += getElapsedSeconds(row);
    if (!current.latestAttemptAt || row.started_at > current.latestAttemptAt) {
      current.latestAttemptAt = row.started_at;
    }

    byStudent.set(row.student_id, current);
  }

  const topicColumnMap = new Map<string, { topicId: string; topicName: string }>();
  const attemptIds = Array.from(attemptsById.keys());
  if (attemptIds.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("attempt_topic_scores")
      .select("attempt_id, topic_id, correct_count, blank_count, total_count, topics(name)")
      .in("attempt_id", attemptIds);

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as RawAttemptTopicScoreRow[]) {
      const attempt = attemptsById.get(row.attempt_id);
      if (
        !attempt ||
        typeof row.topic_id !== "string" ||
        typeof row.correct_count !== "number" ||
        typeof row.total_count !== "number"
      ) {
        continue;
      }

      const student = byStudent.get(attempt.student_id);
      if (!student) {
        continue;
      }

      const topicName = extractTopicName(row.topics, row.topic_id);
      topicColumnMap.set(row.topic_id, { topicId: row.topic_id, topicName });

      const currentTopic = student.topicBreakdown.get(row.topic_id) ?? {
        topicId: row.topic_id,
        topicName,
        correctCount: 0,
        totalCount: 0,
      };
      currentTopic.correctCount += row.correct_count;
      currentTopic.totalCount += row.total_count;
      student.topicBreakdown.set(row.topic_id, currentTopic);
    }
  }

  const topicColumns = Array.from(topicColumnMap.values()).sort((a, b) =>
    a.topicName.localeCompare(b.topicName),
  );

  const exportRows = Array.from(byStudent.values())
    .map((row) => ({
      studentId: row.studentId,
      studentName: studentNames.get(row.studentId) ?? row.studentId.slice(0, 8),
      attempts: row.attempts,
      finished: row.finished,
      expired: row.expired,
      averageScorePercent: toRoundedPercent(row.scoreSum, row.questionsSum),
      totalCorrectAnswers: row.scoreSum,
      totalQuestions: row.questionsSum,
      averageElapsedMinutes:
        row.attempts > 0
          ? Math.round((row.elapsedSecondsSum / row.attempts / 60) * 10) / 10
          : 0,
      blankAnswersTotal: row.blankAnswersTotal,
      latestAttemptAt: row.latestAttemptAt,
      topicBreakdown: Object.fromEntries(
        Array.from(row.topicBreakdown.entries()).map(([topicId, topic]) => [
          topicId,
          {
            correctCount: topic.correctCount,
            totalCount: topic.totalCount,
          },
        ]),
      ),
    }))
    .sort((a, b) => b.averageScorePercent - a.averageScorePercent);

  return {
    filters,
    topicColumns,
    rows: exportRows,
  };
}
