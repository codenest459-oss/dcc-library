import { createFileRoute, Link } from "@tanstack/react-router";
import { Library, BookOpen, Users, Shield, ArrowRight, BarChart3, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Library className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">DCCLMS</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          The modern operating system
          <br />
          for the Dhaka City College library.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          DCCLMS brings catalog management, borrowing, fines, and analytics into one clean,
          role-based workspace for administrators, librarians, faculty, and students.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button size="lg">
              Create your account <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: "Catalog & inventory",
              desc: "Track books, copies, categories, and shelves with real availability.",
            },
            {
              icon: Users,
              title: "Role-based access",
              desc: "Distinct workflows for admins, librarians, faculty, and students.",
            },
            {
              icon: Shield,
              title: "Row-level security",
              desc: "Every read and write is protected by database-level policies.",
            },
            {
              icon: BarChart3,
              title: "Live dashboards",
              desc: "See loans, overdues, popular books, and fines at a glance.",
            },
            {
              icon: Bell,
              title: "In-app notifications",
              desc: "Users are notified on issue, return, due date, and fines.",
            },
            {
              icon: Library,
              title: "Fine automation",
              desc: "Configurable daily rate calculates fines automatically on return.",
            },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()}&nbsp;DCCLMS — Dhaka City College Library Management System.
        </div>
      </footer>
    </div>
  );
}
