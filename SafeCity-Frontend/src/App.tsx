import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { SidebarProvider } from "@/contexts/SidebarContext";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Comparison from "@/pages/Comparison";
import Finance from "@/pages/Finance";
import GISLayers from "@/pages/GISLayers";
import Settings from "@/pages/Settings";
import ProjectDetail from "@/pages/ProjectDetail";
import AuthPage from "@/pages/AuthPage";
import ProvinceManagement from "@/pages/ProvinceManagement";
import DivisionManagement from "@/pages/DivisionManagement";
import DistrictManagement from "@/pages/DistrictManagement";
import TehsilManagement from "@/pages/TehsilManagement";
import StakeholderManagement from "@/pages/StakeholderManagement";
import ProjectManagement from "@/pages/ProjectManagement";
import { useState, useEffect, useRef } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/comparison" component={Comparison} />
      <Route path="/finance" component={Finance} />
      <Route path="/gis" component={GISLayers} />
      <Route path="/settings" component={Settings} />
      <Route path="/project/:tehsil/:projectId" component={ProjectDetail} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/province-management" component={ProvinceManagement} />
      <Route path="/division-management" component={DivisionManagement} />
      <Route path="/district-management" component={DistrictManagement} />
      <Route path="/tehsil-management" component={TehsilManagement} />
      <Route path="/stakeholder-management" component={StakeholderManagement} />
      <Route path="/project-management" component={ProjectManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [location] = useLocation();
  const previousLocation = useRef<string | null>(null);
  const isInitialLoad = useRef<boolean>(true);

  // Helper function to check if a route is an Area Management page
  const isAreaManagementRoute = (route: string): boolean => {
    const areaManagementRoutes = [
      '/province-management',
      '/division-management',
      '/district-management',
      '/tehsil-management'
    ];
    return areaManagementRoutes.includes(route);
  };

  useEffect(() => {
    // On initial load, show splash screen first
    if (isInitialLoad.current) {
      previousLocation.current = location;
      return;
    }

    // If route changed (navigation), check if we should show splash screen
    if (previousLocation.current !== null && previousLocation.current !== location) {
      // Skip splash screen if navigating between Area Management pages
      const isFromAreaManagement = isAreaManagementRoute(previousLocation.current);
      const isToAreaManagement = isAreaManagementRoute(location);
      
      if (isFromAreaManagement && isToAreaManagement) {
        // Both are Area Management pages, skip splash screen
        setShowSplash(false);
      } else {
        // Show splash screen for other navigations
        setShowSplash(true);
      }
    }

    previousLocation.current = location;
  }, [location]);

  const handleSplashComplete = () => {
    setShowSplash(false);
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
  };

  return (
    <>
      {/* Router is always mounted to detect route changes */}
      <div style={{ visibility: showSplash ? 'hidden' : 'visible' }}>
        <SidebarProvider>
          <Router />
        </SidebarProvider>
      </div>
      {/* Splash screen overlays on top */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;