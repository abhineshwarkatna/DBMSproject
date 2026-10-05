-- =====================================================================
-- EVENTORA — COMPLETE REAL-TIME MARKETPLACE & VENDOR SYNC MIGRATION
-- Database: Supabase PostgreSQL (3NF Normalized)
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =====================================================================

-- 1. DROP RESTRICTIVE RLS POLICIES ON VENDORS
-- ---------------------------------------------------------------------
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on vendors" ON public.vendors;
DROP POLICY IF EXISTS "vendors_select_all"           ON public.vendors;
DROP POLICY IF EXISTS "vendors_public_read"         ON public.vendors;
DROP POLICY IF EXISTS "vendors_owner_all"           ON public.vendors;
DROP POLICY IF EXISTS "vendors_admin_all"           ON public.vendors;
DROP POLICY IF EXISTS "vendors_authenticated_insert" ON public.vendors;
DROP POLICY IF EXISTS "vendors_authenticated_update" ON public.vendors;

-- 2. CREATE NON-BLOCKING RLS POLICIES FOR REAL-TIME MULTI-USER ACCESS
-- ---------------------------------------------------------------------
-- A. SELECT: Public read for all authenticated users & customers
-- (Newly created vendors are immediately visible; verification is not a blocker)
CREATE POLICY "vendors_public_select" ON public.vendors
    FOR SELECT USING (true);

-- B. INSERT: Allow vendors & authenticated users to register businesses directly
CREATE POLICY "vendors_public_insert" ON public.vendors
    FOR INSERT WITH CHECK (true);

-- C. UPDATE: Allow vendors to update business info, pricing, status
CREATE POLICY "vendors_public_update" ON public.vendors
    FOR UPDATE USING (true) WITH CHECK (true);

-- D. DELETE: Allow vendor deletion
CREATE POLICY "vendors_public_delete" ON public.vendors
    FOR DELETE USING (true);

-- 3. ENSURE BOOKINGS PERMISSIONS (CUSTOMER -> VENDOR REALTIME SYNC)
-- ---------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_own"          ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_own"          ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_own"          ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete_own"          ON public.bookings;

CREATE POLICY "bookings_public_select" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "bookings_public_insert" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "bookings_public_update" ON public.bookings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "bookings_public_delete" ON public.bookings FOR DELETE USING (true);

-- 4. ENSURE REALTIME REPLICA IDENTITY FULL (BROADCASTS FULL ROW PAYLOADS)
-- ---------------------------------------------------------------------
ALTER TABLE public.vendors  REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.events   REPLICA IDENTITY FULL;
ALTER TABLE public.users    REPLICA IDENTITY FULL;

-- 5. VERIFY & ADD TO SUPABASE_REALTIME PUBLICATION
-- ---------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table vendors already in publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table bookings already in publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table events already in publication';
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    EXCEPTION WHEN duplicate_object THEN
        RAISE NOTICE 'Table users already in publication';
    END;
END $$;

-- 6. VERIFICATION OUTPUT
-- ---------------------------------------------------------------------
SELECT 'Eventora Realtime Multi-User Sync Migration Applied Successfully!' AS status;
