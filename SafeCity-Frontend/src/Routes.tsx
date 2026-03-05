import { Switch, Route, useLocation } from "wouter";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PermissionGate } from "@/components/PermissionGate";
import type { ReactNode } from "react";
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
import UserManagement from "@/pages/UserManagement";
import { useState, useEffect, useRef } from "react";

// AuthGate: redirect to /auth when not authenticated (must be inside AuthProvider)
function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect to /auth if not authenticated (but allow /auth itself through)
  if (!isAuthenticated && location !== "/auth") {
    // Use a layout effect style: schedule the redirect and render nothing
    setTimeout(() => setLocation("/auth"), 0);
    return null;
  }

  return <>{children}</>;
}

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
      <Route path="/user-management" component={UserManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

export function AppRoutes() {
  const [showSplash, setShowSplash] = useState(true);
  const [location] = useLocation();
  const previousLocation = useRef<string | null>(null);
  const isInitialLoad = useRef<boolean>(true);

  // Helper function to check if a route is an Area Management page
  const isAreaManagementRoute = (route: string): boolean => {
    const areaManagementRoutes = [
      "/province-management",
      "/division-management",
      "/district-management",
      "/tehsil-management",
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
    if (
      previousLocation.current !== null &&
      previousLocation.current !== location
    ) {
      // Skip splash screen if navigating between Area Management pages
      const isFromAreaManagement = isAreaManagementRoute(
        previousLocation.current,
      );
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
      <div style={{ visibility: showSplash ? "hidden" : "visible" }}>
        <AuthProvider>
          <AuthGate>
            <SidebarProvider>
              <PermissionGate>
                <Router />
              </PermissionGate>
            </SidebarProvider>
          </AuthGate>
        </AuthProvider>
      </div>
      {/* Splash screen overlays on top */}
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}
