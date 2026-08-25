/**
 * exportToPPTX.ts
 * ============================================================
 * Professional decision-support PowerPoint — pptxgenjs 16:9.
 *
 * Fixes applied (v3 — no double text, no overlap, clean alignment):
 *   - CONTENT_Y raised to 1.3" so nothing clips the header.
 *   - addSectionLabel() positions subtitle at a safe distance
 *     below the underline; returns the Y of the next element.
 *   - addKpiBox() uses only h >= 0.75" minimum; all child text
 *     positioned by fixed offsets that fit inside the box.
 *   - addHBarChart() removes the small bullet square that
 *     overlapped the label; label starts at x + 0.06".
 *   - addInsightBox() heading has 0.30" of vertical space before
 *     the first bullet.
 *   - buildSlide1Title() spreads elements with guaranteed gaps:
 *     branding → title → subtitle → badge → KPI row → date.
 *   - buildSlide5TopProjects() subtitle no longer repeats scopeName.
 *   - buildSlide3Ranking() subtitle no longer repeats scopeName.
 *   - addSectionLabel() no longer passes subtitle text that already
 *     appears in the header chrome.
 *   - Every slide uses addSlideChrome() which already shows
 *     scopeName — slide builders never add it again.
 * ============================================================
 */

import PptxGenJS from "pptxgenjs";
import type { DashboardPageData } from "@/api/dashboard";
import { formatProgress } from "./dashboardPhysicalProgress";
import {
  buildReportData,
  type ScopeType,
  type ReportData,
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
// THEME
// ─────────────────────────────────────────────────────────────

const T = {
  navy:     "111F46",
  blue:     "1E3A8A",
  accent:   "2563EB",
  red:      "B91C1C",
  green:    "16A34A",
  amber:    "D97706",
  slate:    "475569",
  muted:    "64748B",
  border:   "CBD5E1",
  light:    "F1F5F9",
  white:    "FFFFFF",
  text:     "1E293B",
  softBlue: "EFF6FF",
  gold:     "F59E0B",
} as const;

const FONT = "Calibri";

// ─────────────────────────────────────────────────────────────
// SLIDE GEOMETRY  (inches, 16:9 = 13.33 × 7.5)
// ─────────────────────────────────────────────────────────────

const W  = 13.33;
const H  = 7.5;
const MX = 0.45;         // left/right margin
const HEADER_H = 1.1;   // header band
const CONTENT_Y = 1.3;  // first content element starts here (was MARGIN_Y + HEADER_H + 0.15)
const FOOTER_Y  = H - 0.3;
const CONTENT_W = W - MX * 2;
const CONTENT_H = FOOTER_Y - CONTENT_Y - 0.1;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function progressColor(v: number): string {
  if (v >= 75) return T.green;
  if (v >= 50) return T.accent;
  if (v >= 25) return T.amber;
  return T.red;
}

function trunc(text: string, max = 30): string {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function today(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE CHROME  (header + footer — called on every content slide)
// scopeName shown ONCE here; slide builders must NOT repeat it.
// ─────────────────────────────────────────────────────────────

function addSlideChrome(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  title: string, scopeName: string,
  pageNo: number, totalPages: number,
  dateStr: string,
): void {
  // Two-tone header band
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: W * 0.68, h: HEADER_H,
    fill: { color: T.navy }, line: { color: T.navy, width: 0 },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: W * 0.68, y: 0, w: W * 0.32, h: HEADER_H,
    fill: { color: T.blue }, line: { color: T.blue, width: 0 },
  });
  // Gold accent thin strip
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: HEADER_H - 0.1, w: W, h: 0.04,
    fill: { color: T.gold }, line: { color: T.gold, width: 0 },
  });
  // Red accent strip
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: HEADER_H - 0.06, w: W, h: 0.06,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });

  // Slide title (left of header)
  slide.addText(title, {
    x: MX, y: 0.1, w: W * 0.60, h: 0.5,
    fontSize: 17, bold: true, color: T.white, fontFace: FONT, valign: "middle",
  });
  // Scope name (below title, still in header)
  slide.addText(trunc(scopeName, 55), {
    x: MX, y: 0.62, w: W * 0.58, h: 0.28,
    fontSize: 8.5, color: "C7D2FE", fontFace: FONT, valign: "middle",
  });

  // Slide number pill (top-right)
  slide.addShape(prs.ShapeType.roundRect, {
    x: W - 1.35, y: 0.14, w: 0.9, h: 0.3,
    fill: { color: T.accent }, line: { color: T.accent, width: 0 },
    rectRadius: 0.15,
  });
  slide.addText(`${pageNo} / ${totalPages}`, {
    x: W - 1.35, y: 0.14, w: 0.9, h: 0.3,
    fontSize: 7, bold: true, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });

  // Date (below pill)
  slide.addText(dateStr, {
    x: W - 2.6, y: 0.68, w: 2.2, h: 0.26,
    fontSize: 7, color: "94A3B8", fontFace: FONT,
    align: "right", valign: "middle",
  });

  // Footer rule + text
  slide.addShape(prs.ShapeType.line, {
    x: MX, y: FOOTER_Y - 0.04, w: CONTENT_W, h: 0,
    line: { color: T.border, width: 0.5 },
  });
  slide.addText("PSCA SafeCity  •  Physical Progress Decision-Support", {
    x: MX, y: FOOTER_Y + 0.01, w: CONTENT_W * 0.6, h: 0.22,
    fontSize: 6.5, color: T.muted, fontFace: FONT, valign: "middle",
  });
  slide.addText("CONFIDENTIAL", {
    x: MX + CONTENT_W * 0.61, y: FOOTER_Y + 0.01, w: CONTENT_W * 0.39, h: 0.22,
    fontSize: 6.5, bold: true, color: T.red, fontFace: FONT,
    align: "right", valign: "middle",
  });
}

