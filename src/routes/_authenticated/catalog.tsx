import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({ meta: [{ title: "Catalog — ULMS" }] }),
  component: Catalog,
});

function Catalog() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [availability, setAvailability] = useState<"all" | "available">("all");

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id, name").order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["catalog", q, category, availability],
    queryFn: async () => {
      let query = supabase
        .from("books")
        .select("id, title, subtitle, isbn, cover_url, shelf_number, category_id, categories(name), book_copies(id, status)")
        .order("title")
        .limit(60);
      if (q.trim()) {
        const pattern = `%${q.trim()}%`;
        query = query.or(`title.ilike.${pattern},subtitle.ilike.${pattern},isbn.ilike.${pattern}`);
      }
      if (category !== "all") query = query.eq("category_id", category);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((b) => {
        const total = b.book_copies?.length ?? 0;
        const avail = b.book_copies?.filter((c) => c.status === "available").length ?? 0;
        return { ...b, total, avail };
      });
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return availability === "available" ? data.filter((b) => b.avail > 0) : data;
  }, [data, availability]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">Browse and search the entire library collection.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, subtitle or ISBN…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={availability} onValueChange={(v) => setAvailability(v as never)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any availability</SelectItem>
            <SelectItem value="available">Available now</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="No books found" description="Try adjusting your filters." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((b) => (
            <Link key={b.id} to="/catalog/$bookId" params={{ bookId: b.id }}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-semibold">{b.title}</h3>
                    <Badge variant={b.avail > 0 ? "default" : "secondary"} className="shrink-0">
                      {b.avail}/{b.total}
                    </Badge>
                  </div>
                  {b.subtitle && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{b.subtitle}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                    <span>{b.categories?.name ?? "—"}</span>
                    {b.shelf_number && <span className="font-mono">{b.shelf_number}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
