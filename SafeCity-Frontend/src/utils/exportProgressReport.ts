/**
 * exportProgressReport.ts
 * ============================================================
 * Professional chart-led PDF progress report — jsPDF landscape A4.
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
const AMBER:     Rgb = [217, 119, 6];
const SLATE:     Rgb = [71, 85, 105];
const WHITE:     Rgb = [255, 255, 255];
const SOFT_BLUE: Rgb = [238, 243, 252];
const BORDER:    Rgb = [220, 227, 239];
const TEXT:      Rgb = [25, 35, 56];
const MUTED:     Rgb = [100, 116, 139];
const GOLD:      Rgb = [245, 158, 11];

// ─────────────────────────────────────────────────────────────
// PAGE GEOMETRY  (all in mm, landscape A4 = 297 × 210 mm)
// ─────────────────────────────────────────────────────────────

const PW = 297;
const PH = 210;
const MX = 11;          // left/right margin
const HEADER_H = 27;    // header band height  (header + accent strips)
const MY = HEADER_H + 3;// top of content area  = 30 mm
const FOOTER_TOP = PH - 10; // top of footer band
const CW = PW - MX * 2;    // usable content width  = 275 mm
const CB = FOOTER_TOP - 3;  // content bottom limit  = 197 mm
const AVAIL = CB - MY;      // total usable height   ≈ 167 mm

// ─────────────────────────────────────────────────────────────
// LOW-LEVEL HELPERS
// ─────────────────────────────────────────────────────────────

const f = (doc: jsPDF, c: Rgb) => doc.setFillColor(c[0], c[1], c[2]);
const t = (doc: jsPDF, c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
const d = (doc: jsPDF, c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);

function clamp(v: number): number { return Math.max(0, Math.min(100, v)); }

function progressRgb(v: number): Rgb {
  if (v >= 75) return GREEN;
  if (v >= 50) return BLUE;
  if (v >= 25) return AMBER;
  return RED;
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
  f(doc, [210, 215, 228]); doc.roundedRect(x + 0.6, y + 0.6, w, h, 2, 2, "F");
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

  // Gold accent strip
  f(doc, GOLD); doc.rect(0, 24, PW, 0.7, "F");
  // Red accent strip
  f(doc, RED); doc.rect(0, 24.7, PW, 1.3, "F");

  // Logo
  const textX = logo ? 28 : MX;
  if (logo) { try { doc.addImage(logo, "PNG", 10, 3.5, 13, 13); } catch { /* optional */ } }

  // Title (line 1)
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(11.5);
  doc.text("PSCA  PHYSICAL PROGRESS & EXECUTION REPORT", textX, 9);

  // Scope name (line 2) — only shown ONCE here, never repeated in section titles
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  t(doc, [185, 200, 230]);
  doc.text(trunc(report.scope.scopeName, 80), textX, 15.5);

  // Scope-type badge (top-right)
  f(doc, [25, 45, 90]); doc.roundedRect(PW - 68, 4, 27, 8, 2, 2, "F");
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(5.2);
  doc.text(
    report.scope.scopeType.replace(/-/g, " ").toUpperCase(),
    PW - 54.5, 8.5, { align: "center" },
  );

  // Date + page (top-right, second line)
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  t(doc, [170, 185, 210]);
  doc.text(`${today()}`, PW - MX, 16.5, { align: "right" });

  // Page badge
  f(doc, RED); doc.roundedRect(PW - 68, 14, 18, 7, 2, 2, "F");
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(`${pageNo} / ${totalPages}`, PW - 59, 18.5, { align: "center" });
}

