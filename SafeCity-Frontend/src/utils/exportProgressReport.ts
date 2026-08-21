import jsPDF from "jspdf";
import type { DashboardView } from "@/api/dashboard";
import {
  getPhysicalProgressReport,
  type PhysicalReportData,
  type PhysicalReportSelection,
} from "@/api/physicalReport";

type ExportProgressReportOptions = {
  view: DashboardView;
  selection?: PhysicalReportSelection;
};

type Color = readonly [number, number, number];
const NAVY: Color = [17, 31, 70];
const BLUE: Color = [30, 58, 138];
const RED: Color = [185, 28, 28];
const GREEN: Color = [22, 163, 74];
const AMBER: Color = [217, 119, 6];
const SLATE: Color = [71, 85, 105];
const CYAN: Color = [14, 116, 144];
const WHITE: Color = [255, 255, 255];
const LIGHT: Color = [247, 249, 252];
const SOFT_BLUE: Color = [238, 243, 252];
const BORDER: Color = [220, 227, 239];
const TEXT: Color = [25, 35, 56];
const MUTED: Color = [100, 116, 139];

const clampPct = (value: number) => Math.max(0, Math.min(100, Number(value) || 0));
const pct = (value: number, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function truncate(text: string, max = 35) {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

function setFill(doc: jsPDF, color: Color) { doc.setFillColor(color[0], color[1], color[2]); }
function setText(doc: jsPDF, color: Color) { doc.setTextColor(color[0], color[1], color[2]); }
function setDraw(doc: jsPDF, color: Color) { doc.setDrawColor(color[0], color[1], color[2]); }

function drawChrome(doc: jsPDF, pageNo: number, report: PhysicalReportData, logo: string | null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  setFill(doc, LIGHT); doc.rect(0, 0, W, H, "F");

  setFill(doc, NAVY); doc.rect(0, 0, W, 24, "F");
  setFill(doc, RED); doc.rect(0, 24, W, 1.2, "F");
  if (logo) {
    try { doc.addImage(logo, "PNG", 10, 3.3, 16, 16); } catch { /* logo is optional */ }
  }

  setText(doc, WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13.5);
  doc.text("PSCA PHYSICAL PROGRESS & PROJECT EXECUTION REPORT", logo ? 31 : 11, 10);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.7);
  doc.text(report.report.scope_name, logo ? 31 : 11, 16);

  const scopeLabel = report.report.scope_type
    ? report.report.scope_type.toUpperCase()
    : report.report.scope.toUpperCase();
  setFill(doc, [31, 48, 92]);
  doc.roundedRect(W - 68, 5, 24, 7.5, 2, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(5.8);
  doc.text(scopeLabel, W - 56, 9.8, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.6);
  doc.text(`Reporting: ${fmtDate(report.report.reporting_date)}`, W - 11, 17.2, { align: "right" });

  setDraw(doc, BORDER); doc.line(10, H - 9, W - 10, H - 9);
  setText(doc, MUTED); doc.setFontSize(6.2);
  doc.text("PSCA SafeCity • Backend-driven physical progress analytics", 10, H - 4.8);
  doc.text(`Page ${pageNo} of 2`, W - 10, H - 4.8, { align: "right" });
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number, note?: string) {
  setText(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(9.2);
  doc.text(text, x, y);
  setFill(doc, RED); doc.roundedRect(x, y + 2, 16, 1, 0.5, 0.5, "F");
  if (note) {
    setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.8);
    doc.text(note, x + 20, y, { maxWidth: 90 });
  }
}

function kpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  accent: Color = BLUE,
) {
  setFill(doc, WHITE); setDraw(doc, BORDER); doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
  setFill(doc, accent); doc.roundedRect(x, y, 2.2, h, 1.1, 1.1, "F");
  setText(doc, MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(5.8);
  doc.text(label.toUpperCase(), x + 5, y + 5.8);
  setText(doc, TEXT); doc.setFontSize(13); doc.text(value, x + 5, y + 14.2);
  setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.6);
  doc.text(doc.splitTextToSize(sub, w - 9).slice(0, 2), x + 5, y + h - 5);
}

function panel(doc: jsPDF, x: number, y: number, w: number, h: number) {
  setFill(doc, WHITE); setDraw(doc, BORDER); doc.roundedRect(x, y, w, h, 2.4, 2.4, "FD");
}

function progressRanking(
  doc: jsPDF,
  rows: Array<{ name: string; value: number; meta?: string }>,
  x: number, y: number, w: number, h: number,
  maxRows = 7,
) {
  panel(doc, x, y, w, h);
  const data = rows.slice(0, maxRows);
  if (!data.length) {
    setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    doc.text("No valid physical-progress rows were returned for this scope.", x + 5, y + 12);
    return;
  }
  const labelW = Math.min(47, w * 0.37);
  const valueW = 18;
  const barW = w - labelW - valueW - 12;
  const rowH = (h - 8) / data.length;
  data.forEach((row, i) => {
    const yy = y + 5 + i * rowH;
    setText(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
    doc.text(truncate(row.name, 27), x + 4, yy + 3.5, { maxWidth: labelW - 3 });
    setFill(doc, [232, 237, 245]); doc.roundedRect(x + labelW, yy + 0.7, barW, 4.1, 1, 1, "F");
    const value = clampPct(row.value);
    setFill(doc, value >= 75 ? GREEN : value >= 25 ? BLUE : AMBER);
    doc.roundedRect(x + labelW, yy + 0.7, Math.max(0.8, barW * value / 100), 4.1, 1, 1, "F");
    setText(doc, TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(6.3);
    doc.text(pct(value), x + labelW + barW + 2, yy + 3.8);
    if (row.meta) {
      setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(4.8);
      doc.text(truncate(row.meta, 38), x + labelW, yy + 7.1);
    }
  });
}

function distributionChart(doc: jsPDF, report: PhysicalReportData, x: number, y: number, w: number, h: number) {
  panel(doc, x, y, w, h);
  const rows = report.progress_distribution;
  const max = Math.max(...rows.map((r) => r.count), 1);
  const chartX = x + 9;
  const chartY = y + 9;
  const chartW = w - 16;
  const chartH = h - 18;
  setDraw(doc, [226, 232, 241]);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
  const barGap = 4;
  const barW = (chartW - barGap * (rows.length - 1)) / rows.length;
  rows.forEach((row, i) => {
    const bh = Math.max(row.count ? 2 : 0, chartH * row.count / max);
    const bx = chartX + i * (barW + barGap);
    const by = chartY + chartH - bh;
    setFill(doc, i < 2 ? AMBER : i >= 4 ? GREEN : BLUE);
    doc.roundedRect(bx, by, barW, bh, 1.2, 1.2, "F");
    setText(doc, TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
    doc.text(String(row.count), bx + barW / 2, by - 1.5, { align: "center" });
    setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(4.8);
    const label = row.bucket.replace(">", "");
    doc.text(label, bx + barW / 2, chartY + chartH + 5, { align: "center" });
  });
  setText(doc, MUTED); doc.setFontSize(5.3);
  doc.text("Number of valid projects by physical-progress band", x + 5, y + h - 3);
}

type TableColumn = { key: string; label: string; width: number; align?: "left" | "right" | "center" };
function dataTable(
  doc: jsPDF,
  x: number, y: number, w: number,
  columns: TableColumn[],
  rows: Array<Record<string, string | number>>,
  maxRows = 6,
  rowH = 7,
) {
  const tableRows = rows.slice(0, maxRows);
  const h = 8 + Math.max(1, tableRows.length) * rowH;
  panel(doc, x, y, w, h);
  setFill(doc, SOFT_BLUE); doc.roundedRect(x, y, w, 8, 2.2, 2.2, "F");
  let cx = x + 3;
  setText(doc, SLATE); doc.setFont("helvetica", "bold"); doc.setFontSize(5.5);
  columns.forEach((c) => {
    const tx = c.align === "right" ? cx + c.width - 2 : c.align === "center" ? cx + c.width / 2 : cx;
    doc.text(c.label.toUpperCase(), tx, y + 5.1, { align: c.align ?? "left" });
    cx += c.width;
  });
  if (!tableRows.length) {
    setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    doc.text("No backend rows available.", x + 4, y + 14);
    return h;
  }
  tableRows.forEach((row, i) => {
    const yy = y + 8 + i * rowH;
    if (i % 2 === 1) { setFill(doc, [250, 251, 253]); doc.rect(x + 1, yy, w - 2, rowH, "F"); }
    setDraw(doc, [235, 239, 245]); doc.line(x + 2, yy + rowH, x + w - 2, yy + rowH);
    cx = x + 3;
    columns.forEach((c) => {
      const raw = row[c.key] ?? "—";
      const text = typeof raw === "number" ? String(raw) : String(raw);
      const tx = c.align === "right" ? cx + c.width - 2 : c.align === "center" ? cx + c.width / 2 : cx;
      setText(doc, TEXT); doc.setFont("helvetica", c.key === "project" ? "normal" : "bold"); doc.setFontSize(5.8);
      doc.text(truncate(text, c.key === "project" ? 31 : 15), tx, yy + 4.6, { align: c.align ?? "left", maxWidth: c.width - 2 });
      cx += c.width;
    });
  });
  return h;
}

function scatterMatrix(doc: jsPDF, rows: PhysicalReportData["execution_matrix"], x: number, y: number, w: number, h: number) {
  panel(doc, x, y, w, h);
  const px = x + 16, py = y + 8, pw = w - 24, ph = h - 19;
  setDraw(doc, [191, 201, 216]);
  doc.line(px, py + ph, px + pw, py + ph); doc.line(px, py, px, py + ph);
  setDraw(doc, [220, 226, 235]); doc.setLineDashPattern([2, 2], 0); doc.line(px, py + ph, px + pw, py); doc.setLineDashPattern([], 0);
  setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.3);
  doc.text("Physical progress %", x + 2.5, y + h / 2, { angle: 90, align: "center" });
  doc.text("Planned time elapsed %", px + pw / 2, y + h - 2.5, { align: "center" });
  [0, 25, 50, 75, 100].forEach((n) => {
    const xx = px + (n / 100) * pw;
    const yy = py + ph - (n / 100) * ph;
    setText(doc, MUTED); doc.setFontSize(4.7);
    doc.text(String(n), xx, py + ph + 4, { align: "center" });
    doc.text(String(n), px - 2.5, yy + 1.5, { align: "right" });
  });

  rows.slice(0, 40).forEach((row, i) => {
    const sx = px + (clampPct(row.planned_time_elapsed_pct) / 100) * pw;
    const sy = py + ph - (clampPct(row.physical_progress) / 100) * ph;
    const pointColor = row.variance_points < 0 ? RED : GREEN;
    setFill(doc, pointColor); doc.circle(sx, sy, 1.5, "F");
    if (i < 7) {
      setText(doc, MUTED); doc.setFontSize(4.3);
      doc.text(truncate(row.project_name, 16), sx + 1.8, sy - 1);
    }
  });

  setFill(doc, GREEN); doc.circle(x + w - 44, y + 5, 1.2, "F");
  setText(doc, MUTED); doc.setFontSize(4.8); doc.text("At/ahead of elapsed position", x + w - 41, y + 6.2);
  setFill(doc, RED); doc.circle(x + w - 44, y + 10, 1.2, "F");
  doc.text("Below elapsed position", x + w - 41, y + 11.2);
}

function exceptionBars(doc: jsPDF, report: PhysicalReportData, x: number, y: number, w: number, h: number) {
  panel(doc, x, y, w, h);
  const rows = [
    { name: "Past planned finish / incomplete", value: report.schedule.past_finish_incomplete },
    { name: "Not started after planned start", value: report.schedule.not_started_after_planned_start },
    { name: "Projects below elapsed position", value: report.schedule.projects_behind_elapsed_position },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  rows.forEach((row, i) => {
    const yy = y + 8 + i * 12;
    setText(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.1);
    doc.text(row.name, x + 5, yy);
    setFill(doc, [233, 237, 244]); doc.roundedRect(x + 5, yy + 2, w - 23, 4.2, 1, 1, "F");
    setFill(doc, i === 2 ? RED : AMBER); doc.roundedRect(x + 5, yy + 2, Math.max(0.8, (w - 23) * row.value / max), 4.2, 1, 1, "F");
    setText(doc, TEXT); doc.setFont("helvetica", "bold"); doc.text(String(row.value), x + w - 5, yy + 5.4, { align: "right" });
  });
}

function insightPanel(doc: jsPDF, insights: string[], x: number, y: number, w: number, h: number, heading = "Decision signals") {
  panel(doc, x, y, w, h);
  setText(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text(heading.toUpperCase(), x + 5, y + 6);
  let yy = y + 12;
  insights.slice(0, 4).forEach((text) => {
    setFill(doc, BLUE); doc.circle(x + 5.5, yy - 1.2, 1, "F");
    setText(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.8);
    const lines = doc.splitTextToSize(text, w - 15).slice(0, 2);
    doc.text(lines, x + 9, yy);
    yy += Math.max(7, lines.length * 3.4 + 2);
  });
}

function rankingTitle(report: PhysicalReportData) {
  if (report.report.scope_type === "project") return "Major WBS physical progress";
  if (report.report.scope_type === "tehsil") return "Project physical progress";
  if (report.report.scope_type === "district") return "Tehsil physical progress";
  if (report.report.scope_type === "division") return "District physical progress";
  if (report.report.scope === "projects") return "Project physical progress";
  if (report.report.scope === "tehsils") return "Tehsil physical progress";
  if (report.report.scope === "districts") return "District physical progress";
  return "Division physical progress";
}

function watchlistRows(report: PhysicalReportData) {
  return report.execution_watchlist.map((r) => ({
    project: r.project_name,
    physical: pct(r.physical_progress, 1),
    elapsed: pct(r.planned_time_elapsed_pct, 1),
    variance: `${r.variance_points >= 0 ? "+" : ""}${r.variance_points.toFixed(1)} pp`,
    exceptions: String(r.past_finish_incomplete + r.not_started_after_planned_start),
  }));
}

function projectRankingRows(rows: PhysicalReportData["top_projects"]) {
  return rows.map((r) => ({ project: r.project_name, progress: pct(r.physical_progress, 1) }));
}

export async function exportProgressReport({ view, selection }: ExportProgressReportOptions) {
  const report = await getPhysicalProgressReport(view, selection ?? null);
  const logo = await imageUrlToDataUrl("/Assets/psca logo.png");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const singleProject = report.report.scope_type === "project";

  // PAGE 1 — Executive Physical Performance
  drawChrome(doc, 1, report, logo);
  sectionTitle(doc, "Executive physical performance", 11, 33, "Portfolio progress, distribution and priority projects");

  const cardGap = 3;
  const cardW = (W - 22 - cardGap * 5) / 6;
  const activeUnits = singleProject ? report.wbs_progress.length : report.child_progress.length;
  const scheduleCoverage = report.physical.total_projects
    ? (report.schedule.projects_with_schedule / report.physical.total_projects) * 100
    : 0;
  const page1Cards = [
    ["Physical progress", pct(report.physical.progress, 2), "Authoritative backend scope progress", BLUE],
    ["Valid projects", `${report.physical.valid_projects}/${report.physical.total_projects}`, "Projects with valid Primavera progress", NAVY],
    [singleProject ? "Major WBS" : "Active units", String(activeUnits), singleProject ? "Top-level WBS with activity data" : "Child units with valid physical data", SLATE],
    ["Completed projects", String(report.project_status.completed), "Valid projects at 100%", GREEN],
    ["In progress", String(report.project_status.in_progress), "Valid projects between 0% and 100%", BLUE],
    ["Schedule coverage", pct(scheduleCoverage, 0), `${report.schedule.projects_with_schedule} projects with planned dates`, CYAN],
  ] as const;
  page1Cards.forEach((c, i) => kpiCard(doc, 11 + i * (cardW + cardGap), 39, cardW, 23, c[0], c[1], c[2], c[3]));

  sectionTitle(doc, rankingTitle(report), 11, 72);
  const primaryRows = singleProject
    ? report.wbs_progress.map((r) => ({ name: r.name, value: r.physical_progress, meta: `${r.activity_count} descendant activities` }))
    : report.child_progress.map((r) => ({ name: r.name, value: r.physical_progress, meta: `${r.valid_projects} valid / ${r.total_projects} projects` }));
  progressRanking(doc, primaryRows, 11, 77, 165, 61, 7);

  sectionTitle(doc, "Project progress distribution", 184, 72);
  distributionChart(doc, report, 184, 77, W - 195, 61);

  sectionTitle(doc, "Top performing projects", 11, 148);
  dataTable(
    doc, 11, 153, 130,
    [
      { key: "project", label: "Project", width: 101 },
      { key: "progress", label: "Physical", width: 23, align: "right" },
    ],
    projectRankingRows(report.top_projects), 5, 6.5,
  );

  sectionTitle(doc, "Lowest physical-progress projects", 148, 148);
  dataTable(
    doc, 148, 153, 138,
    [
      { key: "project", label: "Project", width: 109 },
      { key: "progress", label: "Physical", width: 23, align: "right" },
    ],
    projectRankingRows(report.bottom_projects), 5, 6.5,
  );

  insightPanel(doc, report.insights, 11, 194, W - 22, 26, "Portfolio observations");

  // PAGE 2 — Execution Intelligence
  doc.addPage("a4", "landscape");
  drawChrome(doc, 2, report, logo);
  sectionTitle(doc, "Execution intelligence & management exceptions", 11, 33, "Physical progress against schedule position and exception workload");

  const p2CardW = (W - 22 - cardGap * 5) / 6;
  const p2Cards = [
    ["Scheduled projects", `${report.schedule.projects_with_schedule}/${report.physical.total_projects}`, "Projects with usable planned dates", NAVY],
    ["Below elapsed position", String(report.schedule.projects_behind_elapsed_position), "Physical progress below elapsed planned-time %", RED],
    ["Past finish", String(report.schedule.past_finish_incomplete), "Incomplete activities beyond planned finish", AMBER],
    ["Late start", String(report.schedule.not_started_after_planned_start), "0% activities after planned start", AMBER],
    ["Progress-date coverage", pct(report.data_currency.coverage_pct, 0), `${report.data_currency.activities_with_progress_date}/${report.activity_status.total} activities dated`, CYAN],
    [report.delay_analysis.has_data ? "Recorded delay days" : "Completed activities", report.delay_analysis.has_data ? String(report.delay_analysis.total_delay_days) : String(report.activity_status.completed), report.delay_analysis.has_data ? `${report.delay_analysis.affected_projects} projects with delay records` : `${report.activity_status.total} non-WBS activities`, report.delay_analysis.has_data ? RED : GREEN],
  ] as const;
  p2Cards.forEach((c, i) => kpiCard(doc, 11 + i * (p2CardW + cardGap), 39, p2CardW, 23, c[0], c[1], c[2], c[3]));

  sectionTitle(doc, "Physical progress vs planned time elapsed", 11, 72, "Diagonal = physical progress equal to elapsed schedule position");
  scatterMatrix(doc, report.execution_matrix, 11, 77, 164, 72);

  sectionTitle(doc, "Execution watchlist", 183, 72, "Lowest physical-vs-time variance first");
  dataTable(
    doc, 183, 77, W - 194,
    [
      { key: "project", label: "Project", width: 47 },
      { key: "physical", label: "Phys.", width: 14, align: "right" },
      { key: "elapsed", label: "Time", width: 14, align: "right" },
      { key: "variance", label: "Variance", width: 19, align: "right" },
      { key: "exceptions", label: "Excp.", width: 13, align: "right" },
    ],
    watchlistRows(report), 6, 8,
  );

  sectionTitle(doc, "Schedule exception profile", 11, 159);
  exceptionBars(doc, report, 11, 164, 132, 42);

  if (singleProject) {
    sectionTitle(doc, "WBS contribution to overall progress", 151, 159);
    const contributionRows = report.wbs_contribution.map((r) => ({
      name: r.name,
      value: r.contribution_points,
      meta: `${pct(r.duration_share_pct, 0)} of duration weight`,
    }));
    const maxContribution = Math.max(...contributionRows.map((r) => r.value), 1);
    // Reuse ranking panel with a common max by normalizing only the bar length; the printed value remains contribution points.
    panel(doc, 151, 164, 66, 42);
    contributionRows.slice(0, 4).forEach((r, i) => {
      const yy = 170 + i * 8.2;
      setText(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.text(truncate(r.name, 18), 155, yy);
      setFill(doc, [232,237,245]); doc.roundedRect(178, yy - 3.2, 26, 3.5, 0.8, 0.8, "F");
      setFill(doc, BLUE); doc.roundedRect(178, yy - 3.2, 26 * r.value / maxContribution, 3.5, 0.8, 0.8, "F");
      setText(doc, TEXT); doc.setFont("helvetica", "bold"); doc.text(`${r.value.toFixed(1)} pp`, 213, yy, { align: "right" });
    });

    sectionTitle(doc, "Top incomplete activities", 224, 159);
    dataTable(
      doc, 224, 164, W - 235,
      [
        { key: "activity", label: "Activity", width: 38 },
        { key: "physical", label: "Phys.", width: 13, align: "right" },
        { key: "remaining", label: "Remain.", width: 16, align: "right" },
      ],
      report.top_incomplete_activities.map((r) => ({
        activity: r.activity_name,
        physical: pct(r.physical_progress, 0),
        remaining: pct(r.remaining_progress, 0),
      })),
      5, 6.5,
    );
  } else if (report.delay_analysis.has_data) {
    sectionTitle(doc, "Recorded delay concentration", 151, 159);
    const delayRows = report.delay_analysis.by_category.slice(0, 5);
    const maxDelay = Math.max(...delayRows.map((r) => r.delay_days), 1);
    panel(doc, 151, 164, 66, 42);
    delayRows.forEach((r, i) => {
      const yy = 170 + i * 7.1;
      setText(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.text(truncate(r.category, 17), 155, yy);
      setFill(doc, [232,237,245]); doc.roundedRect(178, yy - 3.2, 25, 3.5, 0.8, 0.8, "F");
      setFill(doc, RED); doc.roundedRect(178, yy - 3.2, 25 * r.delay_days / maxDelay, 3.5, 0.8, 0.8, "F");
      setText(doc, TEXT); doc.setFont("helvetica", "bold"); doc.text(`${r.delay_days} d`, 213, yy, { align: "right" });
    });

    sectionTitle(doc, "Top recorded delay activities", 224, 159);
    dataTable(
      doc, 224, 164, W - 235,
      [
        { key: "activity", label: "Activity", width: 36 },
        { key: "project", label: "Project", width: 26 },
        { key: "days", label: "Days", width: 11, align: "right" },
      ],
      report.delay_analysis.top_delayed_activities.map((r) => ({
        activity: r.activity_name,
        project: r.project_name,
        days: r.delay_days,
      })), 5, 6.5,
    );
  } else {
    sectionTitle(doc, "Portfolio reporting coverage", 151, 159);
    panel(doc, 151, 164, 66, 42);
    const coverage = [
      ["Projects with schedule", `${report.schedule.projects_with_schedule}/${report.physical.total_projects}`],
      ["Valid physical projects", `${report.physical.valid_projects}/${report.physical.total_projects}`],
      ["Latest progress update", fmtDate(report.data_currency.latest_progress_date)],
      ["Activities with progress date", `${report.data_currency.activities_with_progress_date}/${report.activity_status.total}`],
    ];
    coverage.forEach((r, i) => {
      const yy = 172 + i * 8;
      setText(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.6); doc.text(r[0], 155, yy);
      setText(doc, TEXT); doc.setFont("helvetica", "bold"); doc.text(r[1], 213, yy, { align: "right" });
    });

    sectionTitle(doc, "Activity execution mix", 224, 159);
    panel(doc, 224, 164, W - 235, 42);
    const total = Math.max(report.activity_status.total, 1);
    const mix = [
      { label: "Completed", value: report.activity_status.completed, color: GREEN },
      { label: "In progress", value: report.activity_status.in_progress, color: BLUE },
      { label: "Not started", value: report.activity_status.not_started, color: AMBER },
    ];
    let xx = 229;
    const fullW = W - 245;
    mix.forEach((m) => {
      const sw = fullW * m.value / total;
      setFill(doc, m.color); if (sw > 0) doc.rect(xx, 174, sw, 7, "F");
      xx += sw;
    });
    mix.forEach((m, i) => {
      const yy = 188 + i * 5.3;
      setFill(doc, m.color); doc.circle(230, yy - 1, 1, "F");
      setText(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.4);
      doc.text(`${m.label}: ${m.value} (${((m.value / total) * 100).toFixed(0)}%)`, 234, yy);
    });
  }

  const attention: string[] = [];
  if (report.schedule.projects_behind_elapsed_position) attention.push(`${report.schedule.projects_behind_elapsed_position} scheduled projects have physical progress below their elapsed planned-time position.`);
  if (report.schedule.past_finish_incomplete) attention.push(`${report.schedule.past_finish_incomplete} activities are past planned finish and remain incomplete.`);
  if (report.schedule.not_started_after_planned_start) attention.push(`${report.schedule.not_started_after_planned_start} activities remain at 0% after their planned start date.`);
  if (report.delay_analysis.has_data) attention.push(`${report.delay_analysis.affected_projects} projects contain recorded delay logs totalling ${report.delay_analysis.total_delay_days} days.`);
  if (!attention.length) attention.push("No schedule-position or recorded-delay exception is present in the backend report payload for this scope.");
  insightPanel(doc, attention, 11, 211, W - 22, 20, "Management attention");

  const safe = report.report.scope_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`PSCA-Physical-Progress-Report-${safe || view}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
