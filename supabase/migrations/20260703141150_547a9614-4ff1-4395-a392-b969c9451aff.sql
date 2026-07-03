
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'librarian', 'student', 'faculty');
CREATE TYPE public.copy_status AS ENUM ('available', 'borrowed', 'lost', 'damaged');
CREATE TYPE public.loan_status AS ENUM ('active', 'returned', 'overdue', 'lost');
CREATE TYPE public.fine_status AS ENUM ('unpaid', 'paid', 'waived');

-- =========================================
-- UPDATED_AT trigger fn
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  university_id TEXT,
  phone TEXT,
  avatar_url TEXT,
  department_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER_ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1 WHEN 'librarian' THEN 2
    WHEN 'faculty' THEN 3 WHEN 'student' THEN 4 END
  LIMIT 1;
$$;

CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles policies (after has_role exists)
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles admin manage" ON public.profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- Auto-create profile + assign role on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  -- Seeded demo accounts get their role by email
  v_role := CASE lower(NEW.email)
    WHEN 'admin@ulms.edu' THEN 'admin'::public.app_role
    WHEN 'librarian@ulms.edu' THEN 'librarian'::public.app_role
    WHEN 'faculty@ulms.edu' THEN 'faculty'::public.app_role
    ELSE 'student'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- DEPARTMENTS
-- =========================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments admin write" ON public.departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_fk
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- =========================================
-- AUTHORS / CATEGORIES / PUBLISHERS
-- =========================================
CREATE TABLE public.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.authors TO authenticated;
GRANT ALL ON public.authors TO service_role;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authors read" ON public.authors FOR SELECT TO authenticated USING (true);
CREATE POLICY "authors staff write" ON public.authors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories staff write" ON public.categories FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

CREATE TABLE public.publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.publishers TO authenticated;
GRANT ALL ON public.publishers TO service_role;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publishers read" ON public.publishers FOR SELECT TO authenticated USING (true);
CREATE POLICY "publishers staff write" ON public.publishers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

-- =========================================
-- BOOKS
-- =========================================
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn TEXT UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  edition TEXT,
  language TEXT DEFAULT 'English',
  description TEXT,
  cover_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  publisher_id UUID REFERENCES public.publishers(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  shelf_number TEXT,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "books read" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "books staff write" ON public.books FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE INDEX books_title_idx ON public.books USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(subtitle,'') || ' ' || coalesce(description,'')));
CREATE INDEX books_category_idx ON public.books(category_id);
CREATE TRIGGER trg_books_updated BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.book_authors (
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, author_id)
);
GRANT SELECT ON public.book_authors TO authenticated;
GRANT ALL ON public.book_authors TO service_role;
ALTER TABLE public.book_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_authors read" ON public.book_authors FOR SELECT TO authenticated USING (true);
CREATE POLICY "book_authors staff write" ON public.book_authors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

-- =========================================
-- BOOK COPIES
-- =========================================
CREATE TABLE public.book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL UNIQUE,
  status public.copy_status NOT NULL DEFAULT 'available',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.book_copies TO authenticated;
GRANT ALL ON public.book_copies TO service_role;
ALTER TABLE public.book_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "book_copies read" ON public.book_copies FOR SELECT TO authenticated USING (true);
CREATE POLICY "book_copies staff write" ON public.book_copies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE INDEX book_copies_book_status_idx ON public.book_copies(book_id, status);

-- =========================================
-- BORROW RECORDS
-- =========================================
CREATE TABLE public.borrow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id UUID NOT NULL REFERENCES public.book_copies(id) ON DELETE RESTRICT,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  returned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.loan_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.borrow_records TO authenticated;
GRANT ALL ON public.borrow_records TO service_role;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "borrow_records self read" ON public.borrow_records FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE POLICY "borrow_records staff write" ON public.borrow_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE INDEX borrow_user_status_idx ON public.borrow_records(user_id, status);

