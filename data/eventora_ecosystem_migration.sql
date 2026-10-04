-- =====================================================================
-- EVENTORA — Full Commercial Multi-Role Ecosystem Schema & RLS Policies
-- Roles: Customer | Vendor | Eventora Employee / Field Staff | Admin
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES & ROLES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'vendor', 'employee', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. EVENTS (Customer Owned) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL,
    venue TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL DEFAULT '18:00',
    target_guests INT DEFAULT 100,
    total_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Confirmed', 'In-Progress', 'Completed', 'Cancelled')),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. VENDORS (Merchant Accounts) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendors (
    vendor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    service_category TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Hyderabad',
    service_area TEXT NOT NULL DEFAULT 'Telangana & AP',
    starting_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rating NUMERIC(2, 1) DEFAULT 4.8 CHECK (rating >= 1.0 AND rating <= 5.0),
    review_count INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Rejected', 'Suspended')),
    badge TEXT DEFAULT 'Verified Partner',
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. VENDOR SERVICES & PACKAGES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_services (
    service_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES public.vendors(vendor_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    pricing_model TEXT NOT NULL DEFAULT 'per_person' CHECK (pricing_model IN ('fixed', 'per_person', 'per_plate', 'per_hour', 'per_day', 'custom')),
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_guests INT DEFAULT 25,
    max_guests INT DEFAULT 5000,
    duration_hours INT DEFAULT 4,
    included_items JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_packages (
    package_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES public.vendors(vendor_id) ON DELETE CASCADE,
    service_id BIGINT REFERENCES public.vendor_services(service_id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    price_type TEXT NOT NULL DEFAULT 'per_person',
    menu_items JSONB DEFAULT '[]'::jsonb,
    addons JSONB DEFAULT '[]'::jsonb,
    is_popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. EVENTORA EMPLOYEES / FIELD STAFF ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
    employee_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    employee_type TEXT NOT NULL DEFAULT 'Field Staff' CHECK (employee_type IN ('Operations', 'Field Staff', 'Delivery', 'Setup Crew', 'Event Coordinator', 'Security', 'Technical', 'Transport Coordinator', 'Customer Support')),
    service_area TEXT NOT NULL DEFAULT 'Hyderabad',
    availability_status TEXT DEFAULT 'Available' CHECK (availability_status IN ('Available', 'On Duty', 'Busy', 'Off Duty')),
    rating NUMERIC(2, 1) DEFAULT 4.9,
    active_tasks INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. BOOKINGS (Central Marketplace Junction) ───────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
    booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    vendor_id BIGINT NOT NULL REFERENCES public.vendors(vendor_id) ON DELETE RESTRICT,
    service_id BIGINT REFERENCES public.vendor_services(service_id) ON DELETE SET NULL,
    package_id BIGINT REFERENCES public.vendor_packages(package_id) ON DELETE SET NULL,
    assigned_employee_id BIGINT REFERENCES public.employees(employee_id) ON DELETE SET NULL,
    event_date DATE NOT NULL,
    start_time TIME DEFAULT '18:00',
    guest_count INT DEFAULT 50,
    subtotal NUMERIC(10, 2) NOT NULL,
    tax NUMERIC(10, 2) DEFAULT 0.00,
    service_fee NUMERIC(10, 2) DEFAULT 0.00,
    commission_rate NUMERIC(4, 2) DEFAULT 0.10,
    commission_amount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL,
    booking_status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (booking_status IN ('REQUESTED', 'PENDING_VENDOR', 'ACCEPTED', 'REJECTED', 'PAYMENT_PENDING', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
    service_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. EMPLOYEE / FIELD STAFF TASKS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_tasks (
    task_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    event_id BIGINT NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    task_type TEXT NOT NULL,
    location TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    instructions TEXT,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. PAYMENTS & TRANSACTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
    event_id BIGINT NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'Credit Card', 'Net Banking', 'Bank Wire', 'Cash')),
    transaction_ref TEXT NOT NULL UNIQUE,
    payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK (payment_status IN ('PENDING', 'AUTHORIZED', 'PAID', 'PARTIALLY_PAID', 'REFUND_PENDING', 'REFUNDED', 'FAILED')),
    payment_date TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. REVIEWS & RATINGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
    review_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    vendor_id BIGINT NOT NULL REFERENCES public.vendors(vendor_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
    quality_rating INT DEFAULT 5 CHECK (quality_rating BETWEEN 1 AND 5),
    timeliness_rating INT DEFAULT 5 CHECK (timeliness_rating BETWEEN 1 AND 5),
    communication_rating INT DEFAULT 5 CHECK (communication_rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. NOTIFICATIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. AUDIT LOGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
    log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    actor_role TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. GUESTS & EXPENSES (Preserved & Extended) ──────────────────────
CREATE TABLE IF NOT EXISTS public.guests (
    guest_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    rsvp_status TEXT DEFAULT 'Pending' CHECK (rsvp_status IN ('Attending', 'Declined', 'Pending')),
    dietary_pref TEXT DEFAULT 'Standard' CHECK (dietary_pref IN ('Standard', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-Free')),
    plus_ones INT DEFAULT 0 CHECK (plus_ones >= 0 AND plus_ones <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    expense_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    actual_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Helper to check user role from profiles
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 1. Profiles: Users can view all verified profiles (for display), edit own
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.get_current_role() = 'admin');

-- 2. Events: Customer sees own events, Admin sees all
CREATE POLICY "events_select" ON public.events FOR SELECT USING (auth.uid() = owner_id OR public.get_current_role() = 'admin');
CREATE POLICY "events_insert" ON public.events FOR INSERT WITH CHECK (auth.uid() = owner_id OR public.get_current_role() = 'admin');
CREATE POLICY "events_update" ON public.events FOR UPDATE USING (auth.uid() = owner_id OR public.get_current_role() = 'admin');
CREATE POLICY "events_delete" ON public.events FOR DELETE USING (auth.uid() = owner_id OR public.get_current_role() = 'admin');

-- 3. Vendors: Public can view verified vendors; vendor can edit own; admin can edit all
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT USING (is_verified = true OR auth.uid() = user_id OR public.get_current_role() = 'admin');
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT WITH CHECK (auth.uid() = user_id OR public.get_current_role() = 'admin');
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE USING (auth.uid() = user_id OR public.get_current_role() = 'admin');

-- 4. Vendor Services & Packages: Public can view active; vendor can edit own
CREATE POLICY "services_select" ON public.vendor_services FOR SELECT USING (true);
CREATE POLICY "services_modify" ON public.vendor_services FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.vendor_id = vendor_id AND (v.user_id = auth.uid() OR public.get_current_role() = 'admin'))
);

CREATE POLICY "packages_select" ON public.vendor_packages FOR SELECT USING (true);
CREATE POLICY "packages_modify" ON public.vendor_packages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.vendor_id = vendor_id AND (v.user_id = auth.uid() OR public.get_current_role() = 'admin'))
);

-- 5. Employees: Authenticated users can view; admin can manage
CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "employees_modify" ON public.employees FOR ALL USING (public.get_current_role() = 'admin');

-- 6. Bookings: Customer sees own, Vendor sees bookings assigned to their vendor_id, Admin sees all
CREATE POLICY "bookings_select" ON public.bookings FOR SELECT USING (
    auth.uid() = customer_id 
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.vendor_id = vendor_id AND v.user_id = auth.uid())
    OR public.get_current_role() = 'admin'
);
CREATE POLICY "bookings_insert" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id OR public.get_current_role() = 'admin');
CREATE POLICY "bookings_update" ON public.bookings FOR UPDATE USING (
    auth.uid() = customer_id 
    OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.vendor_id = vendor_id AND v.user_id = auth.uid())
    OR public.get_current_role() = 'admin'
);

-- 7. Employee Tasks: Assigned employee sees own tasks; Admin sees all; Customer sees tasks for their events
CREATE POLICY "tasks_select" ON public.employee_tasks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_id AND e.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.events ev WHERE ev.event_id = event_id AND ev.owner_id = auth.uid())
    OR public.get_current_role() = 'admin'
);
CREATE POLICY "tasks_update" ON public.employee_tasks FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_id AND e.user_id = auth.uid())
    OR public.get_current_role() = 'admin'
);

-- 8. Payments, Reviews, Guests, Expenses
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (
    auth.uid() = customer_id OR public.get_current_role() = 'admin'
);
CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = customer_id OR public.get_current_role() = 'admin');
CREATE POLICY "guests_select" ON public.guests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = event_id AND (e.owner_id = auth.uid() OR public.get_current_role() = 'admin'))
);
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = event_id AND (e.owner_id = auth.uid() OR public.get_current_role() = 'admin'))
);

-- ── Trigger for Auth User creation ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
