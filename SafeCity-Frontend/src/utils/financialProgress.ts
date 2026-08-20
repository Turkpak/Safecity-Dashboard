import type { Project } from "@/api/types";
import type { FinancialProgressMetrics } from "@/api/projectActivity";

const numberValue = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const ratio = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? (numerator / denominator) * 100 : null;

/**
 * Financial fallback/validation helper.
 * Aggregate monetary values first, then calculate percentages. Never average
 * individual project financial percentages.
 */
export function calculateFinancialMetrics(projects: Project[]): FinancialProgressMetrics {
  const totals = projects.reduce(
    (acc, project) => {
      acc.allocation += numberValue(project.allocation_total_cost);
      acc.pd_release += numberValue(project.pd_release_total_cost);
      acc.spending_release += numberValue(project.spending_release_total_cost);
      acc.pifra += numberValue(project.pifra_utilization_total_cost);
      return acc;
    },
    { allocation: 0, pd_release: 0, spending_release: 0, pifra: 0 },
  );

  return {
    ...totals,
    pd_release_vs_allocation: ratio(totals.pd_release, totals.allocation),
    spending_release_vs_allocation: ratio(totals.spending_release, totals.allocation),
    pifra_vs_allocation: ratio(totals.pifra, totals.allocation),
    financial_progress: ratio(totals.pifra, totals.spending_release),
  };
}
