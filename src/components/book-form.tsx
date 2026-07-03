import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookValues = {
  title: string;
  subtitle: string;
  isbn: string;
  edition: string;
  language: string;
  description: string;
  shelf_number: string;
  category_id: string;
  publisher_id: string;
  department_id: string;
};

const empty: BookValues = {
  title: "",
  subtitle: "",
  isbn: "",
  edition: "",
  language: "English",
  description: "",
  shelf_number: "",
  category_id: "",
  publisher_id: "",
  department_id: "",
};

export function BookForm({
  mode,
  initial,
  onSubmitAction,
}: {
  mode: "create" | "edit";
  initial?: Record<string, unknown>;
  onSubmitAction: (values: BookValues, copiesToAdd: number) => Promise<void>;
}) {
  const [values, setValues] = useState<BookValues>(empty);
  const [copiesToAdd, setCopiesToAdd] = useState(mode === "create" ? 1 : 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setValues({
        title: (initial.title as string) ?? "",
        subtitle: (initial.subtitle as string) ?? "",
        isbn: (initial.isbn as string) ?? "",
        edition: (initial.edition as string) ?? "",
        language: (initial.language as string) ?? "English",
        description: (initial.description as string) ?? "",
        shelf_number: (initial.shelf_number as string) ?? "",
        category_id: (initial.category_id as string) ?? "",
        publisher_id: (initial.publisher_id as string) ?? "",
        department_id: (initial.department_id as string) ?? "",
      });
    }
  }, [initial]);

  const { data: cats } = useQuery({ queryKey: ["cats"], queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [] });
  const { data: pubs } = useQuery({ queryKey: ["pubs"], queryFn: async () => (await supabase.from("publishers").select("id, name").order("name")).data ?? [] });
  const { data: deps } = useQuery({ queryKey: ["deps"], queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [] });

  const set = (k: keyof BookValues, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      await onSubmitAction(values, copiesToAdd);
    } catch (err) {
      toast.error("Save failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">{mode === "create" ? "New book" : "Edit book"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="t">Title</Label>
            <Input id="t" value={values.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="st">Subtitle</Label>
              <Input id="st" value={values.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" value={values.isbn} onChange={(e) => set("isbn", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed">Edition</Label>
              <Input id="ed" value={values.edition} onChange={(e) => set("edition", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lang">Language</Label>
              <Input id="lang" value={values.language} onChange={(e) => set("language", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sh">Shelf number</Label>
              <Input id="sh" value={values.shelf_number} onChange={(e) => set("shelf_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={values.category_id} onValueChange={(v) => set("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Publisher</Label>
              <Select value={values.publisher_id} onValueChange={(v) => set("publisher_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {pubs?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={values.department_id} onValueChange={(v) => set("department_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {deps?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="copies">{mode === "create" ? "Initial copies" : "Add copies"}</Label>
            <Input
              id="copies"
              type="number"
              min={0}
              max={50}
              value={copiesToAdd}
              onChange={(e) => setCopiesToAdd(Number(e.target.value) || 0)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {mode === "create" ? "Create" : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
