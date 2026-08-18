import { get } from "./client";

export type ProjectSummaryResponse = {
  project_id?: number | string | null;
  total_allocation: number;
  total_allocation_capital?: number;
  total_allocation_revenue?: number;
  total_pd_release: number;
  total_pd_release_capital?: number;
  total_pd_release_revenue?: number;
  total_spending_release: number;
  total_spending_release_capital?: number;
  total_spending_release_revenue?: number;
  total_pifra: number;
  total_pifra_capital?: number;
  total_pifra_revenue?: number;
  percentage_total?: number;
  percentage_capital?: number;
  percentage_revenue?: number;
};

export async function getProjectSummary(): Promise<ProjectSummaryResponse> {
  const data = await get<ProjectSummaryResponse>("project-summary/");
  return data ?? {
    total_allocation: 0,
    total_pd_release: 0,
    total_spending_release: 0,
    total_pifra: 0,
  };
}

