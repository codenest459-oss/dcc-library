import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ArrowLeftRight, Search, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { issueBook, returnBook } from "@/lib/loans.functions";
import { searchBorrowers } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/loans")({
  head: () => ({ meta: [{ title: "Issue & Return — DCCLMS" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const list = (roles ?? []).map((r) => r.role);
    if (!list.includes("admin") && !list.includes("librarian")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoansAdmin,
});

function LoansAdmin() {
  const qc = useQueryClient();
  const returnFn = useServerFn(returnBook);

  const { data: loans } = useQuery({
    queryKey: ["all-loans"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("borrow_records")
        .select("id, issued_at, due_at, returned_at, status, user_id, books(title), book_copies(barcode)")
        .order("issued_at", { ascending: false })
        .limit(200);
      const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string | null }[] };
      const m = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (rows ?? []).map((r) => ({ ...r, borrower: m.get(r.user_id) ?? "—" }));
    },
  });

  const doReturn = useMutation({
    mutationFn: (id: string) => returnFn({ data: { borrow_record_id: id } }),
    onSuccess: (r) => {
      if (r.fine_amount > 0) {
        toast.success(`Returned — fine of ${r.fine_amount.toFixed(2)} issued (${r.late_days} days late).`);
      } else {
        toast.success("Book returned.");
      }
      qc.invalidateQueries({ queryKey: ["all-loans"] });
      qc.invalidateQueries({ queryKey: ["staff-stats"] });
    },
    onError: (e: Error) => toast.error("Return failed", { description: e.message }),
  });

  const active = loans?.filter((l) => l.status === "active") ?? [];
  const history = loans?.filter((l) => l.status !== "active") ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Issue & Return</h1>
          <p className="text-sm text-muted-foreground">Manage active borrows and process returns.</p>
        </div>
        <IssueDialog />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <Card>
            <CardContent className="p-0">
              {active.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} title="No active loans" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map((r) => {
                      const overdue = new Date(r.due_at) < new Date();
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.books?.title}</TableCell>
                          <TableCell>{r.borrower}</TableCell>
                          <TableCell className="font-mono text-xs">{r.book_copies?.barcode}</TableCell>
                          <TableCell className={overdue ? "text-destructive" : ""}>
                            <Clock className="mr-1 inline h-3 w-3" />
                            {format(new Date(r.due_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => doReturn.mutate(r.id)}
                              disabled={doReturn.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Return
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} title="No history yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Book</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Returned</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.books?.title}</TableCell>
                        <TableCell>{r.borrower}</TableCell>
                        <TableCell>{format(new Date(r.issued_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>{r.returned_at ? format(new Date(r.returned_at), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IssueDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [bookId, setBookId] = useState<string>("");
  const [copyId, setCopyId] = useState<string>("");
  const qc = useQueryClient();
  const issueFn = useServerFn(issueBook);
  const searchFn = useServerFn(searchBorrowers);

  const { data: borrowers } = useQuery({
    enabled: open,
    queryKey: ["borrowers", q],
    queryFn: () => searchFn({ data: { q } }),
  });

  const { data: books } = useQuery({
    enabled: open,
    queryKey: ["book-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("id, title").order("title").limit(200);
      return data ?? [];
    },
  });

  const { data: copies } = useQuery({
    enabled: open && !!bookId,
    queryKey: ["available-copies", bookId],
    queryFn: async () => {
      const { data } = await supabase
        .from("book_copies")
        .select("id, barcode")
        .eq("book_id", bookId)
        .eq("status", "available")
        .order("barcode");
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: () => issueFn({ data: { user_id: userId, copy_id: copyId } }),
    onSuccess: () => {
      toast.success("Book issued");
      setOpen(false);
      setUserId(""); setBookId(""); setCopyId(""); setQ("");
      qc.invalidateQueries({ queryKey: ["all-loans"] });
      qc.invalidateQueries({ queryKey: ["staff-stats"] });
    },
    onError: (e: Error) => toast.error("Issue failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><ArrowLeftRight className="mr-2 h-4 w-4" /> Issue book</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue a book</DialogTitle>
          <DialogDescription>Select the borrower, book, and an available copy.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Borrower</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name or university ID…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Choose borrower" /></SelectTrigger>
              <SelectContent>
                {borrowers?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.full_name ?? "(no name)"} {b.university_id ? `— ${b.university_id}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Book</Label>
            <Select value={bookId} onValueChange={(v) => { setBookId(v); setCopyId(""); }}>
              <SelectTrigger><SelectValue placeholder="Choose book" /></SelectTrigger>
              <SelectContent>
                {books?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Copy (barcode)</Label>
            <Select value={copyId} onValueChange={setCopyId} disabled={!bookId}>
              <SelectTrigger><SelectValue placeholder={bookId ? "Choose available copy" : "Pick a book first"} /></SelectTrigger>
              <SelectContent>
                {copies?.length === 0 && <div className="p-2 text-xs text-muted-foreground">No available copies.</div>}
                {copies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.barcode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!userId || !copyId || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
