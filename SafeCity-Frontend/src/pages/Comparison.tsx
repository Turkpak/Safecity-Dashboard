import { Layout } from "@/components/layout/Layout";
import { CityCompletionChart } from "@/components/comparison/CityCompletionChart";
import { PhaseComparisonPieChart } from "@/components/comparison/PhaseComparisonPieChart";
import { StackedPhaseChart } from "@/components/comparison/StackedPhaseChart";
import { RadarComparisonChart } from "@/components/comparison/RadarComparisonChart";
import { HeatmapChart } from "@/components/comparison/HeatmapChart";
import { CITY_INSTALLATION_DATA, CITY_NAMES } from "@/data/cityData";
import { getAllDivisions } from "@/data/punjabHierarchy";
import { getAllDivisionData } from "@/data/punjabInstallationData";

export default function Comparison() {
  // Prepare data for division completion chart (Punjab Division-wise progress)
  const divisionDataMap = getAllDivisionData();
  const divisionCompletionData = getAllDivisions().map((division) => {
    const key = division.toLowerCase().replace(/\s+/g, "");
    return {
      city: `${division} Division`,
      completion: divisionDataMap[key]?.overall ?? 0,
    };
  });

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
      <div className="flex flex-col gap-6">
        {/* Header Section */}


        {/* City Completion Comparison Chart */}
        <CityCompletionChart cityData={divisionCompletionData} description="Division Wise Progress" />

        {/* Heatmap Chart */}
        <HeatmapChart data={stackedData} />

        {/* Stacked Phase Chart */}
        <StackedPhaseChart data={stackedData} />

        {/* Radar Chart - Full Width */}
        <RadarComparisonChart data={radarData} cities={cities} />




      </div>
    </Layout>
  );
}