function drawFooter(doc: jsPDF, pageNo: number, totalPages: number): void {
  // Background
  f(doc, [244, 246, 252]); doc.rect(0, FOOTER_TOP - 1, PW, PH - FOOTER_TOP + 1, "F");
  // Rule
  d(doc, BLUE); doc.setLineWidth(0.5);
  doc.line(MX, FOOTER_TOP, PW - MX, FOOTER_TOP);
  // Left text
  t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
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
  // Light background band
  f(doc, [233, 240, 255]);
  doc.rect(x, y, CW - (x - MX), 7, "F");

  // Red circle dot (left of title)
  f(doc, RED); doc.circle(x + 2, y + 3.5, 1.3, "F");

  // Title text
  t(doc, NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text(title, x + 6.5, y + 5.2);

  // Red underline bar (under the text, not overlapping it)
  f(doc, RED); doc.roundedRect(x + 6.5, y + 7, 22, 0.9, 0.4, 0.4, "F");

  let nextY = y + 10;
  if (subtitle) {
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
    doc.text(trunc(subtitle, 90), x + 6.5, nextY);
    nextY += 4;
  }
  return nextY + 1; // +1 breathing gap before first content element
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
  t(doc, MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(5.8);
  doc.text(trunc(label.toUpperCase(), 22), x + 5.5, y + 5.5);

  // Value  (middle: y + 13)
  t(doc, accent); doc.setFontSize(13.5);
  doc.text(value, x + 5.5, y + 13.5);

  // Sub-label  (bottom: y + h - 4)
  if (sub && h >= 22) {
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5);
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
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.8);
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

  // Chart area with padding inside the panel
  const cx = x + 6, cy = y + 5;
  const cw = w - 12, ch = h - 16;

  // Baseline
  d(doc, [140, 155, 175]); doc.setLineWidth(0.5);
  doc.line(cx, cy + ch, cx + cw, cy + ch);

  // Grid lines at 50% and 100%
  d(doc, [215, 222, 238]); doc.setLineWidth(0.25);
  [0.5, 1.0].forEach((pct) => doc.line(cx, cy + ch - pct * ch, cx + cw, cy + ch - pct * ch));

  const bGap = 3;
  const bW = (cw - bGap * (rows.length - 1)) / rows.length;

  rows.forEach((row, i) => {
    const bh = row.count > 0 ? Math.max(1.5, (row.count / max) * ch) : 0;
    const bx = cx + i * (bW + bGap);
    const by = cy + ch - bh;
    const rgb = hexToRgb(row.color);

    f(doc, rgb);
    if (bh > 0) doc.roundedRect(bx, by, bW, bh, 0.8, 0.8, "F");

    // Count above bar
    t(doc, TEXT); doc.setFont("helvetica", "bold"); doc.setFontSize(5.5);
    doc.text(String(row.count), bx + bW / 2, by - 1, { align: "center" });

    // Bucket label below baseline
    t(doc, MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(4.5);
    doc.text(row.bucket.replace(/^>/, ""), bx + bW / 2, cy + ch + 4, { align: "center" });
  });

  // Caption
  t(doc, MUTED); doc.setFontSize(4.8);
  doc.text("Projects by physical-progress band", x + 4, y + h - 2);
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
  t(doc, WHITE); doc.setFont("helvetica", "bold"); doc.setFontSize(5);
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

      t(doc, cellRgb); doc.setFont("helvetica", "normal"); doc.setFontSize(5.2);
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
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
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
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(5);
    doc.text(`${s.label}: ${s.count} (${s.pct}%)`, lx + 4.5, ly);
  });
}

// ─────────────────────────────────────────────────────────────
// PAGE BUILDERS
// ─────────────────────────────────────────────────────────────

function buildPage1Executive(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  drawPageBg(doc);
  drawHeader(doc, report, pageNo, totalPages, logo);
  drawFooter(doc, pageNo, totalPages);

  let y = MY;

  // ── Row 1: 6 KPI cards ──
  const GAP = 2.5;
  const CARD_W = (CW - GAP * 5) / 6;
  const CARD_H = 21;

  const cards: Array<[string, string, string, Rgb]> = [
    ["Physical Progress",          `${formatProgress(report.kpis.overallPhysical)}%`, "Scope average",       BLUE],
    ["Total Projects",             String(report.kpis.totalProjects),                  "In scope",            NAVY],
    [report.kpis.activeUnitsLabel, String(report.kpis.activeUnits),                   "Active units",        SLATE],
    ["Completed",                  String(report.kpis.completedProjects),              "100%",                GREEN],
    ["In Progress",                String(report.kpis.inProgressProjects),             "0–100%",              BLUE],
    ["Attention",                  String(report.attentionProjects.length),            "<25% or delayed",     RED],
  ];
  cards.forEach(([lbl, val, sub, acc], i) => {
    kpiCard(doc, MX + i * (CARD_W + GAP), y, CARD_W, CARD_H, lbl, val, sub, acc);
  });
  y += CARD_H + 4;

  // ── Row 2: ranking chart (left 62%) + distribution (right 38%) ──
  const LEFT_W = CW * 0.60;
  const RIGHT_W = CW - LEFT_W - 4;

  // Section labels — no scope-name subtitle (it's already in the header)
  const rankY = sectionTitle(doc,
    `${report.kpis.activeUnitsLabel} Physical Progress Ranking`, MX, y);
  const distY = sectionTitle(doc, "Progress Distribution", MX + LEFT_W + 4, y);

  // Charts fill remaining height, leaving room for insight strip
  const INSIGHT_H = 18;
  const chartH = CB - Math.max(rankY, distY) - INSIGHT_H - 4;

  const rankBars = buildHierarchyBars(report.hierarchyUnits, 10);
  hBarChart(doc, rankBars, MX, rankY, LEFT_W, chartH);
  distributionChart(doc, report, MX + LEFT_W + 4, distY, RIGHT_W, chartH);

  // ── Insight strip pinned to bottom ──
  const insY = CB - INSIGHT_H;
  insightPanel(doc, report.insights.slice(0, 3), MX, insY, CW, INSIGHT_H);
}

