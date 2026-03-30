import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PlannedVsActualChart } from "@/components/dashboard/PlannedVsActualChart";
import type { SubProject } from "@/components/dashboard/SubProjectCard";
import { useWindowSize } from "@/hooks/use-window-size";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, X, Plus, Trash2, Edit2, Calendar, AlertTriangle, Clock, Image as ImageIcon, XCircle, MoreVertical, Upload, FileText, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjectGanttTree } from "@/components/dashboard/ProjectGanttTree";

type PhaseTimelinePoint = {
  month: string;
  actual: number;
  planned: number;
};

export type MilestonePhaseProgress = {
  actual: number;
  planned: number;
  subProjects?: SubProject[];
  timeline?: PhaseTimelinePoint[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Simple deterministic hash -> 0..1
const hash01 = (input: string) => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unsigned -> 0..1
  return (h >>> 0) / 0xffffffff;
};

function buildDeterministicSubprojectTimeline(
  sub: SubProject,
  parentTimeline: PhaseTimelinePoint[]
): PhaseTimelinePoint[] {
  const n = parentTimeline.length;
  if (n === 0) return [];

  // stable factor per subproject, gives different curve "speed" but deterministic
  const factor = 0.75 + hash01(sub.id + "|factor") * 0.5; // 0.75..1.25
  const plannedFactor = 0.8 + hash01(sub.id + "|pf") * 0.4; // 0.8..1.2

  // Base series derived from parent points
  const base = parentTimeline.map((p) => ({
    month: p.month,
    actual: clamp(p.actual * factor, 0, 100),
    planned: clamp(p.planned * plannedFactor, 0, 100),
  }));

  // Ensure last point matches the provided subproject snapshot (so charts stay consistent)
  const last = base[n - 1];
  const aScale = last.actual > 0 ? sub.actualProgress / last.actual : 1;
  const pScale = last.planned > 0 ? sub.plannedProgress / last.planned : 1;

  return base.map((p, idx) => {
    // light easing toward scaled values, keeps earlier months reasonable
    const t = idx / Math.max(1, n - 1);
    const ease = t * t * (3 - 2 * t); // smoothstep
    return {
      month: p.month,
      actual: clamp(p.actual * (1 + (aScale - 1) * ease), 0, 100),
      planned: clamp(p.planned * (1 + (pScale - 1) * ease), 0, 100),
    };
  });
}

type GanttTask = {
  id: string;
  name: string;
  startIdx: number;
  endIdx: number;
  weight: number;
  status: "ahead" | "behind" | "ontrack";
  children?: GanttTask[];
  // Optional overrides used when we generate tasks from API-driven milestones
  progressOverride?: number; // 0..100
  plannedOverride?: number; // 0..100
};

// Frontend-only: progress photos and documents (in-memory, no backend)
type ProgressPhotoItem = {
  id: string;
  file: File;
  objectUrl: string;
  date: string; // YYYY-MM-DD
  caption?: string;
};
type ProgressDocItem = {
  id: string;
  file: File;
  name: string;
  uploadedAt?: string; // ISO string for sort order
};

// Delay logs were previously hardcoded in the UI. We keep the types as no-op
// placeholders so the rest of the component compiles, but the feature is disabled.
type DelayLog = {
  id: string;
  taskId: string;
  loggedBy: string;
  reason: string;
  delayDuration: number;
  loggedAt: string;
  delayDate: string;
  monthIndex: number;
  imageUrl?: string;
};

type DelayLogFormData = {
  loggedBy: string;
  reason: string;
  delayDuration: string;
  delayDate: string;
  imageFile: File | null;
  imagePreview: string | null;
};

function generateHardcodedDelayLogs(): DelayLog[] {
  return [];
}

const CHILD_NAME_TEMPLATES: Record<string, string[]> = {
  "Site Survey & Assessment": ["Field Survey", "Data Collection", "Site Measurements", "Survey Report"],
  "Technical Feasibility Study": ["Requirements Review", "Feasibility Analysis", "Risk Assessment", "Approval & Sign-off"],
  "Site Selection & Approval": ["Option Shortlisting", "Stakeholder Review", "Authority Approval", "Final Selection"],
  "Environmental Clearance": ["Documentation", "Submission", "Compliance Review", "Clearance Issuance"],

  "Excavation Work": ["Marking & Layout", "Excavation", "Disposal/Hauling", "Inspection"],
  "Foundation Pouring": ["Rebar Setup", "Formwork", "Concrete Pour", "Finishing"],
  "Curing & Quality Check": ["Curing", "Cube Tests", "QC Inspection", "Punch List"],
  "Backfilling & Compaction": ["Backfilling", "Layer Compaction", "Leveling", "Final Check"],

  "Cabinet Installation": ["Mounting", "Anchoring", "Alignment", "Handover"],
  "Electrical Connections": ["Cabling", "Terminations", "Earthing", "Testing"],
  "Network Setup": ["Fiber Pulling", "Splicing", "Switch Config", "Connectivity Test"],
  "Equipment Mounting": ["Bracket Install", "Device Mount", "Labeling", "Commissioning Prep"],

  "Cable Trenching": ["Route Marking", "Trenching", "Duct Placement", "Backfill"],
  "Fiber Optic Laying": ["Pulling", "Splicing", "OTDR Test", "Documentation"],
  "Power Cable Installation": ["Cable Pull", "Terminations", "Protection", "Load Test"],
  "Cable Termination & Testing": ["Termination", "Continuity Test", "Insulation Test", "Sign-off"],

  "Room Renovation": ["Civil Works", "Electrical Works", "Flooring/Ceiling", "Finishing"],
  "Server Installation": ["Rack Setup", "Server Mount", "Power & Network", "Burn-in Test"],
  "Display Systems": ["Mounting", "Cabling", "Calibration", "Acceptance Test"],
  "Control Systems Integration": ["Integration", "Configuration", "End-to-End Test", "Handover"],

  "System Integration": ["Interface Setup", "Data Mapping", "Integration Test", "UAT Support"],
  "Software Deployment": ["Environment Setup", "Deployment", "Smoke Tests", "Stabilization"],
  "Testing & Commissioning": ["Test Plans", "Commissioning", "Defect Fixes", "Final Verification"],
  "Go-Live Preparation": ["Training", "Runbook", "Cutover Plan", "Go-Live Readiness"],
};

function getChildNames(parentName: string, childCount: number): string[] {
  const tpl = CHILD_NAME_TEMPLATES[parentName];
  if (tpl && tpl.length) return tpl.slice(0, childCount);
  // Fallback: derive readable labels from parent
  return Array.from({ length: childCount }).map((_, i) => `${parentName} — Task ${i + 1}`);
}

function buildChildTasks(parent: GanttTask, seed: string): GanttTask[] {
  const span = parent.endIdx - parent.startIdx + 1;
  const childCount = clamp(Math.round(2 + hash01(seed + "|n") * 2), 2, 4); // 2..4
  const weightsRaw = Array.from({ length: childCount }).map((_, i) => 0.6 + hash01(seed + `|w|${i}`) * 0.8);
  const wSum = weightsRaw.reduce((a, b) => a + b, 0) || 1;
  const weights = weightsRaw.map(w => w / wSum);

  // Split parent's window into sequential child windows (with small deterministic overlaps)
  let cursor = parent.startIdx;
  const children: GanttTask[] = [];
  const childNames = getChildNames(parent.name, childCount);
  for (let i = 0; i < childCount; i++) {
    const remaining = parent.endIdx - cursor + 1;
    const minDur = 1;
    const maxDur = Math.max(minDur, remaining - (childCount - i - 1));
    const ideal = clamp(Math.round(span * weights[i]), minDur, maxDur);
    const overlap = i > 0 ? (hash01(seed + `|o|${i}`) > 0.75 ? 1 : 0) : 0;
    const startIdx = clamp(cursor - overlap, parent.startIdx, parent.endIdx);
    const endIdx = clamp(startIdx + ideal - 1, startIdx, parent.endIdx);

    children.push({
      id: `${parent.id}::${i}`,
      name: childNames[i] ?? `${parent.name} — Task ${i + 1}`,
      startIdx,
      endIdx,
      weight: parent.weight * weights[i],
      status: parent.status,
    });
    cursor = clamp(endIdx + 1, parent.startIdx, parent.endIdx);
  }
  return children;
}

function buildGanttTasks(subProjects: SubProject[], months: string[]): GanttTask[] {
  const n = months.length;
  if (n === 0) return [];

  const monthIndexFromDate = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    // months[] entries are short month names ("Jan", "Feb", ...). Match by month number.
    const monthShort = MONTH_NAMES[d.getMonth()];
    const idx = months.findIndex((m) => m.startsWith(monthShort));
    return idx >= 0 ? idx : null;
  };

  return subProjects.map((s) => {
    const childMilestones = s.milestones ?? [];

    // Parent timeline: prefer real date range from milestones if present.
    let startIdx: number;
    let endIdx: number;
    if (childMilestones.length > 0) {
      const idxs = childMilestones
        .flatMap((m) => [monthIndexFromDate(m.startDate), monthIndexFromDate(m.finishDate)])
        .filter((v): v is number => typeof v === "number");
      if (idxs.length > 0) {
        startIdx = clamp(Math.min(...idxs), 0, Math.max(0, n - 1));
        endIdx = clamp(Math.max(...idxs), startIdx, Math.max(0, n - 1));
      } else {
        // fallback deterministic
        const r1 = hash01(s.id + "|s");
        const r2 = hash01(s.id + "|d");
        const duration = clamp(Math.round(2 + r2 * 3), 1, Math.max(1, n)); // 2..5 (clamped)
        startIdx = clamp(Math.round(r1 * Math.max(0, n - duration)), 0, Math.max(0, n - 1));
        endIdx = clamp(startIdx + duration - 1, startIdx, Math.max(0, n - 1));
      }
    } else {
      const r1 = hash01(s.id + "|s");
      const r2 = hash01(s.id + "|d");
      const duration = clamp(Math.round(2 + r2 * 3), 1, Math.max(1, n)); // 2..5 (clamped)
      startIdx = clamp(Math.round(r1 * Math.max(0, n - duration)), 0, Math.max(0, n - 1));
      endIdx = clamp(startIdx + duration - 1, startIdx, Math.max(0, n - 1));
    }

    const variance = s.actualProgress - s.plannedProgress;
    const status: GanttTask["status"] =
      Math.abs(variance) < 1 ? "ontrack" : variance >= 0 ? "ahead" : "behind";

    const children: GanttTask[] | undefined =
      childMilestones.length > 0
        ? childMilestones.map((m, i) => {
            const cStart = monthIndexFromDate(m.startDate) ?? startIdx;
            const cEnd = monthIndexFromDate(m.finishDate) ?? cStart;
            const cs = clamp(cStart, 0, Math.max(0, n - 1));
            const ce = clamp(cEnd, cs, Math.max(0, n - 1));
            const rawProgress = (m as any).progress;
            const rawPlanned = (m as any).plannedProgress;
            const progressOverride =
              typeof rawProgress === "number" && Number.isFinite(rawProgress) ? clamp(rawProgress, 0, 100) : undefined;
            const plannedOverride =
              typeof rawPlanned === "number" && Number.isFinite(rawPlanned) ? clamp(rawPlanned, 0, 100) : undefined;

            // Weight evenly among children by default.
            const w = childMilestones.length > 0 ? s.weight / childMilestones.length : s.weight;
            const childVariance = (progressOverride ?? 0) - (plannedOverride ?? 100);
            const childStatus: GanttTask["status"] =
              Math.abs(childVariance) < 1 ? "ontrack" : childVariance >= 0 ? "ahead" : "behind";

            return {
              id: m.id || `${s.id}-m-${i}`,
              name: m.name,
              startIdx: cs,
              endIdx: ce,
              weight: w,
              status: childStatus,
              progressOverride,
              plannedOverride,
            };
          })
        : buildChildTasks(
            {
              id: s.id,
              name: s.name,
              startIdx,
              endIdx,
              weight: s.weight,
              status,
            },
            s.id,
          );

    return {
      id: s.id,
      name: s.name,
      startIdx,
      endIdx,
      weight: s.weight,
      status,
      children,
    };
  });
}

