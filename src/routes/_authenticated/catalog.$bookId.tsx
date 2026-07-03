import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Library } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/catalog/$bookId")({
  head: () => ({ meta: [{ title: "Book details — ULMS" }] }),
  component: BookDetail,
});

function BookDetail() {
  const { bookId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["book", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select(
          "id, title, subtitle, isbn, edition, language, description, shelf_number, cover_url, categories(name), publishers(name), departments(name), book_authors(authors(name)), book_copies(id, barcode, status)"
        )
        .eq("id", bookId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">Book not found.</div>;

  const available = data.book_copies?.filter((c) => c.status === "available").length ?? 0;
  const total = data.book_copies?.length ?? 0;
  const authors = data.book_authors?.map((ba) => ba.authors?.name).filter(Boolean).join(", ") || "—";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/catalog"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" /> Back to catalog</Button></Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{data.title}</CardTitle>
              {data.subtitle && <p className="mt-1 text-sm text-muted-foreground">{data.subtitle}</p>}
            </div>
            <Badge variant={available > 0 ? "default" : "secondary"} className="text-sm">
              {available}/{total} available
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Author(s)" value={authors} />
            <Field label="ISBN" value={data.isbn ?? "—"} />
            <Field label="Edition" value={data.edition ?? "—"} />
            <Field label="Language" value={data.language ?? "—"} />
            <Field label="Category" value={data.categories?.name ?? "—"} />
            <Field label="Publisher" value={data.publishers?.name ?? "—"} />
            <Field label="Department" value={data.departments?.name ?? "—"} />
            <Field label="Shelf" value={data.shelf_number ?? "—"} />
          </dl>
          {data.description && (
            <div>
              <h3 className="text-sm font-semibold">Description</h3>
              <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Copies</h3>
            <ul className="divide-y rounded-md border">
              {data.book_copies?.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-mono text-xs">{c.barcode}</span>
                  <Badge variant={c.status === "available" ? "default" : "secondary"} className="capitalize">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            <BookOpen className="mb-2 inline h-4 w-4" /> To borrow this book, visit the library
            desk. A librarian will issue an available copy using{" "}
            <Link to="/admin/loans" className="text-primary underline underline-offset-2">Issue / Return</Link>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