function buildPage2Comparison(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawHeader(doc, report, pageNo, totalPages, logo);
  drawFooter(doc, pageNo, totalPages);

  const LEFT_W = CW * 0.52, RIGHT_W = CW - LEFT_W - 4;
  const HALF_H = Math.floor((CB - MY - 28) / 2); // space for two charts + titles

  // ── Left column ──
  const topTitle = sectionTitle(doc, "Top Performing Projects", MX, MY,
    "Top 8 by physical progress");
  const topH = HALF_H;
  hBarChart(doc, buildTopProjectBars(report.topProjects, 8), MX, topTitle, LEFT_W, topH);

  const attnStart = topTitle + topH + 4;
  const attnTitle = sectionTitle(doc, "Projects Requiring Attention", MX, attnStart,
    "At 0%, below 25%, or delay-affected");
  const attnH = CB - attnTitle - 2;
  hBarChart(doc, buildAttentionBars(report.attentionProjects, 6), MX, attnTitle, LEFT_W, attnH);

  // ── Right column ──
  const loadTitle = sectionTitle(doc, `Project Load by ${report.kpis.activeUnitsLabel}`,
    MX + LEFT_W + 4, MY);
  const loadBars = buildProjectLoadBars(report.hierarchyUnits, 10).map((b) => ({
    ...b, color: "#3b82f6",
  }));
  const loadH = HALF_H;
  hBarChart(doc, loadBars, MX + LEFT_W + 4, loadTitle, RIGHT_W, loadH,
    Math.max(...loadBars.map((b) => b.value), 1));

  const statusStart = loadTitle + loadH + 4;
  const statusTitle = sectionTitle(doc, "Status Composition", MX + LEFT_W + 4, statusStart);
  const statusH = CB - statusTitle - 2;
  statusBar(doc, report, MX + LEFT_W + 4, statusTitle, RIGHT_W, statusH);
}

function buildPage3Execution(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawHeader(doc, report, pageNo, totalPages, logo);
  drawFooter(doc, pageNo, totalPages);

  const LEFT_W = CW * 0.48, RIGHT_W = CW - LEFT_W - 4;
  const profile = buildAttentionProfile(report.projects);

  // ── Left: 6 attention-profile mini-cards ──
  const attnTitle = sectionTitle(doc, "Attention & Exception Profile", MX, MY);

  const items: Array<[string, number, Rgb]> = [
    ["At 0%",        profile.zeroProgress,    RED],
    ["Below 25%",    profile.below25,         AMBER],
    ["25–50%",       profile.between25and50,  AMBER],
    ["Above 75%",    profile.above75,         GREEN],
    ["Completed",    profile.completed,       GREEN],
    ["With Delays",  profile.withDelay,       RED],
  ];
  const MINI_W = (LEFT_W - 3) / 2;
  const MINI_H = 20;
  const MINI_GAP = 2.5;

  items.forEach(([lbl, val, acc], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    kpiCard(doc,
      MX + col * (MINI_W + MINI_GAP),
      attnTitle + row * (MINI_H + MINI_GAP),
      MINI_W, MINI_H,
      lbl, String(val), "", acc);
  });

  // ── Right: bottom-progress chart ──
  const bottomTitle = sectionTitle(doc, "Lowest Progress Projects",
    MX + LEFT_W + 4, MY,
    "Projects needing immediate attention");
  const bottomH = CB - bottomTitle - 22;
  hBarChart(doc, buildAttentionBars(report.bottomProjects, 10),
    MX + LEFT_W + 4, bottomTitle, RIGHT_W, bottomH);

  // ── Full-width insight at bottom ──
  const INSIGHT_H = 18;
  insightPanel(doc, report.insights, MX, CB - INSIGHT_H, CW, INSIGHT_H, "Decision Signals");
}

