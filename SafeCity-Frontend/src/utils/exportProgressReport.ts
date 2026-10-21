/**
 * exportProgressReport.ts
 * ============================================================
 * Professional chart-led PDF progress report — jsPDF A4 portrait.
 *
 * Fixes applied (v3 — no double text, no overlap, clean alignment):
 *   - MY raised to 29 so content never clips the header.
 *   - sectionTitle() uses strict top-to-bottom Y flow with no
 *     backwards offsets; circle → title → underline → subtitle.
 *   - kpiCard() positions every element relative to (x, y) with
 *     absolute offsets so nothing overflows the card.
 *   - hBarChart() removes meta text entirely — it caused row
 *     crowding. Bar label is truncated tighter (max 20 chars).
 *   - buildPage*() functions use precise remaining-height math
 *     and never stack sections beyond CONTENT_BOTTOM.
 *   - scopeName never duplicated — header shows it, sectionTitle
 *     subtitles are content-specific.
 *   - All hard-coded "30 mm magic offsets" replaced with
 *     calculated values.
 *   - distributionChart Y-axis label removed (too small/overlapping).
 *   - statusBar legend wrapped into two rows with proper row spacing.
 *
 * Physical progress: only physical_progress via formatProgress().
 * ============================================================
 */

import jsPDF from "jspdf";
import { mediaUrl } from "@/api/config";
import { listDelayLogs, type DelayLogItem } from "@/api/delayLog";
import { listProgressImages, type ProgressImage } from "@/api/progressImage";
import type { DashboardPageData } from "@/api/dashboard";
import { formatProgress } from "./dashboardPhysicalProgress";
import {
  buildReportData,
  type ReportData,
  type ScopeType,
} from "./buildProgressReportData";
import {
  buildStatusComposition,
  buildAttentionProfile,
  buildDecisionBullets,
  buildHierarchyBars,
  buildTopProjectBars,
  buildAttentionBars,
  buildProjectLoadBars,
  buildManagementTableRows,
  type ChartBar,
} from "./progressReportAnalytics";

// ─────────────────────────────────────────────────────────────
// COLOR PALETTE
// ─────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number];
const NAVY:      Rgb = [17, 31, 70];
const BLUE:      Rgb = [30, 58, 138];
const RED:       Rgb = [185, 28, 28];
const GREEN:     Rgb = [22, 163, 74];
const AMBER:     Rgb = [37, 99, 235]; // warning is rendered as blue in executive reports to avoid orange-heavy visuals
const SLATE:     Rgb = [71, 85, 105];
const WHITE:     Rgb = [255, 255, 255];
const SOFT_BLUE: Rgb = [238, 243, 252];
const BORDER:    Rgb = [220, 227, 239];
const TEXT:      Rgb = [25, 35, 56];
const MUTED:     Rgb = [100, 116, 139];
const GOLD:      Rgb = [37, 99, 235];

// ─────────────────────────────────────────────────────────────
// PAGE GEOMETRY  (all in mm, portrait A4 = 210 × 297 mm)
// ─────────────────────────────────────────────────────────────

const PW = 210;
const PH = 297;
const MX = 12;          // left/right margin for print-safe A4 portrait
const HEADER_H = 24;    // formal header band
const MY = HEADER_H + 7;
const FOOTER_TOP = PH - 15;
const CW = PW - MX * 2;
const CB = FOOTER_TOP - 8;  // reserved footer clearance for print/export
const AVAIL = CB - MY;

// ─────────────────────────────────────────────────────────────
// LOW-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────

