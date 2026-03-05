import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";

/** Map pathname to sidebar_label + sub_label for permission check */
function getPermissionForPath(path: string): { sidebar_label: string; sub_label: string | null } | null {
  const map: Record<string, { sidebar_label: string; sub_label: string | null }> = {
    "/": { sidebar_label: "Citywise Progress", sub_label: null },
    "/comparison": { sidebar_label: "City Comparison", sub_label: null },
    "/finance": { sidebar_label: "Finance & Budget", sub_label: null },
    "/gis": { sidebar_label: "GIS Layers", sub_label: null },
    "/settings": { sidebar_label: "Settings", sub_label: null },
    "/province-management": { sidebar_label: "Area Management", sub_label: "Province" },
    "/division-management": { sidebar_label: "Area Management", sub_label: "Division" },
    "/district-management": { sidebar_label: "Area Management", sub_label: "District" },
    "/tehsil-management": { sidebar_label: "Area Management", sub_label: "Tehsil" },
    "/stakeholder-management": { sidebar_label: "Stakeholders", sub_label: null },
    "/project-management": { sidebar_label: "Project Management", sub_label: null },
    "/user-management": { sidebar_label: "User Management", sub_label: null },
  };
  const exact = map[path];
  if (exact) return exact;
  if (path.startsWith("/project/")) return { sidebar_label: "Project Management", sub_label: null };
  return null;
}

/**
 * Wraps app content after auth. Redirects to / if the current path requires
 * can_view and the user doesn't have it (based on login permissions).
 */
export function PermissionGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { canView, isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  useEffect(() => {
    if (location === "/auth") return;
    const perm = getPermissionForPath(location);
    if (!perm) return;
    if (isSuperAdmin) return;
    if (!canView(perm.sidebar_label, perm.sub_label)) {
      setLocation("/");
      toast({
        title: "Access restricted",
        description: "You don't have permission to view this page.",
        variant: "destructive",
      });
    }
  }, [location, canView, isSuperAdmin, setLocation, toast]);

  return <>{children}</>;
}
