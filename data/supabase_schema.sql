-- =====================================================================
-- EVENTORA: Plan Smart. Celebrate Smarter.
-- Supabase PostgreSQL Relational Schema (3NF Normalized)
-- Database Management Systems (DBMS) Term Project
-- Team: Sai Charan, Abhineshwar (2510030306), Dheeraj, Sai Nath, Abhilash Goud
-- =====================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. TABLE: users (User & Role Management)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'Organizer' CHECK (role IN ('Admin', 'Organizer', 'Client')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2. TABLE: events (Event Planning & Scheduling)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organizer_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    title VARCHAR(150) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('Wedding', 'Corporate Summit', 'Birthday Gala', 'Tech Conference', 'Cultural Fest')),
    venue VARCHAR(150) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    target_guests INT DEFAULT 50,
    total_budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'Planning' CHECK (status IN ('Planning', 'Confirmed', 'In-Progress', 'Completed', 'Cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 3. TABLE: vendors (Vendor Registry & Services)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    business_name VARCHAR(120) NOT NULL,
    service_category VARCHAR(50) NOT NULL CHECK (service_category IN ('Catering', 'Photography & Media', 'Venue & Decor', 'Audio/Visual & DJ', 'Security & Logistics')),
    contact_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rating NUMERIC(2, 1) DEFAULT 4.5 CHECK (rating >= 1.0 AND rating <= 5.0),
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. TABLE: bookings (Relational Junction: Event <-> Vendor)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    vendor_id BIGINT NOT NULL REFERENCES vendors(vendor_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    booking_date TIMESTAMPTZ DEFAULT NOW(),
    agreed_cost NUMERIC(10, 2) NOT NULL,
    booking_status VARCHAR(20) DEFAULT 'Pending' CHECK (booking_status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
    service_notes TEXT
);

-- ---------------------------------------------------------------------
-- 5. TABLE: guests (Guest Management & RSVP Tracking)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guests (
    guest_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    rsvp_status VARCHAR(20) DEFAULT 'Pending' CHECK (rsvp_status IN ('Attending', 'Declined', 'Pending')),
    dietary_pref VARCHAR(30) DEFAULT 'Standard' CHECK (dietary_pref IN ('Standard', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-Free')),
    plus_ones INT DEFAULT 0 CHECK (plus_ones >= 0 AND plus_ones <= 5),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 6. TABLE: expenses (Budget & Itemized Expense Tracking)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    expense_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Venue', 'Catering', 'Media', 'Entertainment', 'Decor', 'Logistics', 'Miscellaneous')),
    item_name VARCHAR(120) NOT NULL,
    estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    actual_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid'))
);

-- ---------------------------------------------------------------------
-- 7. TABLE: payments (Financial Tracking & Audit Log)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    booking_id BIGINT REFERENCES bookings(booking_id) ON DELETE SET NULL ON UPDATE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('UPI', 'Credit Card', 'Net Banking', 'Bank Wire', 'Cash')),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    transaction_ref VARCHAR(80) NOT NULL UNIQUE,
    payment_status VARCHAR(20) DEFAULT 'Successful' CHECK (payment_status IN ('Successful', 'Pending', 'Failed'))
);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- For DBMS presentation demo: Allow public read/write via anon key
-- ---------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on vendors" ON vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on guests" ON guests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- SAMPLE SEED DATA FOR SUPABASE
-- ---------------------------------------------------------------------
INSERT INTO users (full_name, email, phone, role) VALUES
('Abhineshwar K', 'abhi@eventora.io', '+91 9876543210', 'Admin'),
('Sai Charan V', 'charan@eventora.io', '+91 9876543211', 'Organizer'),
('Dheeraj R', 'dheeraj@eventora.io', '+91 9876543212', 'Organizer'),
('Sai Nath M', 'sainath@eventora.io', '+91 9876543213', 'Organizer'),
('Abhilash Goud P', 'abhilash@eventora.io', '+91 9876543214', 'Organizer'),
('Priya Sharma', 'priya.s@gmail.com', '+91 9845012345', 'Client')
ON CONFLICT (email) DO NOTHING;

INSERT INTO events (organizer_id, title, event_type, venue, event_date, start_time, target_guests, total_budget, status) VALUES
(2, 'Royal Deccan Heritage Wedding', 'Wedding', 'Taj Falaknuma Palace, Hyderabad', '2026-10-24', '18:30:00', 450, 1500000.00, 'Confirmed'),
(3, 'NextGen AI & Cloud Summit 2026', 'Tech Conference', 'HICC Novotel, HITEC City', '2026-11-15', '09:00:00', 600, 850000.00, 'Planning'),
(4, 'Aarav''s 18th Milestone Birthday', 'Birthday Gala', 'The Grand Ballroom, Radisson', '2026-10-05', '19:00:00', 120, 250000.00, 'Confirmed'),
(5, 'Apex Innovations Global Gala', 'Corporate Summit', 'ITC Kohenur, Knowledge City', '2026-12-02', '19:30:00', 300, 1200000.00, 'In-Progress')
ON CONFLICT DO NOTHING;

INSERT INTO vendors (business_name, service_category, contact_name, email, phone, base_price, rating, is_verified) VALUES
('Lumiere Cinematic Studios', 'Photography & Media', 'Vikram Sen', 'vikram@lumiere.com', '+91 9123456780', 120000.00, 4.9, TRUE),
('Royal Nizam Gourmet Caterers', 'Catering', 'Mirza Baig', 'info@nizamcatering.in', '+91 9123456781', 350000.00, 4.8, TRUE),
('Elysian Floral & Lighting Decor', 'Venue & Decor', 'Ananya Roy', 'decor@elysian.com', '+91 9123456782', 220000.00, 4.9, TRUE),
('Bassline Beats & Laser FX', 'Audio/Visual & DJ', 'DJ Rohan', 'rohan@basslinefx.com', '+91 9123456783', 75000.00, 4.7, TRUE),
('ShieldGuard Premier Security', 'Security & Logistics', 'Capt. R. Verma', 'ops@shieldguard.in', '+91 9123456784', 60000.00, 4.6, TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO bookings (event_id, vendor_id, agreed_cost, booking_status, service_notes) VALUES
(1, 1, 135000.00, 'Confirmed', '4K Drone coverage, 3 candid photographers, live streaming'),
(1, 2, 420000.00, 'Confirmed', 'Mughlai & Continental 5-course banquet with dessert lounge'),
(1, 3, 280000.00, 'Confirmed', 'Floral mandap with imported orchids and ambient fairy lights'),
(2, 4, 85000.00, 'Confirmed', 'Dual line-array audio, wireless collar mics, stage spotlighting'),
(2, 2, 290000.00, 'Pending', 'Executive lunch buffet, coffee break stations for 600 pax'),
(3, 4, 65000.00, 'Confirmed', 'EDM stage setup, smoke machine, DJ set with interactive MC')
ON CONFLICT DO NOTHING;

INSERT INTO guests (event_id, full_name, email, phone, rsvp_status, dietary_pref, plus_ones) VALUES
(1, 'Dr. K. Srinivas', 'srinivas.k@gmail.com', '+91 9440112233', 'Attending', 'Standard', 1),
(1, 'Sneha Reddy', 'sneha.r@outlook.com', '+91 9440112234', 'Attending', 'Vegetarian', 2),
(1, 'Manish Kapoor', 'm.kapoor@yahoo.com', '+91 9440112235', 'Declined', 'Standard', 0),
(1, 'Dr. Fatima Begum', 'fatima.b@hyderabad.ac.in', '+91 9440112236', 'Attending', 'Halal', 1),
(2, 'Prof. Alan Turing', 'alan@acm.org', '+1 4155550199', 'Attending', 'Vegan', 0),
(2, 'Kavita Menon (Tech Lead)', 'kavita@google.com', '+91 9887766554', 'Attending', 'Vegetarian', 0),
(2, 'Rajeev Nair (CTO)', 'rajeev@startup.io', '+91 9887766555', 'Pending', 'Standard', 0),
(3, 'Aditya Varma', 'aditya.v@gmail.com', '+91 9776655443', 'Attending', 'Standard', 1),
(3, 'Pooja Iyer', 'pooja.iyer@gmail.com', '+91 9776655444', 'Attending', 'Gluten-Free', 0)
ON CONFLICT DO NOTHING;

INSERT INTO expenses (event_id, category, item_name, estimated_cost, actual_cost, payment_status) VALUES
(1, 'Venue', 'Taj Falaknuma Palace Lawn & Durbar Hall', 550000.00, 550000.00, 'Paid'),
(1, 'Catering', 'Royal Nizam Banquet Service', 420000.00, 420000.00, 'Partially Paid'),
(1, 'Media', 'Lumiere Cinematic Photography Package', 135000.00, 135000.00, 'Partially Paid'),
(1, 'Decor', 'Elysian Floral Setup', 280000.00, 280000.00, 'Paid'),
(2, 'Venue', 'HICC Plenary Hall 1 & 2', 400000.00, 390000.00, 'Paid'),
(2, 'Entertainment', 'Keynote A/V & Stage Production', 85000.00, 85000.00, 'Paid'),
(3, 'Venue', 'Radisson Grand Ballroom', 120000.00, 115000.00, 'Paid'),
(3, 'Entertainment', 'DJ & Dance Lighting FX', 65000.00, 65000.00, 'Paid')
ON CONFLICT DO NOTHING;

INSERT INTO payments (event_id, booking_id, amount, payment_method, transaction_ref, payment_status) VALUES
(1, NULL, 550000.00, 'Bank Wire', 'TXN_WIRE_9823101', 'Successful'),
(1, 2, 200000.00, 'Net Banking', 'TXN_NB_4492019', 'Successful'),
(1, 1, 70000.00, 'UPI', 'UPI_AXIS_8819204', 'Successful'),
(1, 3, 280000.00, 'Bank Wire', 'TXN_WIRE_9823102', 'Successful'),
(2, NULL, 390000.00, 'Net Banking', 'TXN_NB_7719283', 'Successful'),
(2, 4, 85000.00, 'Credit Card', 'TXN_CC_5510294', 'Successful'),
(3, NULL, 115000.00, 'UPI', 'UPI_HDFC_3391024', 'Successful')
ON CONFLICT (transaction_ref) DO NOTHING;

-- ---------------------------------------------------------------------
-- DATABASE VIEWS & ANALYTICS
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW view_event_budget_variance AS
SELECT 
    e.event_id,
    e.title AS event_title,
    e.event_type,
    e.total_budget AS allocated_budget,
    COALESCE(SUM(x.actual_cost), 0.00) AS total_actual_spent,
    (e.total_budget - COALESCE(SUM(x.actual_cost), 0.00)) AS remaining_balance
FROM events e
LEFT JOIN expenses x ON e.event_id = x.event_id
GROUP BY e.event_id, e.title, e.event_type, e.total_budget;
