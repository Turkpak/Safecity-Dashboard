import { Layout } from "@/components/layout/Layout";
import { InstallationCard } from "@/components/dashboard/InstallationCard";
import { InstallationMap } from "@/components/dashboard/InstallationMap";
import { PhaseDistributionChart } from "@/components/dashboard/PhaseDistributionChart";
import { PhaseTimelineChart } from "@/components/dashboard/PhaseTimelineChart";
import { PlannedVsActualChart } from "@/components/dashboard/PlannedVsActualChart";
import { HierarchyCard } from "@/components/dashboard/HierarchyCard";
import { SubProject } from "@/components/dashboard/SubProjectCard";
import { MilestoneDetailsPanel } from "@/components/dashboard/MilestoneDetailsPanel";
import { exportDashboardToPPTX } from "@/utils/exportToPPTX";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useWindowSize } from "@/hooks/use-window-size";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  getAllDivisions,
  getDistrictsByDivision,
  getTehsilsByDivisionAndDistrict,
  CITY_TO_HIERARCHY_MAP,
  PUNJAB_HIERARCHY
} from "@/data/punjabHierarchy";
import {
  getAllDivisionData,
  getAllDistrictData,
  getAllTehsilData,
  KNOWN_CITY_DATA,
  generateMockData,
  InstallationData
} from "@/data/punjabInstallationData";
import { getTehsilSubProjectsByPhase, getBahawalpurTehsilProjects, calculateProjectProgress, BahawalpurProject } from "@/data/bahawalpurProjectsData";
import {
  ClipboardCheck,
  Building2,
  Camera,
  Zap,
  Home,
  Radio,
  TrendingUp,
  FileDown,
  Filter,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  DollarSign
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo, useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";
import { CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

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

// Generate sub-projects for a phase - uses real Excel data for Bahawalpur, fallback for others
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
  timelineData?: { month: string;[key: string]: number | string }[],
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

  return {
    actual: currentValue,
    planned: plannedProgress,
    subProjects: generateSubProjects(phaseKey, currentValue, plannedProgress, division, district, tehsil),
    timeline: timeline.length > 0 ? timeline : undefined
  };
};

const CITY_INSTALLATION_DATA: Record<string, CityInstallationData> = {
  sheikhupura: {
    surveys: 100,
    foundations: 95,
    cabinet: 88,
    cable: 75,
    controlRoom: 60,
    ppic3: 45,
    overall: 77,
    timeline: [
      { month: "Jan", surveys: 50, foundations: 20, cabinet: 10, cable: 5, controlRoom: 0, ppic3: 0, overall: 14 },
      { month: "Feb", surveys: 75, foundations: 50, cabinet: 35, cable: 20, controlRoom: 10, ppic3: 5, overall: 33 },
      { month: "Mar", surveys: 90, foundations: 75, cabinet: 60, cable: 45, controlRoom: 30, ppic3: 15, overall: 53 },
      { month: "Apr", surveys: 100, foundations: 85, cabinet: 75, cable: 60, controlRoom: 45, ppic3: 30, overall: 66 },
      { month: "May", surveys: 100, foundations: 92, cabinet: 82, cable: 70, controlRoom: 55, ppic3: 40, overall: 73 },
      { month: "Jun", surveys: 100, foundations: 95, cabinet: 88, cable: 75, controlRoom: 60, ppic3: 45, overall: 77 },
    ]
  },
  sialkot: {
    surveys: 100,
    foundations: 92,
    cabinet: 85,
    cable: 70,
    controlRoom: 55,
    ppic3: 40,
    overall: 72,
    timeline: [
      { month: "Jan", surveys: 45, foundations: 15, cabinet: 8, cable: 3, controlRoom: 0, ppic3: 0, overall: 12 },
      { month: "Feb", surveys: 70, foundations: 45, cabinet: 30, cable: 18, controlRoom: 8, ppic3: 3, overall: 29 },
      { month: "Mar", surveys: 85, foundations: 70, cabinet: 55, cable: 40, controlRoom: 25, ppic3: 12, overall: 48 },
      { month: "Apr", surveys: 95, foundations: 82, cabinet: 70, cable: 55, controlRoom: 40, ppic3: 25, overall: 61 },
      { month: "May", surveys: 100, foundations: 88, cabinet: 78, cable: 65, controlRoom: 50, ppic3: 35, overall: 69 },
      { month: "Jun", surveys: 100, foundations: 92, cabinet: 85, cable: 70, controlRoom: 55, ppic3: 40, overall: 72 },
    ]
  },
  gujrat: {
    surveys: 100,
    foundations: 88,
    cabinet: 80,
    cable: 65,
    controlRoom: 50,
    ppic3: 35,
    overall: 68,
    timeline: [
      { month: "Jan", surveys: 40, foundations: 12, cabinet: 5, cable: 2, controlRoom: 0, ppic3: 0, overall: 10 },
      { month: "Feb", surveys: 65, foundations: 40, cabinet: 25, cable: 15, controlRoom: 5, ppic3: 2, overall: 26 },
      { month: "Mar", surveys: 80, foundations: 65, cabinet: 50, cable: 35, controlRoom: 20, ppic3: 10, overall: 43 },
      { month: "Apr", surveys: 90, foundations: 78, cabinet: 65, cable: 50, controlRoom: 35, ppic3: 20, overall: 56 },
      { month: "May", surveys: 100, foundations: 84, cabinet: 73, cable: 58, controlRoom: 45, ppic3: 28, overall: 65 },
      { month: "Jun", surveys: 100, foundations: 88, cabinet: 80, cable: 65, controlRoom: 50, ppic3: 35, overall: 68 },
    ]
  },
  jehlum: {
    surveys: 100,
    foundations: 85,
    cabinet: 75,
    cable: 60,
    controlRoom: 45,
    ppic3: 30,
    overall: 66,
    timeline: [
      { month: "Jan", surveys: 35, foundations: 10, cabinet: 3, cable: 1, controlRoom: 0, ppic3: 0, overall: 8 },
      { month: "Feb", surveys: 60, foundations: 35, cabinet: 20, cable: 12, controlRoom: 3, ppic3: 1, overall: 22 },
      { month: "Mar", surveys: 75, foundations: 60, cabinet: 45, cable: 30, controlRoom: 18, ppic3: 8, overall: 39 },
      { month: "Apr", surveys: 85, foundations: 72, cabinet: 60, cable: 45, controlRoom: 30, ppic3: 18, overall: 52 },
      { month: "May", surveys: 95, foundations: 80, cabinet: 68, cable: 55, controlRoom: 40, ppic3: 25, overall: 61 },
      { month: "Jun", surveys: 100, foundations: 85, cabinet: 75, cable: 60, controlRoom: 45, ppic3: 30, overall: 66 },
    ]
  },
  attock: {
    surveys: 100,
    foundations: 82,
    cabinet: 72,
    cable: 55,
    controlRoom: 40,
    ppic3: 25,
    overall: 62,
    timeline: [
      { month: "Jan", surveys: 30, foundations: 8, cabinet: 2, cable: 0, controlRoom: 0, ppic3: 0, overall: 7 },
      { month: "Feb", surveys: 55, foundations: 30, cabinet: 15, cable: 8, controlRoom: 2, ppic3: 0, overall: 18 },
      { month: "Mar", surveys: 70, foundations: 55, cabinet: 40, cable: 25, controlRoom: 15, ppic3: 5, overall: 35 },
      { month: "Apr", surveys: 80, foundations: 68, cabinet: 55, cable: 40, controlRoom: 28, ppic3: 15, overall: 48 },
      { month: "May", surveys: 90, foundations: 76, cabinet: 65, cable: 50, controlRoom: 35, ppic3: 20, overall: 56 },
      { month: "Jun", surveys: 100, foundations: 82, cabinet: 72, cable: 55, controlRoom: 40, ppic3: 25, overall: 62 },
    ]
  },
  hassanAbdal: {
    surveys: 100,
    foundations: 78,
    cabinet: 68,
    cable: 50,
    controlRoom: 35,
    ppic3: 20,
    overall: 59,
    timeline: [
      { month: "Jan", surveys: 25, foundations: 5, cabinet: 1, cable: 0, controlRoom: 0, ppic3: 0, overall: 5 },
      { month: "Feb", surveys: 50, foundations: 25, cabinet: 12, cable: 5, controlRoom: 1, ppic3: 0, overall: 15 },
      { month: "Mar", surveys: 65, foundations: 50, cabinet: 35, cable: 20, controlRoom: 12, ppic3: 3, overall: 29 },
      { month: "Apr", surveys: 75, foundations: 62, cabinet: 50, cable: 35, controlRoom: 25, ppic3: 10, overall: 43 },
      { month: "May", surveys: 85, foundations: 72, cabinet: 60, cable: 45, controlRoom: 30, ppic3: 15, overall: 51 },
      { month: "Jun", surveys: 100, foundations: 78, cabinet: 68, cable: 50, controlRoom: 35, ppic3: 20, overall: 59 },
    ]
  },
  sahiwal: {
    surveys: 100,
    foundations: 90,
    cabinet: 82,
    cable: 68,
    controlRoom: 52,
    ppic3: 38,
    overall: 72,
    timeline: [
      { month: "Jan", surveys: 48, foundations: 18, cabinet: 12, cable: 6, controlRoom: 2, ppic3: 0, overall: 16 },
      { month: "Feb", surveys: 72, foundations: 52, cabinet: 38, cable: 22, controlRoom: 12, ppic3: 5, overall: 33 },
      { month: "Mar", surveys: 88, foundations: 75, cabinet: 62, cable: 48, controlRoom: 32, ppic3: 18, overall: 55 },
      { month: "Apr", surveys: 95, foundations: 82, cabinet: 72, cable: 58, controlRoom: 42, ppic3: 28, overall: 63 },
      { month: "May", surveys: 100, foundations: 87, cabinet: 78, cable: 65, controlRoom: 48, ppic3: 34, overall: 69 },
      { month: "Jun", surveys: 100, foundations: 90, cabinet: 82, cable: 68, controlRoom: 52, ppic3: 38, overall: 72 },
    ]
  },
  okara: {
    surveys: 100,
    foundations: 87,
    cabinet: 78,
    cable: 62,
    controlRoom: 48,
    ppic3: 32,
    overall: 68,
    timeline: [
      { month: "Jan", surveys: 42, foundations: 15, cabinet: 8, cable: 4, controlRoom: 1, ppic3: 0, overall: 12 },
      { month: "Feb", surveys: 68, foundations: 48, cabinet: 32, cable: 18, controlRoom: 8, ppic3: 3, overall: 31 },
      { month: "Mar", surveys: 82, foundations: 68, cabinet: 55, cable: 42, controlRoom: 28, ppic3: 15, overall: 48 },
      { month: "Apr", surveys: 92, foundations: 78, cabinet: 68, cable: 55, controlRoom: 38, ppic3: 25, overall: 60 },
      { month: "May", surveys: 98, foundations: 84, cabinet: 74, cable: 60, controlRoom: 44, ppic3: 29, overall: 65 },
      { month: "Jun", surveys: 100, foundations: 87, cabinet: 78, cable: 62, controlRoom: 48, ppic3: 32, overall: 68 },
    ]
  },
  jhang: {
    surveys: 100,
    foundations: 83,
    cabinet: 70,
    cable: 58,
    controlRoom: 42,
    ppic3: 28,
    overall: 64,
    timeline: [
      { month: "Jan", surveys: 38, foundations: 12, cabinet: 6, cable: 3, controlRoom: 0, ppic3: 0, overall: 10 },
      { month: "Feb", surveys: 62, foundations: 42, cabinet: 28, cable: 15, controlRoom: 6, ppic3: 2, overall: 26 },
      { month: "Mar", surveys: 78, foundations: 62, cabinet: 48, cable: 35, controlRoom: 22, ppic3: 10, overall: 43 },
      { month: "Apr", surveys: 88, foundations: 72, cabinet: 60, cable: 48, controlRoom: 32, ppic3: 18, overall: 53 },
      { month: "May", surveys: 95, foundations: 78, cabinet: 65, cable: 55, controlRoom: 38, ppic3: 24, overall: 59 },
      { month: "Jun", surveys: 100, foundations: 83, cabinet: 70, cable: 58, controlRoom: 42, ppic3: 28, overall: 64 },
    ]
  },
  muzaffargarh: {
    surveys: 100,
    foundations: 80,
    cabinet: 65,
    cable: 52,
    controlRoom: 38,
    ppic3: 22,
    overall: 60,
    timeline: [
      { month: "Jan", surveys: 32, foundations: 8, cabinet: 3, cable: 1, controlRoom: 0, ppic3: 0, overall: 7 },
      { month: "Feb", surveys: 58, foundations: 38, cabinet: 22, cable: 12, controlRoom: 4, ppic3: 1, overall: 23 },
      { month: "Mar", surveys: 72, foundations: 58, cabinet: 42, cable: 28, controlRoom: 18, ppic3: 8, overall: 38 },
      { month: "Apr", surveys: 82, foundations: 68, cabinet: 55, cable: 42, controlRoom: 28, ppic3: 15, overall: 48 },
      { month: "May", surveys: 92, foundations: 75, cabinet: 60, cable: 48, controlRoom: 34, ppic3: 20, overall: 55 },
      { month: "Jun", surveys: 100, foundations: 80, cabinet: 65, cable: 52, controlRoom: 38, ppic3: 22, overall: 60 },
    ]
  },
};

const CITY_NAMES: Record<string, string> = {
  sheikhupura: "Sheikhupura",
  sialkot: "Sialkot",
  gujrat: "Gujrat",
  jehlum: "Jehlum",
  attock: "Attock",
  hassanAbdal: "Hassan Abdal",
  sahiwal: "Sahiwal",
  okara: "Okara",
  jhang: "Jhang",
  muzaffargarh: "Muzaffargarh",
};

// Color palette for cards
const CARD_COLORS = ["green", "blue", "orange", "purple", "indigo", "teal", "pink", "cyan", "amber", "red"];

type ProgressRangeMeta = {
  label: "Low Progress" | "Moderate Progress" | "Good Progress" | "High Progress" | "Fully Completed";
  color: string; // hex
  min: number;
  max: number;
};

const getProgressRangeMeta = (overall: number): ProgressRangeMeta => {
  if (overall >= 100) return { label: "Fully Completed", color: "#10b981", min: 100, max: 100 }; // emerald
  if (overall >= 75) return { label: "High Progress", color: "#22c55e", min: 75, max: 100 }; // green
  if (overall >= 50) return { label: "Good Progress", color: "#3b82f6", min: 50, max: 75 }; // blue
  if (overall >= 25) return { label: "Moderate Progress", color: "#f59e0b", min: 25, max: 50 }; // amber
  return { label: "Low Progress", color: "#ef4444", min: 0, max: 25 }; // red
};

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const [viewType, setViewType] = useState<"divisions" | "districts" | "tehsils" | "">("divisions");
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"division" | "district" | "tehsil" | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [expandedDivisions, setExpandedDivisions] = useState(false);
  const [expandedDistricts, setExpandedDistricts] = useState(false);
  const [expandedTehsilGroups, setExpandedTehsilGroups] = useState<Record<string, boolean>>({});
  const [tehsilSearchQuery, setTehsilSearchQuery] = useState("");
  const [allTehsilGroupsExpanded, setAllTehsilGroupsExpanded] = useState(false);
  const [isFilterBarExpanded, setIsFilterBarExpanded] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedMilestoneKey, setSelectedMilestoneKey] = useState<PhaseKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progressType, setProgressType] = useState<"physical" | "financial">("physical");
  const { theme, toggleTheme } = useTheme();
  const { width } = useWindowSize();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Check for tehsil parameter in URL (from ProjectDetail back navigation)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tehsilParam = urlParams.get('tehsil');
    if (tehsilParam) {
      const tehsilName = decodeURIComponent(tehsilParam);
      // Find the tehsil in hierarchy and select it
      for (const div of PUNJAB_HIERARCHY) {
        for (const dist of div.districts) {
          if (dist.tehsils.some(teh => teh.tehsil === tehsilName)) {
            setSelectedItemName(tehsilName);
            setSelectedItemType("tehsil");
            // Clean up URL parameter
            window.history.replaceState({}, '', '/');
            break;
          }
        }
      }
    }
  }, []); // Only run on mount

  // Simulate loading on initial mount and when view type changes
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // 800ms loading simulation
    return () => clearTimeout(timer);
  }, [viewType, selectedItemName, selectedItemType]);

  // Get available divisions - independent filter
  const divisions = useMemo(() => ["all", ...getAllDivisions()], []);

  // Get ALL districts from ALL divisions - independent filter
  const allDistricts = useMemo(() => {
    if (!PUNJAB_HIERARCHY || !Array.isArray(PUNJAB_HIERARCHY)) return [];
    const districtSet = new Set<string>();
    PUNJAB_HIERARCHY.forEach(div => {
      if (div?.districts) {
        div.districts.forEach(dist => {
          if (dist?.district) {
            districtSet.add(dist.district);
          }
        });
      }
    });
    return Array.from(districtSet).sort();
  }, []);

  // Get ALL tehsils from ALL divisions/districts - independent filter
  const allTehsils = useMemo(() => {
    if (!PUNJAB_HIERARCHY || !Array.isArray(PUNJAB_HIERARCHY)) return [];
    const tehsilSet = new Set<string>();
    PUNJAB_HIERARCHY.forEach(div => {
      if (div?.districts) {
        div.districts.forEach(dist => {
          if (dist?.tehsils) {
            dist.tehsils.forEach(teh => {
              if (teh?.tehsil) {
                tehsilSet.add(teh.tehsil);
              }
            });
          }
        });
      }
    });
    return Array.from(tehsilSet).sort();
  }, []);

  // Filter options - independent
  const districts = useMemo(() => ["all", ...allDistricts], [allDistricts]);
  const tehsils = useMemo(() => ["all", ...allTehsils], [allTehsils]);

  // Calculate aggregated data for all divisions/districts/tehsils
  const getAggregatedDataForView = (type: "divisions" | "districts" | "tehsils"): CityInstallationData => {
    let allItemsData: { surveys: number; foundations: number; cabinet: number; cable: number; controlRoom: number; ppic3: number; overall: number }[] = [];

    if (type === "divisions") {
      const divData = getAllDivisionData();
      allItemsData = Object.values(divData);
    } else if (type === "districts") {
      const distData = getAllDistrictData();
      allItemsData = Object.values(distData);
    } else if (type === "tehsils") {
      const tehData = getAllTehsilData();
      allItemsData = Object.values(tehData);
    }

    if (allItemsData.length === 0) {
      return {
        surveys: convertToPhaseProgress(0, "surveys"),
        foundations: convertToPhaseProgress(0, "foundations"),
        cabinet: convertToPhaseProgress(0, "cabinet"),
        cable: convertToPhaseProgress(0, "cable"),
        controlRoom: convertToPhaseProgress(0, "controlRoom"),
        ppic3: convertToPhaseProgress(0, "ppic3"),
        overall: 0,
        timeline: [],
      };
    }

    // Calculate averages
    const avgSurveys = Math.round(allItemsData.reduce((sum, d) => sum + d.surveys, 0) / allItemsData.length);
    const avgFoundations = Math.round(allItemsData.reduce((sum, d) => sum + d.foundations, 0) / allItemsData.length);
    const avgCabinet = Math.round(allItemsData.reduce((sum, d) => sum + d.cabinet, 0) / allItemsData.length);
    const avgCable = Math.round(allItemsData.reduce((sum, d) => sum + d.cable, 0) / allItemsData.length);
    const avgControlRoom = Math.round(allItemsData.reduce((sum, d) => sum + d.controlRoom, 0) / allItemsData.length);
    const avgPpic3 = Math.round(allItemsData.reduce((sum, d) => sum + d.ppic3, 0) / allItemsData.length);
    const avgOverall = Math.round(allItemsData.reduce((sum, d) => sum + d.overall, 0) / allItemsData.length);

    // Generate timeline data (6 months progression)
    const timeline = [
      { month: "Jan", surveys: Math.max(0, avgSurveys - 50), foundations: Math.max(0, avgFoundations - 75), cabinet: Math.max(0, avgCabinet - 73), cable: Math.max(0, avgCable - 70), controlRoom: Math.max(0, avgControlRoom - 60), ppic3: Math.max(0, avgPpic3 - 55), overall: Math.max(0, avgOverall - 60) },
      { month: "Feb", surveys: Math.max(0, avgSurveys - 30), foundations: Math.max(0, avgFoundations - 50), cabinet: Math.max(0, avgCabinet - 55), cable: Math.max(0, avgCable - 50), controlRoom: Math.max(0, avgControlRoom - 45), ppic3: Math.max(0, avgPpic3 - 40), overall: Math.max(0, avgOverall - 40) },
      { month: "Mar", surveys: Math.max(0, avgSurveys - 15), foundations: Math.max(0, avgFoundations - 30), cabinet: Math.max(0, avgCabinet - 35), cable: Math.max(0, avgCable - 30), controlRoom: Math.max(0, avgControlRoom - 25), ppic3: Math.max(0, avgPpic3 - 20), overall: Math.max(0, avgOverall - 20) },
      { month: "Apr", surveys: Math.max(0, avgSurveys - 8), foundations: Math.max(0, avgFoundations - 15), cabinet: Math.max(0, avgCabinet - 20), cable: Math.max(0, avgCable - 15), controlRoom: Math.max(0, avgControlRoom - 12), ppic3: Math.max(0, avgPpic3 - 10), overall: Math.max(0, avgOverall - 10) },
      { month: "May", surveys: Math.max(0, avgSurveys - 3), foundations: Math.max(0, avgFoundations - 8), cabinet: Math.max(0, avgCabinet - 10), cable: Math.max(0, avgCable - 8), controlRoom: Math.max(0, avgControlRoom - 5), ppic3: Math.max(0, avgPpic3 - 3), overall: Math.max(0, avgOverall - 3) },
      { month: "Jun", surveys: avgSurveys, foundations: avgFoundations, cabinet: avgCabinet, cable: avgCable, controlRoom: avgControlRoom, ppic3: avgPpic3, overall: avgOverall },
    ];

    return {
      surveys: convertToPhaseProgress(avgSurveys, "surveys", timeline),
      foundations: convertToPhaseProgress(avgFoundations, "foundations", timeline),
      cabinet: convertToPhaseProgress(avgCabinet, "cabinet", timeline),
      cable: convertToPhaseProgress(avgCable, "cable", timeline),
      controlRoom: convertToPhaseProgress(avgControlRoom, "controlRoom", timeline),
      ppic3: convertToPhaseProgress(avgPpic3, "ppic3", timeline),
      overall: avgOverall,
      timeline,
    };
  };

  // Get single item data function
  const getSingleItemData = (itemName: string, itemType: "division" | "district" | "tehsil"): CityInstallationData | null => {
    try {
      let itemData: InstallationData | undefined;

      if (itemType === "division") {
        const divData = getAllDivisionData();
        const key = itemName.toLowerCase().replace(/\s+/g, '');
        itemData = divData[key];
      } else if (itemType === "district") {
        const distData = getAllDistrictData();
        // Find the district key (format: division-district)
        const foundKey = Object.keys(distData).find(key => {
          const parts = key.split('-');
          return parts.length >= 2 && parts.slice(1).join('-') === itemName.toLowerCase().replace(/\s+/g, '');
        });
        if (foundKey) {
          itemData = distData[foundKey];
        }
      } else if (itemType === "tehsil") {
        const tehData = getAllTehsilData();
        // Find the tehsil key (format: division-district-tehsil)
        const foundKey = Object.keys(tehData).find(key => {
          const parts = key.split('-');
          return parts.length >= 3 && parts.slice(2).join('-') === itemName.toLowerCase().replace(/\s+/g, '');
        });
        if (foundKey) {
          itemData = tehData[foundKey];
        }
      }

      if (!itemData) return null;

      // Extract division, district, and tehsil from the key for context
      let division: string | undefined;
      let district: string | undefined;
      let tehsil: string | undefined;

      if (itemType === "tehsil") {
        const tehData = getAllTehsilData();
        const foundKey = Object.keys(tehData).find(key => {
          const parts = key.split('-');
          return parts.length >= 3 && parts.slice(2).join('-') === itemName.toLowerCase().replace(/\s+/g, '');
        });
        if (foundKey) {
          const parts = foundKey.split('-');
          if (parts.length >= 3) {
            division = parts[0];
            district = parts[1];
            tehsil = parts.slice(2).join('-');
            // Find the actual tehsil name from hierarchy
            const div = PUNJAB_HIERARCHY.find(d => d.division.toLowerCase().replace(/\s+/g, '') === division);
            if (div) {
              const dist = div.districts.find(d => d.district.toLowerCase().replace(/\s+/g, '') === district);
              if (dist) {
                const teh = dist.tehsils.find(t => t.tehsil.toLowerCase().replace(/\s+/g, '') === tehsil);
                if (teh) {
                  division = div.division;
                  district = dist.district;
                  tehsil = teh.tehsil;
                }
              }
            }
          }
        }
      } else if (itemType === "district") {
        const distData = getAllDistrictData();
        const foundKey = Object.keys(distData).find(key => {
          const parts = key.split('-');
          return parts.length >= 2 && parts.slice(1).join('-') === itemName.toLowerCase().replace(/\s+/g, '');
        });
        if (foundKey) {
          const parts = foundKey.split('-');
          if (parts.length >= 2) {
            division = parts[0];
            district = parts.slice(1).join('-');
            const div = PUNJAB_HIERARCHY.find(d => d.division.toLowerCase().replace(/\s+/g, '') === division);
            if (div) {
              const dist = div.districts.find(d => d.district.toLowerCase().replace(/\s+/g, '') === district);
              if (dist) {
                division = div.division;
                district = dist.district;
              }
            }
          }
        }
      } else if (itemType === "division") {
        division = PUNJAB_HIERARCHY.find(d => d.division.toLowerCase().replace(/\s+/g, '') === itemName.toLowerCase().replace(/\s+/g, ''))?.division;
      }

      // Generate timeline data (6 months progression)
      const timeline = [
        { month: "Jan", surveys: Math.max(0, itemData.surveys - 50), foundations: Math.max(0, itemData.foundations - 75), cabinet: Math.max(0, itemData.cabinet - 73), cable: Math.max(0, itemData.cable - 70), controlRoom: Math.max(0, itemData.controlRoom - 60), ppic3: Math.max(0, itemData.ppic3 - 55), overall: Math.max(0, itemData.overall - 60) },
        { month: "Feb", surveys: Math.max(0, itemData.surveys - 30), foundations: Math.max(0, itemData.foundations - 50), cabinet: Math.max(0, itemData.cabinet - 55), cable: Math.max(0, itemData.cable - 50), controlRoom: Math.max(0, itemData.controlRoom - 45), ppic3: Math.max(0, itemData.ppic3 - 40), overall: Math.max(0, itemData.overall - 40) },
        { month: "Mar", surveys: Math.max(0, itemData.surveys - 15), foundations: Math.max(0, itemData.foundations - 30), cabinet: Math.max(0, itemData.cabinet - 35), cable: Math.max(0, itemData.cable - 30), controlRoom: Math.max(0, itemData.controlRoom - 25), ppic3: Math.max(0, itemData.ppic3 - 20), overall: Math.max(0, itemData.overall - 20) },
        { month: "Apr", surveys: Math.max(0, itemData.surveys - 8), foundations: Math.max(0, itemData.foundations - 15), cabinet: Math.max(0, itemData.cabinet - 20), cable: Math.max(0, itemData.cable - 15), controlRoom: Math.max(0, itemData.controlRoom - 12), ppic3: Math.max(0, itemData.ppic3 - 10), overall: Math.max(0, itemData.overall - 10) },
        { month: "May", surveys: Math.max(0, itemData.surveys - 3), foundations: Math.max(0, itemData.foundations - 8), cabinet: Math.max(0, itemData.cabinet - 10), cable: Math.max(0, itemData.cable - 8), controlRoom: Math.max(0, itemData.controlRoom - 5), ppic3: Math.max(0, itemData.ppic3 - 3), overall: Math.max(0, itemData.overall - 3) },
        { month: "Jun", surveys: itemData.surveys, foundations: itemData.foundations, cabinet: itemData.cabinet, cable: itemData.cable, controlRoom: itemData.controlRoom, ppic3: itemData.ppic3, overall: itemData.overall },
      ];

      return {
        surveys: convertToPhaseProgress(itemData.surveys, "surveys", timeline, division, district, tehsil),
        foundations: convertToPhaseProgress(itemData.foundations, "foundations", timeline, division, district, tehsil),
        cabinet: convertToPhaseProgress(itemData.cabinet, "cabinet", timeline, division, district, tehsil),
        cable: convertToPhaseProgress(itemData.cable, "cable", timeline, division, district, tehsil),
        controlRoom: convertToPhaseProgress(itemData.controlRoom, "controlRoom", timeline, division, district, tehsil),
        ppic3: convertToPhaseProgress(itemData.ppic3, "ppic3", timeline, division, district, tehsil),
        overall: itemData.overall,
        timeline,
      };
    } catch (error) {
      console.error('Error getting single item data:', error);
      return null;
    }
  };

  // Get single item data
  const singleItemData = useMemo(() => {
    if (selectedItemName && selectedItemType) {
      return getSingleItemData(selectedItemName, selectedItemType);
    }
    return null;
  }, [selectedItemName, selectedItemType]);

  // Get aggregated data based on view type
  const aggregatedData = useMemo(() => {
    if (viewType === "divisions") {
      return getAggregatedDataForView("divisions");
    } else if (viewType === "districts") {
      return getAggregatedDataForView("districts");
    } else if (viewType === "tehsils") {
      return getAggregatedDataForView("tehsils");
    }
    return null;
  }, [viewType]);

  // Context theme: follow the currently visible/selected area overall %
  const contextOverall = useMemo(() => {
    if (selectedItemName && singleItemData) return singleItemData.overall ?? 0;
    return aggregatedData?.overall ?? 0;
  }, [selectedItemName, singleItemData, aggregatedData]);

  const contextTheme = useMemo(() => {
    const meta = getProgressRangeMeta(contextOverall);
    return {
      meta,
      // hex with alpha (CSS supports #RRGGBBAA)
      accent: meta.color,
      // stronger tint/border so the theme is clearly visible
      accentSoft: `${meta.color}33`, // ~20% alpha
      accentBorder: `${meta.color}80`, // ~50% alpha
      accentGlow: `${meta.color}4D`, // ~30% alpha (for shadows)
    };
  }, [contextOverall]);

  // Get all divisions data for cards view - sorted by overall progress (descending)
  const divisionsData = useMemo(() => {
    try {
      const divData = getAllDivisionData();
      const divisions = getAllDivisions();
      if (!divisions || !Array.isArray(divisions)) return [];
      const data = divisions.map((div, index) => {
        const key = div.toLowerCase().replace(/\s+/g, '');
        return {
          name: div,
          overall: divData[key]?.overall || 0,
          data: divData[key],
          color: CARD_COLORS[index % CARD_COLORS.length]
        };
      });
      // Sort by overall progress (descending) - higher progress first
      return data.sort((a, b) => b.overall - a.overall);
    } catch (error) {
      console.error('Error loading divisions data:', error);
      return [];
    }
  }, []);

  // Get ALL districts data for cards view (from all divisions) - sorted by overall progress (descending)
  const districtsData = useMemo(() => {
    try {
      if (!PUNJAB_HIERARCHY || !Array.isArray(PUNJAB_HIERARCHY)) return [];
      const distData = getAllDistrictData();
      // Get all unique districts with their data
      const districtMap = new Map<string, { overall: number; data: any; color: string }>();

      PUNJAB_HIERARCHY.forEach((div, divIndex) => {
        if (div?.districts) {
          div.districts.forEach((dist, distIndex) => {
            if (dist?.district && !districtMap.has(dist.district)) {
              // Try to find data for this district (may exist in multiple divisions)
              const possibleKeys = PUNJAB_HIERARCHY
                .filter(d => d?.districts?.some(dd => dd?.district === dist.district))
                .map(d => `${d.division}-${dist.district}`.toLowerCase().replace(/\s+/g, ''));

              let overall = 0;
              for (const key of possibleKeys) {
                if (distData[key]) {
                  overall = distData[key].overall;
                  break;
                }
              }

              districtMap.set(dist.district, {
                overall: overall || Math.floor(Math.random() * 40) + 40, // Fallback
                data: distData[possibleKeys[0]] || null,
                color: CARD_COLORS[(divIndex + distIndex) % CARD_COLORS.length]
              });
            }
          });
        }
      });

      const data = Array.from(districtMap.entries()).map(([name, info], index) => ({
        name,
        overall: info.overall,
        data: info.data,
        color: info.color
      }));
      // Sort by overall progress (descending) - higher progress first
      return data.sort((a, b) => b.overall - a.overall);
    } catch (error) {
      console.error('Error loading districts data:', error);
      return [];
    }
  }, []);

  // Get ALL tehsils data grouped by district - sorted by overall progress (descending)
  const tehsilsDataByDistrict = useMemo(() => {
    try {
      if (!PUNJAB_HIERARCHY || !Array.isArray(PUNJAB_HIERARCHY)) return {};
      const tehData = getAllTehsilData();
      const districtMap = new Map<string, Array<{ name: string; overall: number; data: any; color: string }>>();

      PUNJAB_HIERARCHY.forEach((div, divIndex) => {
        if (div?.districts) {
          div.districts.forEach((dist, distIndex) => {
            if (dist?.district && dist?.tehsils) {
              const districtName = dist.district;
              if (!districtMap.has(districtName)) {
                districtMap.set(districtName, []);
              }

              dist.tehsils.forEach((teh, tehIndex) => {
                if (teh?.tehsil) {
                  const possibleKeys = PUNJAB_HIERARCHY
                    .flatMap(d => d?.districts
                      ?.filter(dd => dd?.district === districtName && dd?.tehsils?.some(tt => tt?.tehsil === teh.tehsil))
                      .map(dd => `${d.division}-${dd.district}-${teh.tehsil}`.toLowerCase().replace(/\s+/g, '')) || []
                    );

                  let overall = 0;
                  for (const key of possibleKeys) {
                    if (tehData[key]) {
                      overall = tehData[key].overall;
                      break;
                    }
                  }

                  const tehsilList = districtMap.get(districtName)!;
                  // Check if tehsil already exists (might be in multiple divisions)
                  if (!tehsilList.find(t => t.name === teh.tehsil)) {
                    tehsilList.push({
                      name: teh.tehsil,
                      overall: overall || Math.floor(Math.random() * 40) + 40, // Fallback
                      data: tehData[possibleKeys[0]] || null,
                      color: CARD_COLORS[(divIndex + distIndex + tehIndex) % CARD_COLORS.length]
                    });
                  }
                }
              });
            }
          });
        }
      });

      // Sort tehsils within each district by overall progress (descending)
      const result: Record<string, Array<{ name: string; overall: number; data: any; color: string }>> = {};
      districtMap.forEach((tehsils, district) => {
        result[district] = tehsils.sort((a, b) => b.overall - a.overall);
      });

      // Sort districts by their highest tehsil progress (descending)
      const sortedDistricts = Object.keys(result).sort((a, b) => {
        const maxA = Math.max(...result[a].map(t => t.overall));
        const maxB = Math.max(...result[b].map(t => t.overall));
        return maxB - maxA;
      });

      const sortedResult: Record<string, Array<{ name: string; overall: number; data: any; color: string }>> = {};
      sortedDistricts.forEach(district => {
        sortedResult[district] = result[district];
      });

      return sortedResult;
    } catch (error) {
      console.error('Error loading tehsils data:', error);
      return {};
    }
  }, []);

  // Skeleton loader component
  const renderSkeletonLoader = () => (
    <div className="space-y-6">
      {/* Installation Phase Cards Skeleton */}
      <div className="w-full">
        <div className="mb-3">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-24 mb-3" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-2 w-full rounded-full" />
            </Card>
          ))}
        </div>
      </div>

      {/* Overall Progress Card Skeleton */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>
          <div className="text-center md:text-right">
            <Skeleton className="h-16 w-24 mb-2" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </div>
        <div className="mt-6">
          <Skeleton className="h-5 w-full rounded-full mb-3" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </Card>

      {/* Pie Charts Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64 mb-6" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Phase Distribution Chart Skeleton (drilldown only) */}
      {selectedItemName && selectedItemType ? (
        <Card className="p-6">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </Card>
      ) : null}
    </div>
  );

  // Convert physical progress to financial progress
  const convertToFinancialProgress = (physicalPhase: PhaseProgress): PhaseProgress => {
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
        name: sub.name.replace(/(Survey|Assessment|Collection|Measurements|Study|Documentation|Feasibility|Installation|Laying|Renovations|Go Live)/g, '$1 Budget'),
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

  // Render aggregated charts function
  const renderAggregatedCharts = (title: string, data: CityInstallationData) => {
    const isAggregatedView = title.startsWith("All Punjab");

    // Calculate overall planned and actual from all phases
    let totalPlanned = 0;
    let totalActual = 0;
    let phaseCount = 0;

    installationPhases.forEach((phase) => {
      const progress = data[phase.key];
      if (hasDetailedProgress(progress)) {
        totalPlanned += progress.planned;
        totalActual += progress.actual;
        phaseCount++;
      } else {
        // If no detailed progress, use the number value as both planned and actual
        const value = getProgressValue(progress);
        totalPlanned += value;
        totalActual += value;
        phaseCount++;
      }
    });

    const avgPlanned = phaseCount > 0 ? totalPlanned / phaseCount : 0;
    const avgActual = phaseCount > 0 ? totalActual / phaseCount : 0;
    const variance = avgActual - avgPlanned;
    const absVariance = Math.abs(variance);

    // Calculate financial/budget metrics (different from installation progress)
    // Financial metrics are calculated based on overall progress with budget considerations
    const overallProgress = data.overall || 0;
    // Budget allocated is typically higher than progress (includes buffer)
    const financialPlanned = Math.min(100, overallProgress + 8 + (Math.abs(overallProgress - 70) * 0.1));
    // Budget spent is typically slightly lower than allocated
    const financialActual = Math.max(0, overallProgress - 3 - (Math.abs(overallProgress - 70) * 0.05));
    const financialVariance = financialActual - financialPlanned;
    const absFinancialVariance = Math.abs(financialVariance);

    // Calculate totals for pie chart normalization (installation progress)
    const maxValue = Math.max(avgPlanned, avgActual);
    const totalForPie = maxValue + absVariance;

    // Normalize values for installation progress pie chart
    const normalizedPlanned = totalForPie > 0 ? (avgPlanned / totalForPie) * 100 : 0;
    const normalizedActual = totalForPie > 0 ? (avgActual / totalForPie) * 100 : 0;
    const normalizedVariance = totalForPie > 0 ? (absVariance / totalForPie) * 100 : 0;

    // Calculate totals for financial pie chart normalization
    const maxFinancialValue = Math.max(financialPlanned, financialActual);
    const totalForFinancialPie = maxFinancialValue + absFinancialVariance;

    // Normalize values for financial progress pie chart
    const normalizedFinancialPlanned = totalForFinancialPie > 0 ? (financialPlanned / totalForFinancialPie) * 100 : 0;
    const normalizedFinancialActual = totalForFinancialPie > 0 ? (financialActual / totalForFinancialPie) * 100 : 0;
    const normalizedFinancialVariance = totalForFinancialPie > 0 ? (absFinancialVariance / totalForFinancialPie) * 100 : 0;

    // Selected milestone (if any) for this current view
    const selectedPhaseMeta = selectedMilestoneKey
      ? installationPhases.find(p => p.key === selectedMilestoneKey)
      : null;
    const selectedProgress = selectedMilestoneKey ? data[selectedMilestoneKey] : null;

    const colorMap: Record<string, string> = {
      blue: "#3b82f6",
      green: "#10b981",
      orange: "#f59e0b",
      purple: "#a855f7",
      red: "#ef4444",
      yellow: "#eab308",
    };

    return (
      <>
        {/* Installation Phase Cards */}
        <div className="w-full">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold font-heading mb-1">Best Performing Projects</h2>
              <p className="text-sm text-muted-foreground">Progress breakdown for {title}</p>
            </div>
            {selectedMilestoneKey && (
              <button
                type="button"
                onClick={() => setSelectedMilestoneKey(null)}
                className="h-9 px-4 rounded-xl border border-border/60 bg-background hover:bg-muted/40 text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {installationPhases.map((phase) => {
              const progress = data[phase.key];
              const progressValue = getProgressValue(progress);
              const hasDetails = hasDetailedProgress(progress);

              return (
                <InstallationCard
                  key={`${title}-${phase.key}`}
                  title={phase.title}
                  percentage={progressValue}
                  icon={phase.icon}
                  color={phase.color}
                  actualProgress={hasDetails ? progress.actual : undefined}
                  plannedProgress={hasDetails ? progress.planned : undefined}
                  selected={selectedMilestoneKey === phase.key}
                  onClick={() => {
                    setSelectedMilestoneKey(prev => (prev === phase.key ? null : phase.key));
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Financial Progress Pie Charts (hide when a milestone KPI is selected) */}
        {!selectedMilestoneKey && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Financial Progress Pie Chart */}
            <Card className="border-2 transition-colors hover:border-[#101a3c]">
              <CardHeader>
                <CardTitle>Financial Progress Overview</CardTitle>
                
              </CardHeader>
              <CardContent>
                {/* Always-visible values (avoid pie labels getting clipped) */}
                <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                    <span className="text-muted-foreground">Planned:</span>
                    <span className="font-semibold">{financialPlanned.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
                    <span className="text-muted-foreground">Actual:</span>
                    <span className="font-semibold">{financialActual.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: financialVariance < 0 ? "#f59e0b" : "#ef4444" }}
                    />
                    <span className="text-muted-foreground">Variance:</span>
                    <span className="font-semibold">{absFinancialVariance.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full" style={{ height: isMobile ? '280px' : isTablet ? '320px' : '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie
                        data={[
                          {
                            name: 'Planned',
                            value: normalizedFinancialPlanned,
                            originalValue: financialPlanned,
                            color: '#3b82f6'
                          },
                          {
                            name: 'Actual',
                            value: normalizedFinancialActual,
                            originalValue: financialActual,
                            color: '#10b981'
                          },
                          {
                            name: 'Variance',
                            value: normalizedFinancialVariance,
                            originalValue: absFinancialVariance,
                            color: financialVariance < 0 ? '#f59e0b' : '#ef4444'
                          }
                        ]}
                        cx="50%"
                        cy="44%"
                        innerRadius={isMobile ? 38 : isTablet ? 48 : 60}
                        labelLine={false}
                        // Avoid rendering long labels around the pie (they get clipped on smaller widths)
                        label={false}
                        outerRadius={isMobile ? 72 : isTablet ? 92 : 120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Planned', value: normalizedFinancialPlanned, originalValue: financialPlanned, color: '#3b82f6' },
                          { name: 'Actual', value: normalizedFinancialActual, originalValue: financialActual, color: '#10b981' },
                          { name: 'Variance', value: normalizedFinancialVariance, originalValue: absFinancialVariance, color: financialVariance < 0 ? '#f59e0b' : '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: isMobile ? '11px' : '12px'
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const originalValue = props.payload?.originalValue ?? value;
                          return [`${originalValue.toFixed(1)}%`, name];
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        layout="horizontal"
                        wrapperStyle={{ paddingTop: isMobile ? "10px" : "14px", fontSize: isMobile ? '11px' : '12px' }}
                        formatter={(value) => {
                          let itemValue = 0;
                          if (value === 'Planned') itemValue = financialPlanned;
                          else if (value === 'Actual') itemValue = financialActual;
                          else if (value === 'Variance') itemValue = absFinancialVariance;
                          return `${value}: ${itemValue.toFixed(1)}%`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Overall Progress Pie Chart */}
            <Card className="border-2 transition-colors hover:border-[#101a3c]">
              <CardHeader>
                <CardTitle>Overall Progress</CardTitle>
                
              </CardHeader>
              <CardContent>
                {/* Always-visible values (avoid pie labels getting clipped) */}
                <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
                    <span className="text-muted-foreground">Planned:</span>
                    <span className="font-semibold">{avgPlanned.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#10b981" }} />
                    <span className="text-muted-foreground">Actual:</span>
                    <span className="font-semibold">{avgActual.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: variance < 0 ? "#f59e0b" : "#ef4444" }}
                    />
                    <span className="text-muted-foreground">Variance:</span>
                    <span className="font-semibold">{absVariance.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full" style={{ height: isMobile ? '280px' : isTablet ? '320px' : '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie
                        data={[
                          {
                            name: 'Planned',
                            value: normalizedPlanned,
                            originalValue: avgPlanned,
                            color: '#3b82f6'
                          },
                          {
                            name: 'Actual',
                            value: normalizedActual,
                            originalValue: avgActual,
                            color: '#10b981'
                          },
                          {
                            name: 'Variance',
                            value: normalizedVariance,
                            originalValue: absVariance,
                            color: variance < 0 ? '#f59e0b' : '#ef4444'
                          }
                        ]}
                        cx="50%"
                        cy="44%"
                        innerRadius={isMobile ? 38 : isTablet ? 48 : 60}
                        labelLine={false}
                        // Avoid rendering long labels around the pie (they get clipped on smaller widths)
                        label={false}
                        outerRadius={isMobile ? 72 : isTablet ? 92 : 120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: 'Planned', value: normalizedPlanned, originalValue: avgPlanned, color: '#3b82f6' },
                          { name: 'Actual', value: normalizedActual, originalValue: avgActual, color: '#10b981' },
                          { name: 'Variance', value: normalizedVariance, originalValue: absVariance, color: variance < 0 ? '#f59e0b' : '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: isMobile ? '11px' : '12px'
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const originalValue = props.payload?.originalValue ?? value;
                          return [`${originalValue.toFixed(1)}%`, name];
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        layout="horizontal"
                        wrapperStyle={{ paddingTop: isMobile ? "10px" : "14px", fontSize: isMobile ? '11px' : '12px' }}
                        formatter={(value) => {
                          let itemValue = 0;
                          if (value === 'Planned') itemValue = avgPlanned;
                          else if (value === 'Actual') itemValue = avgActual;
                          else if (value === 'Variance') itemValue = absVariance;
                          return `${value}: ${itemValue.toFixed(1)}%`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}


        {/* Milestone details should appear beneath Overall Progress (and replace the old charts when selected) */}
        {selectedMilestoneKey && selectedPhaseMeta && selectedProgress && hasDetailedProgress(selectedProgress) && (
          <div className="space-y-4">
            {/* Header with Toggle - Right side where charts are shown */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-heading mb-1">
                  {progressType === "financial" 
                    ? `${selectedPhaseMeta.title} - Financial Progress`
                    : `${selectedPhaseMeta.title} - Milestone KPIs`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {progressType === "financial"
                    ? "Financial progress charts and analysis"
                    : "Gantt chart, WBS breakdown, and S-curves"}
                </p>
              </div>
              {/* Progress Type Toggle - Right side */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/20 bg-background shadow-sm hover:border-primary/40 transition-colors flex-shrink-0">
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
            <MilestoneDetailsPanel
              milestoneTitle={progressType === "financial" 
                ? `${selectedPhaseMeta.title} - Financial Progress`
                : selectedPhaseMeta.title}
              phase={progressType === "financial" 
                ? convertToFinancialProgress({
                    actual: selectedProgress.actual,
                    planned: selectedProgress.planned,
                    subProjects: selectedProgress.subProjects,
                    timeline: selectedProgress.timeline,
                  })
                : {
                    actual: selectedProgress.actual,
                    planned: selectedProgress.planned,
                    subProjects: selectedProgress.subProjects,
                    timeline: selectedProgress.timeline,
                  }}
              phaseColor={colorMap[selectedPhaseMeta.color] || "#6b7280"}
              onClear={() => setSelectedMilestoneKey(null)}
            />
          </div>
        )}

        {/* Charts Grid (drilldown only; hide in All Divisions/Districts/Tehsils views) */}
        {!selectedMilestoneKey && !isAggregatedView && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold font-heading mb-1">Analytics & Insights</h2>
              <p className="text-sm text-muted-foreground">Detailed progress analysis for {title}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              {/* (Removed) Installation Progress Timeline + Phase Breakdown charts */}
            </div>

            {/* Phase Distribution Pie Chart */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-12">
                <PhaseDistributionChart
                  data={installationPhases.map(phase => ({
                    phase: phase.title,
                    percentage: getProgressValue(data[phase.key]),
                  }))}
                />
              </div>
            </div>

            {/* Planned vs Actual Charts for Each Phase - Only show when specific item is selected (not aggregated view) */}
            {title.startsWith("All Punjab") ? null : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold font-heading mb-2">Planned vs Actual Progress</h3>
                  <p className="text-sm text-muted-foreground">Compare actual progress against planned milestones for each project phase</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {installationPhases.map((phase) => {
                    const progress = data[phase.key];
                    if (!hasDetailedProgress(progress) || !progress.timeline) return null;

                    const colorMap: Record<string, string> = {
                      blue: "#3b82f6",
                      green: "#10b981",
                      orange: "#f59e0b",
                      purple: "#a855f7",
                      red: "#ef4444",
                      yellow: "#eab308",
                    };

                    return (
                      <PlannedVsActualChart
                        key={`planned-actual-${phase.key}`}
                        phaseName={phase.title}
                        timelineData={progress.timeline}
                        color={colorMap[phase.color] || "#6b7280"}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Phase Timeline Chart */}
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-12">
                <PhaseTimelineChart
                  timelineData={data.timeline}
                  cityKey={title}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
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

  return (
    <Layout title="PSCA Progress Dashboard">
      <div
        className="flex flex-col gap-4"
        style={{
          // Page-level theme variables (used by chart cards, headers, etc.)
          ["--progress-accent" as any]: contextTheme.accent,
          ["--progress-accent-soft" as any]: contextTheme.accentSoft,
          ["--progress-accent-border" as any]: contextTheme.accentBorder,
          ["--progress-accent-glow" as any]: contextTheme.accentGlow,
        }}
      >
        {/* Top Header Section - Enhanced Design with Filter Bar */}
        <div
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border shadow-lg"
          style={{
            borderColor: "var(--progress-accent-border)",
            boxShadow: `0 16px 40px var(--progress-accent-glow)`,
          }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]"></div>
          {/* soft tint overlay so the page feels \"on track\" based on context */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: [
                // stronger radial tint
                `radial-gradient(900px circle at 18% 22%, var(--progress-accent-soft), transparent 55%)`,
                // subtle top-to-bottom wash
                `linear-gradient(180deg, var(--progress-accent-soft), transparent 55%)`,
              ].join(", "),
            }}
          />

          {/* Filter Bar Section - Radio Buttons */}
          <div className={`relative transition-all duration-300 ${isFilterBarExpanded ? 'border-b border-border/30 pb-3 px-3 sm:px-6 pt-3 sm:pt-4' : 'pb-2 px-3 sm:px-4 pt-2 sm:pt-3'
            }`}>
            <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap flex-1 min-w-0">
                {/* Filters Label / Toggle */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">View:</span>
                </div>

                {/* Radio Button Group with Animation */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ width: 0, opacity: 0, x: -20 }}
                      animate={{ width: "auto", opacity: 1, x: 0 }}
                      exit={{ width: 0, opacity: 0, x: -20 }}
                      transition={{ duration: 0.4, ease: "circOut" }}
                      className="overflow-hidden flex items-center min-w-0"
                    >
                      <RadioGroup
                        value={viewType}
                        onValueChange={(value) => {
                          setViewType(value as "divisions" | "districts" | "tehsils" | "");
                          setSelectedItemName(null);
                          setSelectedItemType(null);
                          setExpandedDivisions(false);
                          setExpandedDistricts(false);
                          // Initialize default districts (Lahore and Sheikhupura) when switching to tehsils view
                          if (value === "tehsils") {
                            const DEFAULT_DISTRICTS = ['Lahore', 'Sheikhupura'];
                            const defaultState: Record<string, boolean> = {};
                            DEFAULT_DISTRICTS.forEach(districtName => {
                              defaultState[districtName] = true;
                            });
                            setExpandedTehsilGroups(defaultState);
                            setAllTehsilGroupsExpanded(false);
                          } else {
                            setExpandedTehsilGroups({});
                            setAllTehsilGroupsExpanded(false);
                          }
                          setTehsilSearchQuery("");
                        }}
                        className="flex items-center gap-2 sm:gap-4 md:gap-6 whitespace-nowrap pl-1 sm:pl-2 flex-wrap"
                      >
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <RadioGroupItem value="divisions" id="divisions" className="h-4 w-4 sm:h-5 sm:w-5" />
                          <Label htmlFor="divisions" className="text-xs sm:text-sm font-medium text-foreground cursor-pointer">
                            <span className="hidden sm:inline">All Divisions</span>
                            <span className="sm:hidden">Divisions</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <RadioGroupItem value="districts" id="districts" className="h-4 w-4 sm:h-5 sm:w-5" />
                          <Label htmlFor="districts" className="text-xs sm:text-sm font-medium text-foreground cursor-pointer">
                            <span className="hidden sm:inline">All Districts</span>
                            <span className="sm:hidden">Districts</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          <RadioGroupItem value="tehsils" id="tehsils" className="h-4 w-4 sm:h-5 sm:w-5" />
                          <Label htmlFor="tehsils" className="text-xs sm:text-sm font-medium text-foreground cursor-pointer">
                            <span className="hidden sm:inline">All Tehsils</span>
                            <span className="sm:hidden">Tehsils</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Expand/Collapse Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsFilterBarExpanded(!isFilterBarExpanded)}
                className="rounded-xl w-9 h-9 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm flex-shrink-0"
                title={isFilterBarExpanded ? "Collapse" : "Expand"}
              >
                {isFilterBarExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Header Content Section - Collapsible */}
          <div className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 ease-in-out overflow-hidden ${isFilterBarExpanded ? 'max-h-[500px] opacity-100 p-4 md:p-6' : 'max-h-0 opacity-0 p-0'
            }`}>
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold font-heading bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {selectedItemName && selectedItemType === "division"
                      ? `${selectedItemName} Division`
                      : selectedItemName && selectedItemType === "district"
                        ? `${selectedItemName} District`
                        : selectedItemName && selectedItemType === "tehsil"
                          ? `${selectedItemName} Tehsil`
                          : viewType === "divisions"
                            ? "All Punjab Divisions"
                            : viewType === "districts"
                              ? "All Punjab Districts"
                              : viewType === "tehsils"
                                ? "All Punjab Tehsils"
                                : "PSCA Progress Dashboard"}
                  </h1>
                </div>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-32 rounded-full" />
                </div>
              ) : (selectedItemName && singleItemData) || aggregatedData ? (() => {
                const overall = selectedItemName && singleItemData ? singleItemData.overall : aggregatedData?.overall || 0;
                const meta = getProgressRangeMeta(overall);
                
                // Map color to Tailwind classes
                const getBadgeClasses = (color: string) => {
                  if (color === "#ef4444") { // red - Low
                    return "px-4 py-1.5 text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors";
                  } else if (color === "#f59e0b") { // orange/amber - Moderate
                    return "px-4 py-1.5 text-sm font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors";
                  } else if (color === "#3b82f6") { // blue - Good
                    return "px-4 py-1.5 text-sm font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors";
                  } else if (color === "#22c55e" || color === "#10b981") { // green/emerald - High/Fully Completed
                    return "px-4 py-1.5 text-sm font-semibold bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors";
                  }
                  return "px-4 py-1.5 text-sm font-semibold bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors";
                };
                
                const getIconClasses = (color: string) => {
                  if (color === "#ef4444") return "h-3.5 w-3.5 mr-1.5 text-red-600 dark:text-red-400";
                  else if (color === "#f59e0b") return "h-3.5 w-3.5 mr-1.5 text-amber-600 dark:text-amber-400";
                  else if (color === "#3b82f6") return "h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400";
                  else if (color === "#22c55e" || color === "#10b981") return "h-3.5 w-3.5 mr-1.5 text-green-600 dark:text-green-400";
                  return "h-3.5 w-3.5 mr-1.5 text-red-600 dark:text-red-400";
                };
                
                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Badge className={getBadgeClasses(meta.color)}>
                        <TrendingUp className={getIconClasses(meta.color)} />
                        Overall: {overall}%
                      </Badge>
                    </div>
                  {/* Legend for progress ranges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {[
                      { label: "0–25% Low", color: "#ef4444" },
                      { label: "25–50% Moderate", color: "#f59e0b" },
                      { label: "50–75% Good", color: "#3b82f6" },
                      { label: "75–100% High", color: "#22c55e" },
                    ].map((it) => (
                      <div key={it.label} className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: it.color }} />
                        <span>{it.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })() : null}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {((selectedItemName && singleItemData) || aggregatedData) && viewType && (
                <Button
                  className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm font-semibold"
                  onClick={async () => {
                    try {
                      const dataToExport = selectedItemName && singleItemData ? singleItemData : aggregatedData;
                      const exportName = selectedItemName && selectedItemType === "division"
                        ? `${selectedItemName} Division`
                        : selectedItemName && selectedItemType === "district"
                          ? `${selectedItemName} District`
                          : selectedItemName && selectedItemType === "tehsil"
                            ? `${selectedItemName} Tehsil`
                            : viewType === "divisions"
                              ? "All Punjab Divisions"
                              : viewType === "districts"
                                ? "All Punjab Districts"
                                : "All Punjab Tehsils";

                      if (!dataToExport) {
                        setShowErrorDialog(true);
                        return;
                      }

                      // Pass the full data structure including PhaseProgress objects with timeline
                      await exportDashboardToPPTX({
                        cityName: exportName,
                        cityData: dataToExport as any, // Type assertion needed due to PhaseProgress union type
                        installationPhases: installationPhases.map(phase => ({
                          key: phase.key,
                          title: phase.title,
                          percentage: getProgressValue(dataToExport[phase.key]),
                        })),
                      });
                      setShowSuccessDialog(true);
                    } catch (error) {
                      console.error('Error exporting to PPTX:', error);
                      setShowErrorDialog(true);
                    }
                  }}
                >
                  <FileDown className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export Operation pptx</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Division Selected - Show Districts */}
        {selectedItemName && selectedItemType === "division" && (
          isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : singleItemData ? (() => {
            const districts = getDistrictsByDivision(selectedItemName);
            const distData = getAllDistrictData();

            // Get districts data for this division
            const divisionDistrictsData = districts.map((districtName, index) => {
              const key = `${selectedItemName}-${districtName}`.toLowerCase().replace(/\s+/g, '');
              const districtData = distData[key];
              return {
                name: districtName,
                overall: districtData?.overall || 0,
                data: districtData,
                color: CARD_COLORS[index % CARD_COLORS.length]
              };
            }).sort((a, b) => b.overall - a.overall);

            return (
              <div className="space-y-6">
                {/* Back Button */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedItemName(null);
                      setSelectedItemType(null);
                    }}
                    className="rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to All Divisions
                  </Button>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold font-heading">Districts in {selectedItemName} Division</h2>
                    <p className="text-sm text-muted-foreground">{selectedItemName} Division</p>
                  </div>
                </div>

                {/* District Cards */}
                {divisionDistrictsData.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {divisionDistrictsData.map((dist) => (
                        <HierarchyCard
                          key={dist.name}
                          title={dist.name}
                          overallProgress={dist.overall}
                          color={dist.color}
                          onClick={() => {
                            setSelectedItemName(dist.name);
                            setSelectedItemType("district");
                          }}
                        />
                      ))}
                    </div>

                    {/* Charts for Division */}
                    {renderAggregatedCharts(selectedItemName + " Division", singleItemData)}
                  </>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        No districts found for {selectedItemName} Division.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })() : null
        )}

        {/* District Selected - Show Tehsils */}
        {selectedItemName && selectedItemType === "district" && (
          isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : singleItemData ? (() => {
            // Find which division this district belongs to
            const division = PUNJAB_HIERARCHY.find(div =>
              div.districts.some(dist => dist.district === selectedItemName)
            );

            if (!division) {
              return (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedItemName(null);
                        setSelectedItemType(null);
                      }}
                      className="rounded-xl cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Divisions
                    </Button>
                  </div>
                  <Card className="border-border/50">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        District not found in hierarchy.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            }

            const district = division.districts.find(dist => dist.district === selectedItemName);
            const tehsils = district?.tehsils || [];
            const tehData = getAllTehsilData();

            // Get tehsils data for this district
            const districtTehsilsData = tehsils.map((tehsil, index) => {
              const key = `${division.division}-${selectedItemName}-${tehsil.tehsil}`.toLowerCase().replace(/\s+/g, '');
              const tehsilData = tehData[key];
              return {
                name: tehsil.tehsil,
                overall: tehsilData?.overall || 0,
                data: tehsilData,
                color: CARD_COLORS[index % CARD_COLORS.length]
              };
            }).sort((a, b) => b.overall - a.overall);

            return (
              <div className="space-y-6">
                {/* Back Button */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Go back to division view
                      setSelectedItemName(division.division);
                      setSelectedItemType("division");
                    }}
                    className="rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to {division.division} Division
                  </Button>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold font-heading">Tehsils in {selectedItemName} District ({division.division} Division)</h2>
                    <p className="text-sm text-muted-foreground">{selectedItemName} District</p>
                  </div>
                </div>

                {/* Tehsil Cards */}
                {districtTehsilsData.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {districtTehsilsData.map((teh) => (
                        <HierarchyCard
                          key={teh.name}
                          title={teh.name}
                          overallProgress={teh.overall}
                          color={teh.color}
                          onClick={() => {
                            setSelectedItemName(teh.name);
                            setSelectedItemType("tehsil");
                          }}
                        />
                      ))}
                    </div>

                    {/* Charts for District */}
                    {renderAggregatedCharts(selectedItemName + " District", singleItemData)}
                  </>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        No tehsils found for {selectedItemName} District.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })() : null
        )}

        {/* Tehsil Selected - Show Detail View */}
        {selectedItemName && selectedItemType === "tehsil" && (
          isLoading ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-32" />
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : singleItemData ? (() => {
            // Find which division and district this tehsil belongs to
            let parentDivision = "";
            let parentDistrict = "";

            for (const div of PUNJAB_HIERARCHY) {
              for (const dist of div.districts) {
                if (dist.tehsils.some(teh => teh.tehsil === selectedItemName)) {
                  parentDivision = div.division;
                  parentDistrict = dist.district;
                  break;
                }
              }
              if (parentDivision) break;
            }

            return (
              <div className="space-y-6">
                {/* Back Button */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Go back to district view
                      setSelectedItemName(parentDistrict);
                      setSelectedItemType("district");
                    }}
                    className="rounded-xl cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to {parentDistrict} District
                  </Button>
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold font-heading">Ongoing projects in {selectedItemName} Tehsil</h2>
                    <p className="text-sm text-muted-foreground">{selectedItemName} Tehsil</p>
                  </div>
                </div>

                {/* Project Cards - Show real projects for Bahawalpur, installation phases for others */}
                <div className="w-full">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold font-heading mb-1">
                      {parentDivision === 'Bahawalpur' ? 'Projects' : 'Ongoing Projects'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {parentDivision === 'Bahawalpur'
                        ? 'Select a project to view sub-projects and activities'
                        : 'Select a project to view detailed KPIs and charts'}
                    </p>
                  </div>
                  {parentDivision === 'Bahawalpur' ? (
                    // Show real projects from JSON for Bahawalpur tehsils
                    (() => {
                      const projects = getBahawalpurTehsilProjects(parentDistrict, selectedItemName);
                      const tehsilSlug = selectedItemName?.toLowerCase().replace(/\s+/g, '') || '';

                      if (projects.length === 0) {
                        return (
                          <Card className="border-border/50">
                            <CardContent className="p-8 text-center">
                              <p className="text-muted-foreground">No projects found for {selectedItemName} Tehsil.</p>
                            </CardContent>
                          </Card>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {projects.map((project: BahawalpurProject) => {
                            const projectProgress = calculateProjectProgress(project);

                            return (
                              <HierarchyCard
                                key={project.id}
                                title={project.name}
                                overallProgress={Math.round(projectProgress.overall)}
                                onClick={() => {
                                  // Navigate to project detail page
                                  setLocation(`/project/${tehsilSlug}/${project.id}`);
                                }}
                                color={CARD_COLORS[projects.indexOf(project) % CARD_COLORS.length]}
                              />
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    // Show installation phases for non-Bahawalpur tehsils
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {installationPhases.map((phase) => {
                        const progress = singleItemData[phase.key];
                        const progressValue = getProgressValue(progress);

                        // Format tehsil name for URL (remove spaces, lowercase)
                        const tehsilSlug = selectedItemName?.toLowerCase().replace(/\s+/g, '') || '';

                        return (
                          <HierarchyCard
                            key={phase.key}
                            title={phase.title}
                            overallProgress={Math.round(progressValue)}
                            onClick={() => {
                              setLocation(`/project/${tehsilSlug}/${phase.key}`);
                            }}
                            color={phase.color}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })() : null
        )}

        {/* Hierarchy Cards View with Charts */}
        {!selectedItemName && viewType === "divisions" && (
          isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : aggregatedData ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading mb-1">All Punjab Divisions</h2>

                </div>

                {/* Show More/Less Button */}
                {divisionsData.length > 4 && (
                  <Button
                    variant="outline"
                    onClick={() => setExpandedDivisions(!expandedDivisions)}
                    className="rounded-xl h-9 whitespace-nowrap text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                    style={{ backgroundColor: '#101a3c' }}
                  >
                    {expandedDivisions ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2 text-white" />
                        Show Less ({divisionsData.length - 4} hidden)
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2 text-white" />
                        Show More ({divisionsData.length - 4} more)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Division Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(expandedDivisions ? divisionsData : divisionsData.slice(0, 4)).map((div) => (
                  <HierarchyCard
                    key={div.name}
                    title={div.name}
                    overallProgress={div.overall}
                    color={div.color}
                    onClick={() => {
                      setSelectedItemName(div.name);
                      setSelectedItemType("division");
                    }}
                  />
                ))}
              </div>

              {/* Aggregated Charts Section - Same as detail view */}
              {renderAggregatedCharts("All Punjab Divisions", aggregatedData)}
            </div>
          ) : null
        )}

        {!selectedItemName && viewType === "districts" && (
          isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-3" />
                    <Skeleton className="h-10 w-20 mb-2" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : aggregatedData ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-heading mb-1">All Punjab Districts</h2>

                </div>

                {/* Show More/Less Button */}
                {districtsData.length > 4 && (
                  <Button
                    variant="outline"
                    onClick={() => setExpandedDistricts(!expandedDistricts)}
                    className="rounded-xl h-9 whitespace-nowrap text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                    style={{ backgroundColor: '#101a3c' }}
                  >
                    {expandedDistricts ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2 text-white" />
                        Show Less ({districtsData.length - 4} hidden)
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2 text-white" />
                        Show More ({districtsData.length - 4} more)
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* District Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(expandedDistricts ? districtsData : districtsData.slice(0, 4)).map((dist) => (
                  <HierarchyCard
                    key={dist.name}
                    title={dist.name}
                    overallProgress={dist.overall}
                    color={dist.color}
                    onClick={() => {
                      setSelectedItemName(dist.name);
                      setSelectedItemType("district");
                    }}
                  />
                ))}
              </div>

              {/* Aggregated Charts Section */}
              {renderAggregatedCharts("All Punjab Districts", aggregatedData)}
            </div>
          ) : null
        )}

        {!selectedItemName && viewType === "tehsils" && (
          isLoading ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <Skeleton className="h-7 w-48 mb-2" />
                  <Skeleton className="h-4 w-80" />
                </div>
              </div>
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <Card key={j} className="p-4">
                          <Skeleton className="h-5 w-24 mb-3" />
                          <Skeleton className="h-8 w-16 mb-2" />
                          <Skeleton className="h-2 w-full rounded-full" />
                        </Card>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
              {renderSkeletonLoader()}
            </div>
          ) : aggregatedData ? (() => {
            // Default districts to show: Lahore and Sheikhupura
            const DEFAULT_DISTRICTS = ['Lahore', 'Sheikhupura'];

            // Filter districts based on search query first
            const allDistricts = Object.entries(tehsilsDataByDistrict).filter(([districtName]) => {
              if (!tehsilSearchQuery.trim()) return true;
              return districtName.toLowerCase().includes(tehsilSearchQuery.toLowerCase());
            });

            // Filter districts to show: by default only Lahore and Sheikhupura, unless all are expanded
            const filteredDistricts = allDistricts.filter(([districtName]) => {
              // If search query exists, show all matching districts
              if (tehsilSearchQuery.trim()) return true;
              // If all expanded, show all districts
              if (allTehsilGroupsExpanded) return true;
              // Otherwise, show only default districts
              return DEFAULT_DISTRICTS.includes(districtName);
            });


            // Toggle all groups expand/collapse
            const handleToggleAllGroups = () => {
              const newState = !allTehsilGroupsExpanded;
              setAllTehsilGroupsExpanded(newState);

              if (newState) {
                // Expand All: show all districts and expand them
                const allExpandedGroups: Record<string, boolean> = {};
                allDistricts.forEach(([districtName]) => {
                  allExpandedGroups[districtName] = true;
                });
                setExpandedTehsilGroups(allExpandedGroups);
              } else {
                // Collapse All: collapse to only show default districts
                const defaultState: Record<string, boolean> = {};
                DEFAULT_DISTRICTS.forEach(districtName => {
                  if (tehsilsDataByDistrict[districtName]) {
                    defaultState[districtName] = true;
                  }
                });
                setExpandedTehsilGroups(defaultState);
              }
            };

            return (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold font-heading mb-1">All Punjab Tehsils</h2>
                    <p className="text-sm text-muted-foreground">Tehsils grouped by district, sorted by progress</p>
                  </div>

                  {/* Search and Expand/Collapse Controls */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 sm:min-w-[250px]">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by district name..."
                        value={tehsilSearchQuery}
                        onChange={(e) => setTehsilSearchQuery(e.target.value)}
                        className="pl-9 h-9 rounded-xl border-border/50 bg-background"
                      />
                    </div>

                    {/* Expand/Collapse All Button */}
                    {filteredDistricts.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={handleToggleAllGroups}
                        className="rounded-xl h-9 whitespace-nowrap text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                        style={{ backgroundColor: '#101a3c' }}
                      >
                        {allTehsilGroupsExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2 text-white" />
                            Collapse All
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2 text-white" />
                            Expand All
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tehsil Cards Grouped by District */}
                {filteredDistricts.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        No districts found matching "{tehsilSearchQuery}". Please try a different search term.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {filteredDistricts.map(([districtName, tehsils]: [string, Array<{ name: string; overall: number; data: any; color: string }>]) => {
                      const isExpanded = expandedTehsilGroups[districtName] ?? false;
                      const visibleTehsils = isExpanded ? tehsils : tehsils.slice(0, 4);
                      const hasMore = tehsils.length > 4;

                      return (
                        <div key={districtName} className="space-y-4">
                          {/* District Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <div>
                              <h3 className="text-lg font-bold font-heading">{districtName} District</h3>
                              <p className="text-sm text-muted-foreground">
                                {tehsils.length} tehsil{tehsils.length !== 1 ? 's' : ''} •
                                Max Progress: {Math.max(...tehsils.map(t => t.overall))}%
                              </p>
                            </div>
                          </div>

                          {/* Tehsil Cards for this District */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {visibleTehsils.map((teh) => (
                              <HierarchyCard
                                key={teh.name}
                                title={teh.name}
                                overallProgress={teh.overall}
                                color={teh.color}
                                onClick={() => {
                                  setSelectedItemName(teh.name);
                                  setSelectedItemType("tehsil");
                                }}
                              />
                            ))}
                          </div>

                          {/* Expand/Collapse Button for this District */}
                          {hasMore && (
                            <div className="flex justify-center">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setExpandedTehsilGroups(prev => {
                                    const newState = !isExpanded;
                                    // Update allTehsilGroupsExpanded based on whether all groups are expanded
                                    const updated = { ...prev, [districtName]: newState };
                                    const allExpanded = filteredDistricts.every(([name]) => updated[name] ?? false);
                                    setAllTehsilGroupsExpanded(allExpanded);
                                    return updated;
                                  });
                                }}
                                className="rounded-xl text-white border-[#101a3c] hover:border-[#101a3c] cursor-pointer"
                                style={{ backgroundColor: '#101a3c' }}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-2 text-white" />
                                    Show Less ({tehsils.length - 4} hidden)
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-2 text-white" />
                                    Show More ({tehsils.length - 4} more)
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Aggregated Charts Section */}
                {renderAggregatedCharts("All Punjab Tehsils", aggregatedData)}
              </div>
            );
          })() : null
        )}

      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 mb-2">
              <img
                src="/Assets/psca logo.png"
                alt="PSCA Logo"
                className="h-16 w-16 object-contain"
              />
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <DialogTitle className="text-xl font-bold">Export Successful!</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-center pt-2">
              PowerPoint presentation exported successfully!
              <br />
              <br />
              The PPTX file includes all KPIs with proper icons and all charts based on your current filter selection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessDialog(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 mb-2">
              <img
                src="/Assets/psca logo.png"
                alt="PSCA Logo"
                className="h-16 w-16 object-contain"
              />
              <DialogTitle className="text-xl font-bold">Export Error</DialogTitle>
            </div>
            <DialogDescription className="text-center pt-2">
              {!viewType
                ? "Please select a view type (All Divisions, All Districts, or All Tehsils) to export the presentation."
                : "Error exporting presentation. Please try again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowErrorDialog(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

