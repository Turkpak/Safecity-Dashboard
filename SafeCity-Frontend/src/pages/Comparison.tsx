import { Layout } from "@/components/layout/Layout";
import { CityCompletionChart } from "@/components/comparison/CityCompletionChart";
import { useQuery } from "@tanstack/react-query";
import { getDashboardPageData } from "@/api/dashboard";
import { useMemo } from "react";
import { useWindowSize } from "@/hooks/use-window-size";

export default function Comparison() {
  const { width } = useWindowSize();
  const isMobile = width < 640;

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["dashboard-page", "divisions"],
    queryFn: () => getDashboardPageData("divisions"),
  });

  const divisionCompletionData = useMemo(() => {
    if (isLoading) return [];
    const divisions = pageData?.divisions ?? [];
    if (divisions.length === 0) return [];

    return divisions
      .map((div: any) => {
        const divisionName = div.division_name ?? div.name ?? "Division";
        const completionValue = Number(div.overall_progress ?? div.physical_progress ?? 0);

        return {
          city: `${divisionName} Division`,
          completion: Math.round(
            Math.min(100, Math.max(0, completionValue)),
          ),
        };
      })
      .sort((a, b) => b.completion - a.completion);
  }, [isLoading, pageData]);

  return (
    <Layout title={isMobile ? "CITY COMPARISON" : "City Comparison - Smart Safe Cities"}>
      <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
        {/* City Completion Comparison Chart */}
        <CityCompletionChart
          cityData={divisionCompletionData}
          description="Division Wise Progress"
        />
      </div>
    </Layout>
  );
}
