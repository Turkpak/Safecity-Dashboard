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

  const divisions = pageData?.divisions ?? [];
  const districts = pageData?.districts ?? [];

  const divisionCompletionData = useMemo(() => {
    if (isLoading || divisions.length === 0) return [];

    return divisions
      .map((div: any) => {
        const divisionName = div.division_name ?? div.name ?? "Division";
        const completionValue = Number(div.overall_progress ?? div.physical_progress ?? 0);

        return {
          city: `${divisionName} Division`,
          completion: Math.min(100, Math.max(0, Number(completionValue.toFixed(2)))),
        };
      })
      .sort((a, b) => b.completion - a.completion);
  }, [divisions, isLoading]);

  const districtCompletionData = useMemo(() => {
    if (isLoading || districts.length === 0) return [];

    return districts
      .map((dist: any) => {
        const districtName = dist.district_name ?? dist.name ?? "District";
        const completionValue = Number(dist.overall_progress ?? dist.physical_progress ?? 0);

        return {
          city: `${districtName} District`,
          completion: Math.min(100, Math.max(0, Number(completionValue.toFixed(2)))),
        };
      })
      .sort((a, b) => b.completion - a.completion)
      .slice(0, 10);
  }, [districts, isLoading]);

  return (
    <Layout title={isMobile ? "CITY COMPARISON" : "City Comparison - Smart Safe Cities"}>
      <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
        <CityCompletionChart
          title="Division Wise Progress"
          cityData={divisionCompletionData}
          description="Average project progress rollup by Division"
        />

        <CityCompletionChart
          title="Top 10 Districts Progress"
          cityData={districtCompletionData}
          description="Top 10 Districts by average project progress"
        />
      </div>
    </Layout>
  );
}