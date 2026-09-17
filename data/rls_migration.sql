-- =====================================================================
-- EVENTORA — Complete Auth + Profiles Migration
-- Run this ONCE in Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- ── 1. Profiles table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT,
    avatar_url  TEXT,
    phone       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. RLS on profiles ────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_upsert_own" ON public.profiles;

-- Each user can only read/write their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── 3. Auto-create profile on new Supabase Auth user ─────────────────
-- This trigger fires when a user signs up via Google, email, or any provider.
-- It copies safe metadata into public.profiles automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      ''
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 4. Add owner_id to events (Supabase UUID identity) ────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 5. RLS on events (drop old open policies first) ───────────────────
DROP POLICY IF EXISTS "Allow public all on events"  ON public.events;
DROP POLICY IF EXISTS "events_select_own"            ON public.events;
DROP POLICY IF EXISTS "events_insert_own"            ON public.events;
DROP POLICY IF EXISTS "events_update_own"            ON public.events;
DROP POLICY IF EXISTS "events_delete_own"            ON public.events;

CREATE POLICY "events_select_own" ON public.events
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "events_insert_own" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "events_update_own" ON public.events
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "events_delete_own" ON public.events
  FOR DELETE USING (auth.uid() = owner_id);

-- ── 6. Guests, expenses, bookings — scoped via event ownership ─────────
DROP POLICY IF EXISTS "Allow public all on guests"   ON public.guests;
DROP POLICY IF EXISTS "guests_select_own"             ON public.guests;
DROP POLICY IF EXISTS "guests_insert_own"             ON public.guests;
DROP POLICY IF EXISTS "guests_update_own"             ON public.guests;
DROP POLICY IF EXISTS "guests_delete_own"             ON public.guests;

CREATE POLICY "guests_select_own" ON public.guests FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "guests_insert_own" ON public.guests FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "guests_update_own" ON public.guests FOR UPDATE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "guests_delete_own" ON public.guests FOR DELETE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Allow public all on expenses"  ON public.expenses;
DROP POLICY IF EXISTS "expenses_select_own"            ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_own"            ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_own"            ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_own"            ON public.expenses;

CREATE POLICY "expenses_select_own" ON public.expenses FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "expenses_insert_own" ON public.expenses FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "expenses_update_own" ON public.expenses FOR UPDATE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "expenses_delete_own" ON public.expenses FOR DELETE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Allow public all on bookings"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_own"            ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own"            ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own"            ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_own"            ON public.bookings;

CREATE POLICY "bookings_select_own" ON public.bookings FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "bookings_insert_own" ON public.bookings FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "bookings_update_own" ON public.bookings FOR UPDATE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "bookings_delete_own" ON public.bookings FOR DELETE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Allow public all on payments"  ON public.payments;
DROP POLICY IF EXISTS "payments_select_own"            ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own"            ON public.payments;

CREATE POLICY "payments_select_own" ON public.payments FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "payments_insert_own" ON public.payments FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

-- ── 7. Vendors — public read-only catalog (no user writes from browser) ─
DROP POLICY IF EXISTS "Allow public all on vendors" ON public.vendors;
DROP POLICY IF EXISTS "vendors_select_all"           ON public.vendors;

CREATE POLICY "vendors_select_all" ON public.vendors FOR SELECT USING (true);

-- ── DONE ──────────────────────────────────────────────────────────────
-- Verify in Supabase Dashboard:
--   Authentication → URL Configuration:
--     Site URL:      https://eventorasite.netlify.app
--     Redirect URLs: https://eventorasite.netlify.app/
--                    http://localhost:3000/
--
--   Authentication → Providers → Google:
--     Enable Google provider
--     Client ID + Secret from Google Cloud Console
--     (Supabase callback: https://qihysexovrckrgsrqaeu.supabase.co/auth/v1/callback)
