# University Library Management System — Phase 1 MVP Plan

Stack adapted to this project: **TanStack Start (React 19 + Vite) + Tailwind + shadcn/ui + managed Supabase**. Everything else follows your spec (roles, RLS, modules, SaaS-style UI).

## Phase 1 Scope

In scope now:

- Authentication (email/password + Google) with 4 roles: Admin, Librarian, Student, Faculty
- Book catalog: books, authors, categories, publishers, departments, copies
- Borrow / Return workflow with limits + loan periods per role
- Fine calculation (configurable daily rate)
- Admin, Librarian, Student/Faculty dashboards
- In-app notifications (bell + table)
- Seed data (sample users per role, ~30 books, some active loans/fines)
- Audit logs (basic write trail)
- Light/Dark mode, responsive, shadcn SaaS styling (Notion/Linear/Vercel feel)

Deferred to Phase 2: reservations queue, email delivery, PDF/Excel/CSV report export, advanced analytics charts, barcode scanning, file uploads for PDFs.

## Design Direction

- Palette: white / slate / gray with a single professional blue accent (`oklch` tokens in `src/styles.css`); no rainbow dashboards.
- Typography: Inter (via `<link>` in `__root.tsx` head, per Tailwind v4 rules).
- Layout: shadcn `Sidebar` (collapsible icon mode) + top bar with role badge, theme toggle, notifications bell, user menu.
- Components: shadcn Card, Table (with pagination + filters), Dialog, Sheet, Form (react-hook-form + zod), Sonner toasts, Skeleton loaders, empty states.

## Route Architecture

```
src/routes/
  __root.tsx                 (head metadata, providers, sidebar layout host)
  index.tsx                  (public landing → CTA to /auth)
  auth.tsx                   (login / signup / forgot password tabs)
  auth.reset-password.tsx    (recovery flow)
  _authenticated/
    route.tsx                (managed gate, ssr:false)
    dashboard.tsx            (role-aware dashboard)
    catalog.tsx              (browse/search books - all roles)
    catalog.$bookId.tsx      (book detail + borrow/reserve action)
    my-loans.tsx             (student/faculty active + history)
    my-fines.tsx
    notifications.tsx
    profile.tsx
    admin/                   (admin + librarian gated in beforeLoad via has_role)
      books.tsx              (CRUD)
      books.new.tsx
      books.$bookId.edit.tsx
      authors.tsx
      categories.tsx
      publishers.tsx
      departments.tsx
      users.tsx              (admin only)
      loans.tsx              (issue/return console)
      fines.tsx
      audit-logs.tsx         (admin only)
      settings.tsx           (fine rate, loan rules — admin only)
```

## Database Schema (Supabase migrations)

Enum `app_role`: `admin | librarian | student | faculty`.

Tables (all `public`, with GRANTs + RLS + policies):

- `profiles` (id → auth.users, full_name, university_id, department_id, phone, avatar_url, created_at)
- `user_roles` (id, user_id, role) — separate table per security rules; `has_role()` SECURITY DEFINER fn
- `departments` (id, name, code)
- `authors` (id, name, bio)
- `categories` (id, name, slug)
- `publishers` (id, name)
- `books` (id, isbn, title, subtitle, edition, language, description, cover_url, category_id, publisher_id, department_id, shelf_number, keywords[], created_at)
- `book_authors` (book_id, author_id) — M2M
- `book_copies` (id, book_id, barcode, status: `available|borrowed|lost|damaged`, acquired_at)
- `borrow_records` (id, copy_id, book_id, user_id, issued_by, issued_at, due_at, returned_at, returned_by, status: `active|returned|overdue|lost`)
- `fines` (id, borrow_record_id, user_id, amount, reason, status: `unpaid|paid|waived`, created_at, paid_at)
- `notifications` (id, user_id, type, title, body, read_at, created_at)
- `audit_logs` (id, actor_id, action, entity, entity_id, meta jsonb, created_at)
- `system_settings` (singleton row: daily_fine_rate, student_limit, student_days, faculty_limit, faculty_days)

Indexes on foreign keys, `books(title)`, `books(isbn)`, `borrow_records(user_id, status)`, `book_copies(book_id, status)`.

## Access & Business Rules (enforced in RLS + server functions)

