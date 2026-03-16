import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { getPermissionForPath } from "@/utils/permissionPaths";

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
