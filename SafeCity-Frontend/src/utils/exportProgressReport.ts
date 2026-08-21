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

const NAVY = [17, 31, 70] as const;
const BLUE = [30, 58, 138] as const;
const RED = [185, 28, 28] as const;
const GREEN = [22, 163, 74] as const;
const AMBER = [217, 119, 6] as const;
const SLATE = [71, 85, 105] as const;
const LIGHT = [247, 249, 252] as const;
const BORDER = [221, 228, 239] as const;
const TEXT = [26, 36, 58] as const;
const MUTED = [100, 116, 139] as const;
type Color = readonly [number, number, number];

const clampPct = (value: number) => Math.max(0, Math.min(100, Number(value) || 0));

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

function drawChrome(doc: jsPDF, pageNo: number, report: PhysicalReportData, logo: string | null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFillColor(...LIGHT); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(...RED); doc.rect(0, 22, W, 1.3, "F");
  if (logo) { try { doc.addImage(logo, "PNG", 10, 3.2, 15, 15); } catch { /* no-op */ } }
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
  doc.text("PSCA PHYSICAL PROGRESS & PROJECT EXECUTION REPORT", logo ? 30 : 11, 9.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.1);
  doc.text(report.report.scope_name, logo ? 30 : 11, 15.6);
  doc.text(`Reporting date: ${fmtDate(report.report.reporting_date)}`, W - 11, 15.6, { align: "right" });
  doc.setDrawColor(...BORDER); doc.line(10, H - 9.5, W - 10, H - 9.5);
  doc.setTextColor(...MUTED); doc.setFontSize(6.8);
  doc.text("SafeCity backend analytics — physical progress only", 10, H - 5);
  doc.text(`Page ${pageNo} of 2`, W - 10, H - 5, { align: "right" });
}

function title(doc: jsPDF, text: string, x: number, y: number) {
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(text, x, y); doc.setDrawColor(...RED); doc.setLineWidth(0.6); doc.line(x, y + 1.8, x + 17, y + 1.8);
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, sub: string, accent: Color = BLUE) {
  doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDER); doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");
  doc.setFillColor(...accent); doc.roundedRect(x, y, 2.3, h, 1.1, 1.1, "F");
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(6.6); doc.text(label.toUpperCase(), x + 5.5, y + 5.8);
  doc.setTextColor(...TEXT); doc.setFontSize(13.5); doc.text(value, x + 5.5, y + 13.7);
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6.3); doc.text(sub, x + 5.5, y + h - 4.2, { maxWidth: w - 9 });
}

function horizontalBars(
  doc: jsPDF,
  rows: Array<{ name: string; value: number; meta?: string }>,
  x: number, y: number, w: number, maxRows = 7, accent: Color = BLUE, maxValue = 100,
) {
  const data = rows.slice(0, maxRows);
  if (!data.length) {
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.2);
    doc.text("No valid backend rows for this comparison.", x, y + 5);
    return;
  }
  const labelW = Math.min(48, w * 0.38); const barW = w - labelW - 20; const rowH = 8;
  data.forEach((row, i) => {
    const yy = y + i * rowH;
    doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    const name = row.name.length > 27 ? `${row.name.slice(0, 25)}…` : row.name;
    doc.text(name, x, yy + 4.5, { maxWidth: labelW - 2 });
    doc.setFillColor(229, 234, 242); doc.roundedRect(x + labelW, yy + 1.2, barW, 4, 1, 1, "F");
    doc.setFillColor(...accent); doc.roundedRect(x + labelW, yy + 1.2, barW * Math.min(1, Math.max(0, row.value / Math.max(maxValue, 1))), 4, 1, 1, "F");
    doc.setTextColor(...TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(6.8);
    doc.text(`${row.value.toFixed(maxValue === 100 ? 1 : 0)}${maxValue === 100 ? "%" : ""}`, x + labelW + barW + 2, yy + 4.5);
    if (row.meta) { doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.7); doc.text(row.meta, x + labelW, yy + 7.2); }
  });
}

