import jsPDF from "jspdf";
import type {
  DashboardPageData,
  DashboardProject,
  DashboardView,
} from "@/api/dashboard";

type Selection = {
  type: "division" | "district" | "tehsil" | "project";
  id: number;
  name: string;
} | null;

type ExportProgressReportOptions = {
  pageData: DashboardPageData;
  view: DashboardView;
  selection?: Selection;
};

type ReportRow = {
  id: number;
  name: string;
  physical: number;
  financial: number;
  projectCount: number;
};

const NAVY = [17, 31, 70] as const;
const BLUE = [30, 58, 138] as const;
const RED = [185, 28, 28] as const;
const LIGHT = [247, 249, 252] as const;
const BORDER = [224, 229, 239] as const;
const TEXT = [26, 36, 58] as const;
const MUTED = [100, 116, 139] as const;
const GREEN = [22, 163, 74] as const;
const AMBER = [217, 119, 6] as const;

const n = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value: unknown) => Math.max(0, Math.min(100, n(value)));

const money = (value: unknown) => {
  const amount = n(value);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `Rs ${(amount / 1_000_000_000).toFixed(2)} B`;
  if (abs >= 1_000_000) return `Rs ${(amount / 1_000_000).toFixed(2)} M`;
  if (abs >= 1_000) return `Rs ${(amount / 1_000).toFixed(2)} K`;
  return `Rs ${amount.toFixed(2)}`;
};

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

function projectName(p: DashboardProject) {
  return p.project_name?.trim() || `Project ${p.id}`;
}

function filterProjects(pageData: DashboardPageData, selection?: Selection): DashboardProject[] {
  if (!selection) return pageData.projects;
  if (selection.type === "project") {
    return pageData.projects.filter((p) => Number(p.id) === selection.id);
  }
  if (selection.type === "tehsil") {
    return pageData.projects.filter((p) => Number(p.tehsil) === selection.id);
  }
  if (selection.type === "district") {
    return pageData.projects.filter((p) => Number(p.district) === selection.id);
  }
  return pageData.projects.filter((p) => Number(p.zone ?? (p as any).division) === selection.id);
}

function getScopeRows(pageData: DashboardPageData, view: DashboardView, selection?: Selection): ReportRow[] {
  if (selection?.type === "project") {
    const p = pageData.projects.find((row) => Number(row.id) === selection.id);
    return p
      ? [{ id: p.id, name: projectName(p), physical: pct(p.physical_progress), financial: pct(p.financial_progress), projectCount: 1 }]
      : [];
  }

  if (selection?.type === "tehsil") {
    return filterProjects(pageData, selection).map((p) => ({
      id: p.id,
      name: projectName(p),
      physical: pct(p.physical_progress),
      financial: pct(p.financial_progress),
      projectCount: 1,
    }));
  }

  if (selection?.type === "district") {
    return pageData.tehsils
      .filter((row) => Number(row.district) === selection.id)
      .map((row) => ({ id: row.id, name: row.name, physical: pct(row.physical_progress), financial: pct(row.financial_progress), projectCount: n(row.project_count) }));
  }

  if (selection?.type === "division") {
    return pageData.districts
      .filter((row) => Number(row.division) === selection.id)
      .map((row) => ({ id: row.id, name: row.name, physical: pct(row.physical_progress), financial: pct(row.financial_progress), projectCount: n(row.project_count) }));
  }

  if (view === "projects") {
    return pageData.projects.map((p) => ({ id: p.id, name: projectName(p), physical: pct(p.physical_progress), financial: pct(p.financial_progress), projectCount: 1 }));
  }

  const source = view === "divisions" ? pageData.divisions : view === "districts" ? pageData.districts : pageData.tehsils;
  return source.map((row) => ({ id: row.id, name: row.name, physical: pct(row.physical_progress), financial: pct(row.financial_progress), projectCount: n(row.project_count) }));
}

function selectedMetric(pageData: DashboardPageData, selection: Selection | undefined, key: "physical_progress" | "financial_progress") {
  if (!selection) return n(pageData.summary[key]);
  if (selection.type === "project") return n(pageData.projects.find((r) => Number(r.id) === selection.id)?.[key]);
  if (selection.type === "tehsil") return n(pageData.tehsils.find((r) => Number(r.id) === selection.id)?.[key]);
  if (selection.type === "district") return n(pageData.districts.find((r) => Number(r.id) === selection.id)?.[key]);
  return n(pageData.divisions.find((r) => Number(r.id) === selection.id)?.[key]);
}

