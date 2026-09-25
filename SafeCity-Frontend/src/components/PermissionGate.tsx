import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { getPermissionForPath } from "@/utils/permissionPaths";
import { Layout } from "@/components/layout/Layout";

/**
 * Wraps app content after auth. Redirects to / if the current path requires
 * can_view and the user doesn't have it (based on login permissions).
 */
export function PermissionGate({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { canView, isSuperAdmin } = usePermissions();
  const { toast } = useToast();
  const rootPermission = getPermissionForPath("/");
  const rootDenied = location === "/" && !isSuperAdmin && rootPermission != null && !canView(rootPermission.sidebar_label, rootPermission.sub_label);

  useEffect(() => {
    if (location === "/auth") return;
    const perm = getPermissionForPath(location);
    if (!perm) return;
    if (isSuperAdmin) return;
    if (!canView(perm.sidebar_label, perm.sub_label) && location !== "/") {
      setLocation("/");
      toast({
        title: "Access restricted",
        description: "You don't have permission to view this page.",
        variant: "destructive",
      });
    }
  }, [location, canView, isSuperAdmin, setLocation, toast]);

  if (rootDenied) {
    return (
      <Layout title="Access restricted">
        <div className="min-h-[60vh] flex items-center justify-center p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Access restricted</h1>
            <p className="mt-2 text-muted-foreground">You don&apos;t have permission to view the Dashboard.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return <>{children}</>;
}
