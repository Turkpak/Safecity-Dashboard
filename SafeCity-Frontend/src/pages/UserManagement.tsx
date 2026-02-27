import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { listStakeholders, createUser } from "@/api";
import { useState } from "react";
import { UserPlus } from "lucide-react";

export default function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [stakeholderId, setStakeholderId] = useState<string>("");

  const { data: stakeholders = [] } = useQuery({
    queryKey: ["stakeholders"],
    queryFn: listStakeholders,
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stakeholders"] });
      toast({ title: "Success", description: "User created successfully." });
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setStakeholderId("");
    },
    onError: (e: Error) => {
      toast({
        title: "Error",
        description: e.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

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
      toast({ title: "Validation Error", description: "Please select a stakeholder.", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({
      email: trimmedEmail,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      password,
      stakeholder: Number(stakeholderId),
    });
  };

  return (
    <Layout title="User Management">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">Create new users.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add New User
            </CardTitle>
            <CardDescription>
              Fill in the form below. All fields are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. sana@psc.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stakeholder">Stakeholder</Label>
                  <Select value={stakeholderId} onValueChange={setStakeholderId}>
                    <SelectTrigger id="stakeholder">
                      <SelectValue placeholder="Select stakeholder" />
                    </SelectTrigger>
                    <SelectContent>
                      {stakeholders.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.stakeholder_title} ({s.stakeholder_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    placeholder="e.g. Sana"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    placeholder="e.g. Admin"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Creating…" : "Create user"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
