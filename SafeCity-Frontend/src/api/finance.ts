import { get } from "./client";

export type ProjectSummaryResponse = {
  total_allocation: number;
  total_pd_release: number;
  total_spending_release: number;
  total_pifra: number;
  percentage_total?: number;
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