function buildPage4Register(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawHeader(doc, report, pageNo, totalPages, logo);
  drawFooter(doc, pageNo, totalPages);

  const titleEnd = sectionTitle(doc, "Management Project Register", MX, MY,
    "Attention projects first · no elapsed time · no schedule variance");

  const sorted = [
    ...report.attentionProjects,
    ...report.projects
      .filter((p) => !report.attentionProjects.some((a) => a.id === p.id))
      .sort((a, b) => a.physical_progress - b.physical_progress),
  ];

  const cols: Col[] = [
    { key: "project",  label: "Project",   w: CW * 0.30, maxLen: 29 },
    { key: "division", label: "Division",  w: CW * 0.13, maxLen: 13 },
    { key: "district", label: "District",  w: CW * 0.12, maxLen: 12 },
    { key: "tehsil",   label: "Tehsil",    w: CW * 0.10, maxLen: 11 },
    { key: "physical", label: "Physical%", w: CW * 0.10, align: "right" },
    { key: "status",   label: "Status",    w: CW * 0.12, align: "center" },
    { key: "delay",    label: "Delay",     w: CW * 0.13, align: "center" },
  ];

  // Max rows that fit in remaining height
  const ROW_H = 6;
  const HEAD_H = 7;
  const availH = CB - titleEnd - 2;
  const maxRows = Math.min(18, Math.floor((availH - HEAD_H) / ROW_H));

  dataTable(doc, MX, titleEnd, CW, cols, buildManagementTableRows(sorted, maxRows), maxRows, ROW_H);
}

