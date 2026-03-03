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
import { useState } from "react";
import { UserPlus, Users, ShieldAlert } from "lucide-react";
import type { UserCrudPermissions } from "@/api/types";

/** Normalize role from login (backend may return super_admin or Super Admin) */
function isSuperAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return r === "super_admin" || r === "super admin";
}

const DEFAULT_CRUD: UserCrudPermissions = {
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
  const [permissions, setPermissions] = useState<UserCrudPermissions>({ ...DEFAULT_CRUD });

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
    setPermissions({ ...DEFAULT_CRUD });
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
      permissions: isSuperAdmin ? permissions : undefined,
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">Create and assign users (Contractor / Consultant) and their CRUD permissions.</p>
          </div>
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
                Assign role (Contractor or Consultant) and which CRUD operations this user can perform on the app.
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
              <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <Label className="text-sm font-semibold">CRUD permissions</Label>
                <p className="text-xs text-muted-foreground">Choose which operations this user can perform across the app.</p>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={permissions.create ?? false}
                      onCheckedChange={(c) => setPermissions((p) => ({ ...p, create: !!c }))}
                    />
                    <span className="text-sm">Create</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={permissions.read ?? false}
                      onCheckedChange={(c) => setPermissions((p) => ({ ...p, read: !!c }))}
                    />
                    <span className="text-sm">Read</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={permissions.update ?? false}
                      onCheckedChange={(c) => setPermissions((p) => ({ ...p, update: !!c }))}
                    />
                    <span className="text-sm">Update</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={permissions.delete ?? false}
                      onCheckedChange={(c) => setPermissions((p) => ({ ...p, delete: !!c }))}
                    />
                    <span className="text-sm">Delete</span>
                  </label>
                </div>
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
              Users added by Super Admin. Role and CRUD permissions are assigned when creating a user. Total: {users.length}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
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
                      </TableRow>
                    ))}
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
