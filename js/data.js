/**
 * EVENTORA 3.0 — Data Layer (EventoraDB)
 * Per-user namespaced storage: each user's data lives under eventora_v3_<userId>
 */
window.EventoraDB = (() => {
  const BASE_KEY = 'eventora_v3';
  let db = {};
  let _userId = null;

  // Returns the storage key for the current user
  const _key = () => _userId ? `${BASE_KEY}_${_userId}` : BASE_KEY;

  // Switch active user — call after login/signup, pass null on logout
  const setUser = (userId) => {
    _userId = userId;
    const saved = localStorage.getItem(_key());
    if (saved) { try { db = JSON.parse(saved); } catch(e) { db = {}; } }
    else { db = {}; }
    if (!db.events)       db.events = {};
    if (!db.activeEventId) db.activeEventId = null;
    save();
  };

  const init = () => {
    // On cold start with no user, just set up empty shell
    const saved = localStorage.getItem(_key());
    if (saved) { try { db = JSON.parse(saved); } catch(e) { db = {}; } }
    if (!db.events)       db.events = {};
    if (!db.activeEventId) db.activeEventId = null;
    save();
  };

  const save = () => localStorage.setItem(_key(), JSON.stringify(db));

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const formatCurrency = (n) => {
    if (!n && n !== 0) return '₹0';
    const abs = Math.abs(Number(n));
    if (abs >= 10000000) return `₹${(abs/10000000).toFixed(2)}Cr`;
    if (abs >= 100000)   return `₹${(abs/100000).toFixed(2)}L`;
    if (abs >= 1000)     return `₹${(abs/1000).toFixed(1)}K`;
    return `₹${abs.toLocaleString('en-IN')}`;
  };

  // ── Default Budget Categories ──────────────────────────────────────────
  const DEFAULT_CATEGORIES = [
    { id:'cat-food',      name:'Catering & Food',      icon:'🍽️', color:'#8b5cf6' },
    { id:'cat-venue',     name:'Venue & Decor',         icon:'🏠', color:'#ec4899' },
    { id:'cat-photo',     name:'Photography',           icon:'📸', color:'#06b6d4' },
    { id:'cat-ent',       name:'Entertainment & DJ',    icon:'🎵', color:'#f59e0b' },
    { id:'cat-transport', name:'Transport',             icon:'🚌', color:'#10b981' },
    { id:'cat-invite',    name:'Invitations',           icon:'💌', color:'#f43f5e' },
    { id:'cat-other',     name:'Contingency',           icon:'🛡️', color:'#6b7280' },
  ];

  // ── Budget Categories (per-event, customizable) ────────────────────────
  const getCategories = (evId) => {
    if (!db.events[evId]) return DEFAULT_CATEGORIES;
    if (!db.events[evId].categories) {
      db.events[evId].categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      save();
    }
    return db.events[evId].categories;
  };

  const addCategory = (evId, cat) => {
    if (!db.events[evId]) return;
    if (!db.events[evId].categories) db.events[evId].categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    const id = uid();
    db.events[evId].categories.push({ id, ...cat });
    save();
    return id;
  };

  const updateCategory = (evId, catId, data) => {
    if (!db.events[evId]?.categories) return;
    const idx = db.events[evId].categories.findIndex(c => c.id === catId);
    if (idx !== -1) { Object.assign(db.events[evId].categories[idx], data); save(); }
  };

  const deleteCategory = (evId, catId) => {
    if (!db.events[evId]?.categories) return;
    db.events[evId].categories = db.events[evId].categories.filter(c => c.id !== catId);
    save();
  };

  // ── Events ──────────────────────────────────────────────────────────────
  const createEvent = (data) => {
    const id = uid();
    db.events[id] = {
      id, createdAt: Date.now(),
      guests: {}, expenses: {}, bookings: {}, tasks: {}, schedule: {},
      floorElements: {}, alerts: {},
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      ...data
    };
    db.activeEventId = id;
    save();
    return db.events[id];
  };

  const getEvent     = (id) => db.events[id] || null;
  const getAllEvents  = () => Object.values(db.events);
  const updateEvent  = (id, data) => { if (db.events[id]) { Object.assign(db.events[id], data); save(); } };
  const deleteEvent  = (id) => { delete db.events[id]; if (db.activeEventId === id) db.activeEventId = Object.keys(db.events)[0] || null; save(); };

  const getActiveEventId = () => db.activeEventId;
  const setActiveEvent   = (id) => { db.activeEventId = id; save(); };

  // ── Guests ───────────────────────────────────────────────────────────────
  const addGuest    = (evId, g) => { if (!db.events[evId]) return; const id = uid(); if (!db.events[evId].guests) db.events[evId].guests = {}; db.events[evId].guests[id] = { id, createdAt: Date.now(), rsvp:'Pending', checkedIn:false, role:'Guest', ...g }; save(); return db.events[evId].guests[id]; };
  const getGuests   = (evId) => Object.values(db.events[evId]?.guests || {});
  const updateGuest = (evId, gId, data) => { if (db.events[evId]?.guests?.[gId]) { Object.assign(db.events[evId].guests[gId], data); save(); } };
  const deleteGuest = (evId, gId) => { if (db.events[evId]?.guests) { delete db.events[evId].guests[gId]; save(); } };

  // ── Expenses ─────────────────────────────────────────────────────────────
  const addExpense    = (evId, e) => { if (!db.events[evId]) return; const id = uid(); if (!db.events[evId].expenses) db.events[evId].expenses = {}; db.events[evId].expenses[id] = { id, createdAt: Date.now(), ...e }; save(); return db.events[evId].expenses[id]; };
  const getExpenses   = (evId) => Object.values(db.events[evId]?.expenses || {});
  const deleteExpense = (evId, eId) => { if (db.events[evId]?.expenses) { delete db.events[evId].expenses[eId]; save(); } };
  const updateExpense = (evId, eId, data) => { if (db.events[evId]?.expenses?.[eId]) { Object.assign(db.events[evId].expenses[eId], data); save(); } };

  // ── Vendors / Bookings ───────────────────────────────────────────────────
  const VENDOR_CATALOG = [
    { id:'v1', name:'Lumiere Cinematic Studios', contact:'Vikram Sen', category:'Photography & Media', city:'Hyderabad', rating:4.9, price:135000, img:'photography', verified:true, desc:'Award-winning wedding & event photography' },
    { id:'v2', name:'Royal Nizam Gourmet Caterers', contact:'Mirza Baig', category:'Catering', city:'Hyderabad', rating:4.8, price:850, priceUnit:'per plate', img:'catering', verified:true, desc:'North & South Indian cuisine specialists' },
    { id:'v3', name:'Elysian Floral & Lighting', contact:'Ananya Roy', category:'Decor', city:'Hyderabad', rating:4.7, price:280000, img:'decor', verified:true, desc:'Premium floral design and lighting solutions' },
    { id:'v4', name:'Bassline Beats & Laser FX', contact:'DJ Arjun', category:'Audio/Visual & DJ', city:'Hyderabad', rating:4.8, price:60000, img:'dj', verified:true, desc:'Professional DJ and live sound engineering' },
    { id:'v5', name:'SecureShield Event Security', contact:'Mahesh K', category:'Security', city:'Hyderabad', rating:4.6, price:15000, priceUnit:'per guard/day', img:'security', verified:true, desc:'Trained event security personnel' },
    { id:'v6', name:'Golden Transport Co.', contact:'Suresh P', category:'Transport', city:'Hyderabad', rating:4.5, price:8000, priceUnit:'per vehicle', img:'transport', verified:false, desc:'AC buses, vans and luxury cars' },
    { id:'v7', name:'Skyline Stage Productions', contact:'Ravi T', category:'Stage & Production', city:'Hyderabad', rating:4.7, price:120000, img:'lighting', verified:true, desc:'Full stage, LED walls, rigging' },
    { id:'v8', name:'Snapmoments Photo Booth', contact:'Priya L', category:'Photo Booth', city:'Hyderabad', rating:4.8, price:18000, img:'photography', verified:true, desc:'Interactive photo booths with instant prints' },
  ];

  const getVendorCatalog = () => VENDOR_CATALOG;
  const addBooking    = (evId, b) => { if (!db.events[evId]) return; const id = uid(); if (!db.events[evId].bookings) db.events[evId].bookings = {}; db.events[evId].bookings[id] = { id, createdAt: Date.now(), status:'Pending', ...b }; save(); return db.events[evId].bookings[id]; };
  const getBookings   = (evId) => Object.values(db.events[evId]?.bookings || {});
  const updateBooking = (evId, bId, data) => { if (db.events[evId]?.bookings?.[bId]) { Object.assign(db.events[evId].bookings[bId], data); save(); } };
  const deleteBooking = (evId, bId) => { if (db.events[evId]?.bookings) { delete db.events[evId].bookings[bId]; save(); } };

  // ── Tasks ────────────────────────────────────────────────────────────────
  const addTask    = (evId, t) => { if (!db.events[evId]) return; const id = uid(); if (!db.events[evId].tasks) db.events[evId].tasks = {}; db.events[evId].tasks[id] = { id, createdAt: Date.now(), status:'Todo', priority:'Medium', ...t }; save(); return db.events[evId].tasks[id]; };
  const getTasks   = (evId) => Object.values(db.events[evId]?.tasks || {});
  const updateTask = (evId, tId, data) => { if (db.events[evId]?.tasks?.[tId]) { Object.assign(db.events[evId].tasks[tId], data); save(); } };
  const deleteTask = (evId, tId) => { if (db.events[evId]?.tasks) { delete db.events[evId].tasks[tId]; save(); } };

  // ── Schedule ─────────────────────────────────────────────────────────────
  const addScheduleItem    = (evId, s) => { if (!db.events[evId]) return; const id = uid(); if (!db.events[evId].schedule) db.events[evId].schedule = {}; db.events[evId].schedule[id] = { id, createdAt: Date.now(), ...s }; save(); return db.events[evId].schedule[id]; };
  const getSchedule        = (evId) => Object.values(db.events[evId]?.schedule || {}).sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  const updateScheduleItem = (evId, sId, data) => { if (db.events[evId]?.schedule?.[sId]) { Object.assign(db.events[evId].schedule[sId], data); save(); } };
  const deleteScheduleItem = (evId, sId) => { if (db.events[evId]?.schedule) { delete db.events[evId].schedule[sId]; save(); } };

  // ── Floor Plan ───────────────────────────────────────────────────────────
  const getFloorElements  = (evId) => db.events[evId]?.floorElements || {};
  const saveFloorElements = (evId, elements) => { if (db.events[evId]) { db.events[evId].floorElements = elements; save(); } };

  // ── Alerts ───────────────────────────────────────────────────────────────
  const addAlert  = (evId, a) => { if (!db.events[evId]) return; const id = uid(); if (!db.events[evId].alerts) db.events[evId].alerts = {}; db.events[evId].alerts[id] = { id, createdAt: Date.now(), timestamp: new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}), ...a }; save(); return db.events[evId].alerts[id]; };
  const getAlerts = (evId) => Object.values(db.events[evId]?.alerts || {}).sort((a,b) => b.createdAt - a.createdAt).slice(0,20);

  // ── Seed Demo Data (called once per new user, on first event creation) ───
  const seedDemoData = () => {
    const e1 = createEvent({
      title:'Royal Deccan Heritage Wedding', category:'Wedding', subtype:'Hindu Wedding',
      eventDate:'2026-10-24', startTime:'11:00', guestCapacity:450, format:'Physical',
      description:'A grand celebration blending royal Deccan traditions with modern elegance.',
      budget:1500000, venueType:'hotel', venueName:'Taj Falaknuma Palace',
      venueCity:'Hyderabad', venueAddr:'Engine Bowli, Falaknuma', venueCapacity:500,
      modules:['Guests','Budget','Vendors','Tasks','Venue','Schedule','Catering','Transport','Accommodation','Invitations','Media','Live'],
      status:'Planning', coverImage:'wedding'
    });
    [{name:'Priya Sharma',email:'priya@email.com',phone:'9876543210',rsvp:'Attending',role:'VIP',table:'A1',dietary:'Vegetarian'},
     {name:'Rahul Verma',email:'rahul@email.com',phone:'9876543211',rsvp:'Attending',role:'Groom',table:'Head',dietary:'Non-Vegetarian'},
     {name:'Sunita Devi',email:'sunita@email.com',phone:'9876543212',rsvp:'Attending',role:'Guest',table:'B2',dietary:'Vegetarian'},
     {name:'Amir Khan',email:'amir@email.com',phone:'9876543213',rsvp:'Pending',role:'Guest',table:'C3',dietary:'Halal'},
     {name:'Lakshmi Rao',email:'lakshmi@email.com',phone:'9876543214',rsvp:'Declined',role:'Guest',table:'',dietary:'Vegetarian'},
    ].forEach(g => addGuest(e1.id, g));
    [{category:'Catering & Food',description:'Advance to Royal Nizam Caterers',budgeted:525000,actual:420000,status:'Paid'},
     {category:'Venue & Decor',description:'Stage & floral décor advance',budgeted:300000,actual:280000,status:'Paid'},
     {category:'Photography',description:'Lumiere Studios booking',budgeted:180000,actual:135000,status:'Pending'},
     {category:'Venue & Decor',description:'Taj Falaknuma booking',budgeted:300000,actual:300000,status:'Paid'},
     {category:'Catering & Food',description:'Remaining catering balance',budgeted:175000,actual:180000,status:'Due'},
     {category:'Transport',description:'Guest pickup buses',budgeted:50000,actual:30000,status:'Paid'},
    ].forEach(e => addExpense(e1.id, e));
    [{vendorId:'v1',vendorName:'Lumiere Cinematic Studios',service:'Photography & Media',cost:135000,status:'Confirmed'},
     {vendorId:'v2',vendorName:'Royal Nizam Gourmet Caterers',service:'Catering',cost:420000,status:'Confirmed'},
     {vendorId:'v3',vendorName:'Elysian Floral & Lighting',service:'Decor',cost:280000,status:'Confirmed'},
    ].forEach(b => addBooking(e1.id, b));
    [{name:'Book venue — Taj Falaknuma',status:'Done',priority:'High',deadline:'2026-09-15',category:'Venue'},
     {name:'Finalize catering menu',status:'Done',priority:'High',deadline:'2026-09-20',category:'Catering'},
     {name:'Send wedding invitations',status:'In Progress',priority:'High',deadline:'2026-09-30',category:'Invitations'},
     {name:'Arrange guest transport',status:'Todo',priority:'Medium',deadline:'2026-10-10',category:'Transport'},
     {name:'Book accommodation for out-of-town guests',status:'Todo',priority:'Medium',deadline:'2026-10-05',category:'Accommodation'},
     {name:'Confirm seating chart',status:'Todo',priority:'Low',deadline:'2026-10-20',category:'Venue'},
    ].forEach(t => addTask(e1.id, t));
    [{startTime:'10:00',endTime:'11:30',title:'Baraat Procession',location:'Main Gate',type:'keynote',speaker:''},
     {startTime:'11:30',endTime:'13:00',title:'Wedding Ceremony (Mandap)',location:'Durbar Hall',type:'session',speaker:'Pandit Ji'},
     {startTime:'13:00',endTime:'14:30',title:'Wedding Lunch',location:'Dining Hall',type:'meal',speaker:''},
     {startTime:'15:00',endTime:'16:30',title:'Photo Session',location:'Gardens',type:'session',speaker:'Lumiere Studios'},
     {startTime:'17:00',endTime:'19:00',title:'Vendor Setup — Reception',location:'Ballroom',type:'setup',speaker:''},
     {startTime:'19:30',endTime:'23:00',title:'Reception & Dinner',location:'Grand Ballroom',type:'keynote',speaker:''},
    ].forEach(s => addScheduleItem(e1.id, s));
    [{type:'success',message:'Registration desk running smoothly',icon:'✅'},
     {type:'success',message:'Catering team ready at buffet counter',icon:'✅'},
     {type:'warning',message:'Sound check needed at Stage B',icon:'⚠️'},
     {type:'info',message:'VIP guests arriving — escort required',icon:'ℹ️'},
    ].forEach(a => addAlert(e1.id, a));
    db.activeEventId = e1.id;
    save();
  };

  return {
    init, save, uid, formatCurrency, setUser,
    createEvent, getEvent, getAllEvents, updateEvent, deleteEvent,
    getActiveEventId, setActiveEvent,
    getCategories, addCategory, updateCategory, deleteCategory,
    addGuest, getGuests, updateGuest, deleteGuest,
    addExpense, getExpenses, deleteExpense, updateExpense,
    getVendorCatalog, addBooking, getBookings, updateBooking, deleteBooking,
    addTask, getTasks, updateTask, deleteTask,
    addScheduleItem, getSchedule, updateScheduleItem, deleteScheduleItem,
    getFloorElements, saveFloorElements,
    addAlert, getAlerts,
    seedDemoData,
  };
})();