function buildPage5DecisionSummary(
  doc: jsPDF, report: ReportData,
  logo: string | null, pageNo: number, totalPages: number,
): void {
  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawHeader(doc, report, pageNo, totalPages, logo);
  drawFooter(doc, pageNo, totalPages);

  const LEFT_W = CW * 0.55, RIGHT_W = CW - LEFT_W - 4;

  // ── Left: decision bullets ──
  const decEnd = sectionTitle(doc, "Decision Summary", MX, MY,
    "Key findings and recommended management actions");

  const bullets = buildDecisionBullets(report);
  let by = decEnd;
  bullets.forEach((b) => {
    if (by > CB - 30) return;
    f(doc, BLUE); doc.circle(MX + 3.5, by + 1.5, 1.5, "F");
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
    const lines = doc.splitTextToSize(b, LEFT_W - 12).slice(0, 2);
    doc.text(lines, MX + 8, by + 3);
    by += lines.length > 1 ? 10 : 7;
  });

  // Insight panel below bullets (only if enough space)
  const insH = 22;
  if (by + insH + 4 <= CB) {
    insightPanel(doc, report.insights, MX, by + 3, LEFT_W, insH);
  }

  // ── Right: distribution + status ──
  const distEnd = sectionTitle(doc, "Progress Distribution", MX + LEFT_W + 4, MY);
  const distH = Math.floor((CB - MY - 28) / 2);
  distributionChart(doc, report, MX + LEFT_W + 4, distEnd, RIGHT_W, distH);

  const statusStart = distEnd + distH + 4;
  const statusEnd = sectionTitle(doc, "Status Composition", MX + LEFT_W + 4, statusStart);
  const statusH = CB - statusEnd - 2;
  if (statusH >= 20) {
    statusBar(doc, report, MX + LEFT_W + 4, statusEnd, RIGHT_W, statusH);
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
function buildAllProjectsReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  buildPage1Executive(doc, r, logo, 1, 2);
  buildPage4Register(doc, r, logo, 2, 2);
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

function buildSelectedProjectReport(doc: jsPDF, r: ReportData, logo: string | null): void {
  // ── Page 1: project executive summary ──
  drawPageBg(doc);
  drawHeader(doc, r, 1, 2, logo);
  drawFooter(doc, 1, 2);

  const proj = r.projects[0];
  const LEFT_W = CW * 0.35, RIGHT_W = CW - LEFT_W - 5;

  // 6 KPI cards (2-column, 3-row)
  const CARD_W = (LEFT_W - 2.5) / 2, CARD_H = 22, CARD_GAP = 2.5;
  const projCards: Array<[string, string, Rgb]> = [
    ["Physical Progress", `${formatProgress(r.kpis.overallPhysical)}%`, BLUE],
    ["Status",            proj ? proj.status.replace(/_/g, " ") : "—",  SLATE],
    ["Delay Recorded",    proj?.has_delay ? "Yes" : "No",                RED],
    ["Projects",          String(r.kpis.totalProjects),                  NAVY],
    ["Completed",         String(r.kpis.completedProjects),              GREEN],
    ["In Progress",       String(r.kpis.inProgressProjects),             BLUE],
  ];
  projCards.forEach(([lbl, val, acc], i) => {
    kpiCard(doc,
      MX + (i % 2) * (CARD_W + CARD_GAP),
      MY + Math.floor(i / 2) * (CARD_H + CARD_GAP),
      CARD_W, CARD_H, lbl, val, "", acc);
  });

  // Right: project details
  const detEnd = sectionTitle(doc, "Project Details",
    MX + LEFT_W + 5, MY,
    proj?.project_name ?? r.scope.scopeName);

  const details = [
    ["Division",  proj?.division_name ?? "—"],
    ["District",  proj?.district_name ?? "—"],
    ["Tehsil",    proj?.tehsil_name   ?? "—"],
    ["Physical",  `${formatProgress(r.kpis.overallPhysical)}%`],
    ["Financial", `${formatProgress(proj?.financial_progress ?? 0)}%`],
    ["Status",    proj?.status?.replace(/_/g, " ") ?? "—"],
  ];

  details.forEach(([key, val], i) => {
    const dy = detEnd + i * 8;
    t(doc, MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    doc.text(key.toUpperCase(), MX + LEFT_W + 5, dy);
    t(doc, TEXT); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text(String(val), MX + LEFT_W + 25, dy);
  });

  // Insight panel below details
  const insY = detEnd + details.length * 8 + 4;
  const insH = Math.min(28, CB - insY - 2);
  if (insH >= 16) {
    insightPanel(doc, r.insights, MX + LEFT_W + 5, insY, RIGHT_W, insH, "Project Observations");
  }

  // ── Page 2: execution register ──
  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawHeader(doc, r, 2, 2, logo);
  drawFooter(doc, 2, 2);

  const regEnd = sectionTitle(doc, "Project Execution Register", MX, MY);
  const cols: Col[] = [
    { key: "project",  label: "Project / Activity", w: CW * 0.34, maxLen: 33 },
    { key: "physical", label: "Physical%",           w: CW * 0.12, align: "right" },
    { key: "status",   label: "Status",              w: CW * 0.14, align: "center" },
    { key: "delay",    label: "Delay",               w: CW * 0.11, align: "center" },
    { key: "division", label: "Division",            w: CW * 0.15, maxLen: 14 },
    { key: "district", label: "District",            w: CW * 0.14, maxLen: 14 },
  ];
  const ROW_H = 6;
  const availH = CB - regEnd - 2;
  const maxRows = Math.min(20, Math.floor((availH - 7) / ROW_H));
  dataTable(doc, MX, regEnd, CW,
    cols, buildManagementTableRows(r.projects, maxRows), maxRows, ROW_H);
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
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  switch (scopeType) {
    case "all-divisions":      buildAllDivisionsReport(doc, report, logo);      break;
    case "all-districts":      buildAllDistrictsReport(doc, report, logo);      break;
    case "all-tehsils":        buildAllTehsilsReport(doc, report, logo);        break;
    case "all-projects":       buildAllProjectsReport(doc, report, logo);       break;
    case "selected-division":  buildSelectedDivisionReport(doc, report, logo);  break;
    case "selected-district":  buildSelectedDistrictReport(doc, report, logo);  break;
    case "selected-tehsil":    buildSelectedTehsilReport(doc, report, logo);    break;
    case "selected-project":   buildSelectedProjectReport(doc, report, logo);   break;
    default:                   buildAllDivisionsReport(doc, report, logo);
  }

  const safeName = cityName
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  doc.save(`PSCA-Progress-Report-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