function distributionBars(doc: jsPDF, report: PhysicalReportData, x: number, y: number, w: number) {
  const rows = report.progress_distribution;
  const max = Math.max(...rows.map((r) => r.count), 1);
  horizontalBars(doc, rows.map((r) => ({ name: r.bucket, value: r.count })), x, y, w, 6, BLUE, max);
}

function rankingList(doc: jsPDF, rows: PhysicalReportData["top_projects"], x: number, y: number, w: number, accent: Color = BLUE) {
  rows.slice(0, 5).forEach((row, i) => {
    const yy = y + i * 9;
    doc.setFillColor(255,255,255); doc.setDrawColor(...BORDER); doc.roundedRect(x, yy, w, 7.2, 1.4, 1.4, "FD");
    doc.setFillColor(...accent); doc.circle(x + 3.8, yy + 3.6, 1.1, "F");
    doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    const name = row.project_name.length > 28 ? `${row.project_name.slice(0, 26)}…` : row.project_name;
    doc.text(name, x + 7, yy + 4.5);
    doc.setFont("helvetica", "bold"); doc.text(`${row.physical_progress.toFixed(2)}%`, x + w - 4, yy + 4.5, { align: "right" });
  });
}

function scatterMatrix(doc: jsPDF, rows: PhysicalReportData["execution_matrix"], x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...BORDER); doc.setFillColor(255,255,255); doc.roundedRect(x, y, w, h, 2, 2, "FD");
  const px = x + 13, py = y + 6, pw = w - 20, ph = h - 15;
  doc.setDrawColor(190,199,214); doc.line(px, py + ph, px + pw, py + ph); doc.line(px, py, px, py + ph);
  doc.setDrawColor(220,225,234); doc.line(px, py + ph, px + pw, py); // 1:1 reference
  doc.setTextColor(...MUTED); doc.setFontSize(5.8); doc.text("Planned time elapsed %", px + pw / 2, y + h - 2, { align: "center" });
  doc.text("100", px - 2, py + 2, { align: "right" }); doc.text("0", px - 2, py + ph, { align: "right" });
  doc.text("0", px, py + ph + 4); doc.text("100", px + pw, py + ph + 4, { align: "right" });
  rows.slice(0, 30).forEach((row, i) => {
    const sx = px + (clampPct(row.planned_time_elapsed_pct) / 100) * pw;
    const sy = py + ph - (clampPct(row.physical_progress) / 100) * ph;
    const pointColor: Color = row.variance_points < -10 ? RED : row.variance_points > 10 ? GREEN : BLUE;
    doc.setFillColor(pointColor[0], pointColor[1], pointColor[2]);
    doc.circle(sx, sy, 1.3, "F");
    if (i < 6) { doc.setTextColor(...MUTED); doc.setFontSize(5.2); const label = row.project_name.slice(0, 14); doc.text(label, sx + 1.7, sy - 1); }
  });
}

function exceptionBars(doc: jsPDF, report: PhysicalReportData, x: number, y: number, w: number) {
  const rows = [
    { name: "Past finish, incomplete", value: report.schedule.past_finish_incomplete },
    { name: "Not started after planned start", value: report.schedule.not_started_after_planned_start },
    { name: "Missing progress date", value: report.data_currency.activities_without_progress_date },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);
  horizontalBars(doc, rows, x, y, w, 3, AMBER, max);
}

function observations(doc: jsPDF, insights: string[], x: number, y: number, w: number, h: number) {
  doc.setFillColor(255,255,255); doc.setDrawColor(...BORDER); doc.roundedRect(x, y, w, h, 2, 2, "FD");
  let yy = y + 6;
  insights.slice(0, 4).forEach((text) => {
    doc.setFillColor(...BLUE); doc.circle(x + 4, yy - 1, 1, "F");
    doc.setTextColor(...TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.6);
    const lines = doc.splitTextToSize(text, w - 12).slice(0, 2); doc.text(lines, x + 8, yy);
    yy += Math.max(8, lines.length * 4 + 2);
  });
}

