-- =====================================================================
-- EVENTORA: Plan Smart. Celebrate Smarter.
-- Database Management Systems (DBMS) Term Project
-- Team: Sai Charan, Abhineshwar, Dheeraj, Sai Nath, Abhilash Goud
-- Relational Schema: 3NF Normalized MySQL DDL & DML
-- =====================================================================

DROP DATABASE IF EXISTS eventora_db;
CREATE DATABASE eventora_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eventora_db;

-- ---------------------------------------------------------------------
-- TABLE 1: users (User & Role Management)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20),
    role ENUM('Admin', 'Organizer', 'Client') DEFAULT 'Organizer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 2: events (Event Planning & Scheduling)
-- ---------------------------------------------------------------------
CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    organizer_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    event_type ENUM('Wedding', 'Corporate Summit', 'Birthday Gala', 'Tech Conference', 'Cultural Fest') NOT NULL,
    venue VARCHAR(150) NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    target_guests INT DEFAULT 50,
    total_budget DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status ENUM('Planning', 'Confirmed', 'In-Progress', 'Completed', 'Cancelled') DEFAULT 'Planning',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) 
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 3: vendors (Vendor Registry & Services)
-- ---------------------------------------------------------------------
CREATE TABLE vendors (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(120) NOT NULL,
    service_category ENUM('Catering', 'Photography & Media', 'Venue & Decor', 'Audio/Visual & DJ', 'Security & Logistics') NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    rating DECIMAL(2, 1) DEFAULT 4.5 CHECK (rating >= 1.0 AND rating <= 5.0),
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 4: bookings (Relational Junction: Event <-> Vendor)
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    vendor_id INT NOT NULL,
    booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    agreed_cost DECIMAL(10, 2) NOT NULL,
    booking_status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') DEFAULT 'Pending',
    service_notes TEXT,
    CONSTRAINT fk_bookings_event FOREIGN KEY (event_id)
        REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bookings_vendor FOREIGN KEY (vendor_id)
        REFERENCES vendors(vendor_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 5: guests (Guest Management & RSVP Tracking)
-- ---------------------------------------------------------------------
CREATE TABLE guests (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(20),
    rsvp_status ENUM('Attending', 'Declined', 'Pending') DEFAULT 'Pending',
    dietary_pref ENUM('Standard', 'Vegetarian', 'Vegan', 'Halal', 'Gluten-Free') DEFAULT 'Standard',
    plus_ones INT DEFAULT 0 CHECK (plus_ones >= 0 AND plus_ones <= 5),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_guests_event FOREIGN KEY (event_id)
        REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 6: expenses (Budget & Itemized Expense Tracking)
-- ---------------------------------------------------------------------
CREATE TABLE expenses (
    expense_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    category ENUM('Venue', 'Catering', 'Media', 'Entertainment', 'Decor', 'Logistics', 'Miscellaneous') NOT NULL,
    item_name VARCHAR(120) NOT NULL,
    estimated_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    actual_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('Unpaid', 'Partially Paid', 'Paid') DEFAULT 'Unpaid',
    CONSTRAINT fk_expenses_event FOREIGN KEY (event_id)
        REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- TABLE 7: payments (Financial Tracking & Audit Log)
-- ---------------------------------------------------------------------
CREATE TABLE payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    booking_id INT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('UPI', 'Credit Card', 'Net Banking', 'Bank Wire', 'Cash') NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transaction_ref VARCHAR(80) NOT NULL UNIQUE,
    payment_status ENUM('Successful', 'Pending', 'Failed') DEFAULT 'Successful',
    CONSTRAINT fk_payments_event FOREIGN KEY (event_id)
        REFERENCES events(event_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id)
        REFERENCES bookings(booking_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- SAMPLE SEED DATA
-- ---------------------------------------------------------------------

-- Users
INSERT INTO users (user_id, full_name, email, phone, role) VALUES
(1, 'Abhineshwar K', 'abhi@eventora.io', '+91 9876543210', 'Admin'),
(2, 'Sai Charan V', 'charan@eventora.io', '+91 9876543211', 'Organizer'),
(3, 'Dheeraj R', 'dheeraj@eventora.io', '+91 9876543212', 'Organizer'),
(4, 'Sai Nath M', 'sainath@eventora.io', '+91 9876543213', 'Organizer'),
(5, 'Abhilash Goud P', 'abhilash@eventora.io', '+91 9876543214', 'Organizer'),
(6, 'Priya Sharma', 'priya.s@gmail.com', '+91 9845012345', 'Client');

-- Events
INSERT INTO events (event_id, organizer_id, title, event_type, venue, event_date, start_time, target_guests, total_budget, status) VALUES
(1, 2, 'Royal Deccan Heritage Wedding', 'Wedding', 'Taj Falaknuma Palace, Hyderabad', '2026-10-24', '18:30:00', 450, 1500000.00, 'Confirmed'),
(2, 3, 'NextGen AI & Cloud Summit 2026', 'Tech Conference', 'HICC Novotel, HITEC City', '2026-11-15', '09:00:00', 600, 850000.00, 'Planning'),
(3, 4, 'Aarav\'s 18th Milestone Birthday', 'Birthday Gala', 'The Grand Ballroom, Radisson', '2026-10-05', '19:00:00', 120, 250000.00, 'Confirmed'),
(4, 5, 'Apex Innovations Global Gala', 'Corporate Summit', 'ITC Kohenur, Knowledge City', '2026-12-02', '19:30:00', 300, 1200000.00, 'In-Progress');

-- Vendors
INSERT INTO vendors (vendor_id, business_name, service_category, contact_name, email, phone, base_price, rating, is_verified) VALUES
(1, 'Lumiere Cinematic Studios', 'Photography & Media', 'Vikram Sen', 'vikram@lumiere.com', '+91 9123456780', 120000.00, 4.9, TRUE),
(2, 'Royal Nizam Gourmet Caterers', 'Catering', 'Mirza Baig', 'info@nizamcatering.in', '+91 9123456781', 350000.00, 4.8, TRUE),
(3, 'Elysian Floral & Lighting Decor', 'Venue & Decor', 'Ananya Roy', 'decor@elysian.com', '+91 9123456782', 220000.00, 4.9, TRUE),
(4, 'Bassline Beats & Laser FX', 'Audio/Visual & DJ', 'DJ Rohan', 'rohan@basslinefx.com', '+91 9123456783', 75000.00, 4.7, TRUE),
(5, 'ShieldGuard Premier Security', 'Security & Logistics', 'Capt. R. Verma', 'ops@shieldguard.in', '+91 9123456784', 60000.00, 4.6, TRUE);

-- Bookings
INSERT INTO bookings (booking_id, event_id, vendor_id, agreed_cost, booking_status, service_notes) VALUES
(1, 1, 1, 135000.00, 'Confirmed', '4K Drone coverage, 3 candid photographers, live streaming'),
(2, 1, 2, 420000.00, 'Confirmed', 'Mughlai & Continental 5-course banquet with dessert lounge'),
(3, 1, 3, 280000.00, 'Confirmed', 'Floral mandap with imported orchids and ambient fairy lights'),
(4, 2, 4, 85000.00, 'Confirmed', 'Dual line-array audio, wireless collar mics, stage spotlighting'),
(5, 2, 2, 290000.00, 'Pending', 'Executive lunch buffet, coffee break stations for 600 pax'),
(6, 3, 4, 65000.00, 'Confirmed', 'EDM stage setup, smoke machine, DJ set with interactive MC');

-- Guests
INSERT INTO guests (guest_id, event_id, full_name, email, phone, rsvp_status, dietary_pref, plus_ones) VALUES
(1, 1, 'Dr. K. Srinivas', 'srinivas.k@gmail.com', '+91 9440112233', 'Attending', 'Standard', 1),
(2, 1, 'Sneha Reddy', 'sneha.r@outlook.com', '+91 9440112234', 'Attending', 'Vegetarian', 2),
(3, 1, 'Manish Kapoor', 'm.kapoor@yahoo.com', '+91 9440112235', 'Declined', 'Standard', 0),
(4, 1, 'Dr. Fatima Begum', 'fatima.b@hyderabad.ac.in', '+91 9440112236', 'Attending', 'Halal', 1),
(5, 2, 'Prof. Alan Turing', 'alan@acm.org', '+1 4155550199', 'Attending', 'Vegan', 0),
(6, 2, 'Kavita Menon (Tech Lead)', 'kavita@google.com', '+91 9887766554', 'Attending', 'Vegetarian', 0),
(7, 2, 'Rajeev Nair (CTO)', 'rajeev@startup.io', '+91 9887766555', 'Pending', 'Standard', 0),
(8, 3, 'Aditya Varma', 'aditya.v@gmail.com', '+91 9776655443', 'Attending', 'Standard', 1),
(9, 3, 'Pooja Iyer', 'pooja.iyer@gmail.com', '+91 9776655444', 'Attending', 'Gluten-Free', 0);

-- Expenses
INSERT INTO expenses (expense_id, event_id, category, item_name, estimated_cost, actual_cost, payment_status) VALUES
(1, 1, 'Venue', 'Taj Falaknuma Palace Lawn & Durbar Hall', 550000.00, 550000.00, 'Paid'),
(2, 1, 'Catering', 'Royal Nizam Banquet Service', 420000.00, 420000.00, 'Partially Paid'),
(3, 1, 'Media', 'Lumiere Cinematic Photography Package', 135000.00, 135000.00, 'Partially Paid'),
(4, 1, 'Decor', 'Elysian Floral Setup', 280000.00, 280000.00, 'Paid'),
(5, 2, 'Venue', 'HICC Plenary Hall 1 & 2', 400000.00, 390000.00, 'Paid'),
(6, 2, 'Entertainment', 'Keynote A/V & Stage Production', 85000.00, 85000.00, 'Paid'),
(7, 3, 'Venue', 'Radisson Grand Ballroom', 120000.00, 115000.00, 'Paid'),
(8, 3, 'Entertainment', 'DJ & Dance Lighting FX', 65000.00, 65000.00, 'Paid');

-- Payments
INSERT INTO payments (payment_id, event_id, booking_id, amount, payment_method, transaction_ref, payment_status) VALUES
(1, 1, NULL, 550000.00, 'Bank Wire', 'TXN_WIRE_9823101', 'Successful'),
(2, 1, 2, 200000.00, 'Net Banking', 'TXN_NB_4492019', 'Successful'),
(3, 1, 1, 70000.00, 'UPI', 'UPI_AXIS_8819204', 'Successful'),
(4, 1, 3, 280000.00, 'Bank Wire', 'TXN_WIRE_9823102', 'Successful'),
(5, 2, NULL, 390000.00, 'Net Banking', 'TXN_NB_7719283', 'Successful'),
(6, 2, 4, 85000.00, 'Credit Card', 'TXN_CC_5510294', 'Successful'),
(7, 3, NULL, 115000.00, 'UPI', 'UPI_HDFC_3391024', 'Successful');

-- ---------------------------------------------------------------------
-- CORE DBMS PROJECT ANALYTICAL QUERIES
-- ---------------------------------------------------------------------

-- Query 1: Total budget and actual expenses per event with variance calculation
-- Demonstrates: INNER JOIN, GROUP BY, Aggregate functions (SUM, AVG)
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

-- Query 2: Confirmed vendor bookings with contact and financial breakdown
-- Demonstrates: Multi-table JOIN (events, bookings, vendors) with WHERE filtering
SELECT 
    b.booking_id,
    e.title AS event_name,
    v.business_name AS vendor,
    v.service_category,
    b.agreed_cost,
    b.booking_status,
    v.phone AS vendor_phone
FROM bookings b
JOIN events e ON b.event_id = e.event_id
JOIN vendors v ON b.vendor_id = v.vendor_id
WHERE b.booking_status = 'Confirmed'
ORDER BY b.agreed_cost DESC;

-- Query 3: RSVP Attendance Statistics per Event
-- Demonstrates: Conditional Aggregation and Percentage Calculation
SELECT 
    e.title AS event_title,
    COUNT(g.guest_id) AS total_invited,
    SUM(CASE WHEN g.rsvp_status = 'Attending' THEN 1 + g.plus_ones ELSE 0 END) AS confirmed_attendees,
    SUM(CASE WHEN g.rsvp_status = 'Declined' THEN 1 ELSE 0 END) AS declined_count,
    SUM(CASE WHEN g.rsvp_status = 'Pending' THEN 1 ELSE 0 END) AS pending_responses
FROM events e
LEFT JOIN guests g ON e.event_id = g.event_id
GROUP BY e.event_id, e.title;
