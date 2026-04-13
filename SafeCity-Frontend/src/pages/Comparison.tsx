import { Layout } from "@/components/layout/Layout";
import { CityCompletionChart } from "@/components/comparison/CityCompletionChart";
import { StackedPhaseChart } from "@/components/comparison/StackedPhaseChart";
import { RadarComparisonChart } from "@/components/comparison/RadarComparisonChart";
import { HeatmapChart } from "@/components/comparison/HeatmapChart";
import { CITY_INSTALLATION_DATA, CITY_NAMES } from "@/data/cityData";
import { useQuery } from "@tanstack/react-query";
import { getProjectGanttAll, listDistricts, listDivisions, listProjects, listTehsils } from "@/api";
import type { District, Division, Project, Tehsil } from "@/api/types";
import { useMemo } from "react";
import { useWindowSize } from "@/hooks/use-window-size";

export default function Comparison() {
  const { width } = useWindowSize();
  const isMobile = width < 640;

  const {
    data: divisions = [],
    isLoading: divisionsLoading,
  } = useQuery<Division[]>({
    queryKey: ["divisions"],
    queryFn: () => listDivisions(),
  });

  const {
    data: districts = [],
    isLoading: districtsLoading,
  } = useQuery<District[]>({
    queryKey: ["districts"],
    queryFn: () => listDistricts(),
  });

  const {
    data: tehsils = [],
    isLoading: tehsilsLoading,
  } = useQuery<Tehsil[]>({
    queryKey: ["tehsils"],
    queryFn: () => listTehsils(),
  });

  const {
    data: projects = [],
    isLoading: projectsLoading,
  } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  // Project progress source of truth: root gantt task `_id:"1"` progress per project.
  const { data: projectGanttAll = [], isLoading: ganttLoading } = useQuery({
    queryKey: ["project-gantt-all"],
    queryFn: () => getProjectGanttAll(),
  });

  const ganttProgressByProjectId = useMemo(() => {
    const clampPct = (n: number) => Math.max(0, Math.min(100, n));
    const toPct = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? clampPct(n) : 0;
    };

    const findNodeById = (
      nodes: any[],
      targetId: string,
    ): { progress?: number } | null => {
      for (const n of nodes) {
        if (String(n?._id ?? n?.id ?? "") === targetId) return n;
        const children: any[] = Array.isArray(n?.subtasks) ? n.subtasks : [];
        const hit = children.length ? findNodeById(children, targetId) : null;
        if (hit) return hit;
      }
      return null;
    };

    const map = new Map<number, number>();
    for (const s of projectGanttAll as any[]) {
      const pid = Number(s?._id);
      if (!Number.isFinite(pid)) continue;
      const tasks: any[] = Array.isArray(s?.tasks) ? s.tasks : [];
      const root = findNodeById(tasks, "1") ?? tasks[0] ?? null;
      map.set(pid, toPct(root?.progress));
    }
    return map;
  }, [projectGanttAll]);

  const divisionCompletionData = useMemo(() => {
    if (
      divisionsLoading ||
      districtsLoading ||
      tehsilsLoading ||
      projectsLoading ||
      ganttLoading
    )
      return [];
    if (!Array.isArray(divisions) || divisions.length === 0) return [];

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

    // Hierarchical rollup:
    // tehsil overall = avg(project root progress in tehsil)
    // district overall = avg(tehsil overalls in district)
    // division overall = avg(district overalls in division)
    return divisions
      .map((div) => {
        const divDistricts = districts.filter((d) => d.division === div.id);
        const districtOveralls: number[] = [];

        for (const dist of divDistricts) {
          const distTehsils = tehsils.filter((t) => t.district === dist.id);
          const tehsilOveralls: number[] = [];

          for (const tehsil of distTehsils) {
            const tehsilProjects = projects.filter((p) => p.tehsil === tehsil.id);
            // Only count tehsils that have at least one project with gantt progress.
            const overall = calcProjectsOverall(tehsilProjects);
            if (tehsilProjects.length > 0) tehsilOveralls.push(overall);
          }

          if (tehsilOveralls.length > 0) {
            districtOveralls.push(avg(tehsilOveralls));
          } else {
            // If a district has no tehsils/projects, treat it as 0% rather than skipping it.
            districtOveralls.push(0);
          }
        }

        const completion = Math.round(avg(districtOveralls));

        return {
          city: `${div.division_name} Division`,
          completion: Math.min(100, Math.max(0, completion)),
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
    <Layout title={isMobile ? "CITY COMPARISON" : "City Comparison - Smart Safe Cities"}>
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
