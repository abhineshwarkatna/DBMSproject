-- =====================================================================
-- EVENTORA — Real Authentication RLS Migration
-- Run this in your Supabase SQL Editor (supabase.com → SQL Editor)
-- =====================================================================

-- ── Step 1: Create profiles table (bridges auth.uid() ↔ app data) ──
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT,
    phone       TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Step 2: Add owner_id to events (Supabase auth UUID) ──────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Step 3: Auto-create profile on new user signup ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    email      = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Step 4: Drop the insecure open-access policies ───────────────────
DROP POLICY IF EXISTS "Allow public all on users"    ON users;
DROP POLICY IF EXISTS "Allow public all on events"   ON events;
DROP POLICY IF EXISTS "Allow public all on vendors"  ON vendors;
DROP POLICY IF EXISTS "Allow public all on bookings" ON bookings;
DROP POLICY IF EXISTS "Allow public all on guests"   ON guests;
DROP POLICY IF EXISTS "Allow public all on expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public all on payments" ON payments;

-- ── Step 5: Enable RLS on profiles ───────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- profiles: each user can only see/edit their own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── Step 6: Events — owner_id based RLS ──────────────────────────────
CREATE POLICY "events_select_own"  ON events FOR SELECT  USING (auth.uid() = owner_id);
CREATE POLICY "events_insert_own"  ON events FOR INSERT  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "events_update_own"  ON events FOR UPDATE  USING (auth.uid() = owner_id);
CREATE POLICY "events_delete_own"  ON events FOR DELETE  USING (auth.uid() = owner_id);

-- ── Step 7: Guests — scoped via event ownership ───────────────────────
CREATE POLICY "guests_select_own" ON guests FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "guests_insert_own" ON guests FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "guests_update_own" ON guests FOR UPDATE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "guests_delete_own" ON guests FOR DELETE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

-- ── Step 8: Expenses — scoped via event ownership ────────────────────
CREATE POLICY "expenses_select_own" ON expenses FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "expenses_insert_own" ON expenses FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "expenses_update_own" ON expenses FOR UPDATE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "expenses_delete_own" ON expenses FOR DELETE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

-- ── Step 9: Bookings — scoped via event ownership ────────────────────
CREATE POLICY "bookings_select_own" ON bookings FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "bookings_insert_own" ON bookings FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "bookings_update_own" ON bookings FOR UPDATE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "bookings_delete_own" ON bookings FOR DELETE
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

-- ── Step 10: Payments — scoped via event ownership ───────────────────
CREATE POLICY "payments_select_own" ON payments FOR SELECT
  USING (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));
CREATE POLICY "payments_insert_own" ON payments FOR INSERT
  WITH CHECK (event_id IN (SELECT event_id FROM events WHERE owner_id = auth.uid()));

-- ── Step 11: Vendors — public read, no user writes ───────────────────
-- (vendors are a global catalog, not user-owned)
CREATE POLICY "vendors_select_all"  ON vendors FOR SELECT  USING (true);

-- ── DONE ──────────────────────────────────────────────────────────────
-- After running this script, go to:
-- Supabase Dashboard → Authentication → Providers → Google
-- Enable Google and add your OAuth Client ID & Secret.
-- Set Redirect URL to: https://<your-project>.supabase.co/auth/v1/callback