const f = (doc: jsPDF, c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);
const t = (doc: jsPDF, c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
const d = (doc: jsPDF, c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);

function clamp(v: number): number { return Math.max(0, Math.min(100, v)); }

function progressRgb(v: number): Rgb {
  if (v >= 75) return GREEN;
  if (v > 0) return BLUE;
  return SLATE;
}

function trunc(s: string, max = 28): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function today(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function hexToRgb(hex: string): Rgb {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
}

// ─────────────────────────────────────────────────────────────
// PANEL  (white card with shadow + border)
// ─────────────────────────────────────────────────────────────

function panel(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  // shadow
  f(doc, [226, 232, 242]); doc.roundedRect(x + 0.45, y + 0.45, w, h, 2, 2, "F");
  // card
  f(doc, WHITE); d(doc, BORDER); doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
}

// ─────────────────────────────────────────────────────────────
// IMAGE HELPER
// ─────────────────────────────────────────────────────────────

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// PAGE CHROME  (header + footer)
// ─────────────────────────────────────────────────────────────

function drawHeader(
  doc: jsPDF, report: ReportData,
  pageNo: number, totalPages: number,
  logo: string | null,
): void {
  // Background
  f(doc, NAVY); doc.rect(0, 0, PW, 24, "F");

  // Diagonal decorative stripes (right side, very subtle)
  d(doc, [35, 58, 105]); doc.setLineWidth(1.8);
  [PW - 40, PW - 28, PW - 16].forEach((sx) => doc.line(sx, 0, sx + 20, 24));

  // Clean PSCA accent strips — no orange/gold band
  f(doc, BLUE); doc.rect(0, 24, PW, 0.6, "F");
  f(doc, RED); doc.rect(0, 24.6, PW, 1.4, "F");

  // Logo
  const textX = logo ? 28 : MX;
  if (logo) { try { doc.addImage(logo, "PNG", 10, 3.5, 13, 13); } catch { /* optional */ } }

  // Title (line 1)
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(11.2);
  doc.text("PSCA  PHYSICAL PROGRESS REPORT", textX, 9);

  // Scope name (line 2) — only shown ONCE here, never repeated in section titles
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  t(doc, [185, 200, 230]);
  doc.text(trunc(report.scope.scopeName, 80), textX, 15.5);

  // Scope-type badge (top-right)
  f(doc, [25, 45, 90]); doc.roundedRect(PW - 58, 4, 27, 8, 2, 2, "F");
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
  doc.text(
    report.scope.scopeType.replace(/-/g, " ").toUpperCase(),
    PW - 44.5, 8.5, { align: "center" },
  );

  // Date + page (top-right, second line)
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  t(doc, [170, 185, 210]);
  doc.text(`${today()}`, PW - MX, 16.5, { align: "right" });

  // Page badge
  f(doc, RED); doc.roundedRect(PW - 58, 14, 18, 7, 2, 2, "F");
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(`${pageNo} / ${totalPages}`, PW - 49, 18.5, { align: "center" });
}

function drawFooter(doc: jsPDF, pageNo: number, totalPages: number): void {
  // Background
  f(doc, [244, 246, 252]); doc.rect(0, FOOTER_TOP - 1, PW, PH - FOOTER_TOP + 1, "F");
  // Rule
  d(doc, BLUE); doc.setLineWidth(0.5);
  doc.line(MX, FOOTER_TOP, PW - MX, FOOTER_TOP);
  // Left text
  t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  doc.text("PSCA SafeCity  •  Physical progress analytics  •  CONFIDENTIAL", MX, FOOTER_TOP + 4);
  doc.text(`Page ${pageNo} of ${totalPages}`, PW - MX, FOOTER_TOP + 4, { align: "right" });
}

function drawPageBg(doc: jsPDF): void {
  f(doc, [251, 252, 255]); doc.rect(0, 0, PW, PH, "F");
}

// ─────────────────────────────────────────────────────────────
// SECTION TITLE
// Returns Y coordinate of the first pixel BELOW the title block.
// Strict top-to-bottom — no backwards offsets.
// ─────────────────────────────────────────────────────────────

function sectionTitle(
  doc: jsPDF, title: string,
  x: number, y: number,
  subtitle?: string,
): number {
  // Minimal formal heading: dot + title + underline, no heavy full-width band.
  f(doc, RED); doc.circle(x + 1.6, y + 2.8, 1.15, "F");

  t(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(8.2);
  doc.text(title, x + 5.5, y + 3.8);

  f(doc, RED); doc.roundedRect(x + 5.5, y + 5.5, 21, 0.75, 0.35, 0.35, "F");

  let nextY = y + 8.5;
  if (subtitle) {
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
    doc.text(trunc(subtitle, 96), x + 5.5, nextY);
    nextY += 3.8;
  }
  return nextY + 1.2;
}

// ─────────────────────────────────────────────────────────────
// KPI CARD
// All positions are offsets inside the card box (x, y, w, h).
// cardH must be at least 20mm for comfortable layout.
// ─────────────────────────────────────────────────────────────

function kpiCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  accent: Rgb = BLUE,
): void {
  // Shadow
  f(doc, [210, 218, 232]); doc.roundedRect(x + 0.7, y + 0.7, w, h, 2, 2, "F");
  // Card
  panel(doc, x, y, w, h);
  // Left accent bar (3 mm wide)
  f(doc, accent); doc.roundedRect(x, y, 3, h, 1, 1, "F");
  // Top-right accent dot
  f(doc, accent); doc.circle(x + w - 3.5, y + 3.5, 1.8, "F");

  // Label  (top area: y + 5)
  t(doc, MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
  doc.text(trunc(label.toUpperCase(), 22), x + 5.5, y + 5.5);

  // Value  (middle: y + 13)
  t(doc, accent); doc.setFontSize(13.5);
  doc.text(value, x + 5.5, y + 13.5);

  // Sub-label  (bottom: y + h - 4)
  if (sub && h >= 22) {
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.7);
    doc.text(trunc(sub, 26), x + 5.5, y + h - 4);
  }
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR CHART
// Each row is self-contained. No meta text (prevents row crowding).
// ─────────────────────────────────────────────────────────────

function hBarChart(
  doc: jsPDF, bars: ChartBar[],
  x: number, y: number, w: number, h: number,
  maxValue = 100, maxRows = 12,
): void {
  panel(doc, x, y, w, h);
  const data = bars.slice(0, maxRows);
  if (!data.length) {
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    doc.text("No data available.", x + w / 2, y + h / 2, { align: "center" });
    return;
  }

  const LABEL_W = Math.min(46, w * 0.36);
  const VAL_W   = 15;
  const BAR_W   = w - LABEL_W - VAL_W - 8;
  const rowH    = (h - 6) / data.length;

  data.forEach((bar, i) => {
    const ry = y + 3 + i * rowH;

    // Alternating row stripe
    if (i % 2 !== 0) {
      f(doc, [248, 250, 254]);
      doc.rect(x + 1.5, ry, w - 3, rowH, "F");
    }

    // Label (vertically centered in the row)
    const labelY = ry + rowH * 0.62;
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
    doc.text(trunc(bar.label, 20), x + 3.5, labelY, { maxWidth: LABEL_W - 5 });

    // Track
    f(doc, [222, 230, 245]);
    doc.roundedRect(x + LABEL_W, ry + rowH * 0.18, BAR_W, rowH * 0.6, 0.7, 0.7, "F");

    // Fill
    const val = Math.max(0, Math.min(maxValue, bar.value ?? 0));
    const fillW = val > 0 ? Math.max(1.5, (val / Math.max(maxValue, 1)) * BAR_W) : 0;
    const barRgb = bar.color ? hexToRgb(bar.color) : progressRgb(val);
    if (fillW > 0) {
      f(doc, barRgb);
      doc.roundedRect(x + LABEL_W, ry + rowH * 0.18, fillW, rowH * 0.6, 0.7, 0.7, "F");
    }

    // Value badge
    t(doc, barRgb); doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    const valStr = maxValue === 100 ? `${formatProgress(val)}%` : String(Math.round(val));
    doc.text(valStr, x + LABEL_W + BAR_W + 2, labelY);
  });
}

// ─────────────────────────────────────────────────────────────
// DISTRIBUTION COLUMN CHART
// ─────────────────────────────────────────────────────────────

function distributionChart(
  doc: jsPDF, report: ReportData,
  x: number, y: number, w: number, h: number,
): void {
  panel(doc, x, y, w, h);
  const rows = report.distribution;
  const max = Math.max(...rows.map((r) => r.count), 1);

  // Compact decision-support bucket bars instead of a tall column chart.
  const padX = 5;
  const padTop = 5;
  const rowH = Math.min(8, (h - padTop - 5) / Math.max(rows.length, 1));
  const labelW = Math.min(30, w * 0.30);
  const countW = 12;
  const barW = w - padX * 2 - labelW - countW - 4;

  rows.forEach((row, i) => {
    const ry = y + padTop + i * rowH;
    const value = row.count;
    const pctW = value > 0 ? Math.max(2, (value / max) * barW) : 0;
    const isZeroBucket = row.bucket === "0%";
    const fillRgb: Rgb = isZeroBucket ? RED : value > 0 ? BLUE : [203, 213, 225];

    if (i % 2 !== 0) {
      f(doc, [248, 250, 254]);
      doc.roundedRect(x + 2, ry - 1.2, w - 4, rowH, 0.7, 0.7, "F");
    }

    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    doc.text(row.bucket, x + padX, ry + 3.6);

    f(doc, [226, 232, 242]);
    doc.roundedRect(x + padX + labelW, ry + 1, barW, 3.8, 1, 1, "F");

    if (pctW > 0) {
      f(doc, fillRgb);
      doc.roundedRect(x + padX + labelW, ry + 1, pctW, 3.8, 1, 1, "F");
    }

    t(doc, fillRgb); doc.setFont("helvetica", "bold"); doc.setFontSize(6.2);
    doc.text(String(value), x + padX + labelW + barW + countW - 2, ry + 3.8, { align: "right" });
  });
}

// ─────────────────────────────────────────────────────────────
// DATA TABLE
// ─────────────────────────────────────────────────────────────

interface Col {
  key: string; label: string; w: number;
  align?: "left" | "right" | "center";
  maxLen?: number;
}

function dataTable(
  doc: jsPDF,
  x: number, y: number, w: number,
  cols: Col[],
  rows: Array<Record<string, string | number>>,
  maxRows = 16,
  rowH = 6,
): number {
  const display = rows.slice(0, maxRows);
  const HEAD_H = 7;
  const totalH = HEAD_H + display.length * rowH + 1;

  panel(doc, x, y, w, totalH);

  // Header row
  f(doc, NAVY); doc.roundedRect(x, y, w, HEAD_H, 2, 2, "F");

  let cx = x + 2.5;
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(5.7);
  cols.forEach((c) => {
    const tx = c.align === "right" ? cx + c.w - 2 : c.align === "center" ? cx + c.w / 2 : cx;
    doc.text(c.label.toUpperCase(), tx, y + 4.8, { align: c.align ?? "left" });
    // Header col divider
    if (cx + c.w < x + w - 1) {
      d(doc, [255, 255, 255]); doc.setLineWidth(0.15);
      doc.line(cx + c.w, y + 1, cx + c.w, y + HEAD_H - 1);
    }
    cx += c.w;
  });

  if (!display.length) {
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    doc.text("No data.", x + 4, y + HEAD_H + 8);
    return totalH;
  }

  display.forEach((row, i) => {
    const ry = y + HEAD_H + i * rowH;

    // Alternating background
    f(doc, i % 2 === 0 ? [255, 255, 255] : [248, 250, 255]);
    doc.rect(x + 0.8, ry, w - 1.6, rowH, "F");

    // Row divider
    d(doc, [232, 238, 248]); doc.setLineWidth(0.2);
    doc.line(x + 1.5, ry + rowH, x + w - 1.5, ry + rowH);

    // Col dividers
    cx = x + 2.5;
    cols.forEach((c) => {
      if (cx + c.w < x + w - 1) {
        d(doc, [228, 234, 245]); doc.setLineWidth(0.15);
        doc.line(cx + c.w, ry + 0.5, cx + c.w, ry + rowH - 0.5);
      }
      cx += c.w;
    });

    // Cell text
    cx = x + 2.5;
    cols.forEach((c) => {
      const raw = String(row[c.key] ?? "—");
      const display = c.maxLen ? trunc(raw, c.maxLen) : raw;
      const tx = c.align === "right" ? cx + c.w - 2 : c.align === "center" ? cx + c.w / 2 : cx;

      // Status-aware cell color
      const lower = raw.toLowerCase();
      let cellRgb: Rgb = TEXT;
      if (lower.includes("delay") || lower === "yes") cellRgb = RED;
      else if (lower.includes("complet"))               cellRgb = GREEN;
      else if (lower.includes("progress"))              cellRgb = BLUE;
      else if (lower === "no")                          cellRgb = [60, 140, 60];

      t(doc, cellRgb); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
      doc.text(display, tx, ry + 4, { align: c.align ?? "left", maxWidth: c.w - 2 });
      cx += c.w;
    });
  });

  return totalH;
}

// ─────────────────────────────────────────────────────────────
// INSIGHT PANEL
// ─────────────────────────────────────────────────────────────

function insightPanel(
  doc: jsPDF, insights: string[],
  x: number, y: number, w: number, h: number,
  heading = "Portfolio Observations",
): void {
  // Background
  f(doc, [237, 243, 255]); doc.roundedRect(x, y, w, h, 2, 2, "F");
  d(doc, [180, 200, 240]); doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, "D");
  // Left accent strip
  f(doc, BLUE); doc.roundedRect(x, y, 3, h, 1.5, 1.5, "F");

  // Heading (well above first bullet)
  t(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text(heading.toUpperCase(), x + 6, y + 6.5);

  // Separator line
  d(doc, [180, 200, 240]); doc.setLineWidth(0.3);
  doc.line(x + 5, y + 8.5, x + w - 4, y + 8.5);

  // Bullets — each on its own line, 6 mm apart
  let iy = y + 13;
  const lineH = 6;
  insights.slice(0, 4).forEach((ins) => {
    // Square bullet
    f(doc, BLUE); doc.rect(x + 5, iy - 2.5, 2, 2, "F");
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    const lines = doc.splitTextToSize(ins, w - 13).slice(0, 2);
    doc.text(lines, x + 9.5, iy);
    iy += lineH + (lines.length > 1 ? 3 : 0);
  });
}

// ─────────────────────────────────────────────────────────────
// STATUS BAR
// ─────────────────────────────────────────────────────────────

function statusBar(
  doc: jsPDF, report: ReportData,
  x: number, y: number, w: number, h: number,
): void {
  panel(doc, x, y, w, h);
  const comp = buildStatusComposition(report.projects);
  const total = Math.max(report.projects.length, 1);

  // Title
  t(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text("STATUS COMPOSITION", x + 4, y + 6);

  // Stacked bar
  const bY = y + 10, bH = 7;
  const bW = w - 10;
  d(doc, BORDER); doc.setLineWidth(0.3); doc.rect(x + 5, bY, bW, bH, "D");
  let bx = x + 5;
  comp.forEach((s) => {
    const sw = s.count > 0 ? Math.max(0.5, (s.count / total) * bW) : 0;
    if (sw > 0) { f(doc, hexToRgb(s.color)); doc.rect(bx, bY, sw, bH, "F"); }
    bx += sw;
  });

  // Legend — two rows of 2 items each to avoid overflow
  const legendItems = comp.slice(0, 4);
  const colW = (w - 10) / 2;
  legendItems.forEach((s, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const lx = x + 5 + col * colW;
    const ly = bY + bH + 5 + row * 6;
    f(doc, hexToRgb(s.color)); doc.circle(lx + 1.5, ly - 1, 1.5, "F");
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.7);
    doc.text(`${s.label}: ${s.count} (${s.pct}%)`, lx + 4.5, ly);
  });
}


// ─────────────────────────────────────────────────────────────
// EVIDENCE HELPERS
// ─────────────────────────────────────────────────────────────

interface ReportEvidence {
  delayLogs: DelayLogItem[];
  progressImages: ProgressImage[];
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function projectIds(report: ReportData): Set<number> {
  return new Set(report.projects.map((p) => Number(p.id)).filter(Number.isFinite));
}

function absoluteMediaSrc(src: string): string {
  const clean = String(src || "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean) || clean.startsWith("data:")) return clean;
  return mediaUrl(clean);
}

function imageSrc(img: ProgressImage): string {
  return absoluteMediaSrc(String((img as any).image_url ?? (img as any).image ?? ""));
}

function delayProjectId(log: DelayLogItem): number {
  return asNumber((log as any).project);
}

function imageProjectId(img: ProgressImage): number {
  return asNumber((img as any).project);
}

function imageActivityId(img: ProgressImage): number {
  return asNumber((img as any).activity);
}

function delayActivityId(log: DelayLogItem): number {
  return asNumber((log as any).activity);
}

function delayActionBy(log: DelayLogItem): string {
  const info = log.action_by_info;
  if (!info) return "—";
  return info.stakeholder_title || info.stakeholder_type || "—";
}

function delaySummaryText(log: DelayLogItem, max = 72): string {
  const pieces = [
    log.category ? String(log.category) : "Delay",
    log.issue ? String(log.issue) : "Issue recorded",
    log.recommended_action ? `Action: ${log.recommended_action}` : "",
  ].filter(Boolean);
  return trunc(pieces.join(" — "), max);
}

function sumDelayDays(logs: DelayLogItem[]): number {
  return logs.reduce((sum, log) => sum + asNumber((log as any).delay_days), 0);
}

function groupByProject<T>(items: T[], getId: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  items.forEach((item) => {
    const id = getId(item);
    if (!Number.isFinite(id) || id <= 0) return;
    const arr = map.get(id) ?? [];
    arr.push(item);
    map.set(id, arr);
  });
  return map;
}

async function fetchEvidenceForReport(
  report: ReportData,
  includeProgressImages = true,
): Promise<ReportEvidence> {
  const ids = projectIds(report);
  if (!ids.size) return { delayLogs: [], progressImages: [] };

  // Delay logs are required for project reports. Progress images are fetched
  // only when the selected-project report needs them. The All Projects report
  // intentionally excludes image evidence.
  const [delayResult] = await Promise.allSettled([listDelayLogs()]);
  const delayLogs = delayResult.status === "fulfilled"
    ? (((delayResult.value as any).data ?? []) as DelayLogItem[])
    : [];

  let progressImages: ProgressImage[] = [];
  if (includeProgressImages) {
    const [imageResult] = await Promise.allSettled([listProgressImages()]);
    progressImages = imageResult.status === "fulfilled"
      ? ((Array.isArray(imageResult.value) ? imageResult.value : []) as ProgressImage[])
      : [];
  }

  return {
    delayLogs: delayLogs.filter((log) => ids.has(delayProjectId(log))),
    progressImages: progressImages.filter((img) => ids.has(imageProjectId(img))),
  };
}

function buildDelayDetailRows(report: ReportData, evidence: ReportEvidence, maxRows = 18): Array<Record<string, string | number>> {
  const projectById = new Map(report.projects.map((p) => [Number(p.id), p]));
  return evidence.delayLogs
    .slice()
    .sort((a, b) => asNumber((b as any).delay_days) - asNumber((a as any).delay_days))
    .slice(0, maxRows)
    .map((log) => {
      const p = projectById.get(delayProjectId(log));
      return {
        project: p ? `${p.project_name}${p.district_name ? ` — ${p.district_name}` : ""}` : `Project #${delayProjectId(log)}`,
        activity: delayActivityId(log) ? `Activity #${delayActivityId(log)}` : "—",
        days: `${asNumber((log as any).delay_days)}d`,
        period: `${log.delay_start_date ?? "—"} to ${log.delay_end_date ?? "—"}`,
        issue: delaySummaryText(log, 78),
        actionBy: delayActionBy(log),
      };
    });
}

async function drawEvidenceThumbnails(doc: jsPDF, images: ProgressImage[], x: number, y: number, w: number, h: number): Promise<number> {
  panel(doc, x, y, w, h);
  t(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(7.4);
  doc.text("PROGRESS IMAGE EVIDENCE", x + 4, y + 6.5);
  t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.8);
  doc.text("Latest uploaded photos linked with projects/activities.", x + 4, y + 10.5);

  const shown = images.slice(0, 6);
  if (!shown.length) {
    drawReportNote(doc, x + 4, y + 17, w - 8, "No progress image evidence is available for this scope.");
    return y + h;
  }

  const gap = 3;
  const cols = 3;
  const thumbW = (w - 8 - gap * (cols - 1)) / cols;
  const thumbH = Math.min(29, (h - 18 - gap) / 2);
  await Promise.all(shown.map(async (img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ix = x + 4 + col * (thumbW + gap);
    const iy = y + 15 + row * (thumbH + gap + 7);
    if (iy + thumbH + 6 > y + h - 3) return;
    f(doc, [241, 245, 249]); d(doc, BORDER); doc.roundedRect(ix, iy, thumbW, thumbH + 6, 1.4, 1.4, "FD");
    const dataUrl = await imageUrlToDataUrl(imageSrc(img));
    if (dataUrl) {
      try { doc.addImage(dataUrl, ix + 1.2, iy + 1.2, thumbW - 2.4, thumbH - 2.4); } catch { /* ignore image issues */ }
    } else {
      t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("Image unavailable", ix + thumbW / 2, iy + thumbH / 2, { align: "center" });
    }
    t(doc, SLATE); doc.setFont("helvetica", "normal"); doc.setFontSize(5.2);
    const cap = img.caption || img.image_date || `Activity #${imageActivityId(img) || "—"}`;
    doc.text(trunc(cap, 24), ix + 2, iy + thumbH + 3.8);
  }));
  return y + h;
}

function drawDelaySummaryCards(doc: jsPDF, evidence: ReportEvidence, x: number, y: number, w: number): number {
  const delayedProjects = new Set(evidence.delayLogs.map(delayProjectId));
  const delayDays = sumDelayDays(evidence.delayLogs);
  const imagesForDelayed = evidence.progressImages.filter((img) => delayedProjects.has(imageProjectId(img))).length;
  const gap = 3;
  const cardW = (w - gap * 3) / 4;
  const cards: Array<[string, string, string, Rgb]> = [
    ["Delay Projects", String(delayedProjects.size), "with log records", delayedProjects.size ? RED : SLATE],
    ["Delay Days", String(delayDays), "total recorded", delayDays ? RED : SLATE],
    ["Delay Logs", String(evidence.delayLogs.length), "project/activity level", evidence.delayLogs.length ? RED : SLATE],
    ["Evidence Images", String(imagesForDelayed), "linked to delayed projects", imagesForDelayed ? GREEN : SLATE],
  ];
  cards.forEach(([lbl, val, sub, color], i) => kpiCard(doc, x + i * (cardW + gap), y, cardW, 22, lbl, val, sub, color));
  return y + 27;
}

async function buildProjectLevelDelayEvidencePage(
  doc: jsPDF,
  report: ReportData,
  evidence: ReportEvidence,
  logo: string | null,
  pageNo: number,
  totalPages: number,
  includeProgressImages = true,
): Promise<void> {
  doc.addPage("a4", "portrait");
  drawPageBg(doc); drawHeader(doc, report, pageNo, totalPages, logo); drawFooter(doc, pageNo, totalPages);

  let y = sectionTitle(
    doc,
    includeProgressImages ? "Project-Level Delay & Evidence Register" : "Project-Level Delay Register",
    MX,
    MY,
    includeProgressImages
      ? "Delay log details and progress images are fetched from backend evidence APIs."
      : "Delay log details are fetched from the backend and summarized by project.",
  );

  if (includeProgressImages) {
    y = drawDelaySummaryCards(doc, evidence, MX, y, CW);
  } else {
    const delayDays = sumDelayDays(evidence.delayLogs);
    const gap = 3;
    const cardW = (CW - gap) / 2;
    const cards: Array<[string, string, string, Rgb]> = [
      ["Delay Days", String(delayDays), "total recorded", delayDays ? RED : SLATE],
      ["Delay Logs", String(evidence.delayLogs.length), "project/activity level", evidence.delayLogs.length ? RED : SLATE],
    ];
    cards.forEach(([lbl, val, sub, color], i) =>
      kpiCard(doc, MX + i * (cardW + gap), y, cardW, 22, lbl, val, sub, color),
    );
    y += 27;
  }

  y = sectionTitle(doc, "Delay Details by Project", MX, y, "Issue, period, delay days and responsible/action party where recorded.");
  const delayCols: Col[] = [
    { key: "project", label: "Project", w: CW * 0.22, maxLen: 22 },
    { key: "activity", label: "Activity", w: CW * 0.12, maxLen: 12 },
    { key: "days", label: "Days", w: CW * 0.08, align: "center" },
    { key: "period", label: "Period", w: CW * 0.18, maxLen: 24 },
    { key: "issue", label: "Issue / Recommended Action", w: CW * 0.30, maxLen: 46 },
    { key: "actionBy", label: "Action By", w: CW * 0.10, maxLen: 12 },
  ];
  const delayRows = buildDelayDetailRows(report, evidence, 10);
  y += dataTable(doc, MX, y, CW, delayCols, delayRows, 10, 8) + 7;

  if (includeProgressImages) {
    if (CB - y > 67) {
      await drawEvidenceThumbnails(doc, evidence.progressImages, MX, y, CW, Math.min(66, CB - y));
    } else if (CB - y >= 18) {
      drawReportNote(
        doc,
        MX,
        y,
        CW,
        evidence.progressImages.length
          ? `${evidence.progressImages.length} progress image(s) are available for this scope. Open selected project report for larger evidence view.`
          : "No progress image evidence is available for this scope.",
      );
    }
  }
}

function drawReportNote(doc: jsPDF, x: number, y: number, w: number, textValue: string): number {
  f(doc, [248, 250, 252]); d(doc, BORDER); doc.roundedRect(x, y, w, 13, 2, 2, "FD");
  t(doc, SLATE); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  const lines = doc.splitTextToSize(textValue, w - 8).slice(0, 2);
  doc.text(lines, x + 4, y + 5.4);
  return y + 15;
}

// ─────────────────────────────────────────────────────────────
// PAGE BUILDERS — A4 portrait, print-safe, sequential layout
// ─────────────────────────────────────────────────────────────

function buildPage1Executive(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  drawPageBg(doc); drawHeader(doc, report, pageNo, totalPages, logo); drawFooter(doc, pageNo, totalPages);

  let y = MY;
  const GAP = 3;
  const CARD_W = (CW - GAP * 2) / 3;
  const CARD_H = 21;

  const cards: Array<[string, string, string, Rgb]> = [
    ["Physical Progress", `${formatProgress(report.kpis.overallPhysical)}%`, "Scope average", BLUE],
    ["Total Projects", String(report.kpis.totalProjects), "In current scope", NAVY],
    [report.kpis.activeUnitsLabel, String(report.kpis.activeUnits), "Hierarchy units", SLATE],
    ["Completed", String(report.kpis.completedProjects), "100% physical", GREEN],
    ["In Progress", String(report.kpis.inProgressProjects), "Active execution", BLUE],
    ["Attention", String(report.attentionProjects.length), "Low progress/delay", RED],
  ];

  cards.forEach(([lbl, val, sub, acc], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    kpiCard(doc, MX + col * (CARD_W + GAP), y + row * (CARD_H + GAP), CARD_W, CARD_H, lbl, val, sub, acc);
  });
  y += CARD_H * 2 + GAP + 7;

  y = sectionTitle(doc, `${report.kpis.activeUnitsLabel} Progress Ranking`, MX, y, "A layman-readable comparison of physical progress by area.");
  hBarChart(doc, buildHierarchyBars(report.hierarchyUnits, 9), MX, y, CW, 56);
  y += 61;

  y = sectionTitle(doc, "Project Progress Distribution", MX, y, "Number of projects in each physical-progress bucket.");
  distributionChart(doc, report, MX, y, CW, 50);
  y += 55;

  const remaining = CB - y;
  if (remaining >= 24) {
    insightPanel(doc, report.insights.slice(0, 4), MX, y, CW, Math.min(remaining, 36), "Executive Insights");
  }
}

function buildPage2Comparison(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "portrait");
  drawPageBg(doc); drawHeader(doc, report, pageNo, totalPages, logo); drawFooter(doc, pageNo, totalPages);

  let y = MY;
  y = sectionTitle(doc, `Project Load by ${report.kpis.activeUnitsLabel}`, MX, y, "Where the project workload is concentrated.");
  const loadBars = buildProjectLoadBars(report.hierarchyUnits, 10).map((b) => ({ ...b, color: "#2563EB" }));
  hBarChart(doc, loadBars, MX, y, CW, 54, Math.max(...loadBars.map((b) => b.value), 1));
  y += 60;

  y = sectionTitle(doc, "Top Performing Projects", MX, y, "Top projects by physical progress, with geography context.");
  hBarChart(doc, buildTopProjectBars(report.topProjects, 8), MX, y, CW, 54);
  y += 60;

  y = sectionTitle(doc, "Projects Requiring Attention", MX, y, "0%, below 25%, or delay-affected projects.");
  hBarChart(doc, buildAttentionBars(report.attentionProjects, 8), MX, y, CW, 54);
  y += 60;

  if (CB - y >= 18) drawReportNote(doc, MX, y, CW, "Priority should be placed on low-progress and delay-affected projects before reviewing normally progressing work.");
}

function buildPage3Execution(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "portrait");
  drawPageBg(doc); drawHeader(doc, report, pageNo, totalPages, logo); drawFooter(doc, pageNo, totalPages);

  let y = MY;
  const profile = buildAttentionProfile(report.projects);

  y = sectionTitle(doc, "Execution Attention Profile", MX, y, "Simple indicators showing where management follow-up is needed.");
  const GAP = 3;
  const MINI_W = (CW - GAP * 2) / 3;
  const MINI_H = 23;
  const items: Array<[string, number, Rgb]> = [
    ["At 0%", profile.zeroProgress, RED],
    ["Below 25%", profile.below25, BLUE],
    ["25-50%", profile.between25and50, SLATE],
    ["Above 75%", profile.above75, GREEN],
    ["Completed", profile.completed, GREEN],
    ["With Delays", profile.withDelay, RED],
  ];
  items.forEach(([lbl, val, acc], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    kpiCard(doc, MX + col * (MINI_W + GAP), y + row * (MINI_H + GAP), MINI_W, MINI_H, lbl, String(val), "project(s)", acc);
  });
  y += MINI_H * 2 + GAP + 8;

  y = sectionTitle(doc, "Status Composition", MX, y, "Completed, in-progress, delayed and pending projects.");
  statusBar(doc, report, MX, y, CW, 42);
  y += 49;

  y = sectionTitle(doc, "Lowest Progress Projects", MX, y, "Projects that require immediate progress review.");
  hBarChart(doc, buildAttentionBars(report.bottomProjects, 8), MX, y, CW, 55);
  y += 60;

  if (CB - y >= 22) insightPanel(doc, report.insights.slice(0, 4), MX, y, CW, CB - y, "Decision Signals");
}

function buildPage4Register(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "portrait");
  drawPageBg(doc); drawHeader(doc, report, pageNo, totalPages, logo); drawFooter(doc, pageNo, totalPages);

  const titleEnd = sectionTitle(doc, "Management Project Register", MX, MY, "Attention projects first. No elapsed-time or schedule-variance columns.");

  const sorted = [
    ...report.attentionProjects,
    ...report.projects.filter((p) => !report.attentionProjects.some((a) => a.id === p.id)).sort((a, b) => a.physical_progress - b.physical_progress),
  ];

  const cols: Col[] = [
    { key: "project", label: "Project", w: CW * 0.31, maxLen: 24 },
    { key: "division", label: "Division", w: CW * 0.13, maxLen: 11 },
    { key: "district", label: "District", w: CW * 0.13, maxLen: 11 },
    { key: "tehsil", label: "Tehsil", w: CW * 0.12, maxLen: 11 },
    { key: "physical", label: "Physical", w: CW * 0.10, align: "right" },
    { key: "status", label: "Status", w: CW * 0.12, align: "center", maxLen: 12 },
    { key: "delay", label: "Delay", w: CW * 0.09, align: "center" },
  ];
  const ROW_H = 7;
  const maxRows = Math.min(25, Math.floor((CB - titleEnd - 9) / ROW_H));
  dataTable(doc, MX, titleEnd, CW, cols, buildManagementTableRows(sorted, maxRows), maxRows, ROW_H);
}

function buildPage5DecisionSummary(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "portrait");
  drawPageBg(doc); drawHeader(doc, report, pageNo, totalPages, logo); drawFooter(doc, pageNo, totalPages);

  let y = sectionTitle(doc, "Decision Summary", MX, MY, "Key findings and recommended management actions.");
  const bullets = buildDecisionBullets(report);
  bullets.slice(0, 7).forEach((b, i) => {
    if (y > CB - 18) return;
    f(doc, i < 2 ? RED : BLUE); doc.circle(MX + 3.5, y + 2, 1.8, "F");
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(7.4);
    const lines = doc.splitTextToSize(b, CW - 14).slice(0, 3);
    doc.text(lines, MX + 8, y + 4);
    y += 8 + (lines.length - 1) * 4;
  });

  y += 4;
  if (y + 46 <= CB) {
    y = sectionTitle(doc, "Progress Distribution", MX, y);
    distributionChart(doc, report, MX, y, CW, 46);
    y += 52;
  }
  if (CB - y >= 22) insightPanel(doc, report.insights.slice(0, 4), MX, y, CW, CB - y, "Management Notes");
}

async function drawEvidenceStrip(doc: jsPDF, evidence: ReportEvidence, x: number, y: number, w: number, h: number): Promise<void> {
  panel(doc, x, y, w, h);
  t(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("DELAY LOGS & PROGRESS EVIDENCE", x + 4, y + 7);
  d(doc, BORDER); doc.line(x + 4, y + 9, x + w - 4, y + 9);

  const delays = evidence.delayLogs.slice(0, 5);
  const images = evidence.progressImages.slice(0, 4);
  let cy = y + 16;
  if (delays.length) {
    delays.forEach((log) => {
      if (cy > y + h - 20) return;
      f(doc, [254, 242, 242]); d(doc, [252, 165, 165]); doc.roundedRect(x + 4, cy - 5, w - 8, 13, 1.5, 1.5, "FD");
      t(doc, RED); doc.setFont("helvetica", "bold"); doc.setFontSize(6.4);
      doc.text(`${log.delay_days ?? 0} day(s)`, x + 7, cy);
      t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.1);
      doc.text(trunc(delaySummaryText(log, 74), 74), x + 27, cy);
      t(doc, MUTED); doc.setFontSize(5.4);
      doc.text(`${log.delay_start_date ?? "—"} to ${log.delay_end_date ?? "—"} · ${delayActionBy(log)}`, x + 27, cy + 4.3);
      cy += 15;
    });
  } else {
    cy = drawReportNote(doc, x + 4, cy - 4, w - 8, "No delay records are available for this project scope.");
  }

  if (images.length) {
    const imgW = (w - 17) / 4;
    const imgY = Math.min(y + h - 38, cy + 2);
    await Promise.all(images.map(async (img, i) => {
      const src = imageSrc(img);
      const dataUrl = src ? await imageUrlToDataUrl(src) : null;
      const ix = x + 4 + i * (imgW + 3);
      f(doc, [241, 245, 249]); d(doc, BORDER); doc.roundedRect(ix, imgY, imgW, 33, 1.5, 1.5, "FD");
      if (dataUrl) {
        try { doc.addImage(dataUrl, ix + 1.5, imgY + 1.5, imgW - 3, 24); } catch { /* ignore image issues */ }
      } else {
        t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
        doc.text("Image unavailable", ix + imgW / 2, imgY + 13, { align: "center" });
      }
      t(doc, SLATE); doc.setFont("helvetica", "normal"); doc.setFontSize(5.2);
      doc.text(trunc(img.caption ?? img.image_date ?? `Activity #${imageActivityId(img) || "—"}`, 22), ix + 2, imgY + 30);
    }));
  } else if (y + h - cy >= 14) {
    drawReportNote(doc, x + 4, y + h - 18, w - 8, "No progress image evidence is available for this scope.");
  }
}

// ─────────────────────────────────────────────────────────────
// SCOPE REPORT ASSEMBLERS
// ─────────────────────────────────────────────────────────────

function buildAllDivisionsReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 5);
  buildPage2Comparison(doc, r, logo, 2, 5);
  buildPage3Execution(doc, r, logo, 3, 5);
  buildPage4Register(doc, r, logo, 4, 5);
  buildPage5DecisionSummary(doc, r, logo, 5, 5);
}
function buildAllDistrictsReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 4);
  buildPage2Comparison(doc, r, logo, 2, 4);
  buildPage3Execution(doc, r, logo, 3, 4);
  buildPage4Register(doc, r, logo, 4, 4);
}
function buildAllTehsilsReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 3);
  buildPage2Comparison(doc, r, logo, 2, 3);
  buildPage4Register(doc, r, logo, 3, 3);
}
async function buildAllProjectsReport(doc: jsPDF, r: ReportData, logo: string | null, evidence: ReportEvidence): Promise<void> {
  buildPage1Executive(doc, r, logo, 1, 2);
  await buildProjectLevelDelayEvidencePage(doc, r, evidence, logo, 2, 2, false);
}
function buildSelectedDivisionReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 5);
  buildPage2Comparison(doc, r, logo, 2, 5);
  buildPage3Execution(doc, r, logo, 3, 5);
  buildPage4Register(doc, r, logo, 4, 5);
  buildPage5DecisionSummary(doc, r, logo, 5, 5);
}
function buildSelectedDistrictReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 4);
  buildPage2Comparison(doc, r, logo, 2, 4);
  buildPage3Execution(doc, r, logo, 3, 4);
  buildPage4Register(doc, r, logo, 4, 4);
}
function buildSelectedTehsilReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 3);
  buildPage2Comparison(doc, r, logo, 2, 3);
  buildPage4Register(doc, r, logo, 3, 3);
}