function statusColor(status: GanttTask["status"], baseColor: string) {
  if (status === "ahead") return "#10b981";
  if (status === "behind") return "#ef4444";
  return baseColor;
}

// Hex to rgba for light bar background (single color family, no white tone)
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Gantt chart year for date labels
const GANTT_CHART_YEAR = 2026;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonthHeaderLabel(monthShort: string, year: number): { label: string; dateRange: string } {
  const idx = MONTH_NAMES.findIndex((m) => m.startsWith(monthShort.substring(0, 3)));
  const monthIndex = idx >= 0 ? idx : 0;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return {
    label: `${monthShort} ${year}`,
    dateRange: `1 - ${daysInMonth}`,
  };
}

// Planned timeline date range for a task (startIdx, endIdx = month indices). Returns YYYY-MM-DD for min/max.
function getPlannedDateRange(startIdx: number, endIdx: number, year: number): { minDate: string; maxDate: string } {
  const minD = new Date(year, startIdx, 1);
  const maxD = new Date(year, endIdx + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    minDate: `${minD.getFullYear()}-${pad(minD.getMonth() + 1)}-${pad(minD.getDate())}`,
    maxDate: `${maxD.getFullYear()}-${pad(maxD.getMonth() + 1)}-${pad(maxD.getDate())}`,
  };
}

// Generate a deterministic "responsible person" name for a task
function getResponsiblePerson(taskId: string, taskName: string): string {
  const seed = hash01(taskId + "|person");
  const names = ["Team A", "Team B", "Team C", "Project Lead", "Site Manager", "QC Team"];
  return names[Math.floor(seed * names.length)];
}

// Calculate progress percentage for display (actual)
// Note: subProject should already have adjusted progress from adjustedSubProjects
function getProgressPercentage(task: GanttTask, subProject?: SubProject): number {
  if (typeof task.progressOverride === "number") {
    return Math.round(task.progressOverride);
  }
  // If we have sub-project data, use actual progress (already adjusted for delays)
  if (subProject) {
    return Math.round(subProject.actualProgress);
  }

  // Fallback: Use a deterministic progress based on task status and position
  const seed = hash01(task.id + "|progress");
  if (task.status === "ahead") return Math.round(60 + seed * 40); // 60-100%
  if (task.status === "behind") return Math.round(20 + seed * 40); // 20-60%
  return Math.round(40 + seed * 40); // 40-80%
}

// Planned progress for display (where we should be)
function getPlannedPercentage(task: GanttTask, subProject?: SubProject): number {
  if (typeof task.plannedOverride === "number") {
    return Math.round(Math.min(100, Math.max(0, task.plannedOverride)));
  }
  if (subProject) {
    return Math.round(Math.min(100, Math.max(0, subProject.plannedProgress)));
  }
  const seed = hash01(task.id + "|planned");
  if (task.status === "ahead") return Math.round(50 + seed * 30);
  if (task.status === "behind") return Math.round(60 + seed * 35);
  return Math.round(45 + seed * 40);
}

