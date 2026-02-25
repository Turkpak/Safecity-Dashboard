import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, TrendingDown, LucideBanknote, Wallet, AlertCircle, CheckCircle2, Filter } from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { useWindowSize } from "@/hooks/use-window-size";
import { cn } from "@/lib/utils";
import {
  getAllDivisions,
  getDistrictsByDivision,
  getTehsilsByDivisionAndDistrict,
  PUNJAB_HIERARCHY
} from "@/data/punjabHierarchy";

// Format PKR currency (Finance page: show in Millions instead of Crore)
const formatPKR = (amount: number) => {
  if (amount >= 1_000_000) {
    return `PKR ${(amount / 1_000_000).toFixed(2)} M`;
  } else if (amount >= 1_000) {
    return `PKR ${(amount / 1_000).toFixed(2)} K`;
  } else {
    return `PKR ${amount.toLocaleString()}`;
  }
};

// Generate deterministic hash from string
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Generate mock finance data based on filter selection
const generateFinanceData = (
  division: string,
  district: string,
  tehsil: string
): {
  budgetData: Array<{ month: string; planned: number; actual: number; variance: number }>;
  expenseData: Array<{ department: string; planned: number; actual: number; color: string }>;
  kpiData: {
    totalBudget: number;
    ytdUtilization: number;
    variance: number;
    remaining: number;
  };
} => {
  // Create a seed based on the filter selection
  const filterKey = `${division}-${district}-${tehsil}`;
  const seed = hashString(filterKey);

  // Generate base multiplier based on hierarchy level
  let baseMultiplier = 1;
  if (division !== "all") {
    baseMultiplier = 0.8 + (seed % 100) / 500; // 0.8 to 1.0
    if (district !== "all") {
      baseMultiplier = 0.5 + (seed % 100) / 400; // 0.5 to 0.75
      if (tehsil !== "all") {
        baseMultiplier = 0.2 + (seed % 100) / 500; // 0.2 to 0.4
      }
    }
  }

  // Generate monthly budget data
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const budgetData = months.map((month, index) => {
    const monthSeed = hashString(`${filterKey}-${month}`);
    const planned = Math.floor((800000000 + (monthSeed % 500000000)) * baseMultiplier);
    const variancePercent = -10 + ((monthSeed % 200) / 10); // -10% to +10%
    const actual = Math.floor(planned * (1 + variancePercent / 100));
    const variance = actual - planned;

    return {
      month,
      planned,
      actual,
      variance,
    };
  });

  // Generate department expense data
  const departments = [
    { name: "Infrastructure", color: "#3b82f6" },
    { name: "Personnel", color: "#10b981" },
    { name: "Maintenance", color: "#f59e0b" },
    { name: "Software Licenses", color: "#a855f7" },
  ];

  const expenseData = departments.map((dept, index) => {
    const deptSeed = hashString(`${filterKey}-${dept.name}`);
    const planned = Math.floor((200000000 + (deptSeed % 1500000000)) * baseMultiplier);
    const variancePercent = -15 + ((deptSeed % 300) / 10); // -15% to +15%
    const actual = Math.floor(planned * (1 + variancePercent / 100));

    return {
      department: dept.name,
      planned,
      actual,
      color: dept.color,
    };
  });

  // Calculate KPIs
  const totalPlanned = budgetData.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = budgetData.reduce((sum, item) => sum + item.actual, 0);
  const variance = totalActual - totalPlanned;
  const remaining = totalPlanned - totalActual;
  const ytdUtilization = totalActual;

  return {
    budgetData,
    expenseData,
    kpiData: {
      totalBudget: totalPlanned,
      ytdUtilization,
      variance,
      remaining,
    },
  };
};

