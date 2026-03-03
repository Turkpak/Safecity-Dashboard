import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { listStakeholders, createUser, listUsers } from "@/api";
import { useState } from "react";
import { UserPlus, Users } from "lucide-react";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [stakeholderId, setStakeholderId] = useState<string>("");

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

  return (
    <Layout title="User Management">
      <div className="space-y-6">
        {/* Header with Add New User button on the right */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1">Create and view registered users.</p>
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
                Fill in the form below. All fields are required.
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
              All users added via the Add New User form. Total: {users.length}
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