// Delay Log Form Dialog Component (for adding/editing)
function DelayLogFormDialog({
  open,
  onOpenChange,
  taskName,
  taskId,
  monthIndex,
  monthName,
  months,
  onSave,
  existingLog,
  defaultDate,
  minDate,
  maxDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskId: string;
  monthIndex: number;
  monthName: string;
  months: string[];
  onSave: (log: DelayLog) => void;
  existingLog?: DelayLog;
  defaultDate?: string; // ISO date string for default date
  minDate?: string; // YYYY-MM-DD: restrict to planned timeline start
  maxDate?: string; // YYYY-MM-DD: restrict to planned timeline end
}) {
  // Get default date: use existing log's delayDate, or defaultDate, clamped to [minDate, maxDate] when provided
  const getDefaultDate = () => {
    let d: string | undefined;
    if (existingLog?.delayDate) d = existingLog.delayDate.split('T')[0];
    else if (defaultDate) d = defaultDate.split('T')[0];
    else if (minDate && maxDate) d = minDate;
    else d = new Date().toISOString().split('T')[0];
    if (d && minDate && d < minDate) return minDate;
    if (d && maxDate && d > maxDate) return maxDate;
    return d!;
  };

  const [formData, setFormData] = useState<DelayLogFormData>({
    loggedBy: existingLog?.loggedBy || "",
    reason: existingLog?.reason || "",
    delayDuration: existingLog?.delayDuration.toString() || "1",
    delayDate: getDefaultDate(),
    imageFile: null,
    imagePreview: existingLog?.imageUrl || null,
  });

  // Reset form when dialog opens/closes or existingLog changes
  useEffect(() => {
    if (open) {
      setFormData({
        loggedBy: existingLog?.loggedBy || "",
        reason: existingLog?.reason || "",
        delayDuration: existingLog?.delayDuration.toString() || "1",
        delayDate: getDefaultDate(),
        imageFile: null,
        imagePreview: existingLog?.imageUrl || null,
      });
    }
  }, [open, existingLog, defaultDate, minDate, maxDate]);

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          imageFile: file,
          imagePreview: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove image
  const handleRemoveImage = () => {
    setFormData({
      ...formData,
      imageFile: null,
      imagePreview: null,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.loggedBy.trim() || !formData.reason.trim() || !formData.delayDate) {
      return;
    }

    // Calculate monthIndex from delayDate
    const delayDateObj = new Date(formData.delayDate);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const delayMonthName = monthNames[delayDateObj.getMonth()];
    const calculatedMonthIndex = months.findIndex(m =>
      m.includes(delayMonthName) || m === delayMonthName
    );

    const delayLog: DelayLog = {
      id: existingLog?.id || `${taskId}-${delayDateObj.getTime()}-${Date.now()}`,
      taskId,
      loggedBy: formData.loggedBy.trim(),
      reason: formData.reason.trim(),
      delayDuration: parseInt(formData.delayDuration, 10) || 1,
      loggedAt: existingLog?.loggedAt || new Date().toISOString(),
      delayDate: new Date(formData.delayDate).toISOString(),
      monthIndex: calculatedMonthIndex >= 0 ? calculatedMonthIndex : monthIndex,
      imageUrl: formData.imagePreview || undefined,
    };

    onSave(delayLog);
    setFormData({
      loggedBy: "",
      reason: "",
      delayDuration: "1",
      delayDate: new Date().toISOString().split('T')[0],
      imageFile: null,
      imagePreview: null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-2 border-primary/10 shadow-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shadow-sm">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-heading">
                {existingLog ? "Edit" : "Add"} Delay Log
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {taskName.length > 40 ? taskName.substring(0, 40) + "..." : taskName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 max-h-[65vh] px-6 py-2">
            <div className="space-y-5 pb-4">
              <div className="space-y-2">
                <Label htmlFor="loggedBy" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logged By <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="loggedBy"
                    placeholder="Enter your name or ID"
                    value={formData.loggedBy}
                    onChange={(e) => setFormData({ ...formData, loggedBy: e.target.value })}
                    className="pl-9 h-11 bg-muted/30 border-muted-foreground/20 focus:border-primary/50 transition-all"
                    required
                  />
                  <AlertCircle className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground/60" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delayDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Delay Date <span className="text-destructive">*</span></Label>
                  <Input
                    id="delayDate"
                    type="date"
                    min={minDate}
                    max={maxDate}
                    value={formData.delayDate}
                    onChange={(e) => setFormData({ ...formData, delayDate: e.target.value })}
                    className="h-11 bg-muted/30 border-muted-foreground/20 focus:border-primary/50 transition-all"
                    required
                  />
                  {minDate && maxDate && (
                    <p className="text-[10px] text-muted-foreground">Within planned timeline: {minDate} to {maxDate}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delayDuration" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration (Days) <span className="text-destructive">*</span></Label>
                  <Input
                    id="delayDuration"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formData.delayDuration}
                    onChange={(e) => setFormData({ ...formData, delayDuration: e.target.value })}
                    className="h-11 bg-muted/30 border-muted-foreground/20 focus:border-primary/50 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for Delay <span className="text-destructive">*</span></Label>
                <Textarea
                  id="reason"
                  placeholder="Describe the reason for the delay in detail..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="bg-muted/30 border-muted-foreground/20 focus:border-primary/50 transition-all resize-none p-3"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Evidence Image (Optional)</Label>
                <div className="space-y-3">
                  {formData.imagePreview ? (
                    <div className="relative group rounded-xl overflow-hidden border-2 border-orange-200 dark:border-orange-900 shadow-md">
                      <img
                        src={formData.imagePreview}
                        alt="Delay evidence"
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-8 rounded-full shadow-lg"
                          onClick={handleRemoveImage}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all rounded-xl p-8 text-center group cursor-pointer"
                      onClick={() => document.getElementById('image')?.click()}>
                      <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground/80">Click to upload image</p>
                        <p className="text-[10px] text-muted-foreground">PNG, JPG or JPEG up to 5MB</p>
                      </div>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-2 bg-muted/10 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 rounded-xl px-6">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.loggedBy.trim() || !formData.reason.trim()}
              className="h-11 rounded-xl px-8 bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-lg shadow-orange-600/20 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" />
              {existingLog ? "Update" : "Add"} Delay Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Delay Log Cards Component (displays delay logs as cards beneath Gantt chart)
function DelayLogCards({
  delayLogs,
  ganttTasks,
  subProjects,
  months,
  onDelete,
  isMobile,
  isTablet,
}: {
  delayLogs: DelayLog[];
  ganttTasks: GanttTask[];
  subProjects?: SubProject[];
  months: string[];
  onDelete?: (logId: string) => void;
  isMobile: boolean;
  isTablet: boolean;
}) {
  // Get task name from taskId
  const getTaskName = (taskId: string): string => {
    // First check subProjects
    const subProject = subProjects?.find(sp => sp.id === taskId);
    if (subProject) return subProject.name;

    // Then check ganttTasks (including children)
    const findTaskInTree = (tasks: GanttTask[], id: string): GanttTask | null => {
      for (const task of tasks) {
        if (task.id === id) return task;
        if (task.children) {
          const found = findTaskInTree(task.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const task = findTaskInTree(ganttTasks, taskId);
    return task?.name || taskId;
  };

  if (delayLogs.length === 0) {
    return null;
  }

  // Sort logs by date (newest first)
  const sortedLogs = [...delayLogs].sort((a, b) =>
    new Date(b.delayDate).getTime() - new Date(a.delayDate).getTime()
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-orange-400" />
        <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold text-foreground`}>
          Delay Logs ({delayLogs.length} total)
        </h3>
      </div>

      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {sortedLogs.map((log) => {
          const taskName = getTaskName(log.taskId);
          const subProject = subProjects?.find(sp => sp.id === log.taskId);
          const variance = subProject
            ? Math.max(0, subProject.plannedProgress - subProject.actualProgress)
            : 0;
          const displayDate = log.loggedAt || log.delayDate;

          return (
            <Card key={log.id} className="border-amber-200 dark:border-orange-800 bg-amber-50/80 dark:bg-orange-950/20 rounded-xl overflow-hidden shadow-sm">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Task title */}
                  <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold text-foreground truncate`} title={taskName}>
                    {taskName}
                  </h4>

                  {/* Red status badge: X% behind schedule */}
                  {variance > 0 && (
                    <Badge variant="destructive" className="rounded-md px-2.5 py-1 text-xs font-semibold">
                      {variance.toFixed(1)}% behind schedule
                    </Badge>
                  )}

                  {/* Timeline: Month (calendar) + Duration (clock) - button-like */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-orange-700 bg-white dark:bg-orange-950/40 px-2.5 py-1.5 text-xs font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-orange-400" />
                      {months[log.monthIndex] || `M${log.monthIndex + 1}`}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-orange-700 bg-white dark:bg-orange-950/40 px-2.5 py-1.5 text-xs font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-orange-400" />
                      {log.delayDuration} day{log.delayDuration !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Reason for delay */}
                  <p className="text-sm text-muted-foreground leading-snug" title={log.reason}>
                    {log.reason}
                  </p>

                  {/* Image display */}
                  {log.imageUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-amber-200 dark:border-orange-800">
                      <img
                        src={log.imageUrl}
                        alt="Delay evidence"
                        className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          const newWindow = window.open();
                          if (newWindow) {
                            newWindow.document.write(`
                              <html>
                                <head><title>Delay Evidence</title></head>
                                <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                  <img src="${log.imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                </body>
                              </html>
                            `);
                          }
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        Evidence
                      </div>
                    </div>
                  )}

                  {/* Attribution and date */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-amber-200/80 dark:border-orange-800/80">
                    <span>By: {log.loggedBy}</span>
                    <span>{new Date(displayDate).toLocaleDateString()}</span>
                  </div>

                  {/* Delete button beneath each delay log card */}
                  {onDelete && (
                    <div className="pt-3 mt-2 border-t border-amber-200/80 dark:border-orange-800/80">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this delay log?")) {
                            onDelete(log.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete delay log
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Delay Logs Table Component (shows all logs in a table format)
function DelayLogsTable({
  delayLogs,
  ganttTasks,
  subProjects,
  months,
  onEdit,
  onDelete,
  isMobile,
  isTablet,
}: {
  delayLogs: DelayLog[];
  ganttTasks: GanttTask[];
  subProjects?: SubProject[];
  months: string[];
  onEdit: (log: DelayLog) => void;
  onDelete: (logId: string) => void;
  isMobile: boolean;
  isTablet: boolean;
}) {
  // Get task name from taskId
  const getTaskName = (taskId: string): string => {
    // First check subProjects
    const subProject = subProjects?.find(sp => sp.id === taskId);
    if (subProject) return subProject.name;

    // Then check ganttTasks (including children)
    const findTaskInTree = (tasks: GanttTask[], id: string): GanttTask | null => {
      for (const task of tasks) {
        if (task.id === id) return task;
        if (task.children) {
          const found = findTaskInTree(task.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const task = findTaskInTree(ganttTasks, taskId);
    return task?.name || taskId;
  };

  if (delayLogs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
        <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">No delay logs recorded yet</p>
        <p className="text-xs mt-1">Delay logs will appear here when you log delays in the Gantt chart.</p>
      </div>
    );
  }

  // Sort logs by date (newest first)
  const sortedLogs = [...delayLogs].sort((a, b) =>
    new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {delayLogs.length} delay log{delayLogs.length !== 1 ? 's' : ''} recorded
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={isMobile ? 'w-[120px]' : ''}>Task Name</TableHead>
                <TableHead className={isMobile ? 'w-[80px]' : ''}>Month</TableHead>
                <TableHead className={isMobile ? 'w-[100px]' : ''}>Logged By</TableHead>
                <TableHead className={isMobile ? 'w-[80px]' : ''}>Duration</TableHead>
                <TableHead className={isMobile ? 'hidden' : ''}>Reason</TableHead>
                <TableHead className={isMobile ? 'w-[100px]' : ''}>Date</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className={`font-medium ${isMobile ? 'text-xs' : ''}`}>
                    <div className="max-w-[200px] truncate" title={getTaskName(log.taskId)}>
                      {getTaskName(log.taskId)}
                    </div>
                  </TableCell>
                  <TableCell className={isMobile ? 'text-xs' : ''}>
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {months[log.monthIndex] || `M${log.monthIndex + 1}`}
                    </Badge>
                  </TableCell>
                  <TableCell className={isMobile ? 'text-xs' : ''}>
                    {log.loggedBy}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      {log.delayDuration} day{log.delayDuration !== 1 ? 's' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className={isMobile ? 'hidden' : ''}>
                    <div className="max-w-[300px] truncate text-sm text-muted-foreground" title={log.reason}>
                      {log.reason}
                    </div>
                  </TableCell>
                  <TableCell className={isMobile ? 'text-xs' : 'text-sm'}>
                    {new Date(log.loggedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(log)}
                        className="h-8 w-8 p-0"
                        title="Edit log"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this delay log?")) {
                            onDelete(log.id);
                          }
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Delete log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile view: Show reason in expanded view */}
      {isMobile && (
        <div className="space-y-2">
          {sortedLogs.map((log) => (
            <div key={log.id} className="border border-border rounded-lg p-3 bg-card/50">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{getTaskName(log.taskId)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {months[log.monthIndex] || `Month ${log.monthIndex + 1}`} • {log.loggedBy}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(log)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Delete this delay log?")) {
                        onDelete(log.id);
                      }
                    }}
                    className="h-7 w-7 p-0 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mb-2">{log.reason}</div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {log.delayDuration} day{log.delayDuration !== 1 ? 's' : ''}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.loggedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Delay Logs List Dialog Component (shows all logs and allows adding new ones)
function DelayLogsListDialog({
  open,
  onOpenChange,
  taskName,
  taskId,
  monthIndex,
  monthName,
  months,
  delayLogs,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskId: string;
  monthIndex: number;
  monthName: string;
  months: string[];
  delayLogs: DelayLog[];
  onSave: (log: DelayLog) => void;
  onDelete: (logId: string) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLog, setEditingLog] = useState<DelayLog | undefined>(undefined);

  const handleAddNew = () => {
    setEditingLog(undefined);
    setShowAddForm(true);
  };

  const handleEdit = (log: DelayLog) => {
    setEditingLog(log);
    setShowAddForm(true);
  };

  const handleSave = (log: DelayLog) => {
    onSave(log);
    setShowAddForm(false);
    setEditingLog(undefined);
  };

  const handleDelete = (logId: string) => {
    if (confirm("Are you sure you want to delete this delay log?")) {
      onDelete(logId);
    }
  };

  if (showAddForm) {
    return (
      <DelayLogFormDialog
        open={showAddForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false);
            setEditingLog(undefined);
          }
        }}
        taskName={taskName}
        taskId={taskId}
        monthIndex={monthIndex}
        monthName={monthName}
        months={months}
        onSave={handleSave}
        existingLog={editingLog}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Delay Logs for {taskName}</DialogTitle>
          <DialogDescription>
            View and manage delay logs for {monthName}. Delay logs are displayed as orange bars in the Gantt chart.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {delayLogs.length} delay log{delayLogs.length !== 1 ? 's' : ''} recorded
            </div>
            <Button onClick={handleAddNew} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Log
            </Button>
          </div>

          {delayLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No delay logs recorded yet.</p>
              <p className="text-xs mt-1">Click "Add New Log" to record a delay.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {delayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(log.loggedAt).toLocaleDateString()}
                          </Badge>
                          <Badge variant="secondary">
                            {log.delayDuration} day{log.delayDuration !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Logged by: {log.loggedBy}</p>
                          <p className="text-sm text-muted-foreground mt-1">{log.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(log)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(log.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GanttMini({
  tasks,
  months,
  baseColor,
  subProjects,
  delayLogs,
  onAddDelayLog,
  onDeleteDelayLog,
  onOpenAddPhoto,
  onOpenAddDocument,
}: {
  tasks: GanttTask[];
  months: string[];
  baseColor: string;
  subProjects?: SubProject[];
  delayLogs?: DelayLog[];
  onAddDelayLog?: (log: DelayLog) => void;
  onDeleteDelayLog?: (logId: string) => void;
  onOpenAddPhoto?: (taskId: string, taskName: string) => void;
  onOpenAddDocument?: (taskId: string, taskName: string) => void;
}) {
  const n = months.length || 1;
  // Initialize all tasks as expanded by default
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    tasks.forEach(task => {
      if (task.children && task.children.length > 0) {
        initial[task.id] = true;
      }
    });
    return initial;
  });

  // Delay logs list dialog state
  const [delayLogsDialogOpen, setDelayLogsDialogOpen] = useState(false);
  const [selectedTaskForDelay, setSelectedTaskForDelay] = useState<{
    taskId: string;
    taskName: string;
    monthIndex: number;
    monthName: string;
  } | null>(null);

  // Add delay log form dialog state (for clicking on bars)
  const [addLogDialogOpen, setAddLogDialogOpen] = useState(false);
  const [selectedBarForLog, setSelectedBarForLog] = useState<{
    taskId: string;
    taskName: string;
    monthIndex: number;
    monthName: string;
    clickDate?: string; // ISO date string from click position
  } | null>(null);

  // Add delay log from row options button (restricted to planned timeline)
  const [rowAddLogOpen, setRowAddLogOpen] = useState(false);
  const [selectedRowForDelayLog, setSelectedRowForDelayLog] = useState<{
    taskId: string;
    taskName: string;
    startIdx: number;
    endIdx: number;
  } | null>(null);


  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const delayLogsDisabled = true;

  // Get delay logs for a specific task and month
  const getDelayLogsForTask = (taskId: string, monthIndex: number): DelayLog[] => {
    if (delayLogsDisabled) return [];
    if (!delayLogs) return [];
    return delayLogs.filter(log => log.taskId === taskId && log.monthIndex === monthIndex);
  };

  // Calculate position within month cell based on date
  const getDatePositionInMonth = (delayDate: string, monthIndex: number): number => {
    if (!delayDate) return 0;
    const date = new Date(delayDate);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const dayOfMonth = date.getDate();
    // Return percentage position within the month (0-100%)
    return (dayOfMonth / daysInMonth) * 100;
  };

  // Handle click on Gantt bar to add delay log
  const handleBarClick = (e: React.MouseEvent, taskId: string, taskName: string, monthIndex: number) => {
    if (delayLogsDisabled) return;
    e.stopPropagation();
    // Calculate approximate date from click position within the month cell
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const cellWidth = rect.width;
    const clickPercent = (clickX / cellWidth) * 100;

    // Estimate date based on click position
    const monthName = months[monthIndex] || 'Jan';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndexNum = monthNames.findIndex(m => monthName.includes(m));
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, monthIndexNum + 1, 0).getDate();
    const estimatedDay = Math.max(1, Math.min(daysInMonth, Math.round((clickPercent / 100) * daysInMonth)));

    const estimatedDate = new Date(currentYear, monthIndexNum, estimatedDay);

    setSelectedBarForLog({
      taskId,
      taskName,
      monthIndex,
      monthName,
      clickDate: estimatedDate.toISOString(),
    });
    setAddLogDialogOpen(true);
  };

  // Get sub-project data for a task to check if it's delayed
  const getSubProjectForTask = (taskId: string): SubProject | undefined => {
    return subProjects?.find(sp => sp.id === taskId);
  };

  // Check if task has delay (actual < planned)
  const hasDelay = (task: GanttTask): boolean => {
    const subProject = getSubProjectForTask(task.id);
    if (!subProject) return task.status === "behind";
    return subProject.actualProgress < subProject.plannedProgress;
  };

  const handleOpenDelayLogs = (taskId: string, taskName: string, monthIndex: number) => {
    setSelectedTaskForDelay({
      taskId,
      taskName,
      monthIndex,
      monthName: months[monthIndex] || `Month ${monthIndex + 1}`,
    });
    setDelayLogsDialogOpen(true);
  };

  const handleSaveDelayLog = (log: DelayLog) => {
    if (onAddDelayLog) {
      onAddDelayLog(log);
    }
  };

  const handleDeleteDelayLog = (logId: string) => {
    if (onDeleteDelayLog) {
      onDeleteDelayLog(logId);
    }
  };

  // Get delay logs for selected task/month
  const getSelectedTaskDelayLogs = (): DelayLog[] => {
    if (!selectedTaskForDelay || !delayLogs) return [];
    return delayLogs.filter(
      log => log.taskId === selectedTaskForDelay.taskId && log.monthIndex === selectedTaskForDelay.monthIndex
    );
  };

  const toggle = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setExpanded((prev) => {
      const currentValue = prev[id] ?? true; // Default to true (expanded)
      return { ...prev, [id]: !currentValue };
    });
  };

  // Calculate grid columns: WBS column + month columns + Actions column
  const labelColWidth = isMobile ? '140px' : isTablet ? '180px' : '240px';
  const actionsColWidth = '48px';
  const monthColWidth = isMobile ? '44px' : '1fr';
  const gridCols = `${labelColWidth} repeat(${n}, ${monthColWidth}) ${actionsColWidth}`;
  const mobileMinChartWidth = isMobile ? `${140 + n * 44 + 48}px` : undefined;

  return (
    <div className="space-y-4">
      {/* Delay Logs List Dialog */}
      {selectedTaskForDelay && (
        <DelayLogsListDialog
          open={delayLogsDialogOpen}
          onOpenChange={setDelayLogsDialogOpen}
          taskName={selectedTaskForDelay.taskName}
          taskId={selectedTaskForDelay.taskId}
          monthIndex={selectedTaskForDelay.monthIndex}
          monthName={selectedTaskForDelay.monthName}
          months={months}
          delayLogs={getSelectedTaskDelayLogs()}
          onSave={handleSaveDelayLog}
          onDelete={handleDeleteDelayLog}
        />
      )}

      {/* Add Delay Log Dialog (from clicking on bar) */}
      {selectedBarForLog && (
        <DelayLogFormDialog
          open={addLogDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setAddLogDialogOpen(false);
              setSelectedBarForLog(null);
            }
          }}
          taskName={selectedBarForLog.taskName}
          taskId={selectedBarForLog.taskId}
          monthIndex={selectedBarForLog.monthIndex}
          monthName={selectedBarForLog.monthName}
          months={months}
          onSave={handleSaveDelayLog}
          defaultDate={selectedBarForLog.clickDate}
        />
      )}

      {/* Add Delay Log Dialog (from row options button - date restricted to planned timeline) */}
      {selectedRowForDelayLog && (() => {
        const { minDate, maxDate } = getPlannedDateRange(
          selectedRowForDelayLog.startIdx,
          selectedRowForDelayLog.endIdx,
          GANTT_CHART_YEAR
        );
        const defaultInRange = minDate; // first day of planned timeline
        return (
          <DelayLogFormDialog
            open={rowAddLogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setRowAddLogOpen(false);
                setSelectedRowForDelayLog(null);
              }
            }}
            taskName={selectedRowForDelayLog.taskName}
            taskId={selectedRowForDelayLog.taskId}
            monthIndex={selectedRowForDelayLog.startIdx}
            monthName={months[selectedRowForDelayLog.startIdx] || "—"}
            months={months}
            onSave={(log) => {
              handleSaveDelayLog(log);
              setRowAddLogOpen(false);
              setSelectedRowForDelayLog(null);
            }}
            defaultDate={defaultInRange}
            minDate={minDate}
            maxDate={maxDate}
          />
        );
      })()}

      {/* Legend removed (delay logs feature removed) */}

      {/* Gantt Chart Container with full border */}
      <div className="border-2 border-border rounded-lg bg-background overflow-x-auto">
        <div style={mobileMinChartWidth ? { minWidth: mobileMinChartWidth } : undefined}>
        {/* Header row with month labels */}
        <div className="grid border-b-2 border-border bg-muted/30" style={{ gridTemplateColumns: gridCols }}>
          <div className={`${isMobile ? 'p-1.5 text-[10px]' : 'p-2 text-xs'} font-bold text-muted-foreground border-r-2 border-border bg-muted/40`}>WBS Subprocess</div>
          {months.map((m, idx) => {
            const { label, dateRange } = getMonthHeaderLabel(m, GANTT_CHART_YEAR);
            return (
              <div
                key={m}
                className={`${isMobile ? 'p-1 text-[9px]' : 'p-2 text-xs'} font-semibold text-center text-muted-foreground border-r-2 border-border bg-muted/40 flex flex-col items-center justify-center gap-0.5`}
              >
                <span>{isMobile ? label.replace(` ${GANTT_CHART_YEAR}`, "'26") : label}</span>
                <span className={`font-normal opacity-90 ${isMobile ? 'text-[8px]' : 'text-[10px]'}`}>{dateRange}</span>
              </div>
            );
          })}
          <div className={`${isMobile ? 'p-1 text-[9px]' : 'p-2 text-xs'} font-semibold text-center text-muted-foreground border-border bg-muted/40 flex items-center justify-center`} title="Add delay log (within planned timeline)">
            Options
          </div>
        </div>

        {/* Task rows */}
        <div className="space-y-1">
          {tasks.map((t) => {
            const isExpanded = expanded[t.id] ?? true;
            const hasChildren = (t.children?.length ?? 0) > 0;
            const subProject = getSubProjectForTask(t.id);
            const progress = getProgressPercentage(t, subProject);
            const plannedPct = getPlannedPercentage(t, subProject);
            const responsible = getResponsiblePerson(t.id, t.name);
            const span = t.endIdx - t.startIdx + 1;

            return (
              <div key={t.id} className="space-y-1">
                {/* Parent task row */}
                <div className="grid border-l-2 border-r-2 border-b-2 border-border relative bg-background overflow-hidden" style={{ gridTemplateColumns: gridCols }}>
                  {/* Left label column */}
                  <div className="p-2 border-r-2 border-border flex items-center gap-2 min-w-0 relative z-5 bg-muted/20" onClick={(e) => e.stopPropagation()}>
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => toggle(t.id, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="h-5 w-5 rounded border border-border/60 bg-background hover:bg-muted/40 transition-colors flex items-center justify-center flex-shrink-0 relative z-10"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        <span className="text-[10px] font-bold leading-none">{isExpanded ? "−" : "+"}</span>
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-foreground truncate`}>{t.name}</div>
                      <div className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-muted-foreground`}>
                        Weight {(t.weight * 100).toFixed(0)}% •{" "}
                        <span
                          className={
                            t.status === "ahead"
                              ? "text-emerald-600"
                              : t.status === "behind"
                                ? "text-red-600"
                                : "text-blue-600"
                          }
                        >
                          {t.status === "ontrack" ? "On track" : t.status === "ahead" ? "Ahead" : "Behind"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline container - month columns only (Actions column is last) */}
                  <div className="relative border-r-2 border-border" style={{ gridColumn: `2 / span ${n}` }}>
                    {/* Grid cells for timeline - background cells */}
                    <div className="grid h-12" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                      {months.map((m, monthIdx) => {
                        const taskHasDelay = hasDelay(t);
                        const delayLogsForMonth = getDelayLogsForTask(t.id, monthIdx);
                        const isInTaskRange = monthIdx >= t.startIdx && monthIdx <= t.endIdx;

                        return (
                          <div
                            key={m}
                            className="border-r-2 border-border last:border-r-0 bg-muted/20 relative"
                          >
                            {/* Clickable area to add delay log - only show if task is in range */}
                            {isInTaskRange && (
                              <button
                                type="button"
                                onClick={(e) => handleBarClick(e, t.id, t.name, monthIdx)}
                                className="absolute inset-0 w-full h-full z-10 opacity-0 hover:opacity-5 hover:bg-blue-500 transition-opacity cursor-pointer"
                                title="Click anywhere on this cell to add a delay log"
                              />
                            )}
                            {/* Delay log indicators - positioned based on date within month - more visible with icons */}
                            {delayLogsForMonth.length > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 z-11">
                                {delayLogsForMonth.map((log) => {
                                  const positionPercent = getDatePositionInMonth(log.delayDate, monthIdx);
                                  return (
                                    <div
                                      key={log.id}
                                      className="absolute group"
                                      style={{
                                        left: `${Math.max(0, Math.min(100, positionPercent - 2.5))}%`,
                                      }}
                                    >
                                      {/* Indicator bar */}
                                      <div className="h-2.5 bg-orange-500 rounded-t border-t-2 border-orange-600 shadow-md w-5 min-w-[4px]" />
                                      {/* Icon badge */}
                                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-orange-500 rounded-full p-0.5 shadow-md border border-orange-600">
                                        <AlertTriangle className="h-1.5 w-1.5 text-white" />
                                      </div>
                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-15 bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-xl max-w-xs">
                                        <div className="font-semibold flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          Delay Logged
                                        </div>
                                        <div className="text-[10px] opacity-90 mt-0.5">{log.reason}</div>
                                        {log.imageUrl && (
                                          <div className="mt-2 border-t border-gray-700 pt-2">
                                            <div className="text-[10px] opacity-75 mb-1 flex items-center gap-1">
                                              <ImageIcon className="h-3 w-3" />
                                              Evidence Image:
                                            </div>
                                            <img
                                              src={log.imageUrl}
                                              alt="Delay evidence"
                                              className="w-full h-24 object-cover rounded mt-1 cursor-pointer hover:opacity-80"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const newWindow = window.open();
                                                if (newWindow) {
                                                  newWindow.document.write(`
                                                  <html>
                                                    <head><title>Delay Evidence</title></head>
                                                    <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                                      <img src="${log.imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                                    </body>
                                                  </html>
                                                `);
                                                }
                                              }}
                                            />
                                          </div>
                                        )}
                                        <div className="text-[10px] opacity-75">{log.delayDuration} days • {new Date(log.delayDate).toLocaleDateString()}</div>
                                        <div className="text-[10px] opacity-75">By: {log.loggedBy}</div>
                                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Task bar spanning across cells - clickable to add delay logs. Planned = blue, Actual = green, Delay = red. */}
                    {(() => {
                      const plannedColor = "#3b82f6"; // blue
                      const actualColor = "#10b981"; // green
                      const barBgColor = "rgba(59, 130, 246, 0.2)";
                      return (
                    <div
                      className="absolute top-1 bottom-1 rounded shadow-sm z-10 overflow-hidden"
                      style={{
                        left: `${(t.startIdx / n) * 100}%`,
                        width: `${(span / n) * 100}%`,
                        maxWidth: `calc(100% - ${(t.startIdx / n) * 100}%)`,
                        backgroundColor: barBgColor,
                      }}
                      onClick={(e) => {
                        // Calculate which month was clicked
                        const barRect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - barRect.left;
                        const barWidth = barRect.width;
                        const clickPercent = (clickX / barWidth) * 100;
                        const monthIdx = Math.floor((clickPercent / 100) * span) + t.startIdx;
                        const clampedMonthIdx = Math.max(t.startIdx, Math.min(t.endIdx, monthIdx));
                        handleBarClick(e, t.id, t.name, clampedMonthIdx);
                      }}
                      title="Click on the bar to add a delay log at this position"
                    >
                      {/* Top = Planned (blue), Bottom = Actual (green), Delay stripe = red */}
                      <div className="absolute inset-0 flex flex-col z-8">
                        {/* Top half: Planned progress - blue */}
                        <div className="flex-1 min-h-0 flex items-stretch border-b border-black/20">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, plannedPct))}%`, backgroundColor: plannedColor }}
                            title={`Planned: ${plannedPct}%`}
                          />
                        </div>
                        {/* Bottom half: Actual progress - green */}
                        <div className="flex-1 min-h-0 flex items-stretch relative">
                          <div
                            className="h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: actualColor }}
                            title={`Actual: ${progress}%`}
                          />
                          {/* Delay impact stripe - red */}
                          {subProject && (subProject as any).delayImpact > 0 && (subProject as any).originalProgress > progress && (
                            <div
                              className="absolute top-0 bottom-0 bg-red-500/50 border-r-2 border-red-600/60 transition-all duration-300"
                              style={{
                                left: `${Math.min(100, Math.max(0, progress))}%`,
                                width: `${Math.min(100 - progress, (subProject as any).delayImpact)}%`,
                              }}
                              title={`Delay impact: ${((subProject as any).delayImpact).toFixed(1)}%`}
                            />
                          )}
                        </div>
                      </div>
                      {/* Delay log markers on the progress bar - more visible with icons */}
                      {delayLogs && delayLogs.filter(log => log.taskId === t.id && log.monthIndex >= t.startIdx && log.monthIndex <= t.endIdx).map((log) => {
                        // Calculate position within the bar based on month index
                        const positionInBar = ((log.monthIndex - t.startIdx) / span) * 100;
                        const clampedPosition = Math.max(0, Math.min(100, positionInBar));

                        return (
                          <div
                            key={log.id}
                            className="absolute top-0 bottom-0 z-12 group"
                            style={{
                              left: `${clampedPosition}%`,
                              transform: 'translateX(-50%)',
                            }}
                          >
                            {/* Vertical marker line */}
                            <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-orange-500 shadow-lg border-l border-r border-orange-600" />
                            {/* Icon indicator at top */}
                            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 bg-orange-500 rounded-full p-0.5 shadow-md border border-orange-600">
                              <AlertTriangle className="h-2 w-2 text-white" />
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-15 bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-xl max-w-xs">
                              <div className="font-semibold">Delay Logged</div>
                              <div className="text-[10px] opacity-90">{log.reason}</div>
                              <div className="text-[10px] opacity-75">{log.delayDuration} days • {new Date(log.delayDate).toLocaleDateString()}</div>
                              <div className="text-[10px] opacity-75">By: {log.loggedBy}</div>
                              {log.imageUrl && (
                                <div className="mt-2 border-t border-gray-700 pt-2">
                                  <div className="text-[10px] opacity-75 mb-1 flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3" />
                                    Evidence Image:
                                  </div>
                                  <img
                                    src={log.imageUrl}
                                    alt="Delay evidence"
                                    className="w-full h-24 object-cover rounded mt-1 cursor-pointer hover:opacity-80"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        newWindow.document.write(`
                                        <html>
                                          <head><title>Delay Evidence</title></head>
                                          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                            <img src="${log.imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                          </body>
                                        </html>
                                      `);
                                      }
                                    }}
                                  />
                                </div>
                              )}
                              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                            </div>
                          </div>
                        );
                      })}
                      {/* Text content */}
                      <div className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} font-semibold text-white truncate flex-1 pointer-events-none relative z-20 px-2 flex items-center h-full`}>
                        <div className="flex-1 min-w-0">
                          <div className="truncate flex items-center gap-1">
                            <span className="truncate">{responsible}</span>
                          </div>
                          <div className={`${isMobile ? 'text-[7px]' : 'text-[8px]'} opacity-95 flex items-center gap-1.5 flex-wrap`}>
                            <span title="Top strip = Planned"><span className="opacity-80">P:</span>{plannedPct}%</span>
                            <span className="opacity-60">|</span>
                            <span title="Bottom strip = Actual"><span className="opacity-80">A:</span>{progress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ); })()}
                  </div>
                  {/* Actions column: options menu (Add delay log / Delete delay log(s)) */}
                  <div className="flex items-center justify-center border-border bg-muted/10 p-1">
                    {/* Delay log options removed */}
                  </div>
                </div>

                {/* Child task rows */}
                {hasChildren && isExpanded && (
                  <div className="space-y-0.5 pl-6">
                    {t.children!.map((c) => {
                      const childSubProject = getSubProjectForTask(c.id);
                      const childProgress = getProgressPercentage(c, childSubProject);
                      const childPlannedPct = getPlannedPercentage(c, childSubProject);
                      const childResponsible = getResponsiblePerson(c.id, c.name);
                      const childSpan = c.endIdx - c.startIdx + 1;

                      return (
                        <div
                          key={c.id}
                          className="grid border-l-2 border-r-2 border-b-2 border-border relative bg-background overflow-hidden"
                          style={{ gridTemplateColumns: gridCols }}
                        >
                          {/* Left label column */}
                          <div className="p-1.5 border-r-2 border-border min-w-0 relative z-10 bg-muted/10">
                            <div className={`${isMobile ? 'text-[11px]' : 'text-xs'} font-medium text-foreground/90 truncate`}>{c.name}</div>
                            <div className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} text-muted-foreground`}>
                              Weight {(c.weight * 100).toFixed(0)}%
                            </div>
                          </div>

                          {/* Timeline container - month columns only */}
                          <div className="relative border-r-2 border-border" style={{ gridColumn: `2 / span ${n}` }}>
                            {/* Grid cells for timeline - background cells */}
                            <div className="grid h-10" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
                              {months.map((m, monthIdx) => {
                                const childHasDelay = c.status === "behind";
                                const delayLogsForMonth = getDelayLogsForTask(c.id, monthIdx);
                                const isInTaskRange = monthIdx >= c.startIdx && monthIdx <= c.endIdx;

                                return (
                                  <div
                                    key={m}
                                    className="border-r-2 border-border last:border-r-0 bg-muted/10 relative"
                                  >
                                    {/* Clickable area to add delay log for child tasks */}
                                    {isInTaskRange && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleBarClick(e, c.id, c.name, monthIdx)}
                                        className="absolute inset-0 w-full h-full z-10 opacity-0 hover:opacity-5 hover:bg-blue-500 transition-opacity cursor-pointer"
                                        title="Click anywhere on this cell to add a delay log"
                                      />
                                    )}
                                    {/* Delay log indicators for child tasks - positioned based on date - more visible with icons */}
                                    {delayLogsForMonth.length > 0 && (
                                      <div className="absolute bottom-0 left-0 right-0 z-25">
                                        {delayLogsForMonth.map((log) => {
                                          const positionPercent = getDatePositionInMonth(log.delayDate, monthIdx);
                                          return (
                                            <div
                                              key={log.id}
                                              className="absolute group"
                                              style={{
                                                left: `${Math.max(0, Math.min(100, positionPercent - 2.5))}%`,
                                              }}
                                            >
                                              {/* Indicator bar */}
                                              <div className="h-2 bg-orange-500 rounded-t border-t-2 border-orange-600 shadow-md w-4 min-w-[3px]" />
                                              {/* Icon badge */}
                                              <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 bg-orange-500 rounded-full p-0.5 shadow-md border border-orange-600">
                                                <AlertTriangle className="h-1 w-1 text-white" />
                                              </div>
                                              {/* Tooltip */}
                                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-50 bg-gray-900 text-white text-[10px] rounded px-1.5 py-0.5 shadow-xl max-w-xs">
                                                <div className="font-semibold">Delay</div>
                                                <div className="opacity-90">{log.reason}</div>
                                                <div className="opacity-75">{log.delayDuration}d</div>
                                                {log.imageUrl && (
                                                  <div className="mt-1 border-t border-gray-700 pt-1">
                                                    <div className="opacity-75 mb-1 flex items-center gap-1">
                                                      <ImageIcon className="h-2.5 w-2.5" />
                                                      Evidence:
                                                    </div>
                                                    <img
                                                      src={log.imageUrl}
                                                      alt="Delay evidence"
                                                      className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newWindow = window.open();
                                                        if (newWindow) {
                                                          newWindow.document.write(`
                                                          <html>
                                                            <head><title>Delay Evidence</title></head>
                                                            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                                              <img src="${log.imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                                            </body>
                                                          </html>
                                                        `);
                                                        }
                                                      }}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Child task bar: Planned = blue, Actual = green, Delay = red */}
                            {(() => {
                              const plannedColor = "#3b82f6";
                              const actualColor = "#10b981";
                              const childBarBgColor = "rgba(59, 130, 246, 0.2)";
                              return (
                            <div
                              className="absolute top-0.5 bottom-0.5 rounded z-20 overflow-hidden"
                              style={{
                                left: `${(c.startIdx / n) * 100}%`,
                                width: `${(childSpan / n) * 100}%`,
                                maxWidth: `calc(100% - ${(c.startIdx / n) * 100}%)`,
                                backgroundColor: childBarBgColor,
                              }}
                              onClick={(e) => {
                                // Calculate which month was clicked
                                const barRect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - barRect.left;
                                const barWidth = barRect.width;
                                const clickPercent = (clickX / barWidth) * 100;
                                const monthIdx = Math.floor((clickPercent / 100) * childSpan) + c.startIdx;
                                const clampedMonthIdx = Math.max(c.startIdx, Math.min(c.endIdx, monthIdx));
                                handleBarClick(e, c.id, c.name, clampedMonthIdx);
                              }}
                              title="Click on the bar to add a delay log at this position"
                            >
                              <div className="absolute inset-0 flex flex-col z-8">
                                <div className="flex-1 min-h-0 flex items-stretch border-b border-black/20">
                                  <div
                                    className="h-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, Math.max(0, childPlannedPct))}%`, backgroundColor: plannedColor }}
                                    title={`Planned: ${childPlannedPct}%`}
                                  />
                                </div>
                                <div className="flex-1 min-h-0 flex items-stretch relative">
                                  <div
                                    className="h-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, Math.max(0, childProgress))}%`, backgroundColor: actualColor }}
                                    title={`Actual: ${childProgress}%`}
                                  />
                                  {childSubProject && (childSubProject as any).delayImpact > 0 && (childSubProject as any).originalProgress > childProgress && (
                                    <div
                                      className="absolute top-0 bottom-0 bg-red-500/50 border-r-2 border-red-600/60 transition-all duration-300"
                                      style={{
                                        left: `${Math.min(100, Math.max(0, childProgress))}%`,
                                        width: `${Math.min(100 - childProgress, (childSubProject as any).delayImpact)}%`,
                                      }}
                                      title={`Delay impact: ${((childSubProject as any).delayImpact).toFixed(1)}%`}
                                    />
                                  )}
                                </div>
                              </div>
                              {/* Delay log markers on the progress bar - more visible with icons */}
                              {delayLogs && delayLogs.filter(log => log.taskId === c.id && log.monthIndex >= c.startIdx && log.monthIndex <= c.endIdx).map((log) => {
                                // Calculate position within the bar based on month index
                                const positionInBar = ((log.monthIndex - c.startIdx) / childSpan) * 100;
                                const clampedPosition = Math.max(0, Math.min(100, positionInBar));

                                return (
                                  <div
                                    key={log.id}
                                    className="absolute top-0 bottom-0 z-30 group"
                                    style={{
                                      left: `${clampedPosition}%`,
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    {/* Vertical marker line */}
                                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-orange-500 shadow-md border-l border-r border-orange-600" />
                                    {/* Icon indicator at top */}
                                    <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 bg-orange-500 rounded-full p-0.5 shadow-md border border-orange-600">
                                      <AlertTriangle className="h-1.5 w-1.5 text-white" />
                                    </div>
                                    {/* Tooltip on hover */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-50 bg-gray-900 text-white text-[10px] rounded px-1.5 py-0.5 shadow-xl max-w-xs">
                                      <div className="font-semibold">Delay</div>
                                      <div className="opacity-90">{log.reason}</div>
                                      <div className="opacity-75">{log.delayDuration}d</div>
                                      {log.imageUrl && (
                                        <div className="mt-1 border-t border-gray-700 pt-1">
                                          <div className="opacity-75 mb-1 flex items-center gap-1">
                                            <ImageIcon className="h-2.5 w-2.5" />
                                            Evidence:
                                          </div>
                                          <img
                                            src={log.imageUrl}
                                            alt="Delay evidence"
                                            className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const newWindow = window.open();
                                              if (newWindow) {
                                                newWindow.document.write(`
                                                <html>
                                                  <head><title>Delay Evidence</title></head>
                                                  <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                                                    <img src="${log.imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
                                                  </body>
                                                </html>
                                              `);
                                              }
                                            }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Text content: Actual / Planned */}
                              <div className={`${isMobile ? 'text-[7px]' : 'text-[8px]'} font-medium text-white truncate flex-1 pointer-events-none relative z-20 px-1.5 flex items-center h-full drop-shadow-md`}>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{childResponsible}</div>
                                  <div className={`${isMobile ? 'text-[6px]' : 'text-[7px]'} opacity-95 flex items-center gap-1`}>
                                    <span title="Top = Planned">P:{childPlannedPct}%</span>
                                    <span className="opacity-60">|</span>
                                    <span title="Bottom = Actual">A:{childProgress}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ); })()}
                          </div>
                          {/* Actions column for child row: options menu */}
                          <div className="flex items-center justify-center border-border bg-muted/10 p-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 w-7 rounded-md border border-border/60 bg-background hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                  title="Options"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    setSelectedRowForDelayLog({
                                      taskId: c.id,
                                      taskName: c.name,
                                      startIdx: c.startIdx,
                                      endIdx: c.endIdx,
                                    });
                                    setRowAddLogOpen(true);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add delay log
                                </DropdownMenuItem>
                                {onOpenAddPhoto && (
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      onOpenAddPhoto(c.id, c.name);
                                    }}
                                  >
                                    <ImageIcon className="h-4 w-4 mr-2" />
                                    Add Photo
                                  </DropdownMenuItem>
                                )}
                                {onOpenAddDocument && (
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      onOpenAddDocument(c.id, c.name);
                                    }}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Add Documents
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}

export function MilestoneDetailsPanel({
  milestoneTitle,
  phase,
  phaseColor,
  onClear,
  showAllTabs = false,
  flatGanttTasks,
}: {
  milestoneTitle: string;
  phase: MilestonePhaseProgress;
  phaseColor: string;
  onClear?: () => void;
  showAllTabs?: boolean;
  /** Optional: API-driven project gantt rows (id/label/start/end/progress/parent). */
  flatGanttTasks?: Array<{
    id: string;
    label: string;
    start: string | null;
    end: string | null;
    progress: number;
    parent?: string;
  }>;
}) {
  const [tab, setTab] = useState<"gantt" | "wbs" | "scurves" | "photos" | "logs">("gantt");

  // Frontend-only: progress photos (with timeline date) and documents
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhotoItem[]>([]);
  const [progressDocs, setProgressDocs] = useState<ProgressDocItem[]>([]);

  // Dialogs opened from Gantt activity options (three dots)
  const [addPhotoDialogOpen, setAddPhotoDialogOpen] = useState(false);
  const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);
  const [selectedTaskForMedia, setSelectedTaskForMedia] = useState<{ taskId: string; taskName: string } | null>(null);
  const [photoDialogForm, setPhotoDialogForm] = useState<{ file: File; objectUrl: string; date: string; caption: string } | null>(null);
  const photoDialogInputRef = React.useRef<HTMLInputElement>(null);
  const docDialogInputRef = React.useRef<HTMLInputElement>(null);

  const progressPhotosRef = React.useRef(progressPhotos);
  progressPhotosRef.current = progressPhotos;
  useEffect(() => {
    return () => {
      progressPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    };
  }, []);

  const removePhoto = (id: string) => {
    setProgressPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.objectUrl);
      return prev.filter((p) => p.id !== id);
    });
  };
  const downloadPhoto = (item: ProgressPhotoItem) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(item.file);
    a.download = item.file.name || `progress-${item.date}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const addDocument = (file: File) => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setProgressDocs((prev) => [...prev, { id, file, name: file.name, uploadedAt: new Date().toISOString() }]);
  };
  const removeDoc = (id: string) => setProgressDocs((prev) => prev.filter((d) => d.id !== id));
  const downloadDoc = (item: ProgressDocItem) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(item.file);
    a.download = item.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // State for editing delay log from table
  const [editingLogFromTable, setEditingLogFromTable] = useState<DelayLog | undefined>(undefined);
  const [showEditForm, setShowEditForm] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  const subProjects = phase.subProjects ?? [];
  const timeline = phase.timeline ?? [];
  const months = useMemo(() => timeline.map((t) => t.month), [timeline]);

  // Delay Logs feature removed (was hardcoded); do not adjust progress.
  const delayLogs: DelayLog[] = [];
  const adjustedSubProjects = subProjects;

  // Calculate overall project progress considering delays
  const overallProgress = useMemo(() => {
    if (adjustedSubProjects.length === 0) return { actual: 0, planned: 0, impact: 0 };

    // Weighted average of all sub-projects
    const totalWeight = adjustedSubProjects.reduce((sum, sp) => sum + sp.weight, 0);
    if (totalWeight === 0) return { actual: 0, planned: 0, impact: 0 };

    const weightedActual = adjustedSubProjects.reduce((sum, sp) =>
      sum + (sp.actualProgress * sp.weight), 0) / totalWeight;
    const weightedPlanned = adjustedSubProjects.reduce((sum, sp) =>
      sum + (sp.plannedProgress * sp.weight), 0) / totalWeight;
    return {
      actual: Math.round(weightedActual),
      planned: Math.round(weightedPlanned),
      impact: 0,
    };
  }, [adjustedSubProjects]);

  const ganttTasks = useMemo(() => buildGanttTasks(adjustedSubProjects, months), [adjustedSubProjects, months]);

  const handleAddDelayLog = (_log: DelayLog) => {};
  const handleDeleteDelayLog = (_logId: string) => {};

  const openAddPhotoFromGantt = (taskId: string, taskName: string) => {
    setSelectedTaskForMedia({ taskId, taskName });
    setPhotoDialogForm(null);
    setAddPhotoDialogOpen(true);
  };
  const openAddDocumentFromGantt = (taskId: string, taskName: string) => {
    setSelectedTaskForMedia({ taskId, taskName });
    setAddDocumentDialogOpen(true);
  };
  const savePhotoFromDialog = () => {
    if (!photoDialogForm) return;
    const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setProgressPhotos((prev) => [...prev, { id, file: photoDialogForm.file, objectUrl: photoDialogForm.objectUrl, date: photoDialogForm.date, caption: photoDialogForm.caption || undefined }]);
    setPhotoDialogForm(null);
    setAddPhotoDialogOpen(false);
    setSelectedTaskForMedia(null);
  };
  const closePhotoDialog = () => {
    if (photoDialogForm) URL.revokeObjectURL(photoDialogForm.objectUrl);
    setPhotoDialogForm(null);
    setAddPhotoDialogOpen(false);
    setSelectedTaskForMedia(null);
  };
  const closeDocumentDialog = () => {
    setAddDocumentDialogOpen(false);
    setSelectedTaskForMedia(null);
  };

  const wbsPieData = useMemo(
    () =>
      subProjects.map((s) => ({
        name: s.name,
        value: Math.max(0, s.weight),
      })),
    [subProjects]
  );

  const subProjectTimelines = useMemo(() => {
    if (timeline.length === 0) return [];
    return adjustedSubProjects.map((s) => ({
      sub: s,
      timeline: buildDeterministicSubprojectTimeline(s, timeline),
    }));
  }, [adjustedSubProjects, timeline]);

  // If there is no WBS/timeline, render nothing (avoid showing an empty banner on pages).
  if (subProjects.length === 0 || timeline.length === 0) return null;

  return (
    <Card className="border-2 border-primary/10">
      <CardHeader>
        <div>
          <CardTitle className={isMobile ? 'text-base' : ''}>{milestoneTitle} — Milestone KPIs</CardTitle>

        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAllTabs ? (
          <>
            {/* Show all charts side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gantt Chart */}
              <div className="lg:col-span-1">
                <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold mb-3`}>Gantt Chart</h3>
                <GanttMini
                  tasks={ganttTasks}
                  months={months}
                  baseColor={phaseColor}
                  subProjects={adjustedSubProjects}
                  delayLogs={delayLogs}
                  onAddDelayLog={handleAddDelayLog}
                  onDeleteDelayLog={handleDeleteDelayLog}
                  onOpenAddPhoto={openAddPhotoFromGantt}
                  onOpenAddDocument={openAddDocumentFromGantt}
                />
                {/* Overall Progress Summary with Delay Impact - beneath Gantt chart */}
                {/* Delay Logs removed (were hardcoded) */}
              </div>

              {/* WBS Breakdown */}
              <div className="lg:col-span-1">
                <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold mb-3`}>WBS Breakdown</h3>
                <div className="space-y-6">
                  <div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Weight Distribution</div>
                    <div className={`w-full ${isMobile ? 'h-[280px]' : isTablet ? 'h-[320px]' : 'h-[340px]'}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={wbsPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={isMobile ? 70 : isTablet ? 90 : 110}
                            labelLine={false}
                            label={({ name, value, cx, cy, midAngle, innerRadius, outerRadius, index }) => {
                              const pct = value * 100;
                              if (pct < 6) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);

                              // Calculate the same color as the segment
                              const segmentColor = `hsl(${Math.round((index / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`;
                              const fontSize = isMobile ? '10px' : isTablet ? '11px' : '12px';

                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill={segmentColor}
                                  textAnchor={x > cx ? 'start' : 'end'}
                                  dominantBaseline="central"
                                  style={{
                                    fontSize,
                                    fontWeight: 600,
                                    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                                  }}
                                >
                                  {`${name}: ${(pct).toFixed(0)}%`}
                                </text>
                              );
                            }}
                          >
                            {wbsPieData.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={`hsl(${Math.round((idx / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Weight"]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: isMobile ? '10px' : '12px',
                              padding: isMobile ? '4px 6px' : '8px 12px'
                            }}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: isMobile ? '10px' : isTablet ? '11px' : '12px'
                            }}
                            iconSize={isMobile ? 10 : isTablet ? 11 : 12}
                            layout={isMobile ? 'vertical' : 'horizontal'}
                            verticalAlign={isMobile ? 'bottom' : 'top'}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Subprocess KPIs</div>
                    <div className="space-y-2">
                      {adjustedSubProjects.map((s) => {
                        const variance = s.actualProgress - s.plannedProgress;
                        return (
                          <div key={s.id} className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} rounded-lg border border-border/50 ${isMobile ? 'p-2' : 'p-3'} bg-card/50`}>
                            <div className="min-w-0 flex-1">
                              <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold truncate`}>{s.name}</div>
                              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Weight {(s.weight * 100).toFixed(0)}%</div>
                            </div>
                            <div className={`${isMobile ? 'text-left' : 'text-right'}`}>
                              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Actual / Planned</div>
                              <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold tabular-nums`}>
                                {s.actualProgress.toFixed(1)}% / {s.plannedProgress.toFixed(1)}%
                              </div>
                              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {variance >= 0 ? "+" : ""}
                                {variance.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* S-Curves */}
              <div className="lg:col-span-1">
                <h3 className={`${isMobile ? 'text-sm' : 'text-base'} font-bold mb-3`}>S-Curves</h3>
                <div className="space-y-4">
                  {subProjectTimelines.map(({ sub, timeline }) => (
                    <PlannedVsActualChart
                      key={sub.id}
                      phaseName={sub.name}
                      timelineData={timeline}
                      color={phaseColor}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className={`w-full ${isMobile ? 'flex items-center gap-1 overflow-x-auto whitespace-nowrap p-1' : 'flex flex-wrap justify-start gap-1'}`}>
              <TabsTrigger value="gantt" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>Gantt</TabsTrigger>
              <TabsTrigger value="wbs" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>WBS Breakdown</TabsTrigger>
              <TabsTrigger value="scurves" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>S-Curves</TabsTrigger>
              <TabsTrigger value="photos" className={isMobile ? 'text-xs shrink-0 px-3' : ''}>Photos & Docs</TabsTrigger>
            </TabsList>

            <TabsContent value="gantt" className="mt-4">
              {flatGanttTasks && flatGanttTasks.length > 0 ? (
                <ProjectGanttTree
                  tasks={flatGanttTasks as any}
                  projectName={milestoneTitle}
                  onOpenAddDocument={openAddDocumentFromGantt}
                />
              ) : (
                <>
                  <GanttMini
                    tasks={ganttTasks}
                    months={months}
                    baseColor={phaseColor}
                    subProjects={adjustedSubProjects}
                    delayLogs={delayLogs}
                    onAddDelayLog={handleAddDelayLog}
                    onDeleteDelayLog={handleDeleteDelayLog}
                    onOpenAddPhoto={openAddPhotoFromGantt}
                    onOpenAddDocument={openAddDocumentFromGantt}
                  />
                  {/* Delay Logs removed (were hardcoded) */}
                </>
              )}
            </TabsContent>

            <TabsContent value="wbs" className="mt-4">
              <div className="space-y-6">
                <div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Weight Distribution</div>
                  <div className={`w-full ${isMobile ? 'h-[280px]' : isTablet ? 'h-[320px]' : 'h-[340px]'}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={wbsPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={isMobile ? 70 : isTablet ? 90 : 110}
                          labelLine={false}
                          label={({ name, value, cx, cy, midAngle, innerRadius, outerRadius, index }) => {
                            const pct = value * 100;
                            if (pct < 6) return null;
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);

                            // Calculate the same color as the segment
                            const segmentColor = `hsl(${Math.round((index / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`;
                            const fontSize = isMobile ? '10px' : isTablet ? '11px' : '12px';

                            return (
                              <text
                                x={x}
                                y={y}
                                fill={segmentColor}
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                style={{
                                  fontSize,
                                  fontWeight: 600,
                                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                                }}
                              >
                                {`${name}: ${(pct).toFixed(0)}%`}
                              </text>
                            );
                          }}
                        >
                          {wbsPieData.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={`hsl(${Math.round((idx / Math.max(1, wbsPieData.length)) * 280)} 75% 55%)`}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Weight"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: isMobile ? '10px' : '12px',
                            padding: isMobile ? '4px 6px' : '8px 12px'
                          }}
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: isMobile ? '10px' : isTablet ? '11px' : '12px'
                          }}
                          iconSize={isMobile ? 10 : isTablet ? 11 : 12}
                          layout={isMobile ? 'vertical' : 'horizontal'}
                          verticalAlign={isMobile ? 'bottom' : 'top'}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div>
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-2`}>WBS Subprocess KPIs</div>
                  <div className="space-y-2">
                    {subProjects.map((s) => {
                      const variance = s.actualProgress - s.plannedProgress;
                      return (
                        <div key={s.id} className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center justify-between'} rounded-lg border border-border/50 ${isMobile ? 'p-2' : 'p-3'} bg-card/50`}>
                          <div className="min-w-0 flex-1">
                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold truncate`}>{s.name}</div>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Weight {(s.weight * 100).toFixed(0)}%</div>
                          </div>
                          <div className={`${isMobile ? 'text-left' : 'text-right'}`}>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>Actual / Planned</div>
                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold tabular-nums`}>
                              {s.actualProgress.toFixed(1)}% / {s.plannedProgress.toFixed(1)}%
                            </div>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {variance >= 0 ? "+" : ""}
                              {variance.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scurves" className="mt-4">
              <div className="grid gap-4 grid-cols-1">
                {subProjectTimelines.map(({ sub, timeline }) => (
                  <PlannedVsActualChart
                    key={sub.id}
                    phaseName={sub.name}
                    timelineData={timeline}
                    color={phaseColor}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="photos" className="mt-4 space-y-6">
              {/* Progress Photos — display only; upload via Gantt activity options (⋮) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Progress Photos</h3>
                <div className="grid grid-cols-3 gap-3">
                  {progressPhotos.length === 0 ? (
                    <p className="col-span-full text-sm text-muted-foreground">No photos yet. Use the options menu (⋮) on an activity in the Gantt chart to add a photo.</p>
                  ) : null}
                  {[...progressPhotos].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
                    <Card key={item.id} className="overflow-hidden border border-border/60">
                      <div className="aspect-square relative bg-muted">
                        <img src={item.objectUrl} alt={item.caption || item.date} className="w-full h-full object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-[10px] bg-black/70">{item.date}</Badge>
                        <div className="absolute top-1 right-1 flex gap-1">
                          <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => downloadPhoto(item)} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => removePhoto(item.id)} title="Remove">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <CardContent className="p-2">
                        <p className="text-xs text-muted-foreground truncate" title={item.caption}>{item.caption || "—"}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Documents — display only; upload via Gantt activity options (⋮) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Documents</h3>
                {progressDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents yet. Use the options menu (⋮) on an activity in the Gantt chart to add a document.</p>
                ) : (
                  <div className="rounded-lg border border-border/60 divide-y divide-border/60">
                    {[...progressDocs]
                      .sort((a, b) => (b.uploadedAt || b.id).localeCompare(a.uploadedAt || a.id))
                      .map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" onClick={() => downloadDoc(item)}>
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => removeDoc(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Delay Logs tab removed (was hardcoded) */}
          </Tabs>
        )}
      </CardContent>

      {/* Add Photo dialog (opened from Gantt activity options) */}
      <Dialog open={addPhotoDialogOpen} onOpenChange={(open) => { if (!open) closePhotoDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Photo</DialogTitle>
            <DialogDescription>
              {selectedTaskForMedia ? `Add a progress photo for: ${selectedTaskForMedia.taskName}` : "Add a progress photo. Set the progress date for the timeline."}
            </DialogDescription>
          </DialogHeader>
          <input
            ref={photoDialogInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhotoDialogForm({ file, objectUrl: URL.createObjectURL(file), date: new Date().toISOString().slice(0, 10), caption: "" });
              e.target.value = "";
            }}
          />
          {photoDialogForm ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted border">
                  <img src={photoDialogForm.objectUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-xs">Progress date (timeline)</Label>
                    <Input
                      type="date"
                      value={photoDialogForm.date}
                      onChange={(e) => setPhotoDialogForm((p) => (p ? { ...p, date: e.target.value } : null))}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Caption (optional)</Label>
                    <Input
                      placeholder="e.g. Site visit"
                      value={photoDialogForm.caption}
                      onChange={(e) => setPhotoDialogForm((p) => (p ? { ...p, caption: e.target.value } : null))}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={closePhotoDialog}>Cancel</Button>
                <Button type="button" onClick={savePhotoFromDialog}>Save photo</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-4">
              <Button type="button" variant="outline" className="w-full gap-2" onClick={() => photoDialogInputRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose image
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Documents dialog (opened from Gantt activity options) */}
      <Dialog open={addDocumentDialogOpen} onOpenChange={(open) => { if (!open) closeDocumentDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Documents</DialogTitle>
            <DialogDescription>
              {selectedTaskForMedia ? `Upload a document for: ${selectedTaskForMedia.taskName}` : "Upload PDF, Word, Excel or text files."}
            </DialogDescription>
          </DialogHeader>
          <input
            ref={docDialogInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                addDocument(file);
                closeDocumentDialog();
              }
              e.target.value = "";
            }}
          />
          <div className="py-4">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => docDialogInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choose file
            </Button>
            <p className="text-xs text-muted-foreground mt-2">PDF, Word, Excel or text files. Document will appear in the Photos & Docs tab.</p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


