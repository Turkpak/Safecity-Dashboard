import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  listStakeholders,
  createUser,
  listUsers,
  createUserPermission,
  getUsersWithPermissions,
  updateUserPermission,
  updateUserStatus,
} from "@/api";
import { useState, useRef, useMemo, useEffect } from "react";
import { UserPlus, Users, ShieldAlert, ListChecks, UserCog, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { UserCrudPermissions, UserWithPermissions, UserPermissionItem } from "@/api/types";

/** Normalize role from login (backend may return super_admin or Super Admin) */
function isSuperAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "super_admin" || r === "super admin";
}

type PermissionRow = {
  sidebar_label: string;
  sub_label: string | null;
  displayLabel: string;
  /** Visual indent to mimic sidebar tree structure */
  indent?: number; // 0..n
  /** Tree grouping */
  kind?: "group" | "item";
  groupId?: "area" | "projects";
};

/** Rows for Step 2 (Add New User): match backend sidebar_label + sub_label. Used with POST /api/user-permissions/ */
const ADD_USER_PERMISSION_ROWS: PermissionRow[] = [
  { sidebar_label: "Citywise Progress", sub_label: null, displayLabel: "Dashboard" },
  { sidebar_label: "Stakeholders", sub_label: null, displayLabel: "Stakeholders" },

  // Area Management (tree)
  { sidebar_label: "Area Management", sub_label: null, displayLabel: "Area Management", kind: "group", groupId: "area" },
  { sidebar_label: "Area Management", sub_label: "Province", displayLabel: "Province", indent: 1, kind: "item", groupId: "area" },
  { sidebar_label: "Area Management", sub_label: "Division", displayLabel: "Division", indent: 1, kind: "item", groupId: "area" },
  { sidebar_label: "Area Management", sub_label: "District", displayLabel: "District", indent: 1, kind: "item", groupId: "area" },
  { sidebar_label: "Area Management", sub_label: "Tehsil", displayLabel: "Tehsil", indent: 1, kind: "item", groupId: "area" },

  // Projects (tree)
  { sidebar_label: "Project Management", sub_label: null, displayLabel: "Projects", kind: "group", groupId: "projects" },
  { sidebar_label: "Project Management", sub_label: "Create", displayLabel: "Create New Project", indent: 1, kind: "item", groupId: "projects" },
  { sidebar_label: "Project Management", sub_label: "View", displayLabel: "View All Projects", indent: 1, kind: "item", groupId: "projects" },

  { sidebar_label: "Finance & Budget", sub_label: null, displayLabel: "Finance & Budget" },
  { sidebar_label: "GIS Layers", sub_label: null, displayLabel: "GIS Layers" },
  { sidebar_label: "City Comparison", sub_label: null, displayLabel: "Citywise Comparison" },
  { sidebar_label: "User Management", sub_label: null, displayLabel: "User Management" },
];

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentRole = (user?.role ?? "").trim().toLowerCase();
  const isSuperAdmin = isSuperAdminRole(user?.role ?? undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  /** Add New User dialog: 1 = user details, 2 = page permissions */
  const [addUserStep, setAddUserStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [stakeholderId, setStakeholderId] = useState<string>("");
  /** Step 2: per-row CRUD for the user being created. Index matches ADD_USER_PERMISSION_ROWS. */
  const [newUserPermissions, setNewUserPermissions] = useState<Record<string, UserCrudPermissions>>({});
  /** Selected user id for Page Permissions card; full user is derived from API data so refetch updates the table. */
  const [selectedUserIdForPermissions, setSelectedUserIdForPermissions] = useState<number | null>(null);
  const [isUpdatingPermission, setIsUpdatingPermission] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PER_PAGE = 6;
  const [nameComboboxOpen, setNameComboboxOpen] = useState(false);

  // States for confirming permission change
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingPermissionChange, setPendingPermissionChange] = useState<{
    sidebar_label: string;
    sub_label: string | null;
    key: "can_view" | "can_create" | "can_update" | "can_delete";
    value: boolean;
    displayLabel: string;
  } | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    userId: number;
    email: string;
    currentStatus: boolean;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Expand/collapse groups in permission tables
  const [expandedGroups, setExpandedGroups] = useState<{ area: boolean; projects: boolean }>({
    area: true,
    projects: true,
  });

  const visiblePermissionRows = useMemo(() => {
    return ADD_USER_PERMISSION_ROWS.filter((r) => {
      if (r.kind === "group") return true;
      if (r.groupId === "area") return expandedGroups.area;
      if (r.groupId === "projects") return expandedGroups.projects;
      return true;
    });
  }, [expandedGroups]);

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: listStakeholders,
  });

  /** All stakeholders from list-stakeholder API */
  const roleStakeholders = stakeholders;

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const { data: usersWithPermissions = [], isLoading: usersWithPermissionsLoading } = useQuery({
    queryKey: ["users-with-permissions"],
    queryFn: getUsersWithPermissions,
  });

  const pagePermissionsCardRef = useRef<HTMLDivElement>(null);

  /** Users sorted by id ascending for consistent table order */
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.id - b.id),
    [users]
  );

  const totalUsersPages = Math.max(1, Math.ceil(sortedUsers.length / USERS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PER_PAGE;
    return sortedUsers.slice(start, start + USERS_PER_PAGE);
  }, [sortedUsers, usersPage]);

  useEffect(() => {
    if (usersPage > totalUsersPages && totalUsersPages >= 1) {
      setUsersPage(totalUsersPages);
    }
  }, [usersPage, totalUsersPages]);

  function permissionRowKey(sidebar_label: string, sub_label: string | null) {
    return `${sidebar_label}|${sub_label ?? ""}`;
  }

  function resetForm() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setPassword("");
    setStakeholderId("");
    setAddUserStep(1);
    setNewUserPermissions({});
  }

  /** Get CRUD for one row in Step 2 (new user permissions) */
  function getNewUserPerm(sidebar_label: string, sub_label: string | null): UserCrudPermissions {
    const key = permissionRowKey(sidebar_label, sub_label);
    return newUserPermissions[key] ?? { create: false, read: false, update: false, delete: false };
  }

  /** Set one CRUD flag for one row in Step 2 */
  function setNewUserPerm(
    sidebar_label: string,
    sub_label: string | null,
    key: keyof UserCrudPermissions,
    value: boolean
  ) {
    const rowKey = permissionRowKey(sidebar_label, sub_label);
    setNewUserPermissions((prev) => {
      const current = prev[rowKey] ?? { create: false, read: false, update: false, delete: false };
      if (key === "read" && !value) {
        return { ...prev, [rowKey]: { ...current, read: false, create: false, update: false, delete: false } };
      }
      if (key !== "read" && value && !current.read) {
        return { ...prev, [rowKey]: { ...current, [key]: false } };
      }
      return { ...prev, [rowKey]: { ...current, [key]: value } };
    });
  }

  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedEmail) {
      toast({ title: "Validation Error", description: "Email is required.", variant: "destructive" });
      return;
    }
    if (!trimmedFirst) {
      toast({ title: "Validation Error", description: "First name is required.", variant: "destructive" });
      return;
    }
    if (!trimmedLast) {
      toast({ title: "Validation Error", description: "Last name is required.", variant: "destructive" });
      return;
    }
    if (!password || password.length < 8) {
      toast({ title: "Validation Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (!stakeholderId) {
      toast({ title: "Validation Error", description: "Please select a role.", variant: "destructive" });
      return;
    }
    setAddUserStep(2);
  };

  const [isCreatingWithPermissions, setIsCreatingWithPermissions] = useState(false);

  const handleCreateUserWithPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const selectedStakeholder = roleStakeholders.find((s) => String(s.id) === stakeholderId);
    const role = selectedStakeholder ? selectedStakeholder.stakeholder_type.toLowerCase() : "";
    setIsCreatingWithPermissions(true);
    try {
      const res = await createUser({
        email: trimmedEmail,
        first_name: trimmedFirst,
        last_name: trimmedLast,
        password,
        role,
        stakeholder: Number(stakeholderId),
      });
      const userId = res.user.id;
      const permissionPromises: Promise<unknown>[] = [];
      for (const row of ADD_USER_PERMISSION_ROWS) {
        const p = getNewUserPerm(row.sidebar_label, row.sub_label);
        const hasAny = (p.read ?? false) || (p.create ?? false) || (p.update ?? false) || (p.delete ?? false);
        if (!hasAny) continue;
        permissionPromises.push(
          createUserPermission({
            user: userId,
            sidebar_label: row.sidebar_label,
            sub_label: row.sub_label,
            can_view: p.read ?? false,
            can_create: (p.read ?? false) && (p.create ?? false),
            can_update: (p.read ?? false) && (p.update ?? false),
            can_delete: (p.read ?? false) && (p.delete ?? false),
          })
        );
      }
      await Promise.all(permissionPromises);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-permissions"] });
      toast({ title: "Success", description: "User and permissions created successfully." });
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create user or permissions",
        variant: "destructive",
      });
    } finally {
      setIsCreatingWithPermissions(false);
    }
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    if (addUserStep === 1) handleSubmitStep1(e);
    else handleCreateUserWithPermissions(e);
  };

  const isSubmitDisabled = addUserStep === 2 && isCreatingWithPermissions;

  const getStakeholderLabel = (id: number | null) => {
    if (id == null) return "—";
    const s = stakeholders.find((st) => st.id === id);
    return s ? `${s.stakeholder_title} (${s.stakeholder_type})` : String(id);
  };

  const formatRole = (role: string | undefined) => {
    if (!role) return "—";
    const r = role.trim().toLowerCase();
    if (r === "super_admin") return "Super Admin";
    if (r === "contractor") return "Contractor";
    if (r === "consultant") return "Consultant";
    return role;
  };

  /** Users from GET user-permissions that have a role we show in the selector (consultant/contractor) */
  const usersForPermissionView = usersWithPermissions.filter(
    (u) => (u.role ?? "").trim().toLowerCase() !== "super_admin"
  );

  /** Selected user's full data (derived so refetch updates the table) */
  const selectedUserWithPermissions = useMemo(
    () => usersWithPermissions.find((u) => u.user_id === selectedUserIdForPermissions) ?? null,
    [usersWithPermissions, selectedUserIdForPermissions]
  );

  /** Find permission for a page row (sidebar_label + sub_label) in the selected user's permissions */
  function getPermissionForRow(
    permissions: UserPermissionItem[],
    sidebar_label: string,
    sub_label: string | null
  ): UserPermissionItem | undefined {
    return permissions.find(
      (p) =>
        p.sidebar_label === sidebar_label &&
        (p.sub_label ?? "") === (sub_label ?? "")
    );
  }

  function permissionControlVisibility(row: PermissionRow) {
    const viewOnlyPage =
      row.sub_label == null &&
      ["Finance & Budget", "GIS Layers", "City Comparison"].includes(row.sidebar_label);
    const createProjectPage =
      row.sidebar_label === "Project Management" && row.sub_label === "Create";
    const viewProjectsPage =
      row.sidebar_label === "Project Management" && row.sub_label === "View";

    return {
      showRead: !createProjectPage,
      showCrud: !viewOnlyPage,
      hideCreate: viewProjectsPage,
    };
  }

  /** Toggle one CRUD flag for the selected user and a page row; create or update via API */
  async function handlePermissionToggle(
    sidebar_label: string,
    sub_label: string | null,
    key: "can_view" | "can_create" | "can_update" | "can_delete",
    value: boolean
  ) {
    if (selectedUserWithPermissions == null) return;
    const perm = getPermissionForRow(
      selectedUserWithPermissions.permissions,
      sidebar_label,
      sub_label
    );
    const userId = selectedUserWithPermissions.user_id;
    setIsUpdatingPermission(true);
    try {
      if (perm) {
        const nextCanView = key === "can_view" ? value : perm.can_view;
        const crudAllowed = nextCanView;
        const payload = {
          user: userId,
          sidebar_label,
          sub_label: sub_label ?? undefined,
          can_view: nextCanView,
          can_create: crudAllowed && (key === "can_create" ? value : perm.can_create),
          can_update: crudAllowed && (key === "can_update" ? value : perm.can_update),
          can_delete: crudAllowed && (key === "can_delete" ? value : perm.can_delete),
        };
        await updateUserPermission(perm.id, payload);
      } else {
        await createUserPermission({
          user: userId,
          sidebar_label,
          sub_label,
          can_view: key === "can_view" ? value : false,
          can_create: false,
          can_update: false,
          can_delete: false,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["users-with-permissions"] });
      toast({ title: "Saved", description: "Page permission updated." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update permission",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPermission(false);
    }
  }

  const requestPermissionToggle = (
    sidebar_label: string,
    sub_label: string | null,
    key: "can_view" | "can_create" | "can_update" | "can_delete",
    value: boolean,
    displayLabel: string
  ) => {
    setPendingPermissionChange({ sidebar_label, sub_label, key, value, displayLabel });
    setConfirmDialogOpen(true);
  };

  const executePermissionToggle = async () => {
    if (!pendingPermissionChange) return;
    const { sidebar_label, sub_label, key, value } = pendingPermissionChange;
    setConfirmDialogOpen(false);
    setPendingPermissionChange(null);
    await handlePermissionToggle(sidebar_label, sub_label, key, value);
  };

  const requestStatusChange = (u: {
  id: number;
  email: string;
  is_active: boolean;
}) => {
  // Do not allow the logged-in Super Admin to deactivate themselves
  if (user?.id === u.id) {
    toast({
      title: "Action not allowed",
      description: "You cannot change the status of your own account.",
      variant: "destructive",
    });
    return;
  }

  setPendingStatusChange({
    userId: u.id,
    email: u.email,
    currentStatus: u.is_active,
  });

  setStatusDialogOpen(true);
};

const executeStatusChange = async () => {
  if (!pendingStatusChange) return;

  const { userId, currentStatus } = pendingStatusChange;
  const newStatus = !currentStatus;

  setStatusDialogOpen(false);
  setIsUpdatingStatus(true);

  try {
    await updateUserStatus(userId, newStatus);

    await queryClient.invalidateQueries({
      queryKey: ["users"],
    });

    toast({
      title: "Status updated",
      description: newStatus
        ? "User has been activated successfully."
        : "User has been deactivated successfully.",
    });
  } catch (err) {
    toast({
      title: "Error",
      description:
        err instanceof Error
          ? err.message
          : "Failed to update user status.",
      variant: "destructive",
    });
  } finally {
    setIsUpdatingStatus(false);
    setPendingStatusChange(null);
  }
};


  if (!isSuperAdmin) {
    return (
      <Layout title="User Management">
        <div className="space-y-6">
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <ShieldAlert className="h-5 w-5" />
                Access restricted
              </CardTitle>
              <CardDescription>
                User Management is available only to Super Admin. Your role: <strong>{currentRole || "—"}</strong>. Contact an administrator to manage users.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="User Management">
      <div className="space-y-6">
        {/* Header with Add New User button on the right — Super Admin only */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            onClick={() => setDialogOpen(true)}
            size="sm"
            className="gap-2 w-fit self-start sm:w-auto sm:self-auto shrink-0 px-3"
          >
            <UserPlus className="h-4 w-4" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add New User</span>
          </Button>
        </div>

        {/* Add New User dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New User{addUserStep === 2 ? " — Step 2 of 2" : ""}
              </DialogTitle>
              {addUserStep === 1 && (
                <DialogDescription>
                  Verify the person's identity and authorization before provisioning. Accounts become active immediately; no email-verification link is sent.
                </DialogDescription>
              )}
              {addUserStep === 2 && (
                <DialogDescription>
                  Set page permissions for this user. Read = can view, Create = add new, Update = edit, Delete = remove.
                </DialogDescription>
              )}
            </DialogHeader>
            <form onSubmit={handleAddUserSubmit} className="space-y-6">
              {addUserStep === 1 && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dialog-email">Email</Label>
                      <Input
                        id="dialog-email"
                        type="email"
                        placeholder="e.g. sana@psc.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dialog-role">Role</Label>
                      <Select value={stakeholderId} onValueChange={setStakeholderId}>
                        <SelectTrigger id="dialog-role">
                          <SelectValue placeholder="Select role (Consultant / Contractor)" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleStakeholders.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.stakeholder_type}
                              {s.stakeholder_title ? ` — ${s.stakeholder_title}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dialog-first_name">First name</Label>
                      <Input
                        id="dialog-first_name"
                        placeholder="e.g. Sana"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dialog-last_name">Last name</Label>
                      <Input
                        id="dialog-last_name"
                        placeholder="e.g. Admin"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dialog-password">Password</Label>
                    <Input
                      id="dialog-password"
                      type="password"
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}

              {addUserStep === 2 && (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Page</TableHead>
                        <TableHead className="text-center w-[80px]">Read</TableHead>
                        <TableHead className="text-center w-[80px]">Create</TableHead>
                        <TableHead className="text-center w-[80px]">Update</TableHead>
                        <TableHead className="text-center w-[80px]">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePermissionRows.map((row) => {
                        const p = getNewUserPerm(row.sidebar_label, row.sub_label);
                        const isGroup = row.kind === "group";
                        const groupId = row.groupId;
                        const { showRead, showCrud, hideCreate } = permissionControlVisibility(row);
                        return (
                          <TableRow key={permissionRowKey(row.sidebar_label, row.sub_label)}>
                            <TableCell className="font-medium">
                              {isGroup && groupId ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 font-semibold"
                                  onClick={() =>
                                    setExpandedGroups((prev) => ({
                                      ...prev,
                                      [groupId]: !prev[groupId],
                                    }))
                                  }
                                >
                                  <span className="text-base leading-none">{expandedGroups[groupId] ? "▾" : "▸"}</span>
                                  <span>{row.displayLabel}</span>
                                </button>
                              ) : (
                                <span style={{ paddingLeft: `${(row.indent ?? 0) * 16}px` }}>
                                  {row.displayLabel}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isGroup && showRead ? (
                                <Checkbox
                                  checked={p.read ?? false}
                                  onCheckedChange={(c) =>
                                    setNewUserPerm(row.sidebar_label, row.sub_label, "read", !!c)
                                  }
                                />
                              ) : null}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isGroup && showCrud && !hideCreate ? (
                                <Checkbox
                                  checked={p.create ?? false}
                                  onCheckedChange={(c) =>
                                    setNewUserPerm(row.sidebar_label, row.sub_label, "create", !!c)
                                  }
                                />
                              ) : null}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isGroup && showCrud ? (
                                <Checkbox
                                  checked={p.update ?? false}
                                  onCheckedChange={(c) =>
                                    setNewUserPerm(row.sidebar_label, row.sub_label, "update", !!c)
                                  }
                                />
                              ) : null}
                            </TableCell>
                            <TableCell className="text-center">
                              {!isGroup && showCrud ? (
                                <Checkbox
                                  checked={p.delete ?? false}
                                  onCheckedChange={(c) =>
                                    setNewUserPerm(row.sidebar_label, row.sub_label, "delete", !!c)
                                  }
                                />
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (addUserStep === 2) setAddUserStep(1);
                    else setDialogOpen(false);
                  }}
                >
                  {addUserStep === 2 ? "Back" : "Cancel"}
                </Button>
                <Button type="submit" disabled={isSubmitDisabled}>
                  {addUserStep === 1 ? "Next" : isSubmitDisabled ? "Creating…" : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Users table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Registered Users
            </CardTitle>
            <CardDescription>
              Users added by Super Admin,                                        Total: {users.length}
              {users.length > USERS_PER_PAGE && (
                <> · Page {usersPage} of {totalUsersPages}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-muted-foreground py-8 text-center">Loading users…</p>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No users yet. Click &quot;Add New User&quot; to create one.</p>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">#</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Full name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Stakeholder</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[120px] text-right">Page permissions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((u, index) => {
                        const rowNumber = (usersPage - 1) * USERS_PER_PAGE + index + 1;
                        const isSuperAdminUser = (u.role ?? "").trim().toLowerCase() === "super_admin";
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono text-muted-foreground">{rowNumber}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.full_name}</TableCell>
                            <TableCell className="capitalize">{formatRole(u.role)}</TableCell>
                            <TableCell>{getStakeholderLabel(u.stakeholder)}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isUpdatingStatus || isSuperAdminUser}
                                onClick={() => requestStatusChange(u)}
                                className={
                                  u.is_active
                                    ? "h-8 px-2 font-medium text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950"
                                    : "h-8 px-2 font-medium text-muted-foreground hover:bg-muted"
                                }
                                title={
                                  isSuperAdminUser
                                    ? "Super Admin status cannot be changed here"
                                    : u.is_active
                                    ? "Click to deactivate this user"
                                    : "Click to activate this user"
                                }
                              >
                                {u.is_active ? "Active" : "Inactive"}
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              {!isSuperAdminUser && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => {
                                    setSelectedUserIdForPermissions(u.id);
                                    pagePermissionsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }}
                                >
                                  <UserCog className="h-3.5 w-3.5" />
                                  View permissions
                                </Button>
                              )}
                              {isSuperAdminUser && <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {totalUsersPages > 1 && (
                  <div className="flex items-center justify-between gap-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((usersPage - 1) * USERS_PER_PAGE) + 1}–{Math.min(usersPage * USERS_PER_PAGE, sortedUsers.length)} of {sortedUsers.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                        disabled={usersPage <= 1}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setUsersPage((p) => Math.min(totalUsersPages, p + 1))}
                        disabled={usersPage >= totalUsersPages}
                        className="gap-1 bg-primary text-primary-foreground"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Page Permissions — select user (name + role) from GET /api/user-permissions/, show their permissions */}
        <Card ref={pagePermissionsCardRef}>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Page permissions
              </CardTitle>
              
              {usersWithPermissionsLoading ? (
                <p className="text-muted-foreground text-sm">Loading users and permissions…</p>
              ) : (
                <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="permissions-name-combobox">Name</Label>
                    <Popover open={nameComboboxOpen} onOpenChange={setNameComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="permissions-name-combobox"
                          variant="outline"
                          role="combobox"
                          aria-expanded={nameComboboxOpen}
                          className="w-full justify-between font-normal h-9 px-3 text-sm"
                        >
                          <span className="truncate">
                            {selectedUserWithPermissions
                              ? selectedUserWithPermissions.full_name || selectedUserWithPermissions.email || `User ${selectedUserWithPermissions.user_id}`
                              : "Select user by name…"}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
                        <Command
                          filter={(value, search) => {
                            const label = (value || "").toLowerCase();
                            const q = (search || "").toLowerCase();
                            if (!q) return 1;
                            return label.includes(q) ? 1 : 0;
                          }}
                        >
                          <CommandInput placeholder="Type to search name or email…" />
                          <CommandList>
                            <CommandEmpty>No user found.</CommandEmpty>
                            <CommandGroup>
                              {usersForPermissionView.map((u) => {
                                const label = u.full_name || u.email || `User ${u.user_id}`;
                                return (
                                  <CommandItem
                                    key={u.user_id}
                                    value={`${label} ${u.email}`}
                                    onSelect={() => {
                                      setSelectedUserIdForPermissions(u.user_id);
                                      setNameComboboxOpen(false);
                                    }}
                                  >
                                    {label}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="permissions-role-display">Role</Label>
                    <Input
                      id="permissions-role-display"
                      readOnly
                      className="bg-muted w-full"
                      value={selectedUserWithPermissions ? formatRole(selectedUserWithPermissions.role) : "—"}
                    />
                  </div>
                  {selectedUserIdForPermissions != null && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setSelectedUserIdForPermissions(null)}
                      className="col-span-2 sm:col-span-auto shrink-0 h-8 text-white bg-red-600 hover:bg-red-700 border-0"
                    >
                      Clear selection
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedUserWithPermissions == null ? (
              <p className="text-muted-foreground py-8 text-center rounded-md border border-dashed">
                Select a user by name above (or click &quot;View permissions&quot; in the Registered Users table) to view and edit their page permissions.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Page</TableHead>
                      <TableHead className="text-center w-[90px]">Read</TableHead>
                      <TableHead className="text-center w-[90px]">Create</TableHead>
                      <TableHead className="text-center w-[90px]">Update</TableHead>
                      <TableHead className="text-center w-[90px]">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePermissionRows.map((row) => {
                      const perm = getPermissionForRow(
                        selectedUserWithPermissions.permissions,
                        row.sidebar_label,
                        row.sub_label
                      );
                      const canView = perm?.can_view ?? false;
                      const canCreate = perm?.can_create ?? false;
                      const canUpdate = perm?.can_update ?? false;
                      const canDelete = perm?.can_delete ?? false;
                      const disabled = isUpdatingPermission;
                      const isGroup = row.kind === "group";
                      const groupId = row.groupId;
                      const { showRead, showCrud, hideCreate } = permissionControlVisibility(row);
                      return (
                        <TableRow key={`${row.sidebar_label}|${row.sub_label ?? ""}`}>
                          <TableCell className="font-medium">
                            {isGroup && groupId ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 font-semibold"
                                onClick={() =>
                                  setExpandedGroups((prev) => ({
                                    ...prev,
                                    [groupId]: !prev[groupId],
                                  }))
                                }
                              >
                                <span className="text-base leading-none">{expandedGroups[groupId] ? "▾" : "▸"}</span>
                                <span>{row.displayLabel}</span>
                              </button>
                            ) : (
                              <span style={{ paddingLeft: `${(row.indent ?? 0) * 16}px` }}>
                                {row.displayLabel}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {!isGroup && showRead ? (
                                <Checkbox
                                  checked={canView}
                                  disabled={disabled}
                                  onCheckedChange={(c) =>
                                    requestPermissionToggle(row.sidebar_label, row.sub_label, "can_view", !!c, row.displayLabel)
                                  }
                                />
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {!isGroup && showCrud && !hideCreate ? (
                                <Checkbox
                                  checked={canCreate}
                                  disabled={disabled}
                                  onCheckedChange={(c) =>
                                    requestPermissionToggle(row.sidebar_label, row.sub_label, "can_create", !!c, row.displayLabel)
                                  }
                                />
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {!isGroup && showCrud ? (
                                <Checkbox
                                  checked={canUpdate}
                                  disabled={disabled}
                                  onCheckedChange={(c) =>
                                    requestPermissionToggle(row.sidebar_label, row.sub_label, "can_update", !!c, row.displayLabel)
                                  }
                                />
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {!isGroup && showCrud ? (
                                <Checkbox
                                  checked={canDelete}
                                  disabled={disabled}
                                  onCheckedChange={(c) =>
                                    requestPermissionToggle(row.sidebar_label, row.sub_label, "can_delete", !!c, row.displayLabel)
                                  }
                                />
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Confirmation Dialog for user status update */}
        <Dialog
          open={statusDialogOpen}
          onOpenChange={(open) => {
            setStatusDialogOpen(open);

            if (!open) {
              setPendingStatusChange(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pendingStatusChange?.currentStatus
                  ? "Deactivate User"
                  : "Activate User"}
              </DialogTitle>

              <DialogDescription>
                Are you sure you want to{" "}
                <strong className="text-foreground">
                  {pendingStatusChange?.currentStatus
                    ? "deactivate"
                    : "activate"}
                </strong>{" "}
                the user{" "}
                <strong className="text-foreground">
                  {pendingStatusChange?.email || "this user"}
                </strong>
                ?
                {pendingStatusChange?.currentStatus && (
                  <>
                    <br />
                    <span className="mt-2 block">
                      This user will no longer be able to log in while the account is
                      inactive.
                    </span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={isUpdatingStatus}
                onClick={() => {
                  setStatusDialogOpen(false);
                  setPendingStatusChange(null);
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={isUpdatingStatus}
                onClick={executeStatusChange}
              >
                {isUpdatingStatus
                  ? "Updating..."
                  : pendingStatusChange?.currentStatus
                  ? "Deactivate"
                  : "Activate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for permission update */}
        <Dialog
          open={confirmDialogOpen}
          onOpenChange={(open) => {
            setConfirmDialogOpen(open);
            if (!open) setPendingPermissionChange(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Permission Change</DialogTitle>
              <DialogDescription>
                Are you sure you want to {pendingPermissionChange?.value ? "grant" : "revoke"}{" "}
                <strong className="text-foreground">
                  {pendingPermissionChange?.key === "can_view"
                    ? "Read"
                    : pendingPermissionChange?.key === "can_create"
                    ? "Create"
                    : pendingPermissionChange?.key === "can_update"
                    ? "Update"
                    : "Delete"}
                </strong>{" "}
                permission for{" "}
                <strong className="text-foreground">{pendingPermissionChange?.displayLabel}</strong> to{" "}
                <strong className="text-foreground">
                  {selectedUserWithPermissions?.full_name || selectedUserWithPermissions?.email || "this user"}
                </strong>
                ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirmDialogOpen(false);
                  setPendingPermissionChange(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={executePermissionToggle}
                className="bg-primary text-primary-foreground"
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
