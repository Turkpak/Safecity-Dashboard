/**
 * Map pathname to sidebar_label + sub_label for permission checks.
 * Used by PermissionGate and Sidebar so both use the same mapping.
 */
export function getPermissionForPath(
  path: string
): { sidebar_label: string; sub_label: string | null } | null {
  const map: Record<
    string,
    { sidebar_label: string; sub_label: string | null }
  > = {
    "/": { sidebar_label: "Citywise Progress", sub_label: null },
    "/comparison": { sidebar_label: "City Comparison", sub_label: null },
    "/finance": { sidebar_label: "Finance & Budget", sub_label: null },
    "/gis": { sidebar_label: "GIS Layers", sub_label: null },
    "/settings": { sidebar_label: "Settings", sub_label: null },
    "/province-management": {
      sidebar_label: "Area Management",
      sub_label: "Province",
    },
    "/division-management": {
      sidebar_label: "Area Management",
      sub_label: "Division",
    },
    "/district-management": {
      sidebar_label: "Area Management",
      sub_label: "District",
    },
    "/tehsil-management": {
      sidebar_label: "Area Management",
      sub_label: "Tehsil",
    },
    "/stakeholder-management": { sidebar_label: "Stakeholders", sub_label: null },
    "/project-management": {
      sidebar_label: "Project Management",
      sub_label: null,
    },
    "/project-management/create": {
      sidebar_label: "Project Management",
      sub_label: "Create",
    },
    "/project-management/view": {
      sidebar_label: "Project Management",
      sub_label: "View",
    },
    "/project-activity-management": {
      sidebar_label: "Project Activities",
      sub_label: null,
    },
    "/user-management": { sidebar_label: "User Management", sub_label: null },
  };
  const exact = map[path];
  if (exact) return exact;
  if (/^\/project\/[^/]+\/[^/]+\/?$/.test(path))
    return { sidebar_label: "Project Management", sub_label: null };
  return null;
}