- `profiles`: user reads/updates own; admin/librarian read all.
- `user_roles`: user reads own; only admin writes (via `has_role`).
- Catalog tables (`books`, `authors`, `categories`, `publishers`, `departments`, `book_copies`): SELECT for `authenticated`; INSERT/UPDATE/DELETE only if `has_role(admin)` OR `has_role(librarian)`.
- `borrow_records`: user reads own; librarian/admin read all + write. Issue/return goes through `createServerFn` with `requireSupabaseAuth`, wraps in a transaction (rpc), validates limits/fines/availability.
- `fines`: user reads own; librarian/admin write.
- `notifications`: user reads/updates own.
- `audit_logs`: admin read only; writes only from server functions using service role after auth check.
- `system_settings`: authenticated read; admin write.

Borrow validation (server function `issueBook`):

1. Verify actor is librarian/admin OR self-checkout allowed.
2. Check user has no unpaid fines.
3. Check active loan count < role limit (5 student / 10 faculty).
4. Reserve copy: update `book_copies.status = 'borrowed'`.
5. Insert `borrow_records` with `due_at = now() + role_days`.
6. Insert notification + audit log.

Return (`returnBook`): compute `late_days`, if > 0 insert `fines` at `daily_fine_rate × late_days`, set copy back to `available`, notify, audit.

## Server Functions (`src/lib/*.functions.ts`)

- `books.functions.ts` — list/search (public via publishable client for catalog SSR), create/update/delete (admin/librarian)
- `taxonomy.functions.ts` — authors/categories/publishers/departments CRUD
- `loans.functions.ts` — `issueBook`, `returnBook`, `myLoans`, `allLoans`
- `fines.functions.ts` — `myFines`, `markPaid`, `waive`
- `notifications.functions.ts` — `list`, `markRead`, `markAllRead`
- `dashboard.functions.ts` — role-aware stats aggregations
- `settings.functions.ts` — read/update fine rate + limits
- `admin-users.functions.ts` — list users, assign role (uses `supabaseAdmin` inside handler after admin check)

All follow `.middleware([requireSupabaseAuth]).inputValidator(zod).handler(...)`. Data reads use TanStack Query pattern (`ensureQueryData` in loader + `useSuspenseQuery` in component).

## UI Components

- `AppSidebar` — role-filtered nav items
- `RoleBadge`, `ThemeToggle`, `NotificationsBell`, `UserMenu`
- `BookCard`, `BookTable` (with column filters, pagination)
- `BookForm`, `TaxonomyForm` (react-hook-form + zod, shadcn Form)
- `IssueBookDialog`, `ReturnBookDialog`
- `StatCard`, `EmptyState`, `ConfirmDialog`, `DataTable` (generic wrapper around shadcn Table)

## Seed Data (migration)

- 4 demo users (one per role) — created via SQL insert into `auth.users` is not allowed, so seed will insert domain data and provide **credentials + a one-time signup script** the user runs from the auth page. Alternative: seed only domain data (departments, authors, categories, publishers, ~30 books with copies) and prompt user to sign up 4 accounts; I'll add a "Promote to role" admin panel and pre-assign roles by email in a trigger for known seed emails.
- 30 books across 6 categories, 3–5 copies each, ~10 active loans, 2 overdue with fines.

## Verification Checklist

- Build passes; `_authenticated` gate redirects to `/auth`.
- Login as each role → sidebar shows correct items.
- Librarian issues book to student → copy count decrements, notification appears.
- Force `due_at` into past → return calculates fine correctly.
- Student with unpaid fine blocked from new borrow with clear toast.
- Dark/light mode, mobile layout, keyboard nav on tables & dialogs.

## Technical Notes (for engineers)

- Tailwind v4: tokens in `src/styles.css` (no config file); Inter loaded via `<link>` in root head.
- Supabase clients per rules: browser client in components, `requireSupabaseAuth` for user-scoped server fns, publishable-key server client for public catalog SSR reads, `supabaseAdmin` only inside handlers after role check.
- Every new `public` table ships with `GRANT` block + RLS + policies in the same migration.
- `has_role()` SECURITY DEFINER function to avoid RLS recursion.
- All forms validated with zod on client and re-validated in server fn `.inputValidator`.
- `router.invalidate()` + `queryClient.invalidateQueries` on mutations.

## After Phase 1 Approval

Phase 2 backlog (not built now): reservations queue + notify-on-available, Resend email integration, PDF/Excel/CSV exports (jspdf + xlsx), analytics charts (Recharts), book cover uploads to Supabase Storage, barcode scan input.

Approve to start Phase 1; I'll enable Lovable Cloud, run the schema migration + seed, then build routes and UI.