async function buildSelectedProjectReport(doc: jsPDF, r: ReportData, logo: string | null, evidence: ReportEvidence): Promise<void> {
  // Page 1: formal project executive summary
  drawPageBg(doc); drawHeader(doc, r, 1, 2, logo); drawFooter(doc, 1, 2);

  const proj = r.projects[0];
  let y = MY;

  y = sectionTitle(doc, "Project Executive Summary", MX, y, proj?.project_name ?? r.scope.scopeName);

  const GAP = 3;
  const CARD_W = (CW - GAP * 2) / 3;
  const CARD_H = 22;
  const cards: Array<[string, string, string, Rgb]> = [
    ["Physical Progress", `${formatProgress(r.kpis.overallPhysical)}%`, "Project progress", BLUE],
    ["Financial", `${formatProgress(proj?.financial_progress ?? 0)}%`, "If available", SLATE],
    ["Status", proj ? proj.status.replace(/_/g, " ") : "-", "Current state", proj?.has_delay ? RED : BLUE],
    ["Delay Logs", String(evidence.delayLogs.length), "Recorded issues", evidence.delayLogs.length ? RED : SLATE],
    ["Evidence Images", String(evidence.progressImages.length), "Progress photos", evidence.progressImages.length ? GREEN : SLATE],
    ["Attention", r.attentionProjects.length ? "Yes" : "No", "Management flag", r.attentionProjects.length ? RED : GREEN],
  ];
  cards.forEach(([lbl, val, sub, acc], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    kpiCard(doc, MX + col * (CARD_W + GAP), y + row * (CARD_H + GAP), CARD_W, CARD_H, lbl, val, sub, acc);
  });
  y += CARD_H * 2 + GAP + 8;

  y = sectionTitle(doc, "Project Location and Scope", MX, y);
  const infoRows = [
    { label: "Division", value: proj?.division_name ?? "-" },
    { label: "District", value: proj?.district_name ?? "-" },
    { label: "Tehsil", value: proj?.tehsil_name ?? "-" },
    { label: "Project", value: proj?.project_name ?? r.scope.scopeName },
  ];
  panel(doc, MX, y, CW, 44);
  infoRows.forEach((row, i) => {
    const iy = y + 8 + i * 8;
    t(doc, MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(6.4);
    doc.text(row.label.toUpperCase(), MX + 5, iy);
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(7.4);
    doc.text(trunc(String(row.value), 78), MX + 34, iy);
  });
  y += 50;

  if (CB - y >= 28) {
    insightPanel(doc, r.insights.slice(0, 4), MX, y, CW, Math.min(34, CB - y), "Project Observations");
  }

  // Page 2: delay logs and evidence images
  doc.addPage("a4", "portrait");
  drawPageBg(doc); drawHeader(doc, r, 2, 2, logo); drawFooter(doc, 2, 2);

  y = MY;
  y = sectionTitle(doc, "Project Execution Evidence", MX, y, "Delay log records and progress images attached to delayed/active work.");
  await drawEvidenceStrip(doc, evidence, MX, y, CW, Math.min(118, CB - y));
  y += 124;

  if (CB - y >= 55) {
    y = sectionTitle(doc, "Project Register Snapshot", MX, y);
    const cols: Col[] = [
      { key: "project", label: "Project / Activity", w: CW * 0.42, maxLen: 36 },
      { key: "physical", label: "Physical", w: CW * 0.14, align: "right" },
      { key: "status", label: "Status", w: CW * 0.18, align: "center" },
      { key: "delay", label: "Delay", w: CW * 0.12, align: "center" },
      { key: "district", label: "District", w: CW * 0.14, maxLen: 14 },
    ];
    const maxRows = Math.min(8, Math.floor((CB - y - 8) / 7));
    dataTable(doc, MX, y, CW, cols, buildManagementTableRows(r.projects, maxRows), maxRows, 7);
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────────────────────

export interface ExportProgressReportOptions {
  cityName: string;
  pageData: DashboardPageData;
  scopeType: ScopeType;
  currentScopePhysical: number;
  currentScopeRows: any[];
  selectedId?: number | null;
  selectedName?: string | null;
  selectedType?: "division" | "district" | "tehsil" | "project" | null;
}

export async function exportProgressReport(
  options: ExportProgressReportOptions,
): Promise<void> {
  const {
    cityName, pageData, scopeType,
    currentScopePhysical, currentScopeRows,
    selectedId = null, selectedName = null, selectedType = null,
  } = options;

  const report = buildReportData(
    pageData, scopeType, cityName,
    currentScopePhysical, currentScopeRows,
    selectedId, selectedName, selectedType,
  );

  const logo = await imageUrlToDataUrl("/Assets/psca logo.png");
  const evidence = await fetchEvidenceForReport(
    report,
    scopeType === "selected-project",
  );
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  switch (scopeType) {
    case "all-divisions":      buildAllDivisionsReport(doc, report, logo);      break;
    case "all-districts":      buildAllDistrictsReport(doc, report, logo);      break;
    case "all-tehsils":        buildAllTehsilsReport(doc, report, logo);        break;
    case "all-projects":       await buildAllProjectsReport(doc, report, logo, evidence);       break;
    case "selected-division":  buildSelectedDivisionReport(doc, report, logo);  break;
    case "selected-district":  buildSelectedDistrictReport(doc, report, logo);  break;
    case "selected-tehsil":    buildSelectedTehsilReport(doc, report, logo);    break;
    case "selected-project":   await buildSelectedProjectReport(doc, report, logo, evidence);   break;
    default:                   buildAllDivisionsReport(doc, report, logo);
  }

  const safeName = cityName
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`PSCA-Progress-Report-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
