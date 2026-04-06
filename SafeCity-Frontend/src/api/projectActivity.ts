import { get, post, put, del } from "./client";
import type {
  ProjectActivity,
  ProjectActivityCreateInput,
  ProjectActivityUpdateInput,
} from "./types";

const CREATE_PATH = "create-project-activity/";
const LIST_PATH = "list-project/";
const UPDATE_PATH = "update-project-activity/";
const DELETE_PATH = "delete-project-activity/";

export async function listProjectActivities(
  projectId?: number,
): Promise<ProjectActivity[]> {
  // backend expects the "project" query parameter on the simple
  // /api/gantt-data/ or /api/list-project-activity/ route (see
  // ListProjectActivityView.list()).
  const params = projectId != null ? { project: String(projectId) } : undefined;
  const data = await get<ProjectActivity[] | ProjectActivity[]>(LIST_PATH, params);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return [];
}

export async function createProjectActivity(
  payload: ProjectActivityCreateInput,
): Promise<ProjectActivity> {
  // backend accepts all fields as plain body
  return post<ProjectActivity>(CREATE_PATH, payload as any);
}

export async function updateProjectActivity(
  id: number,
  payload: ProjectActivityUpdateInput,
): Promise<ProjectActivity> {
  return put<ProjectActivity>(`${UPDATE_PATH}${id}/`, payload as any);
}

export async function deleteProjectActivity(id: number): Promise<void> {
  await del(`${DELETE_PATH}${id}/`);
}

export interface GanttTask {
  id: string;
  activity_id?: string;
  /** Database id of ProjectActivity (required for update-task-actual). */
  db_id?: number;
  label: string;
  /** Duration from nested gantt API (usually in days). */
  duration?: number;
  start: string | null;
  end: string | null;
  /** Actual start date from backend (YYYY-MM-DD). */
  actual_start?: string | null;
  /** Actual end date from backend (YYYY-MM-DD). */
  actual_end?: string | null;
  progress: number;
  parent?: string;
  /** Stable ordering index to preserve API/XER sibling order. */
  order?: number;
  /** From nested gantt: true when a delay log exists for this activity. */
  has_delay?: boolean;
  /** From nested gantt: delay log summary when present. */
  delay_info?: unknown;
}

export interface GanttResponse {
  tasks: GanttTask[];
}

export async function getProjectGanttData(projectId: number): Promise<GanttTask[]> {
  if (!projectId) return [];

  // New API (nested): /api/project-gantt-nested/:id/
  // Old API (flat):   /api/project-gantt/:id/
  // We prefer the new nested endpoint, but keep a safe fallback.
  const data = await get<any>(`project-gantt-nested/${projectId}/`);

  const asDate = (v: any): string | null => {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? s : null;
  };

  const rollupRange = (node: any): { start: string | null; end: string | null } => {
    const ownStart = asDate(node?.start_date);
    const ownEnd = asDate(node?.end_date) ?? ownStart;
    const children: any[] = Array.isArray(node?.subtasks) ? node.subtasks : [];
    if (children.length === 0) return { start: ownStart, end: ownEnd };

    let minStart: number | null = ownStart ? new Date(ownStart).getTime() : null;
    let maxEnd: number | null = ownEnd ? new Date(ownEnd).getTime() : null;
    for (const c of children) {
      const r = rollupRange(c);
      const cs = r.start ? new Date(r.start).getTime() : null;
      const ce = r.end ? new Date(r.end).getTime() : null;
      if (cs != null) minStart = minStart == null ? cs : Math.min(minStart, cs);
      if (ce != null) maxEnd = maxEnd == null ? ce : Math.max(maxEnd, ce);
    }
    return {
      start: minStart != null ? new Date(minStart).toISOString().slice(0, 10) : null,
      end: maxEnd != null ? new Date(maxEnd).toISOString().slice(0, 10) : null,
    };
  };

  const out: GanttTask[] = [];
  let orderCounter = 0;
  const flattenNested = (node: any, parent?: string) => {
    const id = String(node?._id ?? node?.id ?? "");
    if (!id) return;
    const range = rollupRange(node);
    out.push({
      id,
      activity_id: node?.activity_id ? String(node.activity_id) : undefined,
      db_id: typeof node?.id === "number" ? node.id : node?.id ? Number(node.id) : undefined,
      label: String(node?.name ?? node?.activity_name ?? `#${id}`),
      duration: typeof node?.duration === "number" && Number.isFinite(node.duration) ? node.duration : undefined,
      start: range.start,
      end: range.end,
      actual_start: asDate(node?.actual_start),
      actual_end: asDate(node?.actual_end),
      progress: typeof node?.progress === "number" && Number.isFinite(node.progress) ? node.progress : 0,
      parent,
      order: orderCounter++,
      has_delay: Boolean(node?.has_delay),
      delay_info: node?.delay_info ?? undefined,
    });
    const children: any[] = Array.isArray(node?.subtasks) ? node.subtasks : [];
    for (const c of children) flattenNested(c, id);
  };

  const schedules: any[] = Array.isArray(data?.schedules) ? data.schedules : [];
  if (schedules.length > 0 && Array.isArray(schedules[0]?.tasks)) {
    for (const t of schedules[0].tasks) flattenNested(t, undefined);
    return out;
  }

  // Fallback: if backend returned old flat schema for some reason.
  const legacy = await get<any>(`project-gantt/${projectId}/`);
  const tasksArray = legacy?.tasks || [];
  return tasksArray.map((act: any, idx: number) => ({
    id: String(act.id),
    activity_id: act.activity_id,
    db_id: typeof act.id === "number" ? act.id : Number(act.id),
    label: act.activity_name || `#${act.activity_id}`,
    duration: typeof act.duration === "number" && Number.isFinite(act.duration) ? act.duration : undefined,
    start: act.start_date || null,
    end: act.end_date || act.start_date || null,
    actual_start: act.actual_start ?? null,
    actual_end: act.actual_end ?? null,
    progress: act.progress ?? 0,
    parent: act.parent_id ? String(act.parent_id) : undefined,
    order: idx,
    has_delay: Boolean(act.has_delay),
    delay_info: act.delay_info ?? undefined,
  }));
}

export type UpdateTaskActualInput = {
  progress: number;
  /** ISO date (YYYY-MM-DD) */
  actual_start?: string | null;
  /** ISO date (YYYY-MM-DD) */
  actual_end?: string | null;
  progress_date?: string | null;
  remarks?: string | null;
};

export async function updateTaskActual(
  taskId: number,
  payload: UpdateTaskActualInput
): Promise<{ status: boolean; message: string }> {
  return put<{ status: boolean; message: string }>(
    `update-project-activity/${taskId}/`,
    payload as any
  );
}