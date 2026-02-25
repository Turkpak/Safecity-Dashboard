import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Shield, Moon, Sun, Lock, Globe, Save } from "lucide-react";
import { useTheme } from "@/hooks/use-theme.ts";

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Layout title="System Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-heading">Command Center Configuration</h2>
            <p className="text-muted-foreground">Manage your local monitoring preferences and system behavior.</p>
          </div>
          <Button className="bg-secondary hover:bg-secondary/90 text-white font-bold">
            <Save className="mr-2 h-4 w-4" /> Save All Changes
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-primary" />
                <CardTitle>Appearance & Display</CardTitle>
              </div>
              <CardDescription>Customize how the dashboard looks on your station.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">Switch between light and dark mission control themes.</p>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </div>
              <div className="space-y-2">
                <Label>Map Tile Provider</Label>
                <Select defaultValue="carto-dark">
                  <SelectTrigger>
                    <SelectValue placeholder="Select Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carto-dark">CartoDB Dark Matter</SelectItem>
                    <SelectItem value="osm">OpenStreetMap Standard</SelectItem>
                    <SelectItem value="satellite">Satellite Imagery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle>Operational Alerts</CardTitle>
              </div>
              <CardDescription>Configure which incidents trigger desktop notifications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Critical Incident Pulse</Label>
                  <p className="text-xs text-muted-foreground">High-severity incidents will flash the dashboard borders.</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Audio Warnings</Label>
                  <p className="text-xs text-muted-foreground">Play audible alerts for priority 1 emergencies.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <CardTitle>Authentication & Access</CardTitle>
              </div>
              <CardDescription>Secure your command center session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Officer ID</Label>
                  <Input defaultValue="PSCA-402-LHR" disabled />
                </div>
                <div className="space-y-2">
                  <Label>Session Timeout (min)</Label>
                  <Input type="number" defaultValue="60" />
                </div>
              </div>
              <Button variant="outline" className="w-full">Update Access Credentials</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}