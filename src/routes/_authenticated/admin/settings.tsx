import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "System settings — DCCLMS Admin" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) throw redirect({ to: "/dashboard" });
  },
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("system_settings").select("*").eq("id", true).maybeSingle()).data,
  });

  const [values, setValues] = useState({
    daily_fine_rate: 5,
    student_limit: 5,
    student_days: 15,
    faculty_limit: 10,
    faculty_days: 30,
  });

  useEffect(() => {
    if (data) {
      setValues({
        daily_fine_rate: Number(data.daily_fine_rate),
        student_limit: data.student_limit,
        student_days: data.student_days,
        faculty_limit: data.faculty_limit,
        faculty_days: data.faculty_days,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_settings").update(values).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings updated"); qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError: (e: Error) => toast.error("Failed", { description: e.message }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System settings</h1>
        <p className="text-sm text-muted-foreground">Adjust loan limits, loan periods, and the daily fine rate.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Borrow rules</CardTitle>
          <CardDescription>Applied to every new issue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          >
            <div className="space-y-2">
              <Label>Daily fine rate</Label>
              <Input type="number" min={0} step="0.5" value={values.daily_fine_rate}
                onChange={(e) => setValues({ ...values, daily_fine_rate: Number(e.target.value) })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Student book limit</Label>
                <Input type="number" min={1} value={values.student_limit}
                  onChange={(e) => setValues({ ...values, student_limit: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Student loan days</Label>
                <Input type="number" min={1} value={values.student_days}
                  onChange={(e) => setValues({ ...values, student_days: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Faculty book limit</Label>
                <Input type="number" min={1} value={values.faculty_limit}
                  onChange={(e) => setValues({ ...values, faculty_limit: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Faculty loan days</Label>
                <Input type="number" min={1} value={values.faculty_days}
                  onChange={(e) => setValues({ ...values, faculty_days: Number(e.target.value) })} />
              </div>
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
