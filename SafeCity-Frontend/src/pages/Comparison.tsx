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
  const tehsils = pageData?.tehsils ?? [];
  const projects = pageData?.projects ?? [];

  const divisionCompletionData = useMemo(() => {
    if (isLoading) return [];
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
  }, [divisions, isLoading]);

  const districtCompletionData = useMemo(() => {
    if (isLoading || districts.length === 0) return [];

    const avg = (values: number[]): number => {
      if (values.length === 0) return 0;
      const sum = values.reduce((acc, v) => acc + v, 0);
      return sum / values.length;
    };

    return districts
      .map((dist: any) => {
        const distTehsils = tehsils.filter((t: any) => Number(t.district ?? t.district_id) === Number(dist.id));
        const tehsilOveralls: number[] = [];

        for (const tehsil of distTehsils) {
          const tehsilProjects = projects.filter((p: any) => Number(p.tehsil ?? p.tehsil_id) === Number(tehsil.id));
          if (tehsilProjects.length === 0) continue;

          const tehsilAverage =
            tehsilProjects.reduce(
              (sum: number, p: any) => sum + Number(p.overall_progress ?? p.physical_progress ?? 0),
              0,
            ) / tehsilProjects.length;

          tehsilOveralls.push(tehsilAverage);
        }

        const completion = tehsilOveralls.length > 0 ? Math.round(avg(tehsilOveralls)) : 0;

        return {
          city: `${dist.district_name ?? dist.name ?? "District"} District`,
          completion: Math.min(100, Math.max(0, completion)),
        };
      })
      .sort((a, b) => b.completion - a.completion)
      .slice(0, 10);
  }, [districts, tehsils, projects, isLoading]);

  return (
    <Layout title={isMobile ? "CITY COMPARISON" : "City Comparison - Smart Safe Cities"}>
      <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
        {/* Division Completion Comparison Chart */}
        <CityCompletionChart
          title="Division Wise Progress"
          cityData={divisionCompletionData}
          description="Average project progress rollup by Division"
        />

        {/* Top 10 Districts Completion Comparison Chart */}
        <CityCompletionChart
          title="Top 10 Districts Progress"
          cityData={districtCompletionData}
          description="Top 10 Districts by average project progress"
        />
      </div>
    </Layout>
  );
}
