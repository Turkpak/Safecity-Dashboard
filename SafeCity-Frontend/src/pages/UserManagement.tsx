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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { listStakeholders, createUser, listUsers } from "@/api";
import { useState, useRef } from "react";
import { UserPlus, Users, ShieldAlert, ListChecks, UserCog } from "lucide-react";
import type { UserCrudPermissions } from "@/api/types";

/** Normalize role from login (backend may return super_admin or Super Admin) */
function isSuperAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "super_admin" || r === "super admin";
}

/** Page rows for the Page Permissions table. Area Management is a single row covering Province, Division, District, Tehsil. */
const PAGE_PERMISSIONS_ROWS: { id: string; label: string }[] = [
  { id: "area_management", label: "Area Management (Province, Division, District, Tehsil)" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "project_management", label: "Project Management" },
  { id: "citywise_progress", label: "Citywise Progress" },
  { id: "city_comparison", label: "City Comparison" },
  { id: "finance", label: "Finance & Budget" },
  { id: "gis_layers", label: "GIS Layers" },
  { id: "user_management", label: "User Management" },
  { id: "settings", label: "Settings" },
];

const DEFAULT_PAGE_CRUD: UserCrudPermissions = {
  create: true,
  read: true,
  update: true,
  delete: false,
};

export default function UserManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentRole = (user?.role ?? localStorage.getItem("userRole") ?? "").trim().toLowerCase();
  const isSuperAdmin = isSuperAdminRole(user?.role ?? undefined) || isSuperAdminRole(localStorage.getItem("userRole") ?? undefined);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [stakeholderId, setStakeholderId] = useState<string>("");
  /** Which user's page permissions we are editing (null = none selected) */
  const [selectedUserIdForPermissions, setSelectedUserIdForPermissions] = useState<number | null>(null);
  /** Per-user, per-page CRUD: userId -> pageId -> { create, read, update, delete } */
  const [pagePermissionsByUser, setPagePermissionsByUser] = useState<Record<number, Record<string, UserCrudPermissions>>>({});

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: listStakeholders,
  });

  /** Role options: only Consultant and Contractor from list-stakeholder API */
  const roleStakeholders = stakeholders.filter(
    (s) =>
      s.stakeholder_type === "Consultant" || s.stakeholder_type === "Contractor"
  );

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
  });

  const pagePermissionsCardRef = useRef<HTMLDivElement>(null);

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      toast({ title: "Success", description: "User created successfully." });
      resetForm();
      setDialogOpen(false);
    },
    onError: (e: Error) => {
      toast({
        title: "Error",
        description: e.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  function resetForm() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setPassword("");
    setStakeholderId("");
  }

  const handleSubmit = (e: React.FormEvent) => {
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
    const selectedStakeholder = roleStakeholders.find((s) => String(s.id) === stakeholderId);
    const role = selectedStakeholder ? selectedStakeholder.stakeholder_type.toLowerCase() : "";
    createUserMutation.mutate({
      email: trimmedEmail,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      password,
      role,
      stakeholder: Number(stakeholderId),
    });
  };

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

  /** Users that can have page permissions assigned (Contractor / Consultant only) */
  const usersForPermissionAssignment = users.filter(
    (u) => (u.role ?? "").trim().toLowerCase() !== "super_admin"
  );

  /** Get page permissions for the currently selected user (for editing in the table) */
  const getPermissionsForSelectedUser = (pageId: string): UserCrudPermissions => {
    if (selectedUserIdForPermissions == null) return DEFAULT_PAGE_CRUD;
    const byPage = pagePermissionsByUser[selectedUserIdForPermissions];
    return byPage?.[pageId] ?? DEFAULT_PAGE_CRUD;
  };

  /** Update one CRUD flag for the selected user and page */
  const setPermissionForSelectedUser = (
    pageId: string,
    key: keyof UserCrudPermissions,
    value: boolean
  ) => {
    if (selectedUserIdForPermissions == null) return;
    setPagePermissionsByUser((prev) => {
      const userPerms = prev[selectedUserIdForPermissions] ?? {};
      const pagePerms = userPerms[pageId] ?? { ...DEFAULT_PAGE_CRUD };
      return {
        ...prev,
        [selectedUserIdForPermissions]: {
          ...userPerms,
          [pageId]: { ...pagePerms, [key]: value },
        },
      };
    });
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          
          <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
            <UserPlus className="h-4 w-4" />
            Add New User
          </Button>
        </div>

        {/* Add New User dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New User
              </DialogTitle>
              <DialogDescription>
                Create a new user and assign role (Contractor or Consultant). Page-level CRUD permissions are managed in the table below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
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
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creating…" : "Create user"}
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
              Users added by Super Admin. Assign CRUD per page in the Page Permissions table below. Total: {users.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <p className="text-muted-foreground py-8 text-center">Loading users…</p>
            ) : users.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">No users yet. Click &quot;Add New User&quot; to create one.</p>
            ) : (
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
                    {users.map((u) => {
                      const isSuperAdminUser = (u.role ?? "").trim().toLowerCase() === "super_admin";
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-muted-foreground">{u.id}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.full_name}</TableCell>
                          <TableCell className="capitalize">{formatRole(u.role)}</TableCell>
                          <TableCell>{getStakeholderLabel(u.stakeholder)}</TableCell>
                          <TableCell>
                            <span
                              className={
                                u.is_active
                                  ? "text-green-600 dark:text-green-400 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
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
                                Edit permissions
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
            )}
          </CardContent>
        </Card>

        {/* Page Permissions table — per user; select user then edit CRUD per page */}
        <Card ref={pagePermissionsCardRef}>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  Page permissions
                </CardTitle>
                
              </div>
              <div className="flex flex-nowrap items-center gap-3 shrink-0">
                <Label htmlFor="permissions-user-select" className="text-sm font-medium whitespace-nowrap">
                  Permissions for user:
                </Label>
                <Select
                  value={selectedUserIdForPermissions != null ? String(selectedUserIdForPermissions) : "__none__"}
                  onValueChange={(v) => setSelectedUserIdForPermissions(v === "__none__" ? null : Number(v))}
                >
                  <SelectTrigger id="permissions-user-select" className="h-9 w-[280px] max-w-full shrink">
                    <SelectValue placeholder="Select user…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select user…</SelectItem>
                    {usersForPermissionAssignment.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.full_name || u.email} ({formatRole(u.role)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedUserIdForPermissions != null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUserIdForPermissions(null)}
                    className="text-muted-foreground shrink-0 h-9"
                  >
                    Clear selection
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedUserIdForPermissions == null ? (
              <p className="text-muted-foreground py-8 text-center rounded-md border border-dashed">
                Select a user above (or click &quot;Edit permissions&quot; in the Registered Users table) to manage their page-level CRUD.
              </p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[280px]">Page</TableHead>
                      <TableHead className="text-center w-[90px]">Create</TableHead>
                      <TableHead className="text-center w-[90px]">Read</TableHead>
                      <TableHead className="text-center w-[90px]">Update</TableHead>
                      <TableHead className="text-center w-[90px]">Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PAGE_PERMISSIONS_ROWS.map(({ id, label }) => {
                      const perms = getPermissionsForSelectedUser(id);
                      return (
                        <TableRow key={id}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perms.create ?? false}
                              onCheckedChange={(c) => setPermissionForSelectedUser(id, "create", !!c)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perms.read ?? false}
                              onCheckedChange={(c) => setPermissionForSelectedUser(id, "read", !!c)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perms.update ?? false}
                              onCheckedChange={(c) => setPermissionForSelectedUser(id, "update", !!c)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={perms.delete ?? false}
                              onCheckedChange={(c) => setPermissionForSelectedUser(id, "delete", !!c)}
                            />
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
      </div>
    </Layout>
  );
}
