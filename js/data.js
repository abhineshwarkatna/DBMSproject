/**
 * EVENTORA — Unified Data & Ecosystem Engine
 * Connected Multi-Sided Architecture:
 * Customer -> Eventora Platform -> Vendors -> Field Staff/Employees -> Admin Operations
 */
window.EventoraDB = (() => {
  const BASE_KEY = 'eventora_ecosystem_v4';
  const GLOBAL_KEY = 'eventora_global_state_v4';

  let db = {};
  let globalState = {};
  let _userId = null;
  let _currentRole = 'customer'; // 'customer' | 'vendor' | 'employee' | 'admin'

  // Centralized Status Constants
  const BOOKING_STATUS = {
    REQUESTED: 'REQUESTED',
    PENDING_VENDOR: 'PENDING_VENDOR',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    CONFIRMED: 'CONFIRMED',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    READY: 'READY',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED'
  };

  const TASK_STATUS = {
    ASSIGNED: 'ASSIGNED',
    ACCEPTED: 'ACCEPTED',
    ON_THE_WAY: 'ON_THE_WAY',
    ARRIVED: 'ARRIVED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  };

  const VENDOR_STATUS = {
    PENDING: 'Pending Verification',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
    SUSPENDED: 'Suspended'
  };

  // Storage key helpers
  const _userKey = () => _userId ? `${BASE_KEY}_${_userId}` : `${BASE_KEY}_guest`;

  // ── Default Budget Categories ──────────────────────────────────────────
  const DEFAULT_CATEGORIES = [
    { id:'cat-food',      name:'Catering & Food',       icon:'🍽️', color:'#8b5cf6' },
    { id:'cat-venue',     name:'Venue & Banquets',      icon:'🏠', color:'#ec4899' },
    { id:'cat-photo',     name:'Photography & Media',   icon:'📸', color:'#06b6d4' },
    { id:'cat-decor',     name:'Decor & Floral',        icon:'🌸', color:'#10b981' },
    { id:'cat-ent',       name:'Entertainment & DJ',    icon:'🎵', color:'#f59e0b' },
    { id:'cat-transport', name:'Transport & Fleet',     icon:'🚌', color:'#3b82f6' },
    { id:'cat-security',  name:'Security & Logistics',  icon:'🛡️', color:'#64748b' },
    { id:'cat-other',     name:'Contingency & Misc',    icon:'✨', color:'#94a3b8' },
  ];

  // ── Master Verified Vendors Catalog ────────────────────────────────────
  const INITIAL_VENDORS = [
    {
      id: 'v-royal-feast',
      name: 'Royal Feast Catering',
      category: 'Catering',
      city: 'Hyderabad',
      address: 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad',
      serviceArea: 'Hyderabad, Secunderabad, Cyberabad',
      rating: 4.9,
      reviewCount: 142,
      price: 499,
      priceUnit: 'per person',
      img: 'catering',
      verified: true,
      verificationStatus: 'Verified',
      badge: 'Premier Caterer',
      responseTime: '< 15 mins',
      cancellationPolicy: 'Full refund up to 72 hours before event date.',
      desc: 'Award-winning royal banquets, authentic Mughlai, Nizami, South Indian, and Pan-Asian menus with live counter stations.',
      phone: '+91 91234 56781',
      email: 'bookings@royalfeast.in',
      packages: [
        {
          id: 'pkg-silver',
          name: 'Silver Feast Buffet',
          price: 499,
          priceType: 'per person',
          description: 'Ideal for intimate gatherings, birthday parties, and corporate luncheons.',
          starters: ['Paneer Tikka Angaara', 'Crispy Corn Salt & Pepper', 'Veg Spring Rolls'],
          mains: ['Dal Makhani', 'Paneer Butter Masala', 'Aloo Gobi Adraki', 'Butter Naan / Roti'],
          rice: ['Jeera Rice', 'Hyderabadi Veg Biryani'],
          desserts: ['Gulab Jamun with Rabdi'],
          drinks: ['Mint Lemonade', 'Packaged Water']
        },
        {
          id: 'pkg-gold',
          name: 'Gold Grand Banquet',
          price: 799,
          priceType: 'per person',
          isPopular: true,
          description: 'Our most popular package for receptions, sangeets, and major corporate summits.',
          starters: ['Paneer Malai Tikka', 'Chicken Seekh Kebab', 'Hariyali Kebab', 'Stuffed Cheesy Mushrooms', 'Dahi Ke Kebab'],
          mains: ['Dal Bukhara', 'Butter Chicken', 'Kadhai Paneer', 'Subz Meloni', 'Assorted Tandoori Breads'],
          rice: ['Nizami Chicken Dum Biryani', 'Awadhi Veg Biryani', 'Mirchi Ka Salan & Raita'],
          desserts: ['Angoori Rasmalai', 'Shahi Tukda with Saffron', 'Vanilla Bean Ice Cream'],
          drinks: ['Blue Curacao Mocktail', 'Spiced Masala Chai', 'Mineral Water']
        },
        {
          id: 'pkg-diamond',
          name: 'Diamond Royal Wedding Feast',
          price: 1299,
          priceType: 'per person',
          description: 'The pinnacle of luxury catering: live cooking counters, exotic desserts, and white-glove service.',
          starters: ['Tandoori Tiger Prawns', 'Mutton Galouti Kebab', 'Paneer Sufiyana Tikka', 'Truffle Dimsums', 'Peri Peri Lotus Stem', 'Afghani Chicken Wings'],
          mains: ['Mutton Rogan Josh', 'Murgh Musallam', 'Paneer Lababdar', 'Dal Tadka', 'Amritsari Kulche & Butter Naan'],
          rice: ['Signature Hyderabadi Mutton Dum Biryani', 'Kashmiri Pulao', 'Burani Raita'],
          desserts: ['Kesar Pista Kulfi Falooda', 'Belgian Chocolate Fondue', 'Warm Moong Dal Halwa', 'Exotic Fruit Display'],
          drinks: ['Live Mocktail Bar (4 Varieties)', 'Dry Fruit Kahwa', 'Fresh Coconut Water']
        }
      ]
    },
    {
      id: 'v-lumiere',
      name: 'Lumiere Cinematic Studios',
      category: 'Photography & Media',
      city: 'Hyderabad',
      address: 'Film Nagar Main Road, Jubilee Hills, Hyderabad',
      serviceArea: 'Hyderabad & Destination',
      rating: 4.9,
      reviewCount: 96,
      price: 120000,
      priceUnit: 'per event',
      img: 'photography',
      verified: true,
      verificationStatus: 'Verified',
      badge: 'Master Cinematographers',
      responseTime: '< 30 mins',
      cancellationPolicy: '50% advance non-refundable; full balance returned if cancelled 14 days prior.',
      desc: 'Top-tier 4K drone cinematography, candid storytelling, same-day teaser edits, and editorial photobooks.',
      phone: '+91 91234 56780',
      email: 'hello@lumierecinematics.com',
      packages: [
        {
          id: 'pkg-photo-standard',
          name: 'Candid & Drone Coverage (1 Day)',
          price: 120000,
          priceType: 'per event',
          description: '2 candid photographers, 1 traditional videographer, 4K aerial drone, 250 edited shots + 3-min highlight reel.'
        },
        {
          id: 'pkg-photo-luxury',
          name: 'Grand Wedding Cinema (2 Days)',
          price: 240000,
          priceType: 'per event',
          description: '4-camera crew, dual drones, live streaming setup, same-day video teaser, hardcover luxury album.'
        }
      ]
    },
    {
      id: 'v-elysian',
      name: 'Elysian Floral & Stage Architecture',
      category: 'Decor',
      city: 'Hyderabad',
      address: 'Gachibowli Stadium Road, Hyderabad',
      serviceArea: 'Telangana & Andhra Pradesh',
      rating: 4.8,
      reviewCount: 118,
      price: 180000,
      priceUnit: 'starting from',
      img: 'decor',
      verified: true,
      verificationStatus: 'Verified',
      badge: 'Luxury Designer',
      responseTime: '< 1 hour',
      cancellationPolicy: 'Full refund up to 7 days before event.',
      desc: 'Bespoke mandaps, grand fairy-light ceilings, imported fresh orchids, minimalist modern archways, and immersive thematic stages.',
      phone: '+91 91234 56782',
      email: 'curate@elysiandecor.com',
      packages: [
        {
          id: 'pkg-decor-botanical',
          name: 'Botanical Elegance Floral Stage',
          price: 180000,
          priceType: 'per event',
          description: 'Imported hydrangeas, roses, warm fairy ceiling lights, entryway floral arches, and VIP sofa lounge.'
        },
        {
          id: 'pkg-decor-royal',
          name: 'Nizami Royal Durbar Mandap',
          price: 320000,
          priceType: 'per event',
          description: 'Carved regal pillars, cascading mogra & marigold chandeliers, laser backdrop lighting, red carpet pathway.'
        }
      ]
    },
    {
      id: 'v-bassline',
      name: 'Bassline Beats & Laser FX',
      category: 'Audio/Visual & DJ',
      city: 'Hyderabad',
      address: 'HITEC City Phase 2, Hyderabad',
      serviceArea: 'Hyderabad',
      rating: 4.7,
      reviewCount: 84,
      price: 65000,
      priceUnit: 'per event',
      img: 'dj',
      verified: true,
      verificationStatus: 'Verified',
      badge: 'Pro Audio',
      responseTime: '< 20 mins',
      cancellationPolicy: 'Refundable up to 48 hours prior.',
      desc: 'Line-array concert grade sound, moving head stage lasers, dry-ice fog machines, and premier club & wedding DJs.',
      phone: '+91 91234 56783',
      email: 'events@basslinefx.com',
      packages: [
        {
          id: 'pkg-dj-party',
          name: 'Complete Sangeet / Party DJ & Lights',
          price: 65000,
          priceType: 'per event',
          description: 'JBL VRX line array audio, 12 moving head beam lights, interactive DJ + MC, cold spark pyro machines.'
        }
      ]
    },
    {
      id: 'v-transfleet',
      name: 'TransFleet Luxury VIP Coach & Cars',
      category: 'Transport',
      city: 'Hyderabad',
      address: 'Begumpet Airport Road, Hyderabad',
      serviceArea: 'Hyderabad & Outstation',
      rating: 4.8,
      reviewCount: 52,
      price: 25000,
      priceUnit: 'per coach / day',
      img: 'transport',
      verified: true,
      verificationStatus: 'Verified',
      badge: 'Fleet Partner',
      responseTime: '< 15 mins',
      cancellationPolicy: 'Free cancellation up to 24 hours before pickup.',
      desc: 'Mercedes & BMW bridal cars, 45-seater luxury AC Volvo buses, and airport pickup shuttles with uniformed chauffeurs.',
      phone: '+91 91234 56785',
      email: 'ops@transfleet.in',
      packages: [
        {
          id: 'pkg-transport-bus',
          name: '45-Seater Luxury AC Coach (Full Day)',
          price: 25000,
          priceType: 'per day',
          description: 'Includes professional chauffeur, fuel, toll assistance, bottled water, and guest luggage care.'
        }
      ]
    },
    {
      id: 'v-shieldguard',
      name: 'ShieldGuard Premier Event Security',
      category: 'Security',
      city: 'Hyderabad',
      address: 'Madhapur Main Rd, Hyderabad',
      serviceArea: 'Hyderabad',
      rating: 4.9,
      reviewCount: 41,
      price: 18000,
      priceUnit: 'for 4 bouncers',
      img: 'security',
      verified: true,
      verificationStatus: 'Verified',
      badge: 'Certified Security',
      responseTime: '< 30 mins',
      cancellationPolicy: 'Full refund up to 48 hours.',
      desc: 'Licensed security officers, VIP escort bodyguards, metal detector gates, valet parking control, and crowd flow management.',
      phone: '+91 91234 56784',
      email: 'ops@shieldguard.in',
      packages: [
        {
          id: 'pkg-sec-standard',
          name: 'Squad of 4 Uniformed Bouncers (6 Hours)',
          price: 18000,
          priceType: 'per event',
          description: 'Entry gate screening, VIP escort, stage boundary protection, and crowd management.'
        }
      ]
    }
  ];

  // ── Master Employees / Field Staff ──────────────────────────────────────
  const INITIAL_EMPLOYEES = [
    {
      id: 'emp-1',
      name: 'Rahul Verma',
      email: 'rahul.ops@eventora.io',
      phone: '+91 98765 11001',
      type: 'Catering & Food Setup Lead',
      serviceArea: 'Hyderabad Central (Jubilee / Banjara Hills)',
      status: 'Available',
      rating: 4.9,
      activeTasks: 1,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80'
    },
    {
      id: 'emp-2',
      name: 'Sneha Nair',
      email: 'sneha.decor@eventora.io',
      phone: '+91 98765 11002',
      type: 'Venue & Decor Quality Inspector',
      serviceArea: 'Cyberabad (HITEC City / Gachibowli)',
      status: 'Available',
      rating: 4.9,
      activeTasks: 0,
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&q=80'
    },
    {
      id: 'emp-3',
      name: 'Vikram Rao',
      email: 'vikram.av@eventora.io',
      phone: '+91 98765 11003',
      type: 'Stage & AV Technical Supervisor',
      serviceArea: 'Secunderabad & North Hyderabad',
      status: 'Available',
      rating: 4.8,
      activeTasks: 0,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80'
    },
    {
      id: 'emp-4',
      name: 'Ananya Patel',
      email: 'ananya.coord@eventora.io',
      phone: '+91 98765 11004',
      type: 'VIP Guest & Transport Coordinator',
      serviceArea: 'Shamshabad & Airport Corridor',
      status: 'Available',
      rating: 5.0,
      activeTasks: 0,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&q=80'
    }
  ];

  // Helper ID generator
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const formatCurrency = (n) => {
    if (!n && n !== 0) return '₹0';
    const abs = Math.abs(Number(n));
    if (abs >= 10000000) return `₹${(abs/10000000).toFixed(2)}Cr`;
    if (abs >= 100000)   return `₹${(abs/100000).toFixed(2)}L`;
    if (abs >= 1000)     return `₹${(abs/1000).toFixed(1)}K`;
    return `₹${abs.toLocaleString('en-IN')}`;
  };

  // ── Global State Persistence (Vendors, Employees, Bookings, Tasks, Reviews, Audit) ──
  const _loadGlobal = () => {
    try {
      const raw = localStorage.getItem(GLOBAL_KEY);
      if (raw) {
        globalState = JSON.parse(raw);
      } else {
        globalState = {
          vendors: INITIAL_VENDORS,
          employees: INITIAL_EMPLOYEES,
          bookings: {},
          employeeTasks: {},
          reviews: {},
          auditLogs: [],
          notifications: []
        };
        _saveGlobal();
      }
    } catch(e) {
      globalState = {
        vendors: INITIAL_VENDORS,
        employees: INITIAL_EMPLOYEES,
        bookings: {},
        employeeTasks: {},
        reviews: {},
        auditLogs: [],
        notifications: []
      };
    }
  };

  const _saveGlobal = () => {
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(globalState));
  };

  // ── User State Persistence (Events, Guests, Expenses) ────────────────────
  const _loadUser = () => {
    try {
      const raw = localStorage.getItem(_userKey());
      if (raw) {
        db = JSON.parse(raw);
      } else {
        db = {};
      }
    } catch(e) {
      db = {};
    }
    if (!db.events) db.events = {};
    if (!db.activeEventId) {
      const evKeys = Object.keys(db.events);
      db.activeEventId = evKeys.length > 0 ? evKeys[0] : null;
    }
  };

  const save = () => {
    localStorage.setItem(_userKey(), JSON.stringify(db));
    _saveGlobal();
  };

  const setUser = (userId, role = 'customer') => {
    _userId = userId;
    _currentRole = role || 'customer';
    _loadUser();
    _loadGlobal();
    save();
  };

  const getCurrentRole = () => _currentRole;
  const setRole = (role) => {
    _currentRole = role;
    save();
  };

  const init = () => {
    _loadGlobal();
    _loadUser();
  };

  // ── Events CRUD ──────────────────────────────────────────────────────────
  const createEvent = (data) => {
    const id = uid();
    const newEvent = {
      id,
      createdAt: Date.now(),
      status: 'Planning',
      guests: {},
      expenses: {},
      tasks: {},
      schedule: {},
      floorElements: {},
      alerts: {},
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      ...data
    };
    db.events[id] = newEvent;
    db.activeEventId = id;
    save();

    logAudit('CREATE_EVENT', `Created event "${newEvent.title}" (${newEvent.category || 'Event'})`, { eventId: id, budget: newEvent.budget });
    
    // Sync to Supabase if connected
    if (window.EventoraSupabase?.isConnected && window.EventoraSupabase?.client) {
      window.EventoraSupabase.client.from('events').insert([{
        title: newEvent.title,
        event_type: newEvent.category || 'Wedding',
        venue: newEvent.venueName || newEvent.venue || 'TBD',
        event_date: newEvent.eventDate || new Date().toISOString().split('T')[0],
        start_time: (newEvent.startTime || '18:00') + ':00',
        target_guests: Number(newEvent.guestCapacity || 100),
        total_budget: Number(newEvent.budget || 0),
        status: 'Planning',
        description: newEvent.description || ''
      }]).then(() => {}).catch(err => console.warn('Supabase event insert notice:', err.message));
    }

    return newEvent;
  };

  const getEvent = (id) => db.events?.[id] || null;
  const getAllEvents = () => Object.values(db.events || {});
  const updateEvent = (id, data) => {
    if (db.events?.[id]) {
      Object.assign(db.events[id], data);
      save();
    }
  };
  const deleteEvent = (id) => {
    if (db.events?.[id]) {
      delete db.events[id];
      if (db.activeEventId === id) {
        db.activeEventId = Object.keys(db.events)[0] || null;
      }
      save();
      logAudit('DELETE_EVENT', `Deleted event ${id}`, { eventId: id });
    }
  };

  const getActiveEventId = () => db.activeEventId;
  const setActiveEvent = (id) => {
    db.activeEventId = id;
    save();
  };

  // ── Categories ───────────────────────────────────────────────────────────
  const getCategories = (evId) => {
    if (!db.events?.[evId]) return DEFAULT_CATEGORIES;
    if (!db.events[evId].categories) {
      db.events[evId].categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      save();
    }
    return db.events[evId].categories;
  };

  const addCategory = (evId, cat) => {
    if (!db.events?.[evId]) return;
    if (!db.events[evId].categories) db.events[evId].categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    const id = uid();
    db.events[evId].categories.push({ id, ...cat });
    save();
    return id;
  };

  // ── Guests ───────────────────────────────────────────────────────────────
  const addGuest = (evId, g) => {
    if (!db.events?.[evId]) return;
    const id = uid();
    if (!db.events[evId].guests) db.events[evId].guests = {};
    db.events[evId].guests[id] = { id, createdAt: Date.now(), rsvp: 'Pending', checkedIn: false, role: 'Guest', ...g };
    save();
    return db.events[evId].guests[id];
  };
  const getGuests = (evId) => Object.values(db.events?.[evId]?.guests || {});
  const updateGuest = (evId, gId, data) => {
    if (db.events?.[evId]?.guests?.[gId]) {
      Object.assign(db.events[evId].guests[gId], data);
      save();
    }
  };
  const deleteGuest = (evId, gId) => {
    if (db.events?.[evId]?.guests) {
      delete db.events[evId].guests[gId];
      save();
    }
  };

  // ── Expenses ─────────────────────────────────────────────────────────────
  const addExpense = (evId, e) => {
    if (!db.events?.[evId]) return;
    const id = uid();
    if (!db.events[evId].expenses) db.events[evId].expenses = {};
    db.events[evId].expenses[id] = { id, createdAt: Date.now(), budgeted: 0, actual: 0, status: 'Unpaid', ...e };
    save();
    return db.events[evId].expenses[id];
  };
  const getExpenses = (evId) => Object.values(db.events?.[evId]?.expenses || {});
  const updateExpense = (evId, eId, data) => {
    if (db.events?.[evId]?.expenses?.[eId]) {
      Object.assign(db.events[evId].expenses[eId], data);
      save();
    }
  };
  const deleteExpense = (evId, eId) => {
    if (db.events?.[evId]?.expenses) {
      delete db.events[evId].expenses[eId];
      save();
    }
  };

  // ── Vendors & Catalog ────────────────────────────────────────────────────
  const getVendorCatalog = () => globalState.vendors || INITIAL_VENDORS;
  const getVendorById = (vId) => (globalState.vendors || INITIAL_VENDORS).find(v => v.id === vId || v.vendor_id === vId) || null;

  const updateVendorVerification = (vId, status) => {
    const v = (globalState.vendors || []).find(x => x.id === vId || x.vendor_id === vId || String(x.id) === String(vId) || ('v-' + x.vendor_id) === String(vId));
    if (v) {
      v.verificationStatus = status;
      v.verification_status = status;
      v.verified = (status === 'Verified');
      v.is_verified = (status === 'Verified');
      _saveGlobal();
      logAudit('VENDOR_VERIFY', `Vendor "${v.name}" status changed to ${status}`, { vendorId: vId, status });
    }
  };

  const updateVendorStorefront = (vId, isOnline) => {
    const v = (globalState.vendors || []).find(x => x.id === vId || x.vendor_id === vId || String(x.id) === String(vId) || ('v-' + x.vendor_id) === String(vId));
    if (v) {
      v.storefrontOnline = isOnline;
      v.storefront_status = isOnline ? 'ONLINE' : 'OFFLINE';
      v.is_published = isOnline;
      _saveGlobal();
      logAudit('VENDOR_STOREFRONT', `Vendor "${v.name}" storefront set to ${isOnline ? 'ONLINE' : 'OFFLINE'}`, { vendorId: vId, isOnline });
    }
  };

  const registerVendor = (vendorData) => {
    if (!globalState.vendors) globalState.vendors = [];
    const cleanName = (vendorData.name || vendorData.business_name || '').toLowerCase().trim();
    const existing = globalState.vendors.find(v => (v.name || '').toLowerCase().trim() === cleanName);
    if (existing) {
      Object.assign(existing, vendorData);
      _saveGlobal();
      return existing;
    }
    const id = 'v-' + uid();
    const newVendor = {
      id,
      rating: 5.0,
      reviewCount: 0,
      verified: false,
      verificationStatus: 'Pending Verification',
      badge: 'New Partner',
      responseTime: '< 30 mins',
      packages: [],
      ...vendorData
    };
    globalState.vendors.push(newVendor);
    _saveGlobal();
    logAudit('VENDOR_REGISTER', `New vendor registered: ${newVendor.name}`, { vendorId: id });
    return newVendor;
  };

  // ── Bookings & Operations Ecosystem ──────────────────────────────────────
  const getAllBookings = () => Object.values(globalState.bookings || {});

  const getBookingsForEvent = (evId) => {
    return Object.values(globalState.bookings || {}).filter(b => b.eventId === evId);
  };

  const getBookingsForVendor = (vId) => {
    return Object.values(globalState.bookings || {}).filter(b => b.vendorId === vId);
  };

  // Backward-compatible alias for existing modules
  const getBookings = (evId) => {
    if (evId) return getBookingsForEvent(evId);
    return getAllBookings();
  };

  /**
   * Complete Zomato-Like Booking Creation
   * Connects Customer -> Event -> Vendor -> Package
   */
  const requestBooking = (bookingData) => {
    const id = 'bk-' + uid();
    const subtotal = Number(bookingData.cost || bookingData.subtotal || 0);
    const tax = Math.round(subtotal * 0.05); // 5% GST
    const serviceFee = Math.round(subtotal * 0.02); // 2% coordination fee
    const commission = Math.round(subtotal * 0.10); // 10% platform commission
    const total = subtotal + tax + serviceFee;

    const vendor = getVendorById(bookingData.vendorId) || { name: bookingData.vendorName || 'Vendor' };
    const event = getEvent(bookingData.eventId) || { title: bookingData.eventName || 'Event' };

    const newBooking = {
      id,
      bookingId: id,
      createdAt: Date.now(),
      status: BOOKING_STATUS.REQUESTED,
      eventId: bookingData.eventId,
      eventName: event.title,
      eventDate: bookingData.eventDate || event.eventDate || '2026-10-24',
      vendorId: bookingData.vendorId,
      vendorName: vendor.name,
      vendorCategory: vendor.category || 'Catering',
      service: bookingData.service || vendor.category || 'Catering',
      packageId: bookingData.packageId || null,
      packageName: bookingData.packageName || 'Custom Package',
      guestCount: Number(bookingData.guestCount || event.guestCapacity || 100),
      subtotal,
      tax,
      serviceFee,
      commission,
      total,
      cost: total,
      notes: bookingData.notes || '',
      assignedEmployeeId: null,
      assignedEmployeeName: null,
      operationalStatus: 'Awaiting Vendor Acceptance'
    };

    if (!globalState.bookings) globalState.bookings = {};
    globalState.bookings[id] = newBooking;

    // Add to event's expenses ledger automatically
    if (bookingData.eventId && db.events?.[bookingData.eventId]) {
      addExpense(bookingData.eventId, {
        category: vendor.category || 'Catering & Food',
        description: `Booking: ${vendor.name} (${newBooking.packageName})`,
        budgeted: total,
        actual: total,
        status: 'Due',
        bookingId: id
      });
    }

    _saveGlobal();

    logAudit('CREATE_BOOKING', `Customer requested booking with ${vendor.name} for ₹${total.toLocaleString('en-IN')}`, {
      bookingId: id,
      vendorId: bookingData.vendorId,
      total
    });

    addNotification({
      role: 'vendor',
      recipientVendorId: bookingData.vendorId,
      title: 'New Booking Request! 🛎️',
      message: `${event.title} requested ${newBooking.packageName} for ${newBooking.guestCount} guests.`
    });

    return newBooking;
  };

  // Backward-compatible alias
  const addBooking = (evId, b) => {
    return requestBooking({ eventId: evId, ...b });
  };

  /**
   * Vendor accepts booking -> Transitions to ACCEPTED / CONFIRMED
   * and automatically schedules an Eventora Operational Field Staff Task!
   */
  const vendorAcceptBooking = (bookingId) => {
    const bk = globalState.bookings?.[bookingId];
    if (!bk) return null;

    bk.status = BOOKING_STATUS.ACCEPTED;
    bk.operationalStatus = 'Accepted by Vendor — Assigning Operations Crew';

    // Auto-assign first available operations employee
    const availableEmp = (globalState.employees || INITIAL_EMPLOYEES).find(e => e.status === 'Available') || INITIAL_EMPLOYEES[0];
    
    // Create linked field staff task
    const taskId = 'tsk-' + uid();
    const newTask = {
      id: taskId,
      bookingId,
      eventId: bk.eventId,
      eventName: bk.eventName,
      employeeId: availableEmp.id,
      employeeName: availableEmp.name,
      employeePhone: availableEmp.phone,
      title: `Coordinate ${bk.vendorCategory} Setup: ${bk.vendorName}`,
      taskType: bk.vendorCategory.includes('Catering') ? 'Food & Banquet Setup' : bk.vendorCategory.includes('Decor') ? 'Decor Inspection' : 'Operations Coordination',
      location: 'Taj Falaknuma Palace (Main Venue)',
      date: bk.eventDate,
      time: '15:00',
      status: TASK_STATUS.ASSIGNED,
      instructions: `Coordinate with ${bk.vendorName} (${bk.guestCount} guests). Verify menu items, live counters, heating stations, and hygiene standards.`,
      priority: 'High',
      updatedAt: Date.now()
    };

    bk.assignedEmployeeId = availableEmp.id;
    bk.assignedEmployeeName = availableEmp.name;
    bk.assignedTaskId = taskId;

    if (!globalState.employeeTasks) globalState.employeeTasks = {};
    globalState.employeeTasks[taskId] = newTask;

    _saveGlobal();

    logAudit('VENDOR_ACCEPT', `Vendor accepted booking ${bookingId}. Dispatched task to ${availableEmp.name}`, {
      bookingId,
      employeeId: availableEmp.id
    });

    addNotification({
      role: 'customer',
      title: 'Booking Confirmed! 🎉',
      message: `${bk.vendorName} has accepted your booking for ${bk.eventName}. Field Lead ${availableEmp.name} is assigned.`
    });

    addNotification({
      role: 'employee',
      recipientEmployeeId: availableEmp.id,
      title: 'New Operations Task Assigned 📋',
      message: `Assigned to oversee ${bk.vendorCategory} for ${bk.eventName} at 3:00 PM.`
    });

    return bk;
  };

  const vendorRejectBooking = (bookingId, reason = 'Unavailable on chosen date') => {
    const bk = globalState.bookings?.[bookingId];
    if (!bk) return null;
    bk.status = BOOKING_STATUS.REJECTED;
    bk.operationalStatus = `Rejected: ${reason}`;
    _saveGlobal();

    logAudit('VENDOR_REJECT', `Vendor declined booking ${bookingId} (${reason})`, { bookingId, reason });
    addNotification({
      role: 'customer',
      title: 'Booking Update',
      message: `${bk.vendorName} was unable to accept your request (${reason}). Please choose an alternate vendor.`
    });
    return bk;
  };

  const updateBookingStatus = (bookingId, newStatus) => {
    const bk = globalState.bookings?.[bookingId];
    if (bk) {
      bk.status = newStatus;
      _saveGlobal();
    }
  };

  const deleteBooking = (bookingId) => {
    if (globalState.bookings?.[bookingId]) {
      delete globalState.bookings[bookingId];
      _saveGlobal();
    }
  };

  // ── Employee / Field Staff Tasks ─────────────────────────────────────────
  const getEmployeeTasks = (empId) => {
    return Object.values(globalState.employeeTasks || {}).filter(t => !empId || t.employeeId === empId);
  };

  const getAllEmployeeTasks = () => Object.values(globalState.employeeTasks || {});

  /**
   * Field Staff Status Stepper:
   * ASSIGNED -> ACCEPTED -> ON_THE_WAY -> ARRIVED -> IN_PROGRESS -> COMPLETED
   */
  const updateTaskStatus = (taskId, newStatus) => {
    const task = globalState.employeeTasks?.[taskId];
    if (!task) return null;

    task.status = newStatus;
    task.updatedAt = Date.now();

    // Reflect onto associated booking
    if (task.bookingId && globalState.bookings?.[task.bookingId]) {
      const bk = globalState.bookings[task.bookingId];
      if (newStatus === TASK_STATUS.ON_THE_WAY) {
        bk.operationalStatus = `Coordinator ${task.employeeName} is on the way to venue`;
      } else if (newStatus === TASK_STATUS.ARRIVED) {
        bk.operationalStatus = `Coordinator ${task.employeeName} arrived on-site`;
      } else if (newStatus === TASK_STATUS.IN_PROGRESS) {
        bk.operationalStatus = `Setup in progress with ${bk.vendorName}`;
        bk.status = BOOKING_STATUS.IN_PROGRESS;
      } else if (newStatus === TASK_STATUS.COMPLETED) {
        bk.operationalStatus = `Service fully verified & executed ✓`;
        bk.status = BOOKING_STATUS.COMPLETED;
      }
    }

    _saveGlobal();

    logAudit('TASK_UPDATE', `Field Staff task ${taskId} updated to ${newStatus}`, { taskId, newStatus });

    addNotification({
      role: 'customer',
      title: 'Event Operations Update 📍',
      message: `Task "${task.title}": Status updated to ${newStatus.replace(/_/g, ' ')}.`
    });

    return task;
  };

  // ── Reviews & Ratings ────────────────────────────────────────────────────
  const addReview = (reviewData) => {
    const id = 'rev-' + uid();
    const newRev = {
      id,
      createdAt: Date.now(),
      dateStr: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      ...reviewData
    };

    if (!globalState.reviews) globalState.reviews = {};
    if (!globalState.reviews[reviewData.vendorId]) globalState.reviews[reviewData.vendorId] = [];
    globalState.reviews[reviewData.vendorId].push(newRev);

    // Recalculate vendor rating
    const v = getVendorById(reviewData.vendorId);
    if (v) {
      const allRev = globalState.reviews[reviewData.vendorId];
      const avg = allRev.reduce((acc, r) => acc + Number(r.rating || 5), 0) / allRev.length;
      v.rating = Number(avg.toFixed(1));
      v.reviewCount = (v.reviewCount || 0) + 1;
    }

    _saveGlobal();
    logAudit('ADD_REVIEW', `Customer submitted ${newRev.rating}★ review for ${v?.name || 'Vendor'}`, { reviewId: id });
    return newRev;
  };

  const getReviewsForVendor = (vId) => globalState.reviews?.[vId] || [];

  // ── Audit Logs & Notifications ───────────────────────────────────────────
  const logAudit = (action, details, metadata = {}) => {
    if (!globalState.auditLogs) globalState.auditLogs = [];
    globalState.auditLogs.unshift({
      id: uid(),
      action,
      details,
      metadata,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toISOString().split('T')[0]
    });
    if (globalState.auditLogs.length > 100) globalState.auditLogs.pop();
    _saveGlobal();
  };

  const getAuditLogs = () => globalState.auditLogs || [];

  const addNotification = (notif) => {
    if (!globalState.notifications) globalState.notifications = [];
    globalState.notifications.unshift({
      id: uid(),
      createdAt: Date.now(),
      timeStr: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      ...notif
    });
    if (globalState.notifications.length > 50) globalState.notifications.pop();
    _saveGlobal();
  };

  const getNotifications = (role = null) => {
    const list = globalState.notifications || [];
    if (!role) return list;
    return list.filter(n => !n.role || n.role === role || n.role === 'all');
  };

  // ── Tasks / Schedule / Floor Elements (Event-Scoped) ─────────────────────
  const addTask = (evId, t) => {
    if (!db.events?.[evId]) return;
    const id = uid();
    if (!db.events[evId].tasks) db.events[evId].tasks = {};
    db.events[evId].tasks[id] = { id, createdAt: Date.now(), status: 'Todo', priority: 'Medium', ...t };
    save();
    return db.events[evId].tasks[id];
  };
  const getTasks = (evId) => Object.values(db.events?.[evId]?.tasks || {});
  const updateTask = (evId, tId, data) => {
    if (db.events?.[evId]?.tasks?.[tId]) {
      Object.assign(db.events[evId].tasks[tId], data);
      save();
    }
  };
  const deleteTask = (evId, tId) => {
    if (db.events?.[evId]?.tasks) {
      delete db.events[evId].tasks[tId];
      save();
    }
  };

  const addScheduleItem = (evId, s) => {
    if (!db.events?.[evId]) return;
    const id = uid();
    if (!db.events[evId].schedule) db.events[evId].schedule = {};
    db.events[evId].schedule[id] = { id, createdAt: Date.now(), ...s };
    save();
    return db.events[evId].schedule[id];
  };
  const getSchedule = (evId) => Object.values(db.events?.[evId]?.schedule || {}).sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  const updateScheduleItem = (evId, sId, data) => {
    if (db.events?.[evId]?.schedule?.[sId]) {
      Object.assign(db.events[evId].schedule[sId], data);
      save();
    }
  };
  const deleteScheduleItem = (evId, sId) => {
    if (db.events?.[evId]?.schedule) {
      delete db.events[evId].schedule[sId];
      save();
    }
  };

  const getFloorElements = (evId) => db.events?.[evId]?.floorElements || {};
  const saveFloorElements = (evId, elements) => {
    if (db.events?.[evId]) {
      db.events[evId].floorElements = elements;
      save();
    }
  };

  const addAlert = (evId, a) => {
    if (!db.events?.[evId]) return;
    const id = uid();
    if (!db.events[evId].alerts) db.events[evId].alerts = {};
    db.events[evId].alerts[id] = { id, createdAt: Date.now(), timestamp: new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}), ...a };
    save();
    return db.events[evId].alerts[id];
  };
  const getAlerts = (evId) => Object.values(db.events?.[evId]?.alerts || {}).sort((a,b) => b.createdAt - a.createdAt).slice(0, 20);

  // ── Platform-wide Admin Analytics ────────────────────────────────────────
  const getPlatformAnalytics = () => {
    const allBks = Object.values(globalState.bookings || {});
    const confirmedBks = allBks.filter(b => b.status === BOOKING_STATUS.CONFIRMED || b.status === BOOKING_STATUS.COMPLETED || b.status === BOOKING_STATUS.IN_PROGRESS);
    
    const gmv = confirmedBks.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    const commission = confirmedBks.reduce((sum, b) => sum + (Number(b.commission) || 0), 0);
    const activeVendors = (globalState.vendors || []).filter(v => v.verified).length;
    const activeEmployees = (globalState.employees || []).length;
    const allEvs = Object.values(db.events || {});

    return {
      gmv,
      commission,
      totalBookings: allBks.length,
      confirmedBookings: confirmedBks.length,
      activeVendors,
      activeEmployees,
      totalEvents: allEvs.length,
      pendingApprovals: (globalState.vendors || []).filter(v => !v.verified).length
    };
  };

  // Seed sample data for paired demo or testing
  const seedDemoData = () => {
    const e1 = createEvent({
      title: 'Royal Deccan Heritage Wedding',
      category: 'Wedding',
      eventDate: '2026-10-24',
      startTime: '18:30',
      guestCapacity: 250,
      budget: 800000,
      venueName: 'Taj Falaknuma Palace',
      venueCity: 'Hyderabad',
      status: 'Confirmed',
      description: 'A grand traditional wedding celebration featuring royal banquet, classical performances, and fireworks.'
    });

    // Request booking for Royal Feast Catering
    const bk = requestBooking({
      eventId: e1.id,
      vendorId: 'v-royal-feast',
      service: 'Catering',
      packageId: 'pkg-diamond',
      packageName: 'Diamond Royal Wedding Feast',
      guestCount: 250,
      cost: 324750, // 250 * 1299
      notes: 'Provide live chaat counter and zafrani biryani'
    });

    // Auto-accept & assign field staff for demo experience
    vendorAcceptBooking(bk.id);

    return e1;
  };

  return {
    init, save, uid, formatCurrency,
    setUser, getCurrentRole, setRole,
    BOOKING_STATUS, TASK_STATUS, VENDOR_STATUS,
    // Events
    createEvent, getEvent, getAllEvents, updateEvent, deleteEvent,
    getActiveEventId, setActiveEvent,
    // Categories
    getCategories, addCategory,
    // Guests & Expenses
    addGuest, getGuests, updateGuest, deleteGuest,
    addExpense, getExpenses, updateExpense, deleteExpense,
    // Vendors
    getVendorCatalog, getVendorById, updateVendorVerification, updateVendorStorefront, registerVendor,
    // Bookings & Operations
    requestBooking, addBooking, getBookings, getAllBookings, getBookingsForEvent, getBookingsForVendor,
    vendorAcceptBooking, vendorRejectBooking, updateBookingStatus, deleteBooking,
    // Field Staff Tasks
    getEmployeeTasks, getAllEmployeeTasks, updateTaskStatus,
    // Reviews
    addReview, getReviewsForVendor,
    // Audit & Notifications
    logAudit, getAuditLogs, addNotification, getNotifications,
    // Floor & Schedule
    addTask, getTasks, updateTask, deleteTask,
    addScheduleItem, getSchedule, updateScheduleItem, deleteScheduleItem,
    getFloorElements, saveFloorElements,
    addAlert, getAlerts,
    // Analytics & Demo
    getPlatformAnalytics, seedDemoData
  };
})();
