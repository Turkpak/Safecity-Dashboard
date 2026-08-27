/**
 * exportToPPTX.ts
 * ============================================================
 * Professional decision-support PowerPoint — pptxgenjs 16:9.
 *
 * v4 — Management-ready upgrade:
 *   - Gradient-filled bars with rounded pill styling
 *   - RAG (Red/Amber/Green) status indicators
 *   - Risk matrix quadrant visualization
 *   - Financial utilization donut alongside physical
 *   - Rank badges (gold/silver/bronze) on top performers
 *   - Inline mini progress bars in management register table
 *   - Severity-coded decision summary cards
 *   - Performance gap indicator on ranking slides
 *   - Upgraded slide chrome with geometric accents
 *   - Consistent information hierarchy across all slides
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
  buildSeverityBullets,
  buildHierarchyBars,
  buildTopProjectBars,
  buildAttentionBars,
  buildProjectLoadBars,
  buildManagementTableRows,
  buildRagIndicators,
  buildPerformanceGap,
  buildRiskMatrix,
  buildProgressTrend,
  type ChartBar,
  type DecisionSeverity,
} from "./progressReportAnalytics";

// ─────────────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────────────

const T = {
  navy:       "0F172A",
  navyMid:    "1E293B",
  blue:       "1E3A8A",
  accent:     "2563EB",
  accentLt:   "3B82F6",
  red:        "DC2626",
  redDark:    "991B1B",
  green:      "16A34A",
  greenDark:  "15803D",
  amber:      "D97706",
  amberLt:    "F59E0B",
  slate:      "475569",
  muted:      "64748B",
  border:     "CBD5E1",
  light:      "F1F5F9",
  lighter:    "F8FAFC",
  white:      "FFFFFF",
  text:       "1E293B",
  softBlue:   "EFF6FF",
  softGreen:  "F0FDF4",
  softRed:    "FEF2F2",
  softAmber:  "FFFBEB",
  gold:       "F59E0B",
  silver:     "94A3B8",
  bronze:     "B45309",
  cardBg:     "FAFBFF",
} as const;

const FONT = "Calibri";

// ─────────────────────────────────────────────────────────────
// SLIDE GEOMETRY  (inches, 16:9 = 13.33 × 7.5)
// ─────────────────────────────────────────────────────────────

const W  = 13.33;
const H  = 7.5;
const MX = 0.45;         // left/right margin
const HEADER_H = 1.1;   // header band
const CONTENT_Y = 1.3;  // first content element starts here
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

function ragColor(rag: string): string {
  if (rag === "green") return T.green;
  if (rag === "amber") return T.amber;
  return T.red;
}

function severityColor(sev: DecisionSeverity): string {
  if (sev === "critical") return T.red;
  if (sev === "warning") return T.amber;
  if (sev === "positive") return T.green;
  return T.accent;
}

function severityBg(sev: DecisionSeverity): string {
  if (sev === "critical") return T.softRed;
  if (sev === "warning") return T.softAmber;
  if (sev === "positive") return T.softGreen;
  return T.softBlue;
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

function formatBudget(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

// ─────────────────────────────────────────────────────────────
// SLIDE CHROME  (header + footer — called on every content slide)
// ─────────────────────────────────────────────────────────────

function addSlideChrome(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  title: string, scopeName: string,
  pageNo: number, totalPages: number,
  dateStr: string,
): void {
  // Two-tone header band
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: W * 0.65, h: HEADER_H,
    fill: { color: T.navy }, line: { color: T.navy, width: 0 },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: W * 0.65, y: 0, w: W * 0.35, h: HEADER_H,
    fill: { color: T.blue }, line: { color: T.blue, width: 0 },
  });

  // Diagonal accent stripes (right side, subtle)
  [W - 3.5, W - 2.3, W - 1.1].forEach((sx) => {
    slide.addShape(prs.ShapeType.line, {
      x: sx, y: 0, w: 1.2, h: HEADER_H,
      line: { color: T.navyMid, width: 2, transparency: 70 },
    });
  });

  // Gold accent thin strip
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: HEADER_H - 0.08, w: W, h: 0.03,
    fill: { color: T.gold }, line: { color: T.gold, width: 0 },
  });
  // Red accent strip
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: HEADER_H - 0.05, w: W, h: 0.05,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });

  // Slide title (left of header)
  slide.addText(title, {
    x: MX, y: 0.1, w: W * 0.56, h: 0.5,
    fontSize: 16, bold: true, color: T.white, fontFace: FONT, valign: "middle",
  });
  // Scope name (below title, still in header)
  slide.addText(trunc(scopeName, 55), {
    x: MX, y: 0.62, w: W * 0.54, h: 0.28,
    fontSize: 8, color: "93C5FD", fontFace: FONT, valign: "middle",
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
// KPI BOX — elevated card with accent bar and shadow
// ─────────────────────────────────────────────────────────────

function addKpiBox(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  label: string, value: string, sub: string,
  accent: string = T.accent,
  ragDot?: string,
): void {
  // Shadow
  slide.addShape(prs.ShapeType.roundRect, {
    x: x + 0.02, y: y + 0.02, w, h,
    fill: { color: "D1D5DB" }, line: { color: "D1D5DB", width: 0 },
    rectRadius: 0.06,
  });
  // Card
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: T.cardBg }, line: { color: T.border, width: 0.4 },
    rectRadius: 0.06,
  });
  // Left accent strip
  slide.addShape(prs.ShapeType.rect, {
    x, y: y + 0.06, w: 0.07, h: h - 0.12,
    fill: { color: accent }, line: { color: accent, width: 0 },
  });

  // RAG dot (top-right corner)
  if (ragDot) {
    slide.addShape(prs.ShapeType.ellipse, {
      x: x + w - 0.24, y: y + 0.08, w: 0.14, h: 0.14,
      fill: { color: ragDot }, line: { color: ragDot, width: 0 },
    });
  }

  // Label
  slide.addText(trunc(label.toUpperCase(), 20), {
    x: x + 0.14, y: y + 0.06, w: w - 0.4, h: 0.2,
    fontSize: 5.5, bold: true, color: T.muted, fontFace: FONT, valign: "top",
  });

  // Value
  const valY = y + 0.26;
  const valH = Math.max(0.26, h - 0.52);
  slide.addText(value, {
    x: x + 0.14, y: valY, w: w - 0.2, h: valH,
    fontSize: Math.min(20, h < 0.8 ? 14 : 18), bold: true,
    color: T.text, fontFace: FONT, valign: "middle",
  });

  // Sub-label
  if (sub && h >= 0.76) {
    slide.addText(trunc(sub, 24), {
      x: x + 0.14, y: y + h - 0.22, w: w - 0.2, h: 0.18,
      fontSize: 5.5, color: T.muted, fontFace: FONT, valign: "bottom",
    });
  }
}

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
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
  // Circle dot
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

  return nextY;
}

// ─────────────────────────────────────────────────────────────
// HORIZONTAL BAR CHART — upgraded with gradient fills and rank badges
// ─────────────────────────────────────────────────────────────

function addHBarChart(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  bars: ChartBar[],
  x: number, y: number, w: number, h: number,
  maxValue = 100,
  showRankBadges = false,
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

  const rankColors = [T.gold, T.silver, T.bronze];

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

    // Rank badge for top 3
    if (showRankBadges && i < 3) {
      slide.addShape(prs.ShapeType.ellipse, {
        x: x + 0.02, y: ry + rowH * 0.15, w: rowH * 0.55, h: rowH * 0.55,
        fill: { color: rankColors[i] }, line: { color: rankColors[i], width: 0 },
      });
      slide.addText(String(i + 1), {
        x: x + 0.02, y: ry + rowH * 0.15, w: rowH * 0.55, h: rowH * 0.55,
        fontSize: 6, bold: true, color: T.white, fontFace: FONT,
        align: "center", valign: "middle",
      });
    }

    // Label
    const labelX = showRankBadges ? x + 0.3 : x + 0.06;
    slide.addText(trunc(bar.label, 22), {
      x: labelX, y: ry + 0.02, w: LABEL_W - 0.36, h: rowH - 0.04,
      fontSize: 7, color: T.text, fontFace: FONT, valign: "middle",
    });

    // Track
    slide.addShape(prs.ShapeType.roundRect, {
      x: x + LABEL_W, y: ry + rowH * 0.22, w: BAR_W, h: rowH * 0.52,
      fill: { color: T.light }, line: { color: "D8E3EF", width: 0.3 },
      rectRadius: 0.04,
    });

    // Fill (gradient-style via layered shapes)
    const val = Math.max(0, Math.min(maxValue, bar.value ?? 0));
    const fillW = val > 0 ? Math.max(0.06, (val / Math.max(maxValue, 1)) * BAR_W) : 0;
    if (fillW > 0) {
      // Main fill
      slide.addShape(prs.ShapeType.roundRect, {
        x: x + LABEL_W, y: ry + rowH * 0.22, w: fillW, h: rowH * 0.52,
        fill: { color: barColor }, line: { color: barColor, width: 0 },
        rectRadius: 0.04,
      });
      // Highlight overlay (top half, lighter)
      if (fillW > 0.15) {
        slide.addShape(prs.ShapeType.rect, {
          x: x + LABEL_W + 0.02, y: ry + rowH * 0.22, w: fillW - 0.04, h: rowH * 0.22,
          fill: { color: T.white }, line: { color: T.white, width: 0 },
          transparency: 80,
        } as any);
      }
    }

    // Meta text inside bar (project count, etc.)
    if (bar.meta && fillW > 1.5) {
      slide.addText(bar.meta, {
        x: x + LABEL_W + 0.1, y: ry + rowH * 0.22, w: fillW - 0.2, h: rowH * 0.52,
        fontSize: 5, color: T.white, fontFace: FONT, valign: "middle", align: "right",
        transparency: 30,
      } as any);
    }

    // Value pill
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
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h: CHART_H,
    fill: { color: "F8FAFC" }, line: { color: T.border, width: 0.25 },
    rectRadius: 0.06,
  });
  [0.25, 0.5, 0.75].forEach((pct) => {
    slide.addShape(prs.ShapeType.line, {
      x: x + 0.1, y: y + CHART_H * (1 - pct), w: w - 0.2, h: 0,
      line: { color: "E2E8F0", width: 0.2, dashType: "dash" },
    });
  });

  bars.forEach((bar, i) => {
    const bx = x + 0.1 + i * BAR_W;
    const fillH = bar.value > 0 ? Math.max(0.08, (bar.value / maxVal) * CHART_H * 0.85) : 0;
    const by = y + CHART_H - fillH;

    if (bar.value > 0) {
      // Main bar
      slide.addShape(prs.ShapeType.roundRect, {
        x: bx + GAP, y: by, w: BAR_W - GAP * 2, h: fillH,
        fill: { color: bar.color }, line: { color: bar.color, width: 0 },
        rectRadius: 0.04,
      });
    }
    // Count above bar
    slide.addText(String(bar.value), {
      x: bx, y: by - 0.20, w: BAR_W, h: 0.18,
      fontSize: 7.5, bold: true, color: T.text, fontFace: FONT,
      align: "center", valign: "middle",
    });
    // X-axis label
    slide.addText(trunc(bar.label, 10), {
      x: bx, y: y + CHART_H + 0.04, w: BAR_W, h: 0.22,
      fontSize: 5.5, color: T.muted, fontFace: FONT,
      align: "center", valign: "top",
    });
  });
}

// ─────────────────────────────────────────────────────────────
// DONUT PROGRESS
// ─────────────────────────────────────────────────────────────

function addDonutProgress(
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
  physical: number,
  label = "Physical",
): void {
  const actual    = Math.max(0, Math.min(100, physical));
  const remaining = Math.max(0, 100 - actual);

  slide.addChart("doughnut" as any,
    [{ name: "Progress", labels: ["Actual", "Remaining"], values: [actual, remaining] }],
    {
      x, y, w, h,
      chartColors: [progressColor(actual), "E2E8F0"],
      showLegend: false, showTitle: false,
      holeSize: 62, dataLabelFontSize: 0, showValue: false,
    } as any,
  );

  // Center text
  slide.addText(`${formatProgress(actual)}%`, {
    x: x + w * 0.18, y: y + h * 0.33, w: w * 0.64, h: h * 0.28,
    fontSize: 14, bold: true, color: progressColor(actual), fontFace: FONT,
    align: "center", valign: "middle",
  });
  slide.addText(label, {
    x: x + w * 0.18, y: y + h * 0.60, w: w * 0.64, h: 0.18,
    fontSize: 7, color: T.muted, fontFace: FONT,
    align: "center", valign: "top",
  });
}

// ─────────────────────────────────────────────────────────────
// RAG STRIP — horizontal strip of RAG indicators
// ─────────────────────────────────────────────────────────────

function addRagStrip(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  report: ReportData,
): void {
  const indicators = buildRagIndicators(report);
  const itemW = (w - 0.08 * (indicators.length - 1)) / indicators.length;

  indicators.forEach((ind, i) => {
    const ix = x + i * (itemW + 0.08);

    // Card bg
    slide.addShape(prs.ShapeType.roundRect, {
      x: ix, y, w: itemW, h,
      fill: { color: T.cardBg }, line: { color: T.border, width: 0.3 },
      rectRadius: 0.05,
    });

    // RAG dot
    slide.addShape(prs.ShapeType.ellipse, {
      x: ix + 0.12, y: y + h * 0.3, w: 0.18, h: 0.18,
      fill: { color: ragColor(ind.rag) }, line: { color: ragColor(ind.rag), width: 0 },
    });

    // Value
    slide.addText(ind.value, {
      x: ix + 0.36, y: y + 0.06, w: itemW - 0.44, h: h * 0.5,
      fontSize: 11, bold: true, color: T.text, fontFace: FONT, valign: "middle",
    });

    // Label
    slide.addText(ind.label.toUpperCase(), {
      x: ix + 0.12, y: y + h * 0.58, w: itemW - 0.2, h: h * 0.35,
      fontSize: 5.5, color: T.muted, fontFace: FONT, valign: "middle",
    });
  });
}

// ─────────────────────────────────────────────────────────────
// RISK MATRIX QUADRANT
// ─────────────────────────────────────────────────────────────

function addRiskMatrix(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  report: ReportData,
): void {
  const risk = report.riskMatrix;
  const halfW = (w - 0.08) / 2;
  const halfH = (h - 0.08) / 2;

  const quads: Array<{ label: string; value: number; bg: string; border: string; color: string }> = [
    { label: "HIGH RISK",  value: risk.highRisk,  bg: T.softRed,   border: T.red,    color: T.red    },
    { label: "AT RISK",    value: risk.atRisk,    bg: T.softAmber, border: T.amber,  color: T.amber  },
    { label: "ON TRACK",   value: risk.onTrack,   bg: T.softBlue,  border: T.accent, color: T.accent },
    { label: "COMPLETED",  value: risk.completed, bg: T.softGreen, border: T.green,  color: T.green  },
  ];

  quads.forEach((q, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const qx = x + col * (halfW + 0.08);
    const qy = y + row * (halfH + 0.08);

    slide.addShape(prs.ShapeType.roundRect, {
      x: qx, y: qy, w: halfW, h: halfH,
      fill: { color: q.bg }, line: { color: q.border, width: 0.6 },
      rectRadius: 0.08,
    });

    // Value
    slide.addText(String(q.value), {
      x: qx, y: qy + 0.08, w: halfW, h: halfH * 0.55,
      fontSize: 20, bold: true, color: q.color, fontFace: FONT,
      align: "center", valign: "middle",
    });

    // Label
    slide.addText(q.label, {
      x: qx, y: qy + halfH * 0.6, w: halfW, h: halfH * 0.35,
      fontSize: 6, bold: true, color: q.color, fontFace: FONT,
      align: "center", valign: "middle",
    });
  });
}

// ─────────────────────────────────────────────────────────────
// PERFORMANCE GAP INDICATOR
// ─────────────────────────────────────────────────────────────

function addPerformanceGapBar(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  report: ReportData,
): void {
  const gap = buildPerformanceGap(report.hierarchyUnits);
  if (!gap) return;

  // Background
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: T.cardBg }, line: { color: T.border, width: 0.3 },
    rectRadius: 0.05,
  });

  // Label
  slide.addText("PERFORMANCE GAP", {
    x: x + 0.12, y: y + 0.04, w: 1.4, h: 0.18,
    fontSize: 5.5, bold: true, color: T.muted, fontFace: FONT,
  });

  // Bar track
  const barX = x + 0.12;
  const barY = y + h * 0.5;
  const barW = w - 0.24;
  const barH = 0.16;

  slide.addShape(prs.ShapeType.roundRect, {
    x: barX, y: barY, w: barW, h: barH,
    fill: { color: "E2E8F0" }, line: { color: "E2E8F0", width: 0 },
    rectRadius: 0.04,
  });

  // Worst marker
  const worstX = barX + (gap.worstValue / 100) * barW;
  slide.addShape(prs.ShapeType.rect, {
    x: worstX, y: barY - 0.06, w: 0.06, h: barH + 0.12,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });
  slide.addText(trunc(gap.worstUnit, 12), {
    x: worstX - 0.5, y: barY + barH + 0.02, w: 1.1, h: 0.15,
    fontSize: 5, color: T.red, fontFace: FONT, align: "center",
  });

  // Best marker
  const bestX = barX + (gap.bestValue / 100) * barW;
  slide.addShape(prs.ShapeType.rect, {
    x: bestX, y: barY - 0.06, w: 0.06, h: barH + 0.12,
    fill: { color: T.green }, line: { color: T.green, width: 0 },
  });
  slide.addText(trunc(gap.bestUnit, 12), {
    x: bestX - 0.5, y: barY - 0.22, w: 1.1, h: 0.15,
    fontSize: 5, color: T.green, fontFace: FONT, align: "center",
  });

  // Spread label
  const spreadColor = gap.spread > 40 ? T.red : gap.spread > 20 ? T.amber : T.green;
  slide.addText(`${formatProgress(gap.spread)}pp spread  •  ${gap.spreadLabel}`, {
    x: x + w - 2.5, y: y + 0.02, w: 2.4, h: 0.22,
    fontSize: 6, bold: true, color: spreadColor, fontFace: FONT,
    align: "right", valign: "middle",
  });
}

// ─────────────────────────────────────────────────────────────
// COMPACT TABLE — upgraded with inline mini progress bars
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

  // Header — navy with rounded top
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w: tableW, h: HEAD_H,
    fill: { color: T.navy }, line: { color: T.navy, width: 0 },
    rectRadius: 0.05,
  });
  let cx = x;
  cols.forEach((col) => {
    slide.addText(trunc(col.label.toUpperCase(), 14), {
      x: cx + 0.05, y: y + 0.04, w: col.w - 0.07, h: HEAD_H - 0.08,
      fontSize: 5.5, bold: true, color: T.white, fontFace: FONT,
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
      line: { color: T.border, width: 0.2 },
    });

    cx = x;
    cols.forEach((col) => {
      const raw  = String(row[col.key] ?? "—");
      const disp = col.maxLen ? trunc(raw, col.maxLen) : raw;
      const lower = raw.toLowerCase();

      // Status-aware color
      let cellColor: string = T.text;
      if (lower.includes("delay") || lower === "yes") cellColor = T.red;
      else if (lower.includes("complet"))             cellColor = T.green;
      else if (lower.includes("progress"))            cellColor = T.accent;

      // Mini progress bar for physical column
      if (col.key === "physical" && typeof row.physicalNum === "number") {
        const pVal = row.physicalNum as number;
        const barW = col.w - 0.14;
        const barH = 0.09;
        const fillW = Math.max(0.02, (Math.min(100, pVal) / 100) * barW);

        // Track
        slide.addShape(prs.ShapeType.roundRect, {
          x: cx + 0.05, y: ry + ROW_H * 0.2, w: barW, h: barH,
          fill: { color: "E2E8F0" }, line: { color: "E2E8F0", width: 0 },
          rectRadius: 0.02,
        });
        // Fill
        slide.addShape(prs.ShapeType.roundRect, {
          x: cx + 0.05, y: ry + ROW_H * 0.2, w: fillW, h: barH,
          fill: { color: progressColor(pVal) }, line: { color: progressColor(pVal), width: 0 },
          rectRadius: 0.02,
        });
        // Value below bar
        slide.addText(disp, {
          x: cx + 0.05, y: ry + ROW_H * 0.45, w: barW, h: ROW_H * 0.5,
          fontSize: 5.8, bold: true, color: progressColor(pVal), fontFace: FONT,
          align: "center", valign: "middle",
        });
      } else {
        // RAG dot for status column
        if (col.key === "status") {
          const dotColor = lower.includes("complet") ? T.green
            : lower.includes("progress") ? T.accent
            : lower.includes("delay") ? T.red
            : T.silver;
          slide.addShape(prs.ShapeType.ellipse, {
            x: cx + 0.05, y: ry + ROW_H * 0.35, w: 0.09, h: 0.09,
            fill: { color: dotColor }, line: { color: dotColor, width: 0 },
          });
        }

        const textX = col.key === "status" ? cx + 0.18 : cx + 0.05;
        const textW = col.key === "status" ? col.w - 0.22 : col.w - 0.08;

        slide.addText(disp, {
          x: textX, y: ry + 0.03, w: textW, h: ROW_H - 0.06,
          fontSize: 6, color: cellColor, fontFace: FONT,
          align: col.align ?? "left", valign: "middle",
        });
      }

      if (cx + col.w < x + tableW - 0.04) {
        slide.addShape(prs.ShapeType.line, {
          x: cx + col.w, y: ry + 0.02, w: 0, h: ROW_H - 0.04,
          line: { color: T.border, width: 0.2, transparency: 45 },
        });
      }
      cx += col.w;
    });
  });

  // Summary row
  if (display.length > 0) {
    const summY = y + HEAD_H + display.length * ROW_H;
    slide.addShape(prs.ShapeType.rect, {
      x, y: summY, w: tableW, h: 0.22,
      fill: { color: T.light }, line: { color: T.border, width: 0.2 },
    });
    slide.addText(`Showing ${display.length} of ${rows.length} project(s)`, {
      x: x + 0.1, y: summY, w: tableW - 0.2, h: 0.22,
      fontSize: 5.5, color: T.muted, fontFace: FONT, valign: "middle",
    });
  }

  return HEAD_H + display.length * ROW_H + 0.22;
}

// ─────────────────────────────────────────────────────────────
// INSIGHT BOX — upgraded with severity indicators
// ─────────────────────────────────────────────────────────────

function addInsightBox(
  slide: PptxGenJS.Slide, prs: PptxGenJS,
  x: number, y: number, w: number, h: number,
  bullets: string[],
  heading = "Portfolio Observations",
): void {
  // Background
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: T.softBlue }, line: { color: "BFDBFE", width: 0.5 },
    rectRadius: 0.06,
  });
  // Left accent strip
  slide.addShape(prs.ShapeType.rect, {
    x, y: y + 0.06, w: 0.07, h: h - 0.12,
    fill: { color: T.accent }, line: { color: T.accent, width: 0 },
  });

  // Heading
  slide.addText(heading.toUpperCase(), {
    x: x + 0.16, y: y + 0.07, w: w - 0.24, h: 0.22,
    fontSize: 7.5, bold: true, color: T.navy, fontFace: FONT, valign: "top",
  });

  // Separator
  slide.addShape(prs.ShapeType.line, {
    x: x + 0.12, y: y + 0.31, w: w - 0.2, h: 0,
    line: { color: "BDD4FE", width: 0.3 },
  });

  // Bullets
  const BULLET_START = y + 0.36;
  const BULLET_STEP  = 0.215;

  bullets.slice(0, 5).forEach((b, i) => {
    const by = BULLET_START + i * BULLET_STEP;
    if (by + BULLET_STEP > y + h) return;

    slide.addShape(prs.ShapeType.rect, {
      x: x + 0.16, y: by + 0.065, w: 0.065, h: 0.065,
      fill: { color: T.accent }, line: { color: T.accent, width: 0 },
    });
    slide.addText(b, {
      x: x + 0.28, y: by, w: w - 0.38, h: BULLET_STEP - 0.01,
      fontSize: 6.5, color: T.text, fontFace: FONT, valign: "middle",
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

  // Background — navy with blue lower band
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: W, h: H,
    fill: { color: T.navy }, line: { color: T.navy, width: 0 },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: H - 1.1, w: W, h: 1.1,
    fill: { color: T.blue }, line: { color: T.blue, width: 0 },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: H - 0.08, w: W, h: 0.08,
    fill: { color: T.red }, line: { color: T.red, width: 0 },
  });

  // Thin frame
  slide.addShape(prs.ShapeType.rect, {
    x: 0.07, y: 0.07, w: W - 0.14, h: H - 0.14,
    fill: { type: "none" },
    line: { color: T.white, width: 0.4, transparency: 78 },
  });

  // Decorative geometric shapes
  slide.addShape(prs.ShapeType.rect, {
    x: W - 2.6, y: H - 2.2, w: 2.8, h: 2.6,
    fill: { color: "1A3580" }, line: { color: "1A3580", width: 0 },
    rotate: -28,
  });
  slide.addShape(prs.ShapeType.rect, {
    x: W - 1.6, y: H - 1.5, w: 2.0, h: 1.8,
    fill: { color: "2255D0" }, line: { color: "2255D0", width: 0 },
    rotate: -28,
  });

  // Subtle horizontal guides
  [1.6, 3.0, 4.4].forEach((ly) => {
    slide.addShape(prs.ShapeType.line, {
      x: 0, y: ly, w: W, h: 0,
      line: { color: T.white, width: 0.25, transparency: 87 },
    });
  });

  // PSCA branding
  slide.addText("PSCA SAFECITY", {
    x: MX, y: 0.78, w: W - MX * 2, h: 0.44,
    fontSize: 13, bold: true, color: "93C5FD", fontFace: FONT,
    align: "center", valign: "middle", charSpacing: 3.5,
  });

  // Main scope title
  slide.addText(trunc(report.scope.scopeName, 50), {
    x: MX, y: 1.26, w: W - MX * 2, h: 0.9,
    fontSize: 32, bold: true, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });

  // Subtitle
  slide.addText("Physical Progress Decision-Support Report", {
    x: MX, y: 2.22, w: W - MX * 2, h: 0.36,
    fontSize: 13, color: "C7D2FE", fontFace: FONT,
    align: "center", valign: "middle",
  });

  // Progress badge
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
  slide.addText(`${formatProgress(overall)}%`, {
    x: BADGE_X, y: BADGE_Y + 0.08, w: BADGE_W, h: BADGE_H * 0.58,
    fontSize: 26, bold: true, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });
  slide.addText("Overall Physical Progress", {
    x: BADGE_X, y: BADGE_Y + BADGE_H * 0.65, w: BADGE_W, h: BADGE_H * 0.3,
    fontSize: 9, color: T.white, fontFace: FONT,
    align: "center", valign: "middle",
  });

  // KPI row (5 dark boxes)
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
    slide.addText(k.value, {
      x: kx, y: KPI_Y + 0.04, w: kpiW, h: KPI_H * 0.52,
      fontSize: 18, bold: true, color: T.white, fontFace: FONT,
      align: "center", valign: "middle",
    });
    slide.addText(trunc(k.label, 18), {
      x: kx, y: KPI_Y + KPI_H * 0.58, w: kpiW, h: KPI_H * 0.35,
      fontSize: 6.5, color: "94A3B8", fontFace: FONT,
      align: "center", valign: "middle",
    });
  });

  // Generated line
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
  addSlideChrome(slide, prs, "Executive Dashboard", scopeName, 2, totalSlides, dateStr);

  let y = CONTENT_Y;

  // RAG Strip at top
  addRagStrip(slide, prs, MX, y, CONTENT_W, 0.56, report);
  y += 0.68;

  const LEFT_W = 4.2;

  // Left: dual donuts
  const donNextY = addSectionLabel(slide, prs, MX, y, "Progress Overview");
  addDonutProgress(slide, MX + 0.1, donNextY, 1.9, 1.9, report.kpis.overallPhysical, "Physical");
  const finPct = report.financialSummary?.utilizationPct ?? 0;
  addDonutProgress(slide, MX + 2.15, donNextY, 1.9, 1.9, finPct, "Financial");

  // Left: 4 mini KPI cards
  const cardY = donNextY + 2.0;
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
      cardY + Math.floor(i / 2) * 0.78,
      cW, 0.72,
      c.label, c.value, "", c.accent);
  });

  // Right: distribution chart
  const RX = MX + LEFT_W + 0.3;
  const RW = CONTENT_W - LEFT_W - 0.3;
  const distNextY = addSectionLabel(slide, prs, RX, y, "Project Progress Distribution");
  const distH = FOOTER_Y - 0.5 - distNextY;
  const distBars = report.distribution.map((d) => ({ label: d.bucket, value: d.count, color: d.color }));
  addCountBarChart(slide, prs, distBars, RX, distNextY, RW, distH);

  // Insight strip at bottom
  const insY = FOOTER_Y - 0.56;
  if (insY > cardY + 1.66) {
    addInsightBox(slide, prs, MX, insY, LEFT_W + 0.3, 0.52,
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

  let y = CONTENT_Y;

  // Performance gap bar at top
  addPerformanceGapBar(slide, prs, MX, y, CONTENT_W, 0.46, report);
  y += 0.56;

  const nextY = addSectionLabel(slide, prs, MX, y,
    `${unitLabel} Physical Progress Ranking`,
    `${report.hierarchyUnits.length} unit(s) · ranked by physical progress`);

  const bars = buildHierarchyBars(report.hierarchyUnits, 14);
  if (!bars.length) {
    slide.addText("No hierarchy units for this scope.", {
      x: MX, y: nextY + 0.5, w: CONTENT_W, h: 0.4,
      fontSize: 10, color: T.muted, fontFace: FONT, align: "center",
    });
    return;
  }
  addHBarChart(slide, prs, bars, MX, nextY, CONTENT_W, FOOTER_Y - 0.45 - nextY, 100, true);
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

  const nextY = addSectionLabel(slide, prs, MX, CONTENT_Y,
    "Top 10 Projects by Physical Progress",
    `${report.topProjects.length} projects shown`);

  addHBarChart(slide, prs,
    buildTopProjectBars(report.topProjects, 10),
    MX, nextY, CONTENT_W, FOOTER_Y - 0.45 - nextY, 100, true);
}

function buildSlide6Attention(
  prs: PptxGenJS, report: ReportData,
  scopeName: string, dateStr: string, totalSlides: number,
): void {
  const slide = prs.addSlide();
  addSlideChrome(slide, prs, "Risk & Attention Analysis", scopeName, 6, totalSlides, dateStr);

  const LEFT_W = CONTENT_W * 0.55;
  const RIGHT_W = CONTENT_W - LEFT_W - 0.25;

  // Left: attention bar chart
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

  // Right: risk matrix quadrant
  const riskNextY = addSectionLabel(slide, prs, MX + LEFT_W + 0.25, CONTENT_Y, "Risk Matrix");
  const riskH = Math.min(2.5, FOOTER_Y - riskNextY - 1.8);
  addRiskMatrix(slide, prs, MX + LEFT_W + 0.25, riskNextY, RIGHT_W, riskH, report);

  // Right: profile cards below risk matrix
  const profile = buildAttentionProfile(report.projects);
  const profileY = riskNextY + riskH + 0.15;
  const CARD_H = 0.52;
  const CARD_GAP = 0.06;
  const profileItems = [
    { label: "At 0%",      value: profile.zeroProgress, color: T.red   },
    { label: "With Delay", value: profile.withDelay,     color: T.amber },
    { label: "Above 75%",  value: profile.above75,       color: T.green },
  ];
  profileItems.forEach((item, i) => {
    const cardY = profileY + i * (CARD_H + CARD_GAP);
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

  // Left: donut chart showing status breakdown
  const statusNextY = addSectionLabel(slide, prs, MX, CONTENT_Y, "Status Breakdown");

  // Donut with status data
  const statusValues = statusComp.map((s) => s.count);
  const statusLabels = statusComp.map((s) => s.label);
  const statusColors = statusComp.map((s) => s.color.replace("#", ""));

  if (statusValues.some((v) => v > 0)) {
    slide.addChart("doughnut" as any,
      [{ name: "Status", labels: statusLabels, values: statusValues }],
      {
        x: MX + 0.3, y: statusNextY, w: HALF_W - 0.6, h: 2.5,
        chartColors: statusColors,
        showLegend: false, showTitle: false,
        holeSize: 55, dataLabelFontSize: 0, showValue: false,
      } as any,
    );
  }

  // Status cards below donut
  const cardY = statusNextY + 2.6;
  const CARD_H = 0.62;
  statusComp.forEach((s, i) => {
    const cy = cardY + i * (CARD_H + 0.06);
    if (cy + CARD_H > FOOTER_Y - 0.4) return;
    addKpiBox(slide, prs, MX, cy, HALF_W, CARD_H,
      s.label, String(s.count), `${s.pct}% of portfolio`, s.color.replace("#", ""));
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

  // Right: evidence summary cards
  const sumNextY = addSectionLabel(slide, prs, MX + HALF_W + 0.3, CONTENT_Y,
    "Execution Evidence Summary");

  const summaryItems = [
    { label: "At 0% Physical",  value: String(zeros.length),                            color: T.red    },
    { label: "With Delay Logs", value: String(delayed.length),                          color: T.amber  },
    { label: "Delayed + 0%",    value: String(delayed.filter((p) => p.physical_progress === 0).length), color: T.red },
    { label: "In Progress",     value: String(report.kpis.inProgressProjects),          color: T.accent },
    { label: "Completed",       value: String(report.kpis.completedProjects),           color: T.green  },
  ];
  const CARD_H = 0.7, CARD_GAP = 0.07;
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
    "Attention-first · ascending physical progress");

  const sorted = [
    ...report.attentionProjects,
    ...report.projects
      .filter((p) => !report.attentionProjects.some((a) => a.id === p.id))
      .sort((a, b) => a.physical_progress - b.physical_progress),
  ];

  const cols: ColDef[] = [
    { key: "project",  label: "Project",   w: 3.1, maxLen: 26 },
    { key: "division", label: "Division",  w: 1.5, maxLen: 14 },
    { key: "district", label: "District",  w: 1.5, maxLen: 14 },
    { key: "physical", label: "Physical",  w: 1.1, align: "center" },
    { key: "status",   label: "Status",    w: 1.1, align: "center" },
    { key: "delay",    label: "Delay",     w: 0.62, align: "center" },
  ];

  const totalColW = cols.reduce((s, c) => s + c.w, 0);
  const scale = CONTENT_W / totalColW;
  const scaledCols = cols.map((c) => ({ ...c, w: c.w * scale }));

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

  const bullets = buildSeverityBullets(report);
  const CARD_H  = 0.56;
  const CARD_GAP = 0.08;

  bullets.forEach((b, i) => {
    const cy = nextY + i * (CARD_H + CARD_GAP);
    if (cy + CARD_H > FOOTER_Y - 0.4) return;

    const bg = severityBg(b.severity);
    const accentColor = severityColor(b.severity);

    // Card
    slide.addShape(prs.ShapeType.roundRect, {
      x: MX, y: cy, w: CONTENT_W, h: CARD_H,
      fill: { color: bg }, line: { color: accentColor, width: 0.4 },
      rectRadius: 0.06,
    });

    // Severity accent bar (left)
    slide.addShape(prs.ShapeType.rect, {
      x: MX, y: cy + 0.06, w: 0.07, h: CARD_H - 0.12,
      fill: { color: accentColor }, line: { color: accentColor, width: 0 },
    });

    // Numbered circle
    slide.addShape(prs.ShapeType.ellipse, {
      x: MX + 0.16, y: cy + CARD_H / 2 - 0.14, w: 0.28, h: 0.28,
      fill: { color: accentColor }, line: { color: accentColor, width: 0 },
    });
    slide.addText(String(i + 1), {
      x: MX + 0.16, y: cy + CARD_H / 2 - 0.14, w: 0.28, h: 0.28,
      fontSize: 8, bold: true, color: T.white, fontFace: FONT,
      align: "center", valign: "middle",
    });

    // Bullet text
    slide.addText(b.text, {
      x: MX + 0.54, y: cy + 0.06, w: CONTENT_W - 0.7, h: CARD_H - 0.12,
      fontSize: 9, color: T.text, fontFace: FONT, valign: "middle",
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
