-- =====================================================================
-- EVENTORA — Onboarding Patch Migration v2
-- Adds vendor/staff profile metadata columns and improves handle_new_user trigger
-- Safely run this AFTER eventora_ecosystem_migration.sql
-- =====================================================================

-- ── 1. Add new profile columns for role-based onboarding metadata ────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service_category TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vendor_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email';

-- ── 2. Update handle_new_user trigger to capture all onboarding fields ─
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_avatar TEXT;
  v_biz_name TEXT;
  v_category TEXT;
  v_city TEXT;
  v_vendor_id TEXT;
  v_role_title TEXT;
  v_area TEXT;
  v_provider TEXT;
BEGIN
  -- Extract role from metadata (set during signup Step 2)
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'customer'
  );

  -- Validate role is one of the allowed values
  IF v_role NOT IN ('customer', 'vendor', 'employee', 'admin') THEN
    v_role := 'customer';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  v_provider := COALESCE(
    NEW.raw_user_meta_data->>'provider',
    NEW.raw_app_meta_data->>'provider',
    'email'
  );

  -- Vendor-specific fields
  v_biz_name  := NEW.raw_user_meta_data->>'businessName';
  v_category  := NEW.raw_user_meta_data->>'category';
  v_city      := NEW.raw_user_meta_data->>'city';
  v_vendor_id := NEW.raw_user_meta_data->>'vendorId';

  -- Employee/staff-specific fields
  v_role_title := NEW.raw_user_meta_data->>'roleTitle';
  v_area       := NEW.raw_user_meta_data->>'area';

  INSERT INTO public.profiles (
    id, full_name, email, role, avatar_url,
    business_name, service_category, city, vendor_id,
    role_title, area, provider
  )
  VALUES (
    NEW.id,
    v_name,
    NEW.email,
    v_role,
    v_avatar,
    v_biz_name,
    v_category,
    v_city,
    v_vendor_id,
    v_role_title,
    v_area,
    v_provider
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    email            = EXCLUDED.email,
    role             = EXCLUDED.role,
    business_name    = COALESCE(EXCLUDED.business_name, profiles.business_name),
    service_category = COALESCE(EXCLUDED.service_category, profiles.service_category),
    city             = COALESCE(EXCLUDED.city, profiles.city),
    vendor_id        = COALESCE(EXCLUDED.vendor_id, profiles.vendor_id),
    role_title       = COALESCE(EXCLUDED.role_title, profiles.role_title),
    area             = COALESCE(EXCLUDED.area, profiles.area),
    provider         = COALESCE(EXCLUDED.provider, profiles.provider),
    updated_at       = NOW();

  RETURN NEW;
END;
$$;

-- Re-attach trigger (in case it was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 3. RLS: Vendors can also view their OWN profile ──────────────────
DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;
CREATE POLICY "profiles_self_access" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- ── 4. Add helpful index for role-based queries ───────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_category ON public.profiles(service_category);

-- ── Done ──────────────────────────────────────────────────────────────
SELECT 'Eventora Onboarding Patch v2 applied successfully ✓' AS status;