export default function Finance() {
  const { width } = useWindowSize();
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedTehsil, setSelectedTehsil] = useState<string>("all");

  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  // Get available divisions
  const divisions = useMemo(() => ["all", ...getAllDivisions()], []);

  // Get available districts based on selected division
  const districts = useMemo(() => {
    if (selectedDivision === "all") return ["all"];
    return ["all", ...getDistrictsByDivision(selectedDivision)];
  }, [selectedDivision]);

  // Get available tehsils based on selected division and district
  const tehsils = useMemo(() => {
    if (selectedDivision === "all" || selectedDistrict === "all") return ["all"];
    return ["all", ...getTehsilsByDivisionAndDistrict(selectedDivision, selectedDistrict)];
  }, [selectedDivision, selectedDistrict]);

  // Generate finance data based on filters
  const financeData = useMemo(() => {
    return generateFinanceData(selectedDivision, selectedDistrict, selectedTehsil);
  }, [selectedDivision, selectedDistrict, selectedTehsil]);

  const { budgetData, expenseData, kpiData } = financeData;

  // Calculate utilization rate
  const totalPlanned = budgetData.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = budgetData.reduce((sum, item) => sum + item.actual, 0);
  const utilizationRate = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

  // Reset dependent filters when parent filter changes
  const handleDivisionChange = (value: string) => {
    setSelectedDivision(value);
    setSelectedDistrict("all");
    setSelectedTehsil("all");
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setSelectedTehsil("all");
  };

  // Get display name for current selection
  const getLocationName = () => {
    if (selectedDivision === "all") return "All Punjab";
    if (selectedDistrict === "all") return selectedDivision;
    if (selectedTehsil === "all") return `${selectedDistrict}, ${selectedDivision}`;
    return `${selectedTehsil}, ${selectedDistrict}`;
  };

  const kpiDataWithIcons = {
    totalBudget: { value: kpiData.totalBudget, label: "Total Budget Allocated", icon: Wallet, trend: 2.5 },
    ytdUtilization: { value: kpiData.ytdUtilization, label: "YTD Utilization", icon: LucideBanknote, trend: utilizationRate },
    variance: { value: kpiData.variance, label: "Projected Variance", icon: AlertCircle, trend: -1.2 },
    remaining: { value: kpiData.remaining, label: "Remaining Budget", icon: CheckCircle2, trend: (kpiData.remaining / kpiData.totalBudget) * 100 },
  };

  const kpiCardVariants = {
    totalBudget: {
      accent: "border-l-blue-500",
      bg: "bg-gradient-to-br from-card via-card to-blue-50/40 dark:to-blue-950/20",
      blob: "bg-blue-500/10",
      iconWrap: "bg-blue-50 dark:bg-blue-950/40",
      icon: "text-blue-700 dark:text-blue-300",
      value: "text-blue-900 dark:text-blue-100",
      trend: "text-emerald-600 dark:text-emerald-400",
    },
    ytdUtilization: {
      accent: "border-l-emerald-500",
      bg: "bg-gradient-to-br from-card via-card to-emerald-50/40 dark:to-emerald-950/20",
      blob: "bg-emerald-500/10",
      iconWrap: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-900 dark:text-emerald-100",
      trend: "text-emerald-600 dark:text-emerald-400",
    },
    remaining: {
      accent: "border-l-violet-500",
      bg: "bg-gradient-to-br from-card via-card to-violet-50/40 dark:to-violet-950/20",
      blob: "bg-violet-500/10",
      iconWrap: "bg-violet-50 dark:bg-violet-950/40",
      icon: "text-violet-700 dark:text-violet-300",
      value: "text-violet-900 dark:text-violet-100",
      trend: "text-rose-600 dark:text-rose-400",
    },
    varianceGood: {
      accent: "border-l-emerald-500",
      bg: "bg-gradient-to-br from-card via-card to-emerald-50/40 dark:to-emerald-950/20",
      blob: "bg-emerald-500/10",
      iconWrap: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: "text-emerald-700 dark:text-emerald-300",
      value: "text-emerald-600 dark:text-emerald-400",
      trend: "text-emerald-600 dark:text-emerald-400",
    },
    varianceBad: {
      accent: "border-l-rose-500",
      bg: "bg-gradient-to-br from-card via-card to-rose-50/40 dark:to-rose-950/20",
      blob: "bg-rose-500/10",
      iconWrap: "bg-rose-50 dark:bg-rose-950/40",
      icon: "text-rose-700 dark:text-rose-300",
      value: "text-rose-600 dark:text-rose-400",
      trend: "text-rose-600 dark:text-rose-400",
    },
  } as const;

  const getKpiVariant = (key: string, value: number) => {
    if (key === "variance") return value < 0 ? kpiCardVariants.varianceGood : kpiCardVariants.varianceBad;
    if (key === "totalBudget") return kpiCardVariants.totalBudget;
    if (key === "ytdUtilization") return kpiCardVariants.ytdUtilization;
    return kpiCardVariants.remaining;
  };

  return (
    <Layout title="Financial & Budget Analytics">
      <div className="flex flex-col gap-6">
        {/* Filter Bar Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {/* Filters Label */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Filters:</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1">
              {/* Division Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:flex-shrink-0">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Division:</label>
                <Select value={selectedDivision} onValueChange={handleDivisionChange}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9 border-border/50 bg-background rounded-md">
                    <SelectValue placeholder="All Divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {getAllDivisions().map(div => (
                      <SelectItem key={div} value={div}>{div}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* District Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:flex-shrink-0">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">District:</label>
                <Select
                  value={selectedDistrict}
                  onValueChange={handleDistrictChange}
                  disabled={selectedDivision === "all"}
                >
                  <SelectTrigger
                    className={`w-full sm:w-[160px] h-9 border-border/50 bg-background rounded-md ${selectedDivision === "all" ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    disabled={selectedDivision === "all"}
                  >
                    <SelectValue placeholder="All Districts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {selectedDivision !== "all" && getDistrictsByDivision(selectedDivision).map(dist => (
                      <SelectItem key={dist} value={dist}>{dist}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tehsil Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:flex-shrink-0">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground whitespace-nowrap">Tehsil:</label>
                <Select
                  value={selectedTehsil}
                  onValueChange={setSelectedTehsil}
                  disabled={selectedDivision === "all" || selectedDistrict === "all"}
                >
                  <SelectTrigger
                    className={`w-full sm:w-[160px] h-9 border-border/50 bg-background rounded-md ${selectedDivision === "all" || selectedDistrict === "all" ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    disabled={selectedDivision === "all" || selectedDistrict === "all"}
                  >
                    <SelectValue placeholder="All Tehsils" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tehsils</SelectItem>
                    {selectedDivision !== "all" && selectedDistrict !== "all" &&
                      getTehsilsByDivisionAndDistrict(selectedDivision, selectedDistrict).map(teh => (
                        <SelectItem key={teh} value={teh}>{teh}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters Button */}
              {(selectedDivision !== "all" || selectedDistrict !== "all" || selectedTehsil !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedDivision("all");
                    setSelectedDistrict("all");
                    setSelectedTehsil("all");
                  }}
                  className="h-9 px-3 text-xs font-medium w-full sm:w-auto mt-2 sm:mt-0 color-white backgroundcolor-darkblue"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>



        {/* KPI Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Object.entries(kpiDataWithIcons).map(([key, kpi]) => {
            const Icon = kpi.icon;
            const isPositive = kpi.trend >= 0;
            const isVariance = key === 'variance';
            const variant = getKpiVariant(key, kpi.value);

            return (
              <Card
                key={key}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-lg",
                  "border-l-4",
                  variant.accent,
                  variant.bg
                )}
              >
                <div className={cn("absolute top-0 right-0 h-28 w-28 rounded-full blur-2xl -mr-12 -mt-12", variant.blob)} />
                <CardHeader className="pb-2 relative">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
                      {kpi.label}
                    </CardTitle>
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border border-border/40 shadow-sm", variant.iconWrap)}>
                      <Icon className={cn("h-5 w-5", variant.icon)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className={cn("text-2xl font-bold font-heading", isVariance ? variant.value : "text-foreground")}>
                    {formatPKR(Math.abs(kpi.value))}
                  </div>

                  {!isVariance && (
                    <div className="flex items-center gap-1 mt-2">
                      {isPositive ? (
                        <TrendingUp className={cn("h-3 w-3", variant.trend)} />
                      ) : (
                        <TrendingDown className={cn("h-3 w-3", variant.trend)} />
                      )}
                      <p className={cn("text-xs", variant.trend)}>
                        {key === 'ytdUtilization'
                          ? `${kpi.trend.toFixed(1)}% Utilized`
                          : `${Math.abs(kpi.trend).toFixed(1)}% from last year`}
                      </p>
                    </div>
                  )}

                  {isVariance && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {kpi.value < 0 ? "Under budget (Good)" : "Over budget"}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Budget vs Actual Charts */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Budget vs Actual Chart */}
          <Card className="lg:col-span-8 border-2 transition-colors hover:border-[#101a3c]">
            <CardHeader>
              <CardTitle>Planned vs Actual Budget</CardTitle>
              <CardDescription>Monthly budget comparison in PKR</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] sm:h-[380px] lg:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={budgetData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `${(value / 1_000_000).toFixed(1)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string) => {
                      // Map dataKey to display name
                      let displayName = 'Variance';
                      if (name === 'planned' || name === 'Planned') {
                        displayName = 'Planned';
                      } else if (name === 'actual' || name === 'Actual') {
                        displayName = 'Actual';
                      } else if (name === 'variance' || name === 'Variance') {
                        displayName = 'Variance';
                      }
                      return [formatPKR(value), displayName];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="planned" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Planned" />
                  <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual" />
                  <Line
                    type="monotone"
                    dataKey="variance"
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Variance"
                    dot={{ fill: "#ef4444", r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Utilization Progress */}
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Budget Utilization</CardTitle>
              <CardDescription>Overall progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Utilized</span>
                  <span className="font-bold">{utilizationRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${utilizationRate}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatPKR(totalActual)}</span>
                  <span>{formatPKR(totalPlanned)}</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Remaining</span>
                    <span className="font-bold text-emerald-600">
                      {formatPKR(totalPlanned - totalActual)}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Variance</span>
                    <span className={`font-bold ${totalActual < totalPlanned ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPKR(totalActual - totalPlanned)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Department Expense Chart */}
        <Card className="border-2 transition-colors hover:border-[#101a3c]">
          <CardHeader>
            <CardTitle>Department Budget Analysis</CardTitle>
            <CardDescription>Planned vs Actual expenses by department</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[330px] lg:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={expenseData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="department"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `${(value / 1_000_000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number, name: string) => {
                    // The name comes from the Bar component's name prop
                    return [formatPKR(value), name];
                  }}
                />
                <Legend />
                <Bar dataKey="planned" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Planned" />
                <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Drill-down */}
        <Card>
          <CardHeader>
            <CardTitle>Department Expense Breakdown</CardTitle>
            <CardDescription>Detailed expense categorization in PKR</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {expenseData.map((item) => {
                const utilization = (item.actual / item.planned) * 100;
                const variance = item.actual - item.planned;

                return (
                  <div key={item.department} className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-primary">{item.department}</span>
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 bg-muted/30 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                        <div className="text-left sm:text-right">
                          <div className="font-mono text-[10px] text-muted-foreground">Planned: {formatPKR(item.planned)}</div>
                          <div className="font-mono font-bold text-xs sm:text-sm">Actual: {formatPKR(item.actual)}</div>
                        </div>
                        <div className={`text-xs sm:text-sm font-bold whitespace-nowrap px-2 py-1 rounded ${variance < 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {variance < 0 ? '-' : '+'}{formatPKR(Math.abs(variance))}
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${utilization}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{utilization.toFixed(1)}% Utilized</span>
                      <span>{variance < 0 ? 'Under' : 'Over'} Budget</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
