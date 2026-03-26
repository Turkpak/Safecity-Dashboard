import * as XLSX from "xlsx";

/** Amounts in the workbook are PKR millions (same convention as the source Excel). */
export interface FinanceTriple {
  capital: number;
  revenue: number;
  total: number;
}

export interface TehsilSchemeFinanceRow {
  sr: number;
  gsNo: string;
  projectTitle: string;
  category: string;
  approved: FinanceTriple;
  allocation: FinanceTriple;
  pdRelease: FinanceTriple;
  spendingRelease: FinanceTriple;
  pifraUtilization: FinanceTriple;
  /** Ratios (0–1), not currency */
  pctUtilVsSpending: FinanceTriple;
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function readTriple(row: unknown[], start: number): FinanceTriple {
  return {
    capital: num(row[start]),
    revenue: num(row[start + 1]),
    total: num(row[start + 2]),
  };
}

/** Map Excel project title suffix to app division name (punjabHierarchy keys). */
export function excelTitleToAppDivision(title: string): string | null {
  const trimmed = title.trim();
  const parts = trimmed.split(/\s*-\s*/);
  const last = parts[parts.length - 1]?.trim() ?? "";
  const withoutSuffix = last.replace(/\s+Division\s*$/i, "").trim();
  if (!withoutSuffix) return null;
  const key = withoutSuffix.toLowerCase().replace(/\./g, "");
  if (key === "dg khan" || key === "d g khan") return "Dera Ghazi Khan";
  return withoutSuffix;
}

export interface ParsedTehsilSchemesWorkbook {
  rows: TehsilSchemeFinanceRow[];
  /** Aggregated row from the sheet footer, if present */
  totals: TehsilSchemeFinanceRow | null;
  /** e.g. "06-03-2026" from "Pifra Utilization 06-03-2026" */
  pifraAsOfLabel: string | null;
}

/**
 * Parses `Tehsil Schemes Financial Details.xlsx` — sheet "Scheme Wise Sheet",
 * header rows then data rows (Sr., G.S No., … Capital/Revenue/Total blocks).
 */
export function parseTehsilSchemesWorkbook(ab: ArrayBuffer): ParsedTehsilSchemesWorkbook {
  const wb = XLSX.read(ab, { type: "array", cellDates: true, raw: false });
  const name = wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  let pifraAsOfLabel: string | null = null;
  const headerRow0 = matrix[0];
  if (Array.isArray(headerRow0)) {
    for (const cell of headerRow0) {
      if (typeof cell === "string" && /pifra/i.test(cell)) {
        const m = cell.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
        pifraAsOfLabel = m ? m[1].replace(/\//g, "-") : null;
        break;
      }
    }
  }

  const rows: TehsilSchemeFinanceRow[] = [];
  let totals: TehsilSchemeFinanceRow | null = null;

  // Data starts at row index 2 (1-based row 3): after two header lines
  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row) || row.length < 19) continue;

    const sr = num(row[0]);
    const gsRaw = row[1];
    const gsNo = gsRaw != null && gsRaw !== "" ? String(gsRaw).trim() : "";
    const projectTitle = String(row[2] ?? "").trim();
    const category = String(row[3] ?? "").trim();

    const isTotalRow =
      category.toLowerCase() === "total" ||
      (sr === 0 && projectTitle === "" && category.toLowerCase() === "total");

    const triple = (start: number) => readTriple(row, start);

    const record: TehsilSchemeFinanceRow = {
      sr: isTotalRow ? 0 : sr,
      gsNo,
      projectTitle,
      category,
      approved: triple(4),
      allocation: triple(7),
      pdRelease: triple(10),
      spendingRelease: triple(13),
      pifraUtilization: triple(16),
      pctUtilVsSpending: triple(19),
    };

    if (isTotalRow) {
      totals = record;
      continue;
    }
    if (!projectTitle || !Number.isFinite(sr) || sr <= 0) continue;
    rows.push(record);
  }

  return { rows, totals, pifraAsOfLabel };
}

export function aggregateRows(rows: TehsilSchemeFinanceRow[]): TehsilSchemeFinanceRow {
  const sum3 = (a: FinanceTriple, b: FinanceTriple): FinanceTriple => ({
    capital: a.capital + b.capital,
    revenue: a.revenue + b.revenue,
    total: a.total + b.total,
  });

  const empty: TehsilSchemeFinanceRow = {
    sr: 0,
    gsNo: "",
    projectTitle: "",
    category: "All divisions",
    approved: { capital: 0, revenue: 0, total: 0 },
    allocation: { capital: 0, revenue: 0, total: 0 },
    pdRelease: { capital: 0, revenue: 0, total: 0 },
    spendingRelease: { capital: 0, revenue: 0, total: 0 },
    pifraUtilization: { capital: 0, revenue: 0, total: 0 },
    pctUtilVsSpending: { capital: 0, revenue: 0, total: 0 },
  };

  return rows.reduce((acc, r) => ({
    ...acc,
    approved: sum3(acc.approved, r.approved),
    allocation: sum3(acc.allocation, r.allocation),
    pdRelease: sum3(acc.pdRelease, r.pdRelease),
    spendingRelease: sum3(acc.spendingRelease, r.spendingRelease),
    pifraUtilization: sum3(acc.pifraUtilization, r.pifraUtilization),
    pctUtilVsSpending: sum3(acc.pctUtilVsSpending, r.pctUtilVsSpending),
  }), empty);
}

/** Derive % PIFRA vs spending release total (weighted view); 0 if no spending release. */
export function utilizationPctVsSpending(row: TehsilSchemeFinanceRow): number {
  const sp = row.spendingRelease.total;
  if (sp <= 0) return 0;
  return (row.pifraUtilization.total / sp) * 100;
}