-- =========================================
-- FINES
-- =========================================
CREATE TABLE public.fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrow_record_id UUID REFERENCES public.borrow_records(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  status public.fine_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
GRANT SELECT ON public.fines TO authenticated;
GRANT ALL ON public.fines TO service_role;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fines self read" ON public.fines FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));
CREATE POLICY "fines staff write" ON public.fines FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'librarian'));

-- =========================================
-- NOTIFICATIONS
-- =========================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications self read" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "notifications self update" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- =========================================
-- AUDIT LOGS
-- =========================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- SYSTEM SETTINGS (singleton)
-- =========================================
CREATE TABLE public.system_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  daily_fine_rate NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  student_limit INT NOT NULL DEFAULT 5,
  student_days INT NOT NULL DEFAULT 15,
  faculty_limit INT NOT NULL DEFAULT 10,
  faculty_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = true)
);
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.system_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.system_settings (id) VALUES (true);

-- =========================================
-- SEED taxonomy + books (no auth users)
-- =========================================
INSERT INTO public.departments (name, code) VALUES
  ('Computer Science & Engineering','CSE'),
  ('Electrical Engineering','EE'),
  ('Mechanical Engineering','ME'),
  ('Mathematics','MATH'),
  ('Physics','PHY'),
  ('Business Administration','BBA');

INSERT INTO public.categories (name, slug) VALUES
  ('Computer Science','computer-science'),
  ('Mathematics','mathematics'),
  ('Physics','physics'),
  ('Engineering','engineering'),
  ('Business','business'),
  ('Literature','literature');

INSERT INTO public.publishers (name) VALUES
  ('MIT Press'),('O''Reilly Media'),('Pearson'),('Cambridge University Press'),
  ('Oxford University Press'),('McGraw-Hill'),('Wiley');

INSERT INTO public.authors (name) VALUES
  ('Thomas H. Cormen'),('Robert C. Martin'),('Donald E. Knuth'),
  ('Andrew S. Tanenbaum'),('Gilbert Strang'),('Richard P. Feynman'),
  ('Kip S. Thorne'),('Michael E. Porter'),('Yuval Noah Harari'),
  ('Kernighan & Ritchie');

DO $seed$
DECLARE
  cse UUID; ee UUID; math UUID; phy UUID; bba UUID;
  cat_cs UUID; cat_math UUID; cat_phy UUID; cat_eng UUID; cat_biz UUID; cat_lit UUID;
  pub_mit UUID; pub_or UUID; pub_pear UUID; pub_cam UUID; pub_ox UUID; pub_mh UUID; pub_wi UUID;
  a1 UUID; a2 UUID; a3 UUID; a4 UUID; a5 UUID; a6 UUID; a7 UUID; a8 UUID; a9 UUID; a10 UUID;
  b UUID; i INT;