export async function exportProgressReport({ view, selection }: ExportProgressReportOptions) {
  const report = await getPhysicalProgressReport(view, selection ?? null);
  const logo = await imageUrlToDataUrl("/Assets/psca logo.png");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const gap = 3.5;

  // PAGE 1 — Portfolio Physical Performance
  drawChrome(doc, 1, report, logo);
  title(doc, "Portfolio physical performance", 11, 32);
  const cw = (W - 22 - gap * 5) / 6;
  const cards = [
    ["Physical Progress", `${report.physical.progress.toFixed(2)}%`, "Authoritative scope progress", BLUE],
    ["Valid Projects", `${report.physical.valid_projects} / ${report.physical.total_projects}`, "Projects with Primavera physical data", NAVY],
    ["Active Units", String(report.child_progress.length), "Valid child-scope units", SLATE],
    ["Completed", String(report.project_status.completed), "Projects at 100%", GREEN],
    ["In Progress", String(report.project_status.in_progress), "Projects between 0% and 100%", BLUE],
    ["Delay Flagged", String(report.project_status.with_delay_logs), "Projects with recorded delay logs", report.project_status.with_delay_logs ? RED : GREEN],
  ] as const;
  cards.forEach((c, i) => card(doc, 11 + i * (cw + gap), 38, cw, 24, c[0], c[1], c[2], c[3]));

  const singleProject = report.report.scope_type === "project";
  title(doc, singleProject ? "Major WBS physical progress" : "Physical progress by current child scope", 11, 73);
  const primaryRows = singleProject
    ? report.wbs_progress.map((r) => ({ name: r.name, value: r.physical_progress, meta: `${r.activity_count} activities` }))
    : report.child_progress.map((r) => ({ name: r.name, value: r.physical_progress, meta: `${r.valid_projects} valid / ${r.total_projects} total projects` }));
  horizontalBars(doc, primaryRows, 11, 79, 126, 7, BLUE, 100);

  title(doc, "Project physical progress distribution", 150, 73);
  distributionBars(doc, report, 150, 79, W - 161);

  title(doc, "Top performing projects", 11, 139);
  rankingList(doc, report.top_projects, 11, 145, 126, BLUE);
  title(doc, "Projects requiring attention", 150, 139);
  rankingList(doc, report.bottom_projects, 150, 145, W - 161, AMBER);

  title(doc, "Portfolio observations", 11, 191);
  observations(doc, report.insights, 11, 196, W - 22, 32);

  // PAGE 2 — Execution Performance & Management Exceptions
  doc.addPage("a4", "landscape");
  drawChrome(doc, 2, report, logo);
  title(doc, "Execution performance & management exceptions", 11, 32);

  const p2w = (W - 22 - gap * 5) / 6;
  const latest = fmtDate(report.data_currency.latest_progress_date);
  const p2cards = [
    ["Schedules", `${report.schedule.projects_with_schedule}/${report.physical.total_projects}`, "Projects with planned activity dates", NAVY],
    ["Past Finish", String(report.schedule.past_finish_incomplete), "Incomplete activities past planned finish", RED],
    ["Late Start", String(report.schedule.not_started_after_planned_start), "Not started after planned start", AMBER],
    ["Completed Activities", String(report.activity_status.completed), `${report.activity_status.total} non-WBS activities`, GREEN],
    ["In Progress Activities", String(report.activity_status.in_progress), "Backend activity progress", BLUE],
    ["Latest Update", latest, `${report.data_currency.activities_with_progress_date} activities dated`, SLATE],
  ] as const;
  p2cards.forEach((c, i) => card(doc, 11 + i * (p2w + gap), 38, p2w, 24, c[0], c[1], c[2], c[3]));

  title(doc, "Physical progress vs planned schedule position", 11, 74);
  scatterMatrix(doc, report.execution_matrix, 11, 80, 132, 58);
  title(doc, "Schedule exception summary", 154, 74);
  exceptionBars(doc, report, 154, 82, W - 165);

  if (report.delay_analysis.has_data) {
    title(doc, "Top recorded delay activities", 11, 150);
    const maxDelay = Math.max(...report.delay_analysis.top_delayed_activities.map((r) => r.delay_days), 1);
    horizontalBars(doc, report.delay_analysis.top_delayed_activities.map((r) => ({ name: r.activity_name, value: r.delay_days, meta: r.project_name })), 11, 156, 132, 5, RED, maxDelay);
    title(doc, "Delay days by category", 154, 150);
    const maxCat = Math.max(...report.delay_analysis.by_category.map((r) => r.delay_days), 1);
    horizontalBars(doc, report.delay_analysis.by_category.map((r) => ({ name: r.category, value: r.delay_days })), 154, 156, W - 165, 5, AMBER, maxCat);
  } else if (singleProject && report.wbs_remaining.length) {
    title(doc, "Largest remaining WBS work", 11, 150);
    horizontalBars(doc, report.wbs_remaining.map((r) => ({ name: r.name, value: r.remaining_progress, meta: `${r.activity_count} activities` })), 11, 156, 132, 5, AMBER, 100);
    title(doc, "Top incomplete activities", 154, 150);
    horizontalBars(doc, report.top_incomplete_activities.map((r) => ({ name: r.activity_name, value: r.remaining_progress })), 154, 156, W - 165, 5, AMBER, 100);
  } else {
    title(doc, "Project schedule coverage", 11, 150);
    const coverageRows = [
      { name: "Projects with schedule", value: report.schedule.projects_with_schedule },
      { name: "Projects without schedule", value: report.schedule.projects_without_schedule },
      { name: "Activities completed", value: report.activity_status.completed },
      { name: "Activities in progress", value: report.activity_status.in_progress },
      { name: "Activities not started", value: report.activity_status.not_started },
    ];
    horizontalBars(doc, coverageRows, 11, 156, 132, 5, BLUE, Math.max(...coverageRows.map((r) => r.value), 1));
    title(doc, "Data currency", 154, 150);
    doc.setFillColor(255,255,255); doc.setDrawColor(...BORDER); doc.roundedRect(154, 156, W - 165, 40, 2, 2, "FD");
    const currency = [
      ["Latest recorded update", latest],
      ["Activities with progress date", String(report.data_currency.activities_with_progress_date)],
      ["Activities without progress date", String(report.data_currency.activities_without_progress_date)],
    ];
    currency.forEach((r, i) => { doc.setTextColor(...MUTED); doc.setFontSize(6.8); doc.text(r[0], 160, 164 + i * 9); doc.setTextColor(...TEXT); doc.setFont("helvetica", "bold"); doc.text(r[1], W - 17, 164 + i * 9, { align: "right" }); doc.setFont("helvetica", "normal"); });
    if (report.data_currency.activities_without_progress_date > report.data_currency.activities_with_progress_date) {
      doc.setTextColor(...MUTED); doc.setFontSize(6.4); doc.text("Progress-date coverage is limited in the current dataset.", 160, 191);
    }
  }

  title(doc, "Management attention", 11, 207);
  const facts: string[] = [];
  if (report.schedule.past_finish_incomplete) facts.push(`${report.schedule.past_finish_incomplete} activities are past planned finish and remain incomplete.`);
  if (report.schedule.not_started_after_planned_start) facts.push(`${report.schedule.not_started_after_planned_start} activities have not started after their planned start date.`);
  if (report.delay_analysis.has_data) facts.push(`${report.delay_analysis.affected_projects} projects have recorded delay logs totalling ${report.delay_analysis.total_delay_days} delay days.`);
  if (!facts.length) facts.push("No schedule or recorded-delay exception was returned for the selected scope.");
  observations(doc, facts, 11, 212, W - 22, 17);

  const safe = report.report.scope_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`PSCA-Physical-Progress-Report-${safe || view}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
