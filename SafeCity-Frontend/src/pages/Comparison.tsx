import { Layout } from "@/components/layout/Layout";
import { CityCompletionChart } from "@/components/comparison/CityCompletionChart";
import { StackedPhaseChart } from "@/components/comparison/StackedPhaseChart";
import { RadarComparisonChart } from "@/components/comparison/RadarComparisonChart";
import { HeatmapChart } from "@/components/comparison/HeatmapChart";
import { CITY_INSTALLATION_DATA, CITY_NAMES } from "@/data/cityData";
import { useQuery } from "@tanstack/react-query";
import { listDivisions, listProjects } from "@/api";
import type { Division, Project } from "@/api/types";
import { useMemo } from "react";

export default function Comparison() {
  // Division completion chart should be API-driven:
  // completion % per division is calculated from all projects under that division
  // (projects already belong to district -> tehsil -> project, and also carry division id).
  const {
    data: divisions = [],
    isLoading: divisionsLoading,
  } = useQuery<Division[]>({
    queryKey: ["divisions"],
    queryFn: () => listDivisions(),
  });

  const {
    data: projects = [],
    isLoading: projectsLoading,
  } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const divisionCompletionData = useMemo(() => {
    if (divisionsLoading || projectsLoading) return [];
    if (!Array.isArray(divisions) || divisions.length === 0) return [];

    return divisions
      .map((div) => {
        const divProjects = projects.filter((p) => p.division === div.id);
        let allocated = 0;
        let utilized = 0;

        for (const p of divProjects) {
          allocated += parseFloat(p.total_budget_allocated ?? "0") || 0;
          utilized += parseFloat(p.budget_utilized ?? "0") || 0;
        }

        const completion =
          allocated > 0 ? Math.round((utilized / allocated) * 100) : 0;

        return {
          city: `${div.division_name} Division`,
          completion: Math.min(100, Math.max(0, completion)),
        };
      })
      .sort((a, b) => b.completion - a.completion);
  }, [divisionsLoading, projectsLoading, divisions, projects]);

  // Prepare data for stacked phase chart
  const stackedData = Object.entries(CITY_INSTALLATION_DATA).map(([key, data]) => ({
    city: CITY_NAMES[key] || key,
    surveys: data.surveys,
    foundations: data.foundations,
    cabinet: data.cabinet,
    cable: data.cable,
    controlRoom: data.controlRoom,
    ppic3: data.ppic3,
  }));

  // Prepare data for radar chart
  const radarData = [
    { phase: "Surveys" },
    { phase: "Foundations" },
    { phase: "Cabinet" },
    { phase: "Cable" },
    { phase: "Control Room" },
    { phase: "PPIC3" },
  ];

  Object.entries(CITY_INSTALLATION_DATA).forEach(([key, data]) => {
    const cityName = CITY_NAMES[key] || key;
    (radarData[0] as any)[cityName] = data.surveys;
    (radarData[1] as any)[cityName] = data.foundations;
    (radarData[2] as any)[cityName] = data.cabinet;
    (radarData[3] as any)[cityName] = data.cable;
    (radarData[4] as any)[cityName] = data.controlRoom;
    (radarData[5] as any)[cityName] = data.ppic3;
  });

  const cities = Object.values(CITY_NAMES);

  // Prepare phase comparison data for pie charts
  const surveysData = Object.entries(CITY_INSTALLATION_DATA).map(([key, data]) => ({
    city: CITY_NAMES[key] || key,
    value: data.surveys,
  }));

  const foundationsData = Object.entries(CITY_INSTALLATION_DATA).map(([key, data]) => ({
    city: CITY_NAMES[key] || key,
    value: data.foundations,
  }));

  const cabinetData = Object.entries(CITY_INSTALLATION_DATA).map(([key, data]) => ({
    city: CITY_NAMES[key] || key,
    value: data.cabinet,
  }));


  return (
    <Layout title="City Comparison - Smart Safe Cities">
      <div className="flex flex-col gap-4 sm:gap-6 w-full min-w-0">
        {/* Header Section */}


        {/* City Completion Comparison Chart */}
        <CityCompletionChart
          cityData={divisionCompletionData}
          description="Division Wise Progress"
        />

        {/* Heatmap Chart */}
        <HeatmapChart data={stackedData} />

        {/* Stacked Phase Chart */}
        {/* <StackedPhaseChart data={stackedData} /> */}

        {/* Radar Chart - Full Width */}
        <RadarComparisonChart data={radarData} cities={cities} />




      </div>
    </Layout>
  );
}
