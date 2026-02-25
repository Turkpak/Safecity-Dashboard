import { Layout } from "@/components/layout/Layout";
import { InstallationCard } from "@/components/dashboard/InstallationCard";
import { PhaseDistributionChart } from "@/components/dashboard/PhaseDistributionChart";
import { PhaseTimelineChart } from "@/components/dashboard/PhaseTimelineChart";
import { PlannedVsActualChart } from "@/components/dashboard/PlannedVsActualChart";
import { MilestoneDetailsPanel } from "@/components/dashboard/MilestoneDetailsPanel";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useWindowSize } from "@/hooks/use-window-size";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  getAllTehsilData,
  InstallationData
} from "@/data/punjabInstallationData";
import { PUNJAB_HIERARCHY } from "@/data/punjabHierarchy";
import { getTehsilSubProjectsByPhase, getBahawalpurTehsilProjects, BahawalpurProject, convertToSubProjects } from "@/data/bahawalpurProjectsData";
import { 
  ClipboardCheck, 
  Building2, 
  Camera, 
  Zap, 
  Home, 
  Radio,
  TrendingUp,
  ArrowLeft,
  DollarSign
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { SubProject } from "@/components/dashboard/SubProjectCard";

// Enhanced installation progress data with sub-projects and planned vs actual
interface PhaseProgress {
  actual: number;
  planned: number;
  subProjects?: SubProject[];
  timeline?: {
    month: string;
    actual: number;
    planned: number;
  }[];
}

interface CityInstallationData {
  surveys: number | PhaseProgress;
  foundations: number | PhaseProgress;
  cabinet: number | PhaseProgress;
  cable: number | PhaseProgress;
  controlRoom: number | PhaseProgress;
  ppic3: number | PhaseProgress;
  overall: number;
  timeline?: {
    month: string;
    surveys: number;
    foundations: number;
    cabinet: number;
    cable: number;
    controlRoom: number;
    ppic3: number;
    overall: number;
  }[];
}

type PhaseKey = "surveys" | "foundations" | "cabinet" | "cable" | "controlRoom" | "ppic3";

// Helper function to get progress value (backward compatible)
const getProgressValue = (progress: number | PhaseProgress): number => {
  return typeof progress === 'number' ? progress : progress.actual;
};

// Helper function to check if progress has detailed data
const hasDetailedProgress = (progress: number | PhaseProgress): progress is PhaseProgress => {
  return typeof progress !== 'number';
};

// Generate sub-projects for a phase - uses real Excel data for Bahawalpur
const generateSubProjects = (
  phaseKey: string,
  actualProgress: number,
  plannedProgress: number,
  division?: string,
  district?: string,
  tehsil?: string
): SubProject[] => {
  // ALWAYS try to use real Bahawalpur data if available - NO hardcoded fallback for Bahawalpur
  if (division === 'Bahawalpur' && district && tehsil) {
    try {
      const subProjectsByPhase = getTehsilSubProjectsByPhase(district, tehsil);
      const realSubProjects = subProjectsByPhase[phaseKey];
      
      if (realSubProjects && realSubProjects.length > 0) {
        // Use REAL sub-projects from Excel data with real names, deadlines, and milestones
        return realSubProjects;
      }
      // If no data found for this phase, return empty array (don't use hardcoded templates)
      return [];
    } catch (error) {
      console.warn(`Error loading Bahawalpur sub-projects for ${district}-${tehsil}:`, error);
      // Return empty array instead of fallback for Bahawalpur
      return [];
    }
  }
  
  // Only use hardcoded templates for NON-Bahawalpur divisions
  const subProjectTemplates: Record<string, { names: string[], weights: number[] }> = {
    surveys: {
      names: ["Site Survey & Assessment", "Technical Feasibility Study", "Site Selection & Approval", "Environmental Clearance"],
      weights: [0.30, 0.25, 0.25, 0.20]
    },
    foundations: {
      names: ["Excavation Work", "Foundation Pouring", "Curing & Quality Check", "Backfilling & Compaction"],
      weights: [0.25, 0.35, 0.20, 0.20]
    },
    cabinet: {
      names: ["Cabinet Installation", "Electrical Connections", "Network Setup", "Equipment Mounting"],
      weights: [0.30, 0.25, 0.25, 0.20]
    },
    cable: {
      names: ["Cable Trenching", "Fiber Optic Laying", "Power Cable Installation", "Cable Termination & Testing"],
      weights: [0.25, 0.30, 0.25, 0.20]
    },
    controlRoom: {
      names: ["Room Renovation", "Server Installation", "Display Systems", "Control Systems Integration"],
      weights: [0.25, 0.30, 0.25, 0.20]
    },
    ppic3: {
      names: ["System Integration", "Software Deployment", "Testing & Commissioning", "Go-Live Preparation"],
      weights: [0.30, 0.25, 0.25, 0.20]
    }
  };

  const template = subProjectTemplates[phaseKey] || {
    names: ["Sub-Project 1", "Sub-Project 2", "Sub-Project 3"],
    weights: [0.33, 0.33, 0.34]
  };

  // Generate sub-projects with variance based on parent progress (only for non-Bahawalpur)
  const variance = actualProgress - plannedProgress;
  
  return template.names.map((name, index) => {
    const weight = template.weights[index];
    const baseActual = actualProgress * (0.8 + Math.random() * 0.4); // Vary around parent
    const basePlanned = plannedProgress * (0.8 + Math.random() * 0.4);
    
    return {
      id: `${phaseKey}-${index}`,
      name,
      actualProgress: Math.min(100, Math.max(0, baseActual)),
      plannedProgress: Math.min(100, Math.max(0, basePlanned)),
      weight
    };
  });
};

// Helper to convert legacy data to new format
const convertToPhaseProgress = (
  currentValue: number,
  phaseKey: string,
  timelineData?: { month: string; [key: string]: number | string }[],
  division?: string,
  district?: string,
  tehsil?: string
): PhaseProgress => {
  // Generate planned progress (typically 5-10% higher initially, then converges)
  const plannedProgress = Math.min(100, currentValue + (100 - currentValue) * 0.15);
  
  // Generate timeline if not provided
  const timeline = timelineData?.map(point => {
    const actual = (point[phaseKey] as number) || 0;
    const planned = Math.min(100, actual + (100 - actual) * 0.15);
    return {
      month: point.month as string,
      actual,
      planned
    };
  }) || [];

  // Generate default timeline if none provided
  const defaultTimeline = timeline.length === 0 ? [
    { month: "Jan", actual: Math.max(0, currentValue * 0.1), planned: Math.max(0, plannedProgress * 0.15) },
    { month: "Feb", actual: Math.max(0, currentValue * 0.25), planned: Math.max(0, plannedProgress * 0.30) },
    { month: "Mar", actual: Math.max(0, currentValue * 0.40), planned: Math.max(0, plannedProgress * 0.45) },
    { month: "Apr", actual: Math.max(0, currentValue * 0.55), planned: Math.max(0, plannedProgress * 0.60) },
    { month: "May", actual: Math.max(0, currentValue * 0.70), planned: Math.max(0, plannedProgress * 0.75) },
    { month: "Jun", actual: Math.max(0, currentValue * 0.85), planned: Math.max(0, plannedProgress * 0.90) },
    { month: "Jul", actual: currentValue, planned: plannedProgress },
  ] : timeline;

  return {
    actual: currentValue,
    planned: plannedProgress,
    subProjects: generateSubProjects(phaseKey, currentValue, plannedProgress, division, district, tehsil),
    timeline: defaultTimeline.length > 0 ? defaultTimeline : undefined
  };
};

const installationPhases = [
  {
    key: "surveys" as const,
    title: "Surveys",
    icon: ClipboardCheck,
    color: "blue" as const,
  },
  {
    key: "foundations" as const,
    title: "Foundations Pole Installations",
    icon: Building2,
    color: "emerald" as const,
  },
  {
    key: "cabinet" as const,
    title: "Cabinet Cameras Installation",
    icon: Camera,
    color: "orange" as const,
  },
  {
    key: "cable" as const,
    title: "Cable Laying & Power Connections",
    icon: Zap,
    color: "purple" as const,
  },
  {
    key: "controlRoom" as const,
    title: "Control Room Renovations",
    icon: Home,
    color: "red" as const,
  },
  {
    key: "ppic3" as const,
    title: "PPIC3 Go Live",
    icon: Radio,
    color: "indigo" as const,
  },
];

export default function ProjectDetail() {
  const [location, setLocation] = useLocation();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const [selectedMilestoneKey, setSelectedMilestoneKey] = useState<PhaseKey | null>(null);
  const [progressType, setProgressType] = useState<"physical" | "financial">("physical");

  // Convert physical progress to financial progress
  const convertToFinancialProgress = (physicalPhase: PhaseProgress): PhaseProgress => {
    // Financial progress typically runs slightly behind physical progress
    // and has different variance patterns
    const financialMultiplier = 0.92; // Financial is typically 92% of physical
    const varianceAdjustment = 0.85; // Financial variance is typically 85% of physical variance
    
    const financialActual = Math.min(100, physicalPhase.actual * financialMultiplier);
    const variance = physicalPhase.actual - physicalPhase.planned;
    const financialVariance = variance * varianceAdjustment;
    const financialPlanned = financialActual - financialVariance;
    
    // Convert sub-projects to financial
    const financialSubProjects: SubProject[] = (physicalPhase.subProjects || []).map(sub => {
      const subFinancialActual = Math.min(100, sub.actualProgress * financialMultiplier);
      const subVariance = sub.actualProgress - sub.plannedProgress;
      const subFinancialVariance = subVariance * varianceAdjustment;
      const subFinancialPlanned = subFinancialActual - subFinancialVariance;
      
      return {
        ...sub,
        name: sub.name.replace(/(Survey|Assessment|Collection|Measurements|Study|Documentation|Feasibility)/g, '$1 Budget'),
        actualProgress: subFinancialActual,
        plannedProgress: Math.max(0, subFinancialPlanned),
      };
    });
    
    // Convert timeline to financial
    const financialTimeline = (physicalPhase.timeline || []).map(t => ({
      month: t.month,
      actual: Math.min(100, t.actual * financialMultiplier),
      planned: Math.min(100, t.planned * financialMultiplier),
    }));
    
    return {
      actual: financialActual,
      planned: Math.max(0, financialPlanned),
      subProjects: financialSubProjects,
      timeline: financialTimeline,
    };
  };

  // Extract tehsil and projectId from URL
  // URL format: /project/:tehsil/:projectId
  const pathParts = location.split('/').filter(Boolean);
  const tehsilName = pathParts[1] || '';
  const projectId = pathParts[2] || '';

  // Find the actual tehsil name, division, and district from hierarchy
  const tehsilContext = useMemo(() => {
    if (!tehsilName) return { tehsil: null, division: null, district: null };
    const tehsilSlug = tehsilName.toLowerCase().replace(/\s+/g, '');
    for (const div of PUNJAB_HIERARCHY) {
      for (const dist of div.districts) {
        for (const teh of dist.tehsils) {
          const tehSlug = teh.tehsil.toLowerCase().replace(/\s+/g, '');
          if (tehSlug === tehsilSlug || tehSlug.includes(tehsilSlug) || tehsilSlug.includes(tehSlug)) {
            return {
              tehsil: teh.tehsil,
              division: div.division,
              district: dist.district
            };
          }
        }
      }
    }
    return { tehsil: null, division: null, district: null };
  }, [tehsilName]);

  const actualTehsilName = tehsilContext.tehsil;

  // Get tehsil data
  const tehsilData = useMemo(() => {
    if (!tehsilName) return null;
    const allTehsilData = getAllTehsilData();
    // Find the tehsil data - the key format is division-district-tehsil
    const tehsilKey = Object.keys(allTehsilData).find(key => 
      key.toLowerCase().includes(tehsilName.toLowerCase().replace(/\s+/g, ''))
    );
    return tehsilKey ? allTehsilData[tehsilKey] : null;
  }, [tehsilName]);

  // Find the selected project - could be installation phase or real Bahawalpur project
  const selectedProject = useMemo(() => {
    if (!projectId) return null;
    
    // First check if it's a real Bahawalpur project ID (starts with "project-")
    if (projectId.startsWith('project-') && tehsilContext.division === 'Bahawalpur' && tehsilContext.district && tehsilContext.tehsil) {
      const projects = getBahawalpurTehsilProjects(tehsilContext.district, tehsilContext.tehsil);
      const project = projects.find(p => p.id === projectId);
      if (project) {
        return {
          key: projectId,
          title: project.name,
          icon: Camera, // Default icon
          color: "blue" as const
        };
      }
    }
    
    // Otherwise, it's an installation phase
    if (!tehsilData) return null;
    return installationPhases.find(p => p.key === projectId);
  }, [projectId, tehsilData, tehsilContext]);

  // Get project-specific data - handle both real projects and installation phases
  const projectData = useMemo(() => {
    if (!selectedProject) return null;
    
    // If it's a real Bahawalpur project
    if (projectId.startsWith('project-') && tehsilContext.division === 'Bahawalpur' && tehsilContext.district && tehsilContext.tehsil) {
      const projects = getBahawalpurTehsilProjects(tehsilContext.district, tehsilContext.tehsil);
      const project = projects.find(p => p.id === projectId);
      
      if (project) {
        // Calculate progress from sub-projects
        const allSubProjects = convertToSubProjects(project.subProjects, projectId);
        const totalActual = allSubProjects.reduce((sum, sp) => sum + (sp.actualProgress * sp.weight), 0);
        const totalPlanned = allSubProjects.reduce((sum, sp) => sum + (sp.plannedProgress * sp.weight), 0);
        const overall = (totalActual + totalPlanned) / 2;
        
        return {
          progress: {
            actual: totalActual,
            planned: totalPlanned,
            overall: overall,
            subProjects: allSubProjects
          },
          phase: selectedProject,
          isRealProject: true,
          project: project
        };
      }
    }
    
    // Otherwise, it's an installation phase
    if (!tehsilData) return null;
    const progress = tehsilData[selectedProject.key];
    return {
      progress,
      phase: selectedProject,
      isRealProject: false
    };
  }, [selectedProject, tehsilData, projectId, tehsilContext]);

  // Allow real Bahawalpur projects even if tehsilData is null
  const isRealBahawalpurProject = projectId.startsWith('project-') && tehsilContext.division === 'Bahawalpur';
  
  if (!tehsilName || !projectId || (!isRealBahawalpurProject && !tehsilData) || !selectedProject || !projectData) {
    return (
      <Layout title="Project Not Found">
        <div className="space-y-6">
          <Button
            variant="outline"
            onClick={() => setLocation('/')}
            className="rounded-xl cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">Project not found. Please go back to the dashboard.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const progress = projectData.progress;
  const progressValue = getProgressValue(progress);
  const hasDetails = hasDetailedProgress(progress);

  // Convert to PhaseProgress if needed to get sub-projects
  const projectPhaseProgress: PhaseProgress = useMemo(() => {
    if (hasDetails) {
      return progress;
    } else {
      const timelineData = (tehsilData as any).timeline;
      return convertToPhaseProgress(
        progressValue, 
        projectId, 
        timelineData,
        tehsilContext.division || undefined,
        tehsilContext.district || undefined,
        tehsilContext.tehsil || undefined
      );
    }
  }, [hasDetails, progress, progressValue, projectId, tehsilData, tehsilContext]);

  // Get sub-projects for the selected project
  const subProjects = projectPhaseProgress.subProjects || [];

  // Calculate metrics for this specific project
  const planned = projectPhaseProgress.planned;
  const actual = projectPhaseProgress.actual;
  const variance = actual - planned;
  const absVariance = Math.abs(variance);

  // Calculate totals for pie chart normalization
  const maxValue = Math.max(planned, actual);
  const totalForPie = maxValue + absVariance;
  const normalizedPlanned = totalForPie > 0 ? (planned / totalForPie) * 100 : 0;
  const normalizedActual = totalForPie > 0 ? (actual / totalForPie) * 100 : 0;
  const normalizedVariance = totalForPie > 0 ? (absVariance / totalForPie) * 100 : 0;

  const colorMap: Record<string, string> = {
    blue: "#3b82f6",
    green: "#10b981",
    orange: "#f59e0b",
    purple: "#a855f7",
    red: "#ef4444",
    yellow: "#eab308",
  };

  const phaseColor = colorMap[selectedProject.color] || "#6b7280";

  // Calculate overall progress for the tehsil
  const overallProgress = tehsilData.overall || 0;
  const rangeMeta =
    overallProgress < 25
      ? { label: "Low Progress", color: "#ef4444" }
      : overallProgress < 50
        ? { label: "Moderate Progress", color: "#f59e0b" }
        : overallProgress < 75
          ? { label: "Good Progress", color: "#3b82f6" }
          : overallProgress < 100
            ? { label: "High Progress", color: "#22c55e" }
            : { label: "Fully Completed", color: "#10b981" };

  return (
    <Layout title={`${selectedProject.title} - ${tehsilName} Tehsil`}>
      <div className="space-y-6">
        {/* Back Button */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => {
              // Navigate back to Dashboard with tehsil selected
              if (actualTehsilName) {
                // Use location state to pass tehsil info
                setLocation(`/?tehsil=${encodeURIComponent(actualTehsilName)}`);
              } else {
                setLocation('/');
              }
            }}
            className="rounded-xl cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {actualTehsilName || 'Tehsil'} Projects
          </Button>
          <div>
            <h2 className="text-2xl font-bold font-heading">{selectedProject.title}</h2>
            <p className="text-sm text-muted-foreground">{tehsilName} Tehsil - Project Details</p>
          </div>
        </div>

        {/* Project KPIs - Sub-projects of the selected project */}
        <div className="w-full">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-heading mb-1">Project KPIs</h2>
              <p className="text-sm text-muted-foreground">Sub-projects breakdown for {selectedProject.title}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {selectedMilestoneKey && (
                <button
                  type="button"
                  onClick={() => setSelectedMilestoneKey(null)}
                  className="h-9 px-4 rounded-xl border border-border/60 bg-background hover:bg-muted/40 text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
                >
                  Clear
                </button>
              )}
              {/* Progress Type Toggle - Always visible */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/20 bg-background shadow-sm hover:border-primary/40 transition-colors">
                <TrendingUp className={`h-4 w-4 ${progressType === "physical" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold ${progressType === "physical" ? "text-foreground" : "text-muted-foreground"}`}>
                  Physical
                </span>
                <button
                  type="button"
                  onClick={() => setProgressType(prev => prev === "physical" ? "financial" : "physical")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    progressType === "financial" ? "bg-primary" : "bg-muted"
                  }`}
                  aria-label="Toggle between Physical and Financial Progress"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      progressType === "financial" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <DollarSign className={`h-4 w-4 ${progressType === "financial" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold ${progressType === "financial" ? "text-foreground" : "text-muted-foreground"}`}>
                  Financial
                </span>
              </div>
            </div>
          </div>
          {(() => {
            // Get the appropriate sub-projects based on progress type
            const displaySubProjects = progressType === "financial" 
              ? (projectPhaseProgress.subProjects || []).map(sub => {
                  const financialActual = Math.min(100, sub.actualProgress * 0.92);
                  const variance = sub.actualProgress - sub.plannedProgress;
                  const financialVariance = variance * 0.85;
                  const financialPlanned = financialActual - financialVariance;
                  return {
                    ...sub,
                    name: sub.name.replace(/(Survey|Assessment|Collection|Measurements|Study|Documentation|Feasibility)/g, '$1 Budget'),
                    actualProgress: financialActual,
                    plannedProgress: Math.max(0, financialPlanned),
                  };
                })
              : subProjects;
            
            return displaySubProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {displaySubProjects.map((subProject) => {
                  const subProjectProgress = Math.round(subProject.actualProgress);
                  const isSelected = selectedMilestoneKey === subProject.id;
                
                return (
                  <InstallationCard
                      key={subProject.id}
                      title={subProject.name}
                      percentage={subProjectProgress}
                      icon={selectedProject.icon}
                      color={selectedProject.color}
                      actualProgress={subProject.actualProgress}
                      plannedProgress={subProject.plannedProgress}
                      selected={isSelected}
                    onClick={() => {
                        setSelectedMilestoneKey(prev => (prev === subProject.id ? null : subProject.id));
                    }}
                  />
                );
              })}
            </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">
                    No sub-projects found for {selectedProject.title}. Sub-projects will be generated automatically.
                  </p>
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {/* Charts Section - Always visible, updates based on selected KPI */}
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-heading mb-1">Project Charts</h2>
              <p className="text-sm text-muted-foreground">
                {selectedMilestoneKey 
                  ? `Gantt chart, WBS breakdown, and S-curves for ${installationPhases.find(p => p.key === selectedMilestoneKey)?.title || 'selected milestone'}`
                  : `Gantt chart, WBS breakdown, and S-curves for ${selectedProject.title}`
                }
              </p>
            </div>
          </div>

          {/* Get current phase data based on selection */}
          {(() => {
            // If a sub-project KPI is selected, show that sub-project's data
            // Otherwise, show the main project's data
            let currentPhase: PhaseProgress;
            let currentPhaseTitle: string;
            let currentPhaseColor: string;

            // Apply financial conversion if needed
            const basePhaseProgress = progressType === "financial" 
              ? convertToFinancialProgress(projectPhaseProgress)
              : projectPhaseProgress;

            if (selectedMilestoneKey && subProjects.length > 0) {
              // A sub-project KPI was selected
              const selectedSubProject = subProjects.find(sp => sp.id === selectedMilestoneKey);
              if (selectedSubProject) {
                // Convert milestones to sub-projects format for display in Gantt/WBS
                const milestoneSubProjects: SubProject[] = [];
                if (selectedSubProject.milestones && selectedSubProject.milestones.length > 0) {
                  const totalDuration = selectedSubProject.milestones.reduce((sum, m) => sum + (m.duration || 1), 0);
                  const now = new Date();
                  
                  selectedSubProject.milestones.forEach((milestone, index) => {
                    // Calculate progress for each milestone based on dates
                    let milestoneProgress = 0;
                    if (milestone.finishDate) {
                      const finishDate = new Date(milestone.finishDate);
                      if (finishDate <= now) {
                        milestoneProgress = 100;
                      } else if (milestone.startDate) {
                        const startDate = new Date(milestone.startDate);
                        if (startDate <= now && now < finishDate) {
                          const totalDays = (finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                          const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                          if (totalDays > 0) {
                            milestoneProgress = Math.min(100, (elapsedDays / totalDays) * 100);
                          }
                        }
                      }
                    }
                    
                    const weight = totalDuration > 0 ? (milestone.duration || 1) / totalDuration : 1 / selectedSubProject.milestones.length;
                    
                    milestoneSubProjects.push({
                      id: `${selectedSubProject.id}-${milestone.id}`,
                      name: `${milestone.id}: ${milestone.name}`, // Show Activity ID and Name
                      actualProgress: milestoneProgress,
                      plannedProgress: 75, // Default planned
                      weight: weight,
                      startDate: milestone.startDate,
                      finishDate: milestone.finishDate,
                      milestones: [] // Activities don't have sub-activities
                    });
                  });
                }
                
                // Get the selected sub-project from the appropriate source (physical or financial)
                const displaySubProjects = progressType === "financial" 
                  ? basePhaseProgress.subProjects || []
                  : subProjects;
                const selectedDisplaySubProject = displaySubProjects.find(sp => sp.id === selectedMilestoneKey) || selectedSubProject;
                
                // Use the sub-project's timeline (generate from parent timeline)
                const subProjectTimeline = basePhaseProgress.timeline?.map(t => ({
                  month: t.month,
                  actual: selectedDisplaySubProject.actualProgress * (t.actual / 100),
                  planned: selectedDisplaySubProject.plannedProgress * (t.planned / 100),
                })) || [];

                currentPhase = {
                  actual: selectedDisplaySubProject.actualProgress,
                  planned: selectedDisplaySubProject.plannedProgress,
                  subProjects: milestoneSubProjects, // Show milestones as sub-projects
                  timeline: subProjectTimeline,
                };
                currentPhaseTitle = selectedDisplaySubProject.name;
                currentPhaseColor = phaseColor;
              } else {
                // Fallback to main project
                currentPhase = basePhaseProgress;
                currentPhaseTitle = progressType === "financial" 
                  ? `${selectedProject.title} - Financial Progress`
                  : selectedProject.title;
                currentPhaseColor = phaseColor;
              }
            } else {
              // No sub-project selected, show main project data
              currentPhase = basePhaseProgress;
              currentPhaseTitle = progressType === "financial" 
                ? `${selectedProject.title} - Financial Progress`
                : selectedProject.title;
              currentPhaseColor = phaseColor;
            }

            if (!currentPhase || !currentPhase.timeline || currentPhase.timeline.length === 0) {
              return (
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle>{currentPhaseTitle} — Charts</CardTitle>
                    <CardDescription>
                      No timeline data found for this project yet. Timeline data is required to enable Gantt, WBS breakdown and S-curves.
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            }

            // For sub-project selection, we still show the main project's sub-projects in WBS
            // but filter the timeline to the selected sub-project
            const displayPhase = selectedMilestoneKey && subProjects.find(sp => sp.id === selectedMilestoneKey)
              ? {
                  ...currentPhase,
                  subProjects: basePhaseProgress.subProjects || [], // Keep all sub-projects for WBS view
                }
              : currentPhase;

            return (
              <MilestoneDetailsPanel
                milestoneTitle={currentPhaseTitle}
                phase={displayPhase}
                phaseColor={currentPhaseColor}
                onClear={selectedMilestoneKey ? () => setSelectedMilestoneKey(null) : undefined}
                showAllTabs={false}
              />
            );
          })()}
          </div>
      </div>
    </Layout>
  );
}

