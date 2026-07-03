import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ULMS" }] }),
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });

  const { data: profile } = useQuery({
    enabled: !!user,
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [fullName, setFullName] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setUniversityId(profile.university_id ?? "");
      setPhone(profile.phone ?? "");
      setDepartmentId(profile.department_id ?? "");
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          university_id: universityId || null,
          phone: phone || null,
          department_id: departmentId || null,
        })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account information.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Personal details</CardTitle></CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="uni">University ID</Label>
                <Input id="uni" value={universityId} onChange={(e) => setUniversityId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph">Phone</Label>
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