BEGIN
  SELECT id INTO cse FROM public.departments WHERE code='CSE';
  SELECT id INTO ee FROM public.departments WHERE code='EE';
  SELECT id INTO math FROM public.departments WHERE code='MATH';
  SELECT id INTO phy FROM public.departments WHERE code='PHY';
  SELECT id INTO bba FROM public.departments WHERE code='BBA';

  SELECT id INTO cat_cs FROM public.categories WHERE slug='computer-science';
  SELECT id INTO cat_math FROM public.categories WHERE slug='mathematics';
  SELECT id INTO cat_phy FROM public.categories WHERE slug='physics';
  SELECT id INTO cat_eng FROM public.categories WHERE slug='engineering';
  SELECT id INTO cat_biz FROM public.categories WHERE slug='business';
  SELECT id INTO cat_lit FROM public.categories WHERE slug='literature';

  SELECT id INTO pub_mit FROM public.publishers WHERE name='MIT Press';
  SELECT id INTO pub_or FROM public.publishers WHERE name='O''Reilly Media';
  SELECT id INTO pub_pear FROM public.publishers WHERE name='Pearson';
  SELECT id INTO pub_cam FROM public.publishers WHERE name='Cambridge University Press';
  SELECT id INTO pub_ox FROM public.publishers WHERE name='Oxford University Press';
  SELECT id INTO pub_mh FROM public.publishers WHERE name='McGraw-Hill';
  SELECT id INTO pub_wi FROM public.publishers WHERE name='Wiley';

  SELECT id INTO a1 FROM public.authors WHERE name='Thomas H. Cormen';
  SELECT id INTO a2 FROM public.authors WHERE name='Robert C. Martin';
  SELECT id INTO a3 FROM public.authors WHERE name='Donald E. Knuth';
  SELECT id INTO a4 FROM public.authors WHERE name='Andrew S. Tanenbaum';
  SELECT id INTO a5 FROM public.authors WHERE name='Gilbert Strang';
  SELECT id INTO a6 FROM public.authors WHERE name='Richard P. Feynman';
  SELECT id INTO a7 FROM public.authors WHERE name='Kip S. Thorne';
  SELECT id INTO a8 FROM public.authors WHERE name='Michael E. Porter';
  SELECT id INTO a9 FROM public.authors WHERE name='Yuval Noah Harari';
  SELECT id INTO a10 FROM public.authors WHERE name='Kernighan & Ritchie';

  -- Helper to insert book + copies + author
  INSERT INTO public.books (isbn,title,subtitle,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780262046305','Introduction to Algorithms','CLRS','4th',cat_cs,pub_mit,cse,'CS-A-01','The definitive algorithms textbook.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a1);
  FOR i IN 1..4 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-CLRS-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,subtitle,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780132350884','Clean Code','A Handbook of Agile Software Craftsmanship','1st',cat_cs,pub_pear,cse,'CS-A-02','Writing readable, maintainable code.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a2);
  FOR i IN 1..3 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-CLEAN-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,subtitle,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780201896831','The Art of Computer Programming','Volume 1: Fundamental Algorithms','3rd',cat_cs,pub_pear,cse,'CS-A-03','Knuth''s masterwork.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a3);
  FOR i IN 1..2 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-TAOCP-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780133594140','Modern Operating Systems','4th',cat_cs,pub_pear,cse,'CS-B-01','Comprehensive OS textbook.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a4);
  FOR i IN 1..3 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-MOS-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780131103627','The C Programming Language','2nd',cat_cs,pub_pear,cse,'CS-B-02','K&R C — the classic.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a10);
  FOR i IN 1..5 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-KNR-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780980232776','Introduction to Linear Algebra','5th',cat_math,pub_cam,math,'MA-A-01','Strang''s standard reference.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a5);
  FOR i IN 1..4 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-LINALG-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780465025275','The Feynman Lectures on Physics','1st',cat_phy,pub_ox,phy,'PH-A-01','Legendary undergrad physics lectures.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a6);
  FOR i IN 1..3 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-FEYN-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780393338102','Black Holes and Time Warps','1st',cat_phy,pub_ox,phy,'PH-A-02','Einstein''s outrageous legacy.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a7);
  FOR i IN 1..2 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-BHTW-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780684841489','Competitive Strategy','1st',cat_biz,pub_mh,bba,'BZ-A-01','Techniques for analyzing industries.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a8);
  FOR i IN 1..3 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-COMP-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780062316097','Sapiens','A Brief History of Humankind',cat_lit,pub_ox,bba,'LT-A-01','Yuval Noah Harari''s bestseller.') RETURNING id INTO b;
  INSERT INTO public.book_authors VALUES (b,a9);
  FOR i IN 1..4 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-SAP-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9781491950357','Designing Data-Intensive Applications','1st',cat_cs,pub_or,cse,'CS-C-01','Modern data systems fundamentals.') RETURNING id INTO b;
  FOR i IN 1..3 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-DDIA-'||i); END LOOP;

  INSERT INTO public.books (isbn,title,edition,category_id,publisher_id,department_id,shelf_number,description)
  VALUES ('9780596007126','Head First Design Patterns','1st',cat_cs,pub_or,cse,'CS-C-02','Approachable design patterns book.') RETURNING id INTO b;
  FOR i IN 1..2 LOOP INSERT INTO public.book_copies(book_id,barcode) VALUES (b,'BC-HFDP-'||i); END LOOP;
END; $seed$;
