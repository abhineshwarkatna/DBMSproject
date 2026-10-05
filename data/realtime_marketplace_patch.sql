-- ============================================================
-- EVENTORA LIVE MARKETPLACE — Supabase Realtime & Tables Patch
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================

-- 1. PROFILES TABLE (maps auth.users → roles)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','vendor','employee','admin')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. VENDORS TABLE — add missing columns
-- -------------------------------------------------------
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_service_category_check;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_name    TEXT,
  ADD COLUMN IF NOT EXISTS service_category TEXT,
  ADD COLUMN IF NOT EXISTS contact_name     TEXT,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS location         TEXT DEFAULT 'Hyderabad',
  ADD COLUMN IF NOT EXISTS service_area     TEXT DEFAULT 'Telangana & AP',
  ADD COLUMN IF NOT EXISTS starting_price   NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,
  ADD COLUMN IF NOT EXISTS rating           NUMERIC(3,1) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS review_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending','Verified','Rejected','Suspended')),
  ADD COLUMN IF NOT EXISTS storefront_status TEXT DEFAULT 'ONLINE' CHECK (storefront_status IN ('ONLINE','OFFLINE')),
  ADD COLUMN IF NOT EXISTS is_published     BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();

-- 3. VENDOR_SERVICES TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_services (
  service_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id      BIGINT REFERENCES public.vendors(vendor_id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  base_price     NUMERIC(12,2) NOT NULL DEFAULT 0,
  pricing_model  TEXT NOT NULL DEFAULT 'per_person' CHECK (pricing_model IN ('per_person','flat_rate','per_hour','per_day')),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VENDOR_PACKAGES TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_packages (
  package_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id   BIGINT REFERENCES public.vendors(vendor_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_type  TEXT DEFAULT 'person',
  is_popular  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOOKINGS TABLE — add customer_id & booking_status
-- -------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendor_id        BIGINT REFERENCES public.vendors(vendor_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id       BIGINT REFERENCES public.vendor_services(service_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id       BIGINT REFERENCES public.vendor_packages(package_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_count      INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS event_date       DATE,
  ADD COLUMN IF NOT EXISTS subtotal         NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax              NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee      NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate  NUMERIC(5,4) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount     NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_status   TEXT DEFAULT 'REQUESTED'
    CHECK (booking_status IN ('REQUESTED','PENDING_VENDOR','ACCEPTED','REJECTED','PAYMENT_PENDING','CONFIRMED','ASSIGNED','IN_PROGRESS','READY','COMPLETED','CANCELLED','REFUNDED')),
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ DEFAULT NOW();

-- 6. NOTIFICATIONS TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'customer',
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  link            TEXT,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id  ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vendor_id    ON public.bookings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id       ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status        ON public.vendors(verification_status);

-- 7. ENABLE REALTIME on all marketplace tables
-- -------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_packages;

-- 8. ROW LEVEL SECURITY (RLS)
-- -------------------------------------------------------
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_packages    ENABLE ROW LEVEL SECURITY;

-- Profiles: users see their own profile
CREATE POLICY IF NOT EXISTS "profiles_own" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Admins see all profiles (for notifications targeting)
CREATE POLICY IF NOT EXISTS "profiles_admin_read" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Notifications: users see their own
CREATE POLICY IF NOT EXISTS "notifs_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- Vendors: public SELECT on verified and online vendors only (for marketplace)
CREATE POLICY IF NOT EXISTS "vendors_public_read" ON public.vendors
  FOR SELECT USING ((is_verified = true OR verification_status = 'Verified') AND (storefront_status IS NULL OR storefront_status = 'ONLINE') AND (is_published IS NULL OR is_published = true));

-- Vendors: owner can update their own listing
CREATE POLICY IF NOT EXISTS "vendors_owner_all" ON public.vendors
  FOR ALL USING (auth.uid() = user_id);

-- Admin bypass all RLS on vendors
CREATE POLICY IF NOT EXISTS "vendors_admin_all" ON public.vendors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Vendor services & packages: anyone can read active ones
CREATE POLICY IF NOT EXISTS "services_public_read" ON public.vendor_services
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY IF NOT EXISTS "packages_public_read" ON public.vendor_packages
  FOR SELECT USING (TRUE);

-- Bookings: customer sees their own, vendor sees bookings for their vendor_id
CREATE POLICY IF NOT EXISTS "bookings_customer_own" ON public.bookings
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY IF NOT EXISTS "bookings_vendor_own" ON public.bookings
  FOR ALL USING (
    vendor_id IN (SELECT vendor_id FROM public.vendors WHERE user_id = auth.uid())
  );

-- Admins see all bookings
CREATE POLICY IF NOT EXISTS "bookings_admin_all" ON public.bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Allow anon / authenticated to INSERT bookings (customer creates)
CREATE POLICY IF NOT EXISTS "bookings_customer_insert" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Allow notification inserts from any authenticated user (server-side trigger pattern)
CREATE POLICY IF NOT EXISTS "notifs_service_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

SELECT 'Eventora Live Marketplace patch applied successfully!' AS result;