// ─────────────────────────────────────────────────────────────
// KPI BOX
// Minimum recommended height: 0.80" for single-value cards,
// 0.65" if sub is empty.
// ─────────────────────────────────────────────────────────────

function addKpiBox(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  accent: string = T.accent,
): void {
  // Shadow
  slide.addShape(prs.ShapeType.rect, {
    x: x + 0.022, y: y + 0.022, w, h,
    fill: { color: "C8D5E8" }, line: { color: "C8D5E8", width: 0 },
  });
  // Card
  slide.addShape(prs.ShapeType.rect, {
    x, y, w, h,
    fill: { color: T.white }, line: { color: T.border, width: 0.5 },
  });
  // Left accent strip
  slide.addShape(prs.ShapeType.rect, {
    x, y, w: 0.09, h,
    fill: { color: accent }, line: { color: accent, width: 0 },
  });

  // Label — 0.09" from top
  slide.addText(trunc(label.toUpperCase(), 18), {
    x: x + 0.14, y: y + 0.07, w: w - 0.2, h: 0.22,
    fontSize: 6, bold: true, color: T.muted, fontFace: FONT, valign: "top",
  });

  // Value — middle zone
  const valY = y + 0.28;
  const valH = Math.max(0.28, h - 0.56);
  slide.addText(value, {
    x: x + 0.14, y: valY, w: w - 0.2, h: valH,
    fontSize: Math.min(20, h < 0.8 ? 14 : 18), bold: true,
    color: T.text, fontFace: FONT, valign: "middle",
  });

  // Sub-label — only if enough room (h >= 0.76")
  if (sub && h >= 0.76) {
    slide.addText(trunc(sub, 24), {
      x: x + 0.14, y: y + h - 0.22, w: w - 0.2, h: 0.2,
      fontSize: 5.8, color: T.muted, fontFace: FONT, valign: "bottom",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
// Returns Y of the next element (below the section block).
// No scopeName in subtitles — it's already in the header.
// ─────────────────────────────────────────────────────────────

function addSectionLabel(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, text: string, subtitle?: string,
): number {
  // Title
  slide.addText(text, {
    x, y, w: CONTENT_W, h: 0.26,
    fontSize: 10, bold: true, color: T.navy, fontFace: FONT, valign: "middle",
  });
  // Red underline
  slide.addShape(prs.ShapeType.rect, {
    x, y: y + 0.26, w: 1.1, h: 0.04,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });
  // Circle dot at left end of underline
  slide.addShape(prs.ShapeType.ellipse, {
    x: x - 0.04, y: y + 0.22, w: 0.1, h: 0.1,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });

  let nextY = y + 0.36;

  if (subtitle) {
    slide.addText(subtitle, {
      x, y: nextY, w: CONTENT_W, h: 0.2,
      fontSize: 7, color: T.muted, fontFace: FONT, valign: "top",
    });
    nextY += 0.22;
  }

  return nextY; // caller starts their content here
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR CHART
// ─────────────────────────────────────────────────────────────

function addHBarChart(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  bars: ChartBar[],
  x: number, y: number, w: number, h: number,
  maxValue = 100,
): void {
  if (!bars.length) {
    slide.addText("No data available.", {
      x, y, w, h, fontSize: 9, color: T.muted, fontFace: FONT,
      align: "center", valign: "middle",
    });
    return;
  }

  const LABEL_W = 2.5;
  const VALUE_W = 0.82;
  const BAR_W   = w - LABEL_W - VALUE_W - 0.06;
  const rowH    = Math.min(0.38, (h - 0.04) / bars.length);

  bars.forEach((bar, i) => {
    const ry = y + i * rowH;
    const barColor = bar.color || T.accent;

    // Alternating row stripe
    if (i % 2 !== 0) {
      slide.addShape(prs.ShapeType.rect, {
        x, y: ry, w, h: rowH,
        fill: { color: "F7FAFD" }, line: { color: "F7FAFD", width: 0 },
      });
    }

    // Label — starts at x + 0.06 (no bullet shape that could overlap)
    slide.addText(trunc(bar.label, 24), {
      x: x + 0.06, y: ry + 0.02, w: LABEL_W - 0.1, h: rowH - 0.04,
      fontSize: 7, color: T.text, fontFace: FONT, valign: "middle",
    });

    // Track
    slide.addShape(prs.ShapeType.rect, {
      x: x + LABEL_W, y: ry + rowH * 0.2, w: BAR_W, h: rowH * 0.56,
      fill: { color: T.light }, line: { color: "C8D5E5", width: 0.4 },
    });

    // Fill
    const val = Math.max(0, Math.min(maxValue, bar.value ?? 0));
    const fillW = val > 0 ? Math.max(0.04, (val / Math.max(maxValue, 1)) * BAR_W) : 0;
    if (fillW > 0) {
      slide.addShape(prs.ShapeType.rect, {
        x: x + LABEL_W, y: ry + rowH * 0.2, w: fillW, h: rowH * 0.56,
        fill: { color: barColor }, line: { color: barColor, width: 0 },
      });
    }

    // Value (in pill)
    slide.addShape(prs.ShapeType.roundRect, {
      x: x + LABEL_W + BAR_W + 0.03, y: ry + rowH * 0.18, w: VALUE_W - 0.04, h: rowH * 0.60,
      fill: { color: "EEF4FF" }, line: { color: "BDD4FE", width: 0.3 }, rectRadius: 0.07,
    });
    slide.addText(`${formatProgress(val)}%`, {
      x: x + LABEL_W + BAR_W + 0.03, y: ry + 0.02, w: VALUE_W - 0.04, h: rowH - 0.04,
      fontSize: 7, bold: true, color: T.accent, fontFace: FONT,
      align: "center", valign: "middle",
    });
  });
}

// ─────────────────────────────────────────────────────────────
// COUNT BAR CHART  (distribution / load)
// ─────────────────────────────────────────────────────────────

function addCountBarChart(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  bars: Array<{ label: string; value: number; color: string }>,
  x: number, y: number, w: number, h: number,
): void {
  if (!bars.length) return;
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const CHART_H = h - 0.5;
  const BAR_W   = (w - 0.2) / bars.length;
  const GAP     = 0.05;

  // Background + grid
  slide.addShape(prs.ShapeType.rect, {
    x, y, w, h: CHART_H,
    fill: { color: "F8FAFC" }, line: { color: T.border, width: 0.25 },
  });
  [0.33, 0.66].forEach((pct) => {
    slide.addShape(prs.ShapeType.line, {
      x, y: y + CHART_H * (1 - pct), w, h: 0,
      line: { color: "D8E3EF", width: 0.25, dashType: "dash" },
    });
  });

  bars.forEach((bar, i) => {
    const bx = x + 0.1 + i * BAR_W;
    const fillH = bar.value > 0 ? Math.max(0.06, (bar.value / maxVal) * CHART_H) : 0;
    const by = y + CHART_H - fillH;

    if (bar.value > 0) {
      slide.addShape(prs.ShapeType.rect, {
        x: bx + GAP, y: by, w: BAR_W - GAP * 2, h: fillH,
        fill: { color: bar.color }, line: { color: bar.color, width: 0 },
      });
    }
    // Count above bar
    slide.addText(String(bar.value), {
      x: bx, y: by - 0.18, w: BAR_W, h: 0.18,
      fontSize: 7.5, bold: true, color: T.text, fontFace: FONT,
      align: "center", valign: "middle",
    });
    // X-axis label
    slide.addText(trunc(bar.label, 9), {
      x: bx, y: y + CHART_H + 0.04, w: BAR_W, h: 0.22,
      fontSize: 6, color: T.muted, fontFace: FONT,
      align: "center", valign: "top",
    });
  });
}

// ─────────────────────────────────────────────────────────────
// DONUT PROGRESS  (uses pptxgenjs chart)
// ─────────────────────────────────────────────────────────────

function addDonutProgress(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  physical: number,
): void {
  const actual    = Math.max(0, Math.min(100, physical));
  const remaining = Math.max(0, 100 - actual);

  slide.addChart("doughnut" as any,
    [{ name: "Progress", labels: ["Actual", "Remaining"], values: [actual, remaining] }],
    {
      x, y, w, h,
      chartColors: [progressColor(actual), "E2E8F0"],
      showLegend: false, showTitle: false,
      holeSize: 65, dataLabelFontSize: 0, showValue: false,
    } as any,
  );

  // Center text — positioned at the geometric center of the donut
  slide.addText(`${formatProgress(actual)}%`, {
    x: x + w * 0.18, y: y + h * 0.35, w: w * 0.64, h: h * 0.26,
    fontSize: 13, bold: true, color: progressColor(actual), fontFace: FONT,
    align: "center", valign: "middle",
  });
  slide.addText("Physical", {
    x: x + w * 0.18, y: y + h * 0.60, w: w * 0.64, h: 0.18,
    fontSize: 7, color: T.muted, fontFace: FONT,
    align: "center", valign: "top",
  });
}

// ─────────────────────────────────────────────────────────────
// COMPACT TABLE
// ─────────────────────────────────────────────────────────────

interface ColDef {
  key: string; label: string; w: number;
  align?: "left" | "right" | "center";
  maxLen?: number;
}

function addCompactTable(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, tableW: number,
  cols: ColDef[],
  rows: Array<Record<string, string | number>>,
  maxRows = 12,
): number {
  const ROW_H = 0.27;
  const HEAD_H = 0.29;
  const display = rows.slice(0, maxRows);

  // Header — navy
  slide.addShape(prs.ShapeType.rect, {
    x, y, w: tableW, h: HEAD_H,
    fill: { color: T.navy }, line: { color: T.navy, width: 0 },
  });
  let cx = x;
  cols.forEach((col) => {
    slide.addText(trunc(col.label.toUpperCase(), 14), {
      x: cx + 0.05, y: y + 0.04, w: col.w - 0.07, h: HEAD_H - 0.08,
      fontSize: 6, bold: true, color: T.white, fontFace: FONT,
      align: col.align ?? "left", valign: "middle",
    });
    if (cx + col.w < x + tableW - 0.04) {
      slide.addShape(prs.ShapeType.line, {
        x: cx + col.w, y: y + 0.03, w: 0, h: HEAD_H - 0.06,
        line: { color: T.white, width: 0.25, transparency: 55 },
      });
    }
    cx += col.w;
  });

  // Data rows
  display.forEach((row, i) => {
    const ry = y + HEAD_H + i * ROW_H;

    slide.addShape(prs.ShapeType.rect, {
      x, y: ry, w: tableW, h: ROW_H,
      fill: { color: i % 2 === 0 ? T.white : "F7FAFF" },
      line: { color: T.border, width: 0.25 },
    });
    slide.addShape(prs.ShapeType.line, {
      x, y: ry + ROW_H, w: tableW, h: 0,
      line: { color: T.border, width: 0.25 },
    });

    cx = x;
    cols.forEach((col) => {
      const raw  = String(row[col.key] ?? "—");
      const disp = col.maxLen ? trunc(raw, col.maxLen) : raw;
      const lower = raw.toLowerCase();

      // Status-aware color
      let cellColor = T.text;
      if (lower.includes("delay") || lower === "yes") cellColor = T.red;
      else if (lower.includes("complet"))             cellColor = T.green;
      else if (lower.includes("progress"))            cellColor = T.accent;

      slide.addText(disp, {
        x: cx + 0.05, y: ry + 0.03, w: col.w - 0.08, h: ROW_H - 0.06,
        fontSize: 6.5, color: cellColor, fontFace: FONT,
        align: col.align ?? "left", valign: "middle",
      });

      if (cx + col.w < x + tableW - 0.04) {
        slide.addShape(prs.ShapeType.line, {
          x: cx + col.w, y: ry + 0.02, w: 0, h: ROW_H - 0.04,
          line: { color: T.border, width: 0.25, transparency: 45 },
        });
      }
      cx += col.w;
    });
  });

  return HEAD_H + display.length * ROW_H;
}

// ─────────────────────────────────────────────────────────────
// INSIGHT BOX
// ─────────────────────────────────────────────────────────────

function addInsightBox(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  bullets: string[],
  heading = "Portfolio Observations",
): void {
  // Background
  slide.addShape(prs.ShapeType.rect, {
    x, y, w, h,
    fill: { color: T.softBlue }, line: { color: "BFDBFE", width: 0.5 },
  });
  // Left accent strip
  slide.addShape(prs.ShapeType.rect, {
    x, y, w: 0.07, h,
    fill: { color: T.accent }, line: { color: T.accent, width: 0 },
  });

  // Heading — starts at y + 0.08, height 0.22"
  slide.addText(heading.toUpperCase(), {
    x: x + 0.16, y: y + 0.07, w: w - 0.24, h: 0.22,
    fontSize: 8, bold: true, color: T.navy, fontFace: FONT, valign: "top",
  });

  // Separator line
  slide.addShape(prs.ShapeType.line, {
    x: x + 0.12, y: y + 0.31, w: w - 0.2, h: 0,
    line: { color: "BDD4FE", width: 0.3 },
  });

  // Bullets — start at y + 0.36, spaced 0.22" apart
  const BULLET_START = y + 0.36;
  const BULLET_STEP  = 0.215;

  bullets.slice(0, 5).forEach((b, i) => {
    const by = BULLET_START + i * BULLET_STEP;
    if (by + BULLET_STEP > y + h) return; // guard against overflow

    // Square icon
    slide.addShape(prs.ShapeType.rect, {
      x: x + 0.16, y: by + 0.065, w: 0.065, h: 0.065,
      fill: { color: T.accent }, line: { color: T.accent, width: 0 },
    });
    slide.addText(b, {
      x: x + 0.28, y: by, w: w - 0.38, h: BULLET_STEP - 0.01,
      fontSize: 7, color: T.text, fontFace: FONT, valign: "middle",
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SLIDE BUILDERS
// ─────────────────────────────────────────────────────────────

function buildSlide1Title(
  prs: PptxGenJS, report: ReportData,
  dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();

  // Background — navy + blue gradient band at bottom
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { color: T.navy }, line: { color: T.navy, width: 0 },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: H - 1.1, w: W, h: 1.1,
    fill: { color: T.blue }, line: { color: T.blue, width: 0 },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: H - 0.1, w: W, h: 0.1,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });

  // Thin white frame border
  slide.addShape(prs.ShapeType.rect, {
    x: 0.07, y: 0.07, w: W - 0.14, h: H - 0.14,
    fill: { type: "none" },
    line: { color: T.white, width: 0.5, transparency: 72 },
  });

  // Decorative accent shapes (bottom-right)
  slide.addShape(prs.ShapeType.rect, {
    x: W - 2.6, y: H - 2.0, w: 2.8, h: 2.4,
    fill: { color: "1A3580" }, line: { color: "1A3580", width: 0 },
    rotate: -28,
  });
  slide.addShape(prs.ShapeType.rect, {
    x: W - 1.8, y: H - 1.5, w: 2.0, h: 1.8,
    fill: { color: "2255D0" }, line: { color: "2255D0", width: 0 },
    rotate: -28,
  });

  // Subtle horizontal guide lines
  [1.6, 3.0, 4.4].forEach((ly) => {
    slide.addShape(prs.ShapeType.line, {
      x: 0, y: ly, w: W, h: 0,
      line: { color: T.white, width: 0.25, transparency: 87 },
    });
  });

  // ─ Content, top-to-bottom with confirmed gaps ─
  // Y=0.80  PSCA branding
  slide.addText("PSCA SAFECITY", {
    x: MX, y: 0.78, w: W - MX * 2, h: 0.44,
    fontSize: 13, bold: true, color: "93C5FD", fontFace: FONT,
    align: "center", valign: "middle", charSpacing: 3.5,
  });

  // Y=1.28  Main scope title
  slide.addText(trunc(report.scope.scopeName, 50), {
    x: MX, y: 1.26, w: W - MX * 2, h: 0.9,
    fontSize: 32, bold: true, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });

  // Y=2.24  Subtitle
  slide.addText("Physical Progress Decision-Support Report", {
    x: MX, y: 2.22, w: W - MX * 2, h: 0.36,
    fontSize: 13, color: "C7D2FE", fontFace: FONT,
    align: "center", valign: "middle",
  });

  // Y=2.70  Progress badge (3.2" wide × 1.28" tall)
  const overall    = report.kpis.overallPhysical;
  const badgeColor = progressColor(overall);
  const BADGE_X = W / 2 - 1.6;
  const BADGE_Y = 2.68;
  const BADGE_W = 3.2;
  const BADGE_H = 1.26;

  // Shadow
  slide.addShape(prs.ShapeType.roundRect, {
    x: BADGE_X + 0.06, y: BADGE_Y + 0.06, w: BADGE_W, h: BADGE_H,
    fill: { color: "000000" }, line: { color: "000000", width: 0 },
    shadow: { type: "outer", blur: 8, offset: 3, angle: 45, color: "00000038" },
    rectRadius: 0.1,
  });
  slide.addShape(prs.ShapeType.roundRect, {
    x: BADGE_X, y: BADGE_Y, w: BADGE_W, h: BADGE_H,
    fill: { color: badgeColor }, line: { color: T.white, width: 0.5 },
    rectRadius: 0.1,
  });
  // Badge value
  slide.addText(`${formatProgress(overall)}%`, {
    x: BADGE_X, y: BADGE_Y + 0.08, w: BADGE_W, h: BADGE_H * 0.58,
    fontSize: 26, bold: true, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });
  // Badge label  — inside the badge, below the value
  slide.addText("Overall Physical Progress", {
    x: BADGE_X, y: BADGE_Y + BADGE_H * 0.65, w: BADGE_W, h: BADGE_H * 0.3,
    fontSize: 9, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });

  // Y=4.10  KPI row (5 dark boxes) — safely below badge bottom (2.68+1.26=3.94)
  const kpiRow = [
    { label: "Total Projects",        value: String(report.kpis.totalProjects) },
    { label: report.kpis.activeUnitsLabel, value: String(report.kpis.activeUnits) },
    { label: "Completed",             value: String(report.kpis.completedProjects) },
    { label: "In Progress",           value: String(report.kpis.inProgressProjects) },
    { label: "Attention Required",    value: String(report.attentionProjects.length) },
  ];
  const KPI_Y  = 4.10;
  const KPI_H  = 0.68;
  const kpiW   = (W - MX * 2 - 0.08 * 4) / 5;
  kpiRow.forEach((k, i) => {
    const kx = MX + i * (kpiW + 0.08);
    slide.addShape(prs.ShapeType.roundRect, {
      x: kx, y: KPI_Y, w: kpiW, h: KPI_H,
      fill: { color: "0D1B3E" }, line: { color: T.accent, width: 0.5 },
      rectRadius: 0.06,
    });
    // Number
    slide.addText(k.value, {
      x: kx, y: KPI_Y + 0.04, w: kpiW, h: KPI_H * 0.52,
      fontSize: 18, bold: true, color: T.white, fontFace: FONT,
      align: "center", valign: "middle",
    });
    // Label
    slide.addText(trunc(k.label, 18), {
      x: kx, y: KPI_Y + KPI_H * 0.58, w: kpiW, h: KPI_H * 0.35,
      fontSize: 6.5, color: "94A3B8", fontFace: FONT,
      align: "center", valign: "middle",
    });
  });

  // Y=4.94  Generated line — safely below KPI row bottom (4.10+0.68=4.78)
  slide.addText(`Generated: ${dateStr}  |  ${totalSlides} slides`, {
    x: MX, y: 4.98, w: W - MX * 2, h: 0.26,
    fontSize: 7, color: "6B80A0", fontFace: FONT, align: "center",
  });
}

function buildSlide2Overview(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Portfolio Progress Overview", scopeName, 2, totalSlides, dateStr);

  const y = CONTENT_Y;
  const LEFT_W = 3.9;

  // Left: donut
  const donNextY = addSectionLabel(slide, prs, MX, y, "Overall Physical Progress");
  addDonutProgress(slide, MX + 0.25, donNextY, LEFT_W - 0.5, 2.1, report.kpis.overallPhysical);

  // Left: 4 mini KPI cards below donut
  const cardY = donNextY + 2.18;
  const cW = (LEFT_W - 0.1) / 2;
  const miniCards = [
    { label: "Total Projects", value: String(report.kpis.totalProjects),      accent: T.accent },
    { label: "Completed",      value: String(report.kpis.completedProjects),   accent: T.green  },
    { label: "In Progress",    value: String(report.kpis.inProgressProjects),  accent: T.accent },
    { label: "Attention",      value: String(report.attentionProjects.length), accent: T.red    },
  ];
  miniCards.forEach((c, i) => {
    addKpiBox(slide, prs,
      MX + (i % 2) * (cW + 0.08),
      cardY + Math.floor(i / 2) * 0.82,
      cW, 0.76,
      c.label, c.value, "", c.accent);
  });

  // Right: distribution chart
  const RX = MX + LEFT_W + 0.3;
  const RW = CONTENT_W - LEFT_W - 0.3;
  const distNextY = addSectionLabel(slide, prs, RX, y, "Project Progress Distribution");
  const distH = FOOTER_Y - 0.5 - distNextY;
  const distBars = report.distribution.map((d) => ({ label: d.bucket, value: d.count, color: d.color }));
  addCountBarChart(slide, prs, distBars, RX, distNextY, RW, distH);

  // Insight strip at bottom (only if room)
  const insY = FOOTER_Y - 0.6;
  if (insY > cardY + 1.72 + 0.1) {
    addInsightBox(slide, prs, MX, insY, LEFT_W + 0.3, 0.56,
      report.insights.slice(0, 2), "Key Observations");
  }
}

function buildSlide3Ranking(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  const unitLabel = report.kpis.activeUnitsLabel;
  addSlideChrome(slide, prs, `${unitLabel} Performance Ranking`, scopeName, 3, totalSlides, dateStr);

  // No scopeName in subtitle — it's in the header
  const nextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    `${unitLabel} Physical Progress Ranking`,
    `${report.hierarchyUnits.length} unit(s) · ranked by physical_progress`);

  const bars = buildHierarchyBars(report.hierarchyUnits, 14);
  if (!bars.length) {
    slide.addText("No hierarchy units for this scope.", {
      x: MX, y: nextY + 0.5, w: CONTENT_W, h: 0.4,
      fontSize: 10, color: T.muted, fontFace: FONT, align: "center",
    });
    return;
  }
  addHBarChart(slide, prs, bars, MX, nextY, CONTENT_W, FOOTER_Y - 0.45 - nextY);
}

function buildSlide4Load(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Project Load & Concentration", scopeName, 4, totalSlides, dateStr);

  const loadBars = buildProjectLoadBars(report.hierarchyUnits, 14).map((b) => ({
    ...b, color: T.accent,
  }));

  if (!loadBars.length) {
    slide.addText("No project-load data for this scope.", {
      x: MX, y: CONTENT_Y + 0.8, w: CONTENT_W, h: 0.4,
      fontSize: 10, color: T.muted, fontFace: FONT, align: "center",
    });
    return;
  }

  const HALF_W = CONTENT_W / 2 - 0.15;

  const leftNextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    `Project Count by ${report.kpis.activeUnitsLabel}`);
  addHBarChart(slide, prs,
    loadBars.map((b) => ({ ...b, value: b.value })),
    MX, leftNextY, HALF_W, FOOTER_Y - 0.45 - leftNextY,
    Math.max(...loadBars.map((b) => b.value), 1));

  const rightNextY = addSectionLabel(slide, prs, MX + HALF_W + 0.3, CONTENT_Y,
    "Avg Physical Progress per Unit");
  addHBarChart(slide, prs,
    buildHierarchyBars(report.hierarchyUnits, 14),
    MX + HALF_W + 0.3, rightNextY, HALF_W, FOOTER_Y - 0.45 - rightNextY);
}

function buildSlide5TopProjects(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Top Performing Projects", scopeName, 5, totalSlides, dateStr);

  // subtitle does NOT repeat scopeName
  const nextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    "Top 10 Projects by Physical Progress",
    `${report.topProjects.length} projects shown`);

  addHBarChart(slide, prs,
    buildTopProjectBars(report.topProjects, 10),
    MX, nextY, CONTENT_W, FOOTER_Y - 0.45 - nextY);
}

function buildSlide6Attention(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Projects Requiring Attention", scopeName, 6, totalSlides, dateStr);

  const LEFT_W = CONTENT_W * 0.58;
  const RIGHT_W = CONTENT_W - LEFT_W - 0.25;
  const profile = buildAttentionProfile(report.projects);

  const attnNextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    "Attention Projects",
    "0%, below 25%, or delay-affected");

  const attnBars = buildAttentionBars(report.attentionProjects, 10);
  if (!attnBars.length) {
    slide.addText("No attention projects in this scope.", {
      x: MX, y: attnNextY + 0.4, w: LEFT_W, h: 0.4,
      fontSize: 10, color: T.green, fontFace: FONT, align: "center",
    });
  } else {
    addHBarChart(slide, prs, attnBars, MX, attnNextY, LEFT_W, FOOTER_Y - 0.45 - attnNextY);
  }

  // Right: profile cards — 6 cards in 1 column
  const profileNextY = addSectionLabel(slide, prs, MX + LEFT_W + 0.25, CONTENT_Y, "Attention Profile");
  const CARD_H = 0.62;
  const CARD_GAP = 0.065;
  const profileItems = [
    { label: "At 0%",       value: profile.zeroProgress,    color: T.red   },
    { label: "Below 25%",   value: profile.below25,         color: T.amber },
    { label: "25–50%",      value: profile.between25and50,  color: T.amber },
    { label: "Above 75%",   value: profile.above75,         color: T.green },
    { label: "Completed",   value: profile.completed,       color: T.green },
    { label: "With Delay",  value: profile.withDelay,       color: T.red   },
  ];
  profileItems.forEach((item, i) => {
    const cardY = profileNextY + i * (CARD_H + CARD_GAP);
    if (cardY + CARD_H > FOOTER_Y - 0.4) return;
    addKpiBox(slide, prs,
      MX + LEFT_W + 0.25, cardY, RIGHT_W, CARD_H,
      item.label, String(item.value), "", item.color);
  });
}

function buildSlide7StatusComposition(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Execution Status Composition", scopeName, 7, totalSlides, dateStr);

  const HALF_W = CONTENT_W / 2 - 0.15;
  const statusComp = buildStatusComposition(report.projects);

  // Left: status KPI cards
  const statusNextY = addSectionLabel(slide, prs, MX, CONTENT_Y, "Project Status Breakdown");
  const CARD_H = 0.75, CARD_GAP = 0.07;
  statusComp.forEach((s, i) => {
    const cy = statusNextY + i * (CARD_H + CARD_GAP);
    if (cy + CARD_H > FOOTER_Y - 0.4) return;
    addKpiBox(slide, prs, MX, cy, HALF_W, CARD_H,
      s.label, String(s.count), `${s.pct}% of portfolio`, s.color);
  });

  // Right: distribution chart
  const distNextY = addSectionLabel(slide, prs, MX + HALF_W + 0.3, CONTENT_Y, "Progress Distribution");
  const distBars = report.distribution.map((d) => ({ label: d.bucket, value: d.count, color: d.color }));
  addCountBarChart(slide, prs, distBars,
    MX + HALF_W + 0.3, distNextY, HALF_W, FOOTER_Y - 0.45 - distNextY);
}

function buildSlide8DelayEvidence(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Delay & Evidence Overview", scopeName, 8, totalSlides, dateStr);

  const HALF_W = CONTENT_W / 2 - 0.15;
  const delayed = report.projects.filter((p) => p.has_delay);
  const zeros   = report.projects.filter((p) => p.physical_progress === 0);

  // Left: delay chart
  const delayNextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    "Delay-Affected Projects",
    `${delayed.length} project(s) with delay logs`);

  if (!delayed.length) {
    slide.addText("No delay logs recorded.", {
      x: MX, y: delayNextY + 0.4, w: HALF_W, h: 0.4,
      fontSize: 9, color: T.green, fontFace: FONT, align: "center",
    });
  } else {
    const delayBars = delayed.slice(0, 8).map((p) => ({
      label: p.project_name, value: p.physical_progress, color: T.red,
    }));
    addHBarChart(slide, prs, delayBars, MX, delayNextY, HALF_W, FOOTER_Y - 0.45 - delayNextY);
  }

  // Right: summary cards
  const sumNextY = addSectionLabel(slide, prs, MX + HALF_W + 0.3, CONTENT_Y,
    "Execution Evidence Summary");

  const summaryItems = [
    { label: "At 0% Physical",  value: String(zeros.length),                            color: T.red    },
    { label: "With Delay Logs", value: String(delayed.length),                          color: T.amber  },
    { label: "Delayed + 0%",    value: String(delayed.filter((p) => p.physical_progress === 0).length), color: T.red },
    { label: "In Progress",     value: String(report.kpis.inProgressProjects),          color: T.accent },
    { label: "Completed",       value: String(report.kpis.completedProjects),           color: T.green  },
  ];
  const CARD_H = 0.74, CARD_GAP = 0.07;
  summaryItems.forEach((item, i) => {
    const cy = sumNextY + i * (CARD_H + CARD_GAP);
    if (cy + CARD_H > FOOTER_Y - 0.4) return;
    addKpiBox(slide, prs, MX + HALF_W + 0.3, cy, HALF_W, CARD_H,
      item.label, item.value, "", item.color);
  });
}

function buildSlide9Register(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Management Project Register", scopeName, 9, totalSlides, dateStr);

  const nextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    "Priority Project Snapshot",
    "Attention-first · ascending physical progress · no elapsed time");

  const sorted = [
    ...report.attentionProjects,
    ...report.projects
      .filter((p) => !report.attentionProjects.some((a) => a.id === p.id))
      .sort((a, b) => a.physical_progress - b.physical_progress),
  ];

  const cols: ColDef[] = [
    { key: "project",  label: "Project",   w: 3.1, maxLen: 26 },
    { key: "division", label: "Division",  w: 1.6, maxLen: 15 },
    { key: "district", label: "District",  w: 1.6, maxLen: 15 },
    { key: "physical", label: "Physical",  w: 0.88, align: "right" },
    { key: "status",   label: "Status",    w: 1.05, align: "center" },
    { key: "delay",    label: "Delay",     w: 0.62, align: "center" },
  ];

  const totalColW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / totalColW;
  const scaledCols = cols.map((c) => ({ ...c, w: c.w * scale }));

  // Max rows that fit between nextY and footer
  const ROW_H = 0.27, HEAD_H = 0.29;
  const maxRows = Math.min(12, Math.floor((FOOTER_Y - 0.45 - nextY - HEAD_H) / ROW_H));

  addCompactTable(slide, prs, MX, nextY, CONTENT_W, scaledCols,
    buildManagementTableRows(sorted, maxRows), maxRows);
}

function buildSlide10Decision(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Decision Summary & Recommended Actions", scopeName, 10, totalSlides, dateStr);

  const nextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    "Key Decision Points",
    `${report.kpis.totalProjects} project(s)  ·  ${formatProgress(report.kpis.overallPhysical)}% avg physical progress`);

  const bullets = buildDecisionBullets(report);
  const CARD_H  = 0.60;
  const CARD_GAP = 0.10;

  bullets.forEach((b, i) => {
    const cy = nextY + i * (CARD_H + CARD_GAP);
    if (cy + CARD_H > FOOTER_Y - 0.4) return;

    // Card
    slide.addShape(prs.ShapeType.roundRect, {
      x: MX, y: cy, w: CONTENT_W, h: CARD_H,
      fill: { color: "F0F6FF" }, line: { color: "BFDBFE", width: 0.5 },
      rectRadius: 0.05,
    });
    // Numbered circle
    slide.addShape(prs.ShapeType.ellipse, {
      x: MX + 0.1, y: cy + 0.16, w: 0.27, h: 0.27,
      fill: { color: T.accent }, line: { color: T.accent, width: 0 },
    });
    slide.addText(String(i + 1), {
      x: MX + 0.1, y: cy + 0.16, w: 0.27, h: 0.27,
      fontSize: 7.5, bold: true, color: T.white, fontFace: FONT,
      align: "center", valign: "middle",
    });
    // Bullet text
    slide.addText(b, {
      x: MX + 0.48, y: cy + 0.07, w: CONTENT_W - 0.62, h: CARD_H - 0.14,
      fontSize: 9.5, color: T.text, fontFace: FONT, valign: "middle",
    });
  });

  // Bottom tag
  slide.addText(
    `Generated: ${dateStr}  ·  ${formatProgress(report.kpis.overallPhysical)}% physical progress`,
    {
      x: MX, y: FOOTER_Y - 0.38, w: CONTENT_W, h: 0.26,
      fontSize: 7.5, color: T.muted, fontFace: FONT, align: "center",
    },
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT FUNCTION
// ─────────────────────────────────────────────────────────────

export interface ExportToPPTXOptions {
  cityName: string;
  pageData: DashboardPageData;
  scopeType: ScopeType;
  currentScopePhysical: number;
  currentScopeRows: any[];
  selectedId?: number | null;
  selectedName?: string | null;
  selectedType?: "division" | "district" | "tehsil" | "project" | null;
}

export async function exportDashboardToPPTX(options: ExportToPPTXOptions): Promise<void> {
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

  const prs = new PptxGenJS();
  prs.layout = "LAYOUT_WIDE";
  prs.title    = `PSCA SafeCity — ${cityName}`;
  prs.subject  = "Physical Progress Decision-Support Report";
  prs.company  = "Punjab Safe City Authority";

  const dateStr     = today();
  const TOTAL_SLIDES = 10;

  buildSlide1Title(prs, report, dateStr, TOTAL_SLIDES);
  buildSlide2Overview(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide3Ranking(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide4Load(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide5TopProjects(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide6Attention(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide7StatusComposition(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide8DelayEvidence(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide9Register(prs, report, cityName, dateStr, TOTAL_SLIDES);
  buildSlide10Decision(prs, report, cityName, dateStr, TOTAL_SLIDES);

  const safeName = cityName
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  await prs.writeFile({
    fileName: `PSCA-SafeCity-${safeName}-${new Date().toISOString().slice(0, 10)}.pptx`,
  });
}
