import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { UserPermissionItem } from "@/api/types";

export interface PagePermission {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

const EMPTY_PERMISSION: PagePermission = {
  can_view: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

function isSuperAdmin(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "super_admin" || r === "super admin";
}

/**
 * Returns permission helpers based on the current user's login response (permissions array).
 * Super_admin bypasses: all pages get full access.
 */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role ?? "").trim().toLowerCase();
  const superAdmin = isSuperAdmin(user?.role ?? undefined);
  const permissions: UserPermissionItem[] = user?.permissions ?? [];

  const getPermission = useMemo(
    () =>
      (sidebarLabel: string, subLabel: string | null | undefined): PagePermission => {
        if (superAdmin) {
          return {
            can_view: true,
            can_create: true,
            can_update: true,
            can_delete: true,
          };
        }
        const sub = subLabel ?? "";
        const perm = permissions.find(
          (p) =>
            p.sidebar_label === sidebarLabel && (p.sub_label ?? "") === sub
        );
        if (!perm) return EMPTY_PERMISSION;
        return {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_update: perm.can_update,
          can_delete: perm.can_delete,
        };
      },
    [superAdmin, permissions]
  );

  const canView = useMemo(
    () => (sidebarLabel: string, subLabel?: string | null) =>
      getPermission(sidebarLabel, subLabel ?? null).can_view,
    [getPermission]
  );

  return { getPermission, canView, isSuperAdmin: superAdmin };
}