function scopeTitle(view: DashboardView, selection?: Selection) {
  if (selection) {
    const suffix = selection.type === "project" ? "Project" : `${selection.type[0].toUpperCase()}${selection.type.slice(1)}`;
    return `${selection.name} — ${suffix}`;
  }
  if (view === "projects") return "All Projects";
  if (view === "districts") return "All Punjab Districts";
  if (view === "tehsils") return "All Punjab Tehsils";
  return "All Punjab Divisions";
}

function reportRowLabel(view: DashboardView, selection?: Selection) {
  if (selection?.type === "division") return "District";
  if (selection?.type === "district") return "Tehsil";
  if (selection?.type === "tehsil") return "Project";
  if (selection?.type === "project") return "Project";
  if (view === "projects") return "Project";
  if (view === "districts") return "District";
  if (view === "tehsils") return "Tehsil";
  return "Division";
}

function setFill(doc: jsPDF, color: readonly [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function drawPageChrome(doc: jsPDF, pageNo: number, title: string, logo: string | null) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setFillColor(...LIGHT);
  doc.rect(0, 0, width, height, "F");
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, width, 22, "F");
  doc.setFillColor(...RED);
  doc.rect(0, 22, width, 1.4, "F");

  if (logo) {
    try { doc.addImage(logo, "PNG", 10, 3.5, 15, 15); } catch { /* ignore logo errors */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("PSCA PROJECT PROGRESS & PERFORMANCE REPORT", logo ? 30 : 11, 10.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(title, logo ? 30 : 11, 16.2);

  doc.setDrawColor(...BORDER);
  doc.line(10, height - 10, width - 10, height - 10);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString()}`, 10, height - 5.5);
  doc.text(`Page ${pageNo} of 2`, width - 10, height - 5.5, { align: "right" });
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, sub?: string, accent: readonly [number, number, number] = BLUE) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(x, y, w, h, 2.3, 2.3, "FD");
  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 2.4, h, 1.2, 1.2, "F");
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(label.toUpperCase(), x + 6, y + 6.5);
  doc.setTextColor(...TEXT);
  doc.setFontSize(16);
  doc.text(value, x + 6, y + 15.5);
  if (sub) {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.text(sub, x + 6, y + h - 4.5, { maxWidth: w - 10 });
  }
}

function sectionTitle(doc: jsPDF, text: string, x: number, y: number) {
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.2);
  doc.text(text, x, y);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.65);
  doc.line(x, y + 2, x + 18, y + 2);
}

function horizontalBars(doc: jsPDF, rows: ReportRow[], metric: "physical" | "financial", x: number, y: number, w: number, maxRows = 7) {
  const ordered = [...rows].sort((a, b) => b[metric] - a[metric]).slice(0, maxRows);
  const labelW = Math.min(54, w * 0.42);
  const barW = w - labelW - 19;
  const rowH = 8.3;
  ordered.forEach((row, index) => {
    const yy = y + index * rowH;
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    const label = row.name.length > 30 ? `${row.name.slice(0, 28)}…` : row.name;
    doc.text(label, x, yy + 4.8, { maxWidth: labelW - 2 });
    doc.setFillColor(229, 234, 242);
    doc.roundedRect(x + labelW, yy + 1.4, barW, 4.2, 1.2, 1.2, "F");
    setFill(doc, metric === "physical" ? BLUE : RED);
    doc.roundedRect(x + labelW, yy + 1.4, barW * (pct(row[metric]) / 100), 4.2, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.3);
    doc.text(`${pct(row[metric]).toFixed(1)}%`, x + labelW + barW + 3, yy + 4.8);
  });
  if (ordered.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text("No records available for this scope.", x, y + 8);
  }
}

function statusStrip(doc: jsPDF, projects: DashboardProject[], x: number, y: number, w: number) {
  const counts = {
    completed: projects.filter((p) => p.status === "completed").length,
    inProgress: projects.filter((p) => p.status === "in_progress").length,
    delayed: projects.filter((p) => p.status === "in_delay" || p.has_delay).length,
    pending: projects.filter((p) => p.status === "pending").length,
  };
  const total = Math.max(1, projects.length);
  const segments = [
    { label: "Completed", value: counts.completed, color: GREEN },
    { label: "In Progress", value: counts.inProgress, color: BLUE },
    { label: "Delayed", value: counts.delayed, color: RED },
    { label: "Pending", value: counts.pending, color: AMBER },
  ] as const;

  let cursor = x;
  for (const s of segments) {
    const sw = w * (s.value / total);
    if (sw > 0) {
      setFill(doc, s.color);
      doc.rect(cursor, y, sw, 6, "F");
      cursor += sw;
    }
  }
  doc.setDrawColor(...BORDER);
  doc.rect(x, y, w, 6);

  let lx = x;
  segments.forEach((s) => {
    setFill(doc, s.color);
    doc.circle(lx + 1.5, y + 12, 1.5, "F");
    doc.setTextColor(...TEXT);
    doc.setFontSize(7.2);
    doc.text(`${s.label}: ${s.value}`, lx + 4.5, y + 13.3);
    lx += w / 4;
  });
  return counts;
}

function deterministicInsights(scope: string, physical: number, financial: number, projects: DashboardProject[], rows: ReportRow[]) {
  const delayed = projects.filter((p) => p.status === "in_delay" || p.has_delay).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const best = [...rows].sort((a, b) => b.physical - a.physical)[0];
  const lowest = [...rows].sort((a, b) => a.physical - b.physical)[0];
  const gap = physical - financial;
  const insights = [
    `${scope} reports ${physical.toFixed(2)}% physical progress across ${projects.length} project${projects.length === 1 ? "" : "s"}.`,
    `${completed} project${completed === 1 ? " is" : "s are"} completed and ${delayed} project${delayed === 1 ? " has" : "s have"} a recorded delay flag in the current dashboard data.`,
  ];
  if (best) insights.push(`Highest physical progress in the current comparison is ${best.name} at ${best.physical.toFixed(2)}%.`);
  if (lowest && lowest.id !== best?.id) insights.push(`Lowest physical progress in the current comparison is ${lowest.name} at ${lowest.physical.toFixed(2)}%.`);
  insights.push(`Physical progress is ${Math.abs(gap).toFixed(2)} percentage points ${gap >= 0 ? "above" : "below"} the current dashboard financial progress indicator.`);
  return insights;
}

export async function exportProgressReport({ pageData, view, selection = null }: ExportProgressReportOptions) {
  const title = scopeTitle(view, selection);
  const projects = filterProjects(pageData, selection);
  const rows = getScopeRows(pageData, view, selection);
  const physical = pct(selectedMetric(pageData, selection, "physical_progress"));
  const financial = pct(selectedMetric(pageData, selection, "financial_progress"));
  const delayed = projects.filter((p) => p.status === "in_delay" || p.has_delay).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const inProgress = projects.filter((p) => p.status === "in_progress").length;
  const pending = projects.filter((p) => p.status === "pending").length;

  const useBackendRootSummary = !selection;
  const allocated = useBackendRootSummary
    ? n(pageData.summary.total_budget)
    : projects.reduce((sum, p) => sum + n(p.total_budget_allocated), 0);
  const consumed = useBackendRootSummary
    ? n(pageData.summary.total_consume)
    : projects.reduce((sum, p) => sum + n(p.budget_utilized), 0);
  const remaining = useBackendRootSummary
    ? n(pageData.summary.remaining_budget)
    : projects.reduce((sum, p) => sum + n(p.budget_remaining), 0);

  const logo = await imageUrlToDataUrl("/Assets/psca logo.png");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // PAGE 1 — Executive physical performance
  drawPageChrome(doc, 1, title, logo);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 11, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Executive progress analysis · Current dashboard scope: ${reportRowLabel(view, selection)}`, 11, 40);

  const gap = 4;
  const cardW = (W - 22 - gap * 3) / 4;
  card(doc, 11, 46, cardW, 27, "Physical Progress", `${physical.toFixed(2)}%`, `${(100 - physical).toFixed(2)}% remaining`, BLUE);
  card(doc, 11 + cardW + gap, 46, cardW, 27, "Financial Progress", `${financial.toFixed(2)}%`, "Current dashboard financial indicator", RED);
  card(doc, 11 + (cardW + gap) * 2, 46, cardW, 27, "Projects", String(projects.length || pageData.summary.total_projects), `${completed} completed · ${inProgress} in progress`, NAVY);
  card(doc, 11 + (cardW + gap) * 3, 46, cardW, 27, "Delayed Projects", String(delayed), `${pending} pending`, delayed > 0 ? RED : GREEN);

  sectionTitle(doc, "Project status composition", 11, 83);
  statusStrip(doc, projects, 11, 89, W - 22);

  sectionTitle(doc, `Physical progress by ${reportRowLabel(view, selection)}`, 11, 113);
  horizontalBars(doc, rows, "physical", 11, 119, 132, 7);

  sectionTitle(doc, "Executive analysis", 154, 113);
  const insights = deterministicInsights(title, physical, financial, projects, rows);
  let iy = 121;
  insights.slice(0, 5).forEach((text, idx) => {
    setFill(doc, idx === 4 ? [254, 242, 242] as const : [255, 255, 255] as const);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(154, iy - 5, W - 165, 12.5, 2, 2, "FD");
    setFill(doc, idx === 4 ? RED : BLUE);
    doc.circle(158.2, iy + 0.7, 1.35, "F");
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(text, W - 177);
    doc.text(lines.slice(0, 2), 162, iy);
    iy += 15;
  });

  // PAGE 2 — Financial / management analysis
  doc.addPage("a4", "landscape");
  drawPageChrome(doc, 2, title, logo);
  sectionTitle(doc, "Financial position", 11, 34);
  const financeCardW = (W - 22 - gap * 2) / 3;
  card(doc, 11, 40, financeCardW, 27, "Allocated Budget", money(allocated), "Current dashboard budget source", NAVY);
  card(doc, 11 + financeCardW + gap, 40, financeCardW, 27, "Budget Utilized", money(consumed), allocated > 0 ? `${((consumed / allocated) * 100).toFixed(2)}% of allocation` : "No allocation denominator", RED);
  card(doc, 11 + (financeCardW + gap) * 2, 40, financeCardW, 27, "Remaining Budget", money(remaining), "Reported remaining budget", BLUE);

  sectionTitle(doc, `Financial progress by ${reportRowLabel(view, selection)}`, 11, 79);
  horizontalBars(doc, rows, "financial", 11, 85, 132, 7);

  sectionTitle(doc, "Physical vs financial alignment", 154, 79);
  const alignRows: ReportRow[] = [
    { id: 1, name: "Physical Progress", physical, financial: physical, projectCount: projects.length },
    { id: 2, name: "Financial Progress", physical: financial, financial, projectCount: projects.length },
  ];
  horizontalBars(doc, alignRows, "physical", 154, 87, W - 165, 2);

  const physicalFinancialGap = physical - financial;
  card(
    doc,
    154,
    111,
    W - 165,
    25,
    "Execution Gap",
    `${Math.abs(physicalFinancialGap).toFixed(2)} pp`,
    physicalFinancialGap >= 0 ? "Physical progress is above financial progress" : "Financial progress is above physical progress",
    Math.abs(physicalFinancialGap) >= 20 ? RED : AMBER,
  );

  sectionTitle(doc, "Management attention", 154, 148);
  const attention = [
    delayed > 0 ? `${delayed} project${delayed === 1 ? " has" : "s have"} a recorded delay flag.` : "No projects in the current scope carry a recorded delay flag.",
    rows.length > 0 ? `${rows.filter((r) => r.physical < 25).length} ${reportRowLabel(view, selection).toLowerCase()} record${rows.filter((r) => r.physical < 25).length === 1 ? "s" : ""} are below 25% physical progress.` : "No comparison rows are available.",
    allocated > 0 ? `${((remaining / allocated) * 100).toFixed(2)}% of the reported allocated budget remains.` : "No allocated budget is available for ratio analysis.",
  ];
  let ay = 155;
  attention.forEach((text) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(154, ay - 5, W - 165, 11.5, 2, 2, "FD");
    doc.setFillColor(...RED);
    doc.circle(158.2, ay + 0.4, 1.25, "F");
    doc.setTextColor(...TEXT);
    doc.setFontSize(7.4);
    doc.text(doc.splitTextToSize(text, W - 177).slice(0, 2), 162, ay);
    ay += 13.5;
  });

  doc.setTextColor(...MUTED);
  doc.setFontSize(7.2);
  doc.text(
    "Data note: this report visualizes the current dashboard API values for the selected scope. It does not independently recalculate the authoritative physical hierarchy.",
    11,
    190,
    { maxWidth: 132 },
  );

  const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`PSCA-Progress-Report-${safeTitle || view}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
