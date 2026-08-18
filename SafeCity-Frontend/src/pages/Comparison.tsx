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
  }, [
    divisionsLoading,
    districtsLoading,
    tehsilsLoading,
    projectsLoading,
    ganttLoading,
    divisions,
    districts,
    tehsils,
    projects,
    ganttProgressByProjectId,
  ]);

  const districtCompletionData = useMemo(() => {
    if (
      divisionsLoading ||
      districtsLoading ||
      tehsilsLoading ||
      projectsLoading ||
      ganttLoading
    )
      return [];
    if (!Array.isArray(districts) || districts.length === 0) return [];

    const avg = (values: number[]): number => {
      if (values.length === 0) return 0;
      const sum = values.reduce((acc, v) => acc + v, 0);
      return sum / values.length;
    };

    const calcProjectsOverall = (ps: Project[]): number => {
      let sum = 0;
      let count = 0;
      for (const p of ps) {
        const v = ganttProgressByProjectId.get(p.id);
        if (v === undefined) continue;
        sum += v;
        count++;
      }
      return count > 0 ? Math.max(0, Math.min(100, sum / count)) : 0;
    };

    return districts
      .map((dist) => {
        const distTehsils = tehsils.filter((t) => t.district === dist.id);
        const tehsilOveralls: number[] = [];

        for (const tehsil of distTehsils) {
          const tehsilProjects = projects.filter((p) => p.tehsil === tehsil.id);
          const overall = calcProjectsOverall(tehsilProjects);
          if (tehsilProjects.length > 0) tehsilOveralls.push(overall);
        }

        const completion = tehsilOveralls.length > 0 ? Math.round(avg(tehsilOveralls)) : 0;

        return {
          city: `${dist.district_name} District`,
          completion: Math.min(100, Math.max(0, completion)),
        };
      })
      .sort((a, b) => b.completion - a.completion)
      .slice(0, 10);
  }, [
    divisionsLoading,
    districtsLoading,
    tehsilsLoading,
    projectsLoading,
    ganttLoading,
    districts,
    tehsils,
    projects,
    ganttProgressByProjectId,
  ]);

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
