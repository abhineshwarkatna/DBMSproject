/**
 * EVENTORA — Live Connected Real-Time Marketplace Engine
 * ========================================================
 * Database: Supabase PostgreSQL (Single Source of Truth)
 * Realtime: Supabase Realtime Channels (postgres_changes)
 *
 * Core Rules:
 * 1. Database is the SINGLE SOURCE OF TRUTH (vendors table).
 * 2. When a vendor creates a business, it is immediately visible to ALL authenticated customers.
 * 3. NO admin approval / verification status blocks customer visibility.
 * 4. Customers already inside the Marketplace see new vendors WITHOUT page refresh.
 * 5. Real-time updates on INSERT, UPDATE, DELETE propagate across sessions instantly.
 * 6. Never display "Starting from ₹0" — show "Price on request" if price is 0 or missing.
 * 7. Never display fake "5.0 (0)" rating — show "✨ New" if 0 reviews.
 * 8. Duplicate prevention ensures stable cards by vendor_id / name.
 */

window.LiveMarketplace = (() => {
  let _vendors = [];
  let _notifications = [];
  let _realtimeChannels = {};
  let _initialized = false;
  let _activeCategory = 'All';
  let _searchQuery = '';
  let _guestCount = 100;
  let _activeVendor = null;
  let _selectedPkg = null;
  let _unreadCount = 0;
  let _isLoading = false;
  let _loadError = null;

  const CATEGORIES = [
    { id: 'All',           label: 'All Services',     icon: '✨' },
    { id: 'Catering',      label: 'Food & Catering',  icon: '🍽️' },
    { id: 'Photography',   label: 'Photography',      icon: '📸' },
    { id: 'Decor',         label: 'Decor & Floral',   icon: '🌸' },
    { id: 'Entertainment', label: 'DJ & Sound',       icon: '🎵' },
    { id: 'Venues',        label: 'Venues',           icon: '🏠' },
    { id: 'Transport',     label: 'Transport',        icon: '🚌' },
    { id: 'Security',      label: 'Security',         icon: '🛡️' },
  ];

  // Normalized display categories
  const _normCat = (cat) => {
    if (!cat) return 'Catering';
    const c = cat.toLowerCase();
    if (c.includes('cater') || c.includes('food')) return 'Catering';
    if (c.includes('photo') || c.includes('media') || c.includes('film')) return 'Photography';
    if (c.includes('decor') || c.includes('floral') || c.includes('flower')) return 'Decor';
    if (c.includes('dj') || c.includes('music') || c.includes('sound') || c.includes('audio') || c.includes('entertain')) return 'Entertainment';
    if (c.includes('venue') || c.includes('hall') || c.includes('banquet') || c.includes('resort')) return 'Venues';
    if (c.includes('transport') || c.includes('car') || c.includes('coach') || c.includes('fleet') || c.includes('bus')) return 'Transport';
    if (c.includes('security') || c.includes('guard') || c.includes('escort') || c.includes('logistic')) return 'Security';
    return cat;
  };

  // Convert to exact PostgreSQL check constraint value on public.vendors
  // CHECK (service_category IN ('Catering', 'Photography & Media', 'Venue & Decor', 'Audio/Visual & DJ', 'Security & Logistics'))
  const _toDBServiceCategory = (cat) => {
    if (!cat) return 'Catering';
    const c = cat.toLowerCase();
    if (c.includes('cater') || c.includes('food')) return 'Catering';
    if (c.includes('photo') || c.includes('media') || c.includes('film')) return 'Photography & Media';
    if (c.includes('venue') || c.includes('decor') || c.includes('hall') || c.includes('banquet') || c.includes('floral')) return 'Venue & Decor';
    if (c.includes('dj') || c.includes('music') || c.includes('sound') || c.includes('audio') || c.includes('entertain')) return 'Audio/Visual & DJ';
    if (c.includes('security') || c.includes('guard') || c.includes('logistic') || c.includes('transport')) return 'Security & Logistics';
    return 'Catering';
  };

  const _catIcon = (cat) => {
    const map = {
      'Catering': '🍽️',
      'Photography': '📸',
      'Decor': '🌸',
      'Entertainment': '🎵',
      'Venues': '🏠',
      'Transport': '🚌',
      'Security': '🛡️'
    };
    return map[_normCat(cat)] || '🏢';
  };

  const _catImg = (cat) => {
    const imgs = {
      'Catering': 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=80&auto=format&fit=crop',
      'Photography': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80&auto=format&fit=crop',
      'Decor': 'https://images.unsplash.com/photo-1519225421-2c890c5c2d59?w=800&q=80&auto=format&fit=crop',
      'Entertainment': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80&auto=format&fit=crop',
      'Venues': 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80&auto=format&fit=crop',
      'Transport': 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80&auto=format&fit=crop',
      'Security': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop'
    };
    return imgs[_normCat(cat)] || 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80&auto=format&fit=crop';
  };

  const sb = () => window.EventoraSupabase?.client;

  // ── Connection Status Indicator ─────────────────────────────────────────
  const _updateConnectionIndicator = (state) => {
    const el = document.getElementById('mktLiveIndicator');
    if (!el) return;
    if (state === 'connected') {
      el.innerHTML = '<span style="color:#10b981;font-size:12px;font-weight:700">● Live Real-Time Sync Active</span>';
    } else if (state === 'disconnected') {
      el.innerHTML = '<span style="color:#ef4444;font-size:12px;font-weight:700">○ Real-Time Reconnecting...</span>';
    } else {
      el.innerHTML = '<span style="color:#f59e0b;font-size:12px;font-weight:700">◌ Real-Time Connecting...</span>';
    }
  };

  // ── Helper: Public Visibility Rule (Section 9 & 22) ─────────────────────
  // A newly created business MUST be visible to customers immediately.
  // Verification status DOES NOT BLOCK visibility in this version.
  // Only explicitly suspended or storefront offline listings are hidden.
  const _isVendorPublic = (v) => {
    if (!v) return false;
    const name = v.business_name || v.name;
    if (!name || name.trim() === '') return false;
    const isSuspended = (v.verification_status === 'Suspended' || v.verificationStatus === 'Suspended');
    const isOffline = (v.storefront_status === 'OFFLINE' || v.storefrontOnline === false || v.is_published === false);
    return !isSuspended && !isOffline;
  };

  // ── Helper: Normalize Vendor Record ─────────────────────────────────────
  const _normalizeVendor = (raw) => {
    const vId = raw.vendor_id ? Number(raw.vendor_id) : (raw.id && !isNaN(Number(raw.id)) ? Number(raw.id) : null);
    const baseId = raw.id || (raw.vendor_id ? ('v-' + raw.vendor_id) : ('v-' + Math.random().toString(36).substr(2, 9)));
    const cat = _normCat(raw.service_category || raw.category || 'Catering');
    const rawPrice = Number(raw.starting_price || raw.base_price || raw.price || 0);
    const price = isNaN(rawPrice) ? 0 : rawPrice;
    const name = raw.business_name || raw.name || 'Eventora Partner';

    const revCount = Number(raw.review_count || raw.reviewCount || 0);
    const rawRating = raw.rating !== undefined && raw.rating !== null ? Number(raw.rating) : 5.0;

    return {
      vendor_id: vId,
      id: baseId,
      name: name,
      business_name: name,
      category: cat,
      service_category: cat,
      city: raw.location || raw.city || 'Hyderabad',
      location: raw.location || raw.city || 'Hyderabad',
      serviceArea: raw.service_area || raw.serviceArea || 'Telangana & AP',
      service_area: raw.service_area || raw.serviceArea || 'Telangana & AP',
      price: price,
      starting_price: price,
      base_price: price,
      priceUnit: raw.priceUnit || (cat === 'Catering' ? 'person' : 'service'),
      rating: isNaN(rawRating) ? 5.0 : rawRating,
      reviewCount: isNaN(revCount) ? 0 : revCount,
      review_count: isNaN(revCount) ? 0 : revCount,
      verified: raw.is_verified === true || raw.verification_status === 'Verified' || raw.verificationStatus === 'Verified',
      is_verified: raw.is_verified === true || raw.verification_status === 'Verified' || raw.verificationStatus === 'Verified',
      verification_status: raw.verification_status || raw.verificationStatus || (raw.is_verified ? 'Verified' : 'Pending Verification'),
      verificationStatus: raw.verification_status || raw.verificationStatus || (raw.is_verified ? 'Verified' : 'Pending Verification'),
      storefront_status: raw.storefront_status || (raw.storefrontOnline === false ? 'OFFLINE' : 'ONLINE'),
      storefrontOnline: raw.storefront_status !== 'OFFLINE' && raw.storefrontOnline !== false && raw.is_published !== false,
      is_published: raw.is_published !== false && raw.storefront_status !== 'OFFLINE',
      description: raw.description || raw.desc || `Premium ${cat} services coordinated directly by Eventora operations.`,
      desc: raw.description || raw.desc || `Premium ${cat} services coordinated directly by Eventora operations.`,
      phone: raw.phone || '+91 91234 56780',
      email: raw.email || 'partner@eventora.io',
      logo_url: raw.logo_url || null,
      img: raw.logo_url || _catImg(cat),
      packages: raw.packages || [
        {
          id: 'pkg-standard-' + baseId,
          name: 'Standard ' + cat + ' Package',
          price: price > 0 ? price : (cat === 'Catering' ? 599 : (cat === 'Venues' ? 85000 : 25000)),
          priceType: cat === 'Catering' ? 'per person' : 'package',
          description: `Complete ${cat} setup with dedicated Eventora on-site operations coordinator.`
        }
      ]
    };
  };

  // ── Database Initial Load (Section 4 & 5) ───────────────────────────────
  const _fetchVendorsFromDB = async () => {
    const client = sb();
    let supabaseVendors = [];

    if (client) {
      try {
        console.log('[EVENTORA] Loading businesses: Querying Supabase public.vendors...');
        const { data, error } = await client
          .from('vendors')
          .select('*')
          .order('vendor_id', { ascending: false });

        if (error) {
          console.error('[EVENTORA] Supabase fetch error:', error.message);
          _loadError = error.message;
        } else if (data) {
          supabaseVendors = data.map(_normalizeVendor);
          console.log(`[EVENTORA] Businesses loaded from Supabase: ${supabaseVendors.length} records`);
        }
      } catch (err) {
        console.warn('[EVENTORA] Supabase query exception:', err);
        _loadError = err.message;
      }
    }

    // Merge with local fallback catalog if present
    const localCatalog = (window.EventoraDB ? EventoraDB.getVendorCatalog() : []).map(_normalizeVendor);
    const mergedMap = new Map();

    // 1. Add local seed vendors first
    localCatalog.forEach(v => {
      if (_isVendorPublic(v)) {
        mergedMap.set(v.name.toLowerCase().trim(), v);
      }
    });

    // 2. Supabase records take precedence as Single Source of Truth
    supabaseVendors.forEach(v => {
      const key = v.name.toLowerCase().trim();
      if (_isVendorPublic(v)) {
        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key);
          mergedMap.set(key, { ...existing, ...v, packages: existing.packages || v.packages });
        } else {
          mergedMap.set(key, v);
        }
      } else {
        // If Supabase says this vendor is suspended or offline, remove immediately!
        mergedMap.delete(key);
      }
    });

    const finalVendors = Array.from(mergedMap.values());
    console.log(`[EVENTORA] UI updated: ${finalVendors.length} public businesses ready in state.`);
    return finalVendors;
  };

  // ── Realtime Channel Setup (Section 6, 7 & 24) ──────────────────────────
  const _subscribeRealtime = () => {
    const client = sb();
    if (!client) {
      _updateConnectionIndicator('disconnected');
      return;
    }

    // Clean up any stale subscription first (Section 24)
    cleanup();

    try {
      _updateConnectionIndicator('connecting');
      console.log('[EVENTORA] Realtime connecting to table: vendors...');

      // Persistent Realtime channel on public.vendors
      const vendorChannel = client.channel('eventora-public-vendors-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vendors' }, (payload) => {
          console.log('[EVENTORA] Vendor INSERT event received:', payload.new);
          _handleVendorRealtimeChange(payload);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vendors' }, (payload) => {
          console.log('[EVENTORA] Vendor UPDATE event received:', payload.new);
          _handleVendorRealtimeChange(payload);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'vendors' }, (payload) => {
          console.log('[EVENTORA] Vendor DELETE event received:', payload.old);
          _handleVendorRealtimeChange(payload);
        })
        .subscribe((status) => {
          console.log('[EVENTORA] Realtime status:', status);
          if (status === 'SUBSCRIBED') {
            _updateConnectionIndicator('connected');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            _updateConnectionIndicator('disconnected');
          }
        });

      _realtimeChannels['vendors'] = vendorChannel;

      // Realtime channel for bookings
      const bookingChannel = client.channel('eventora-public-bookings-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
          console.log('[EVENTORA] Booking change event received:', payload.eventType, payload.new || payload.old);
          if (payload.new) _handleBookingStatusChange(payload.new);
        })
        .subscribe();
      _realtimeChannels['bookings'] = bookingChannel;

    } catch (e) {
      console.warn('[EVENTORA] Realtime subscription exception:', e);
      _updateConnectionIndicator('disconnected');
    }
  };

  // ── Realtime Event Handlers (Section 10, 11, 12, 13) ───────────────────
  const _handleVendorRealtimeChange = (payload) => {
    const raw = payload.new || payload.old;
    if (!raw) return;

    const normalized = _normalizeVendor(raw);
    const eventType = payload.eventType;

    // Stable lookup by vendor_id, business_name, or base ID (Section 11: Prevent Duplicates)
    const key = (normalized.business_name || normalized.name || '').toLowerCase().trim();
    const existingIdx = _vendors.findIndex(v =>
      (v.vendor_id && normalized.vendor_id && Number(v.vendor_id) === Number(normalized.vendor_id)) ||
      (v.name && v.name.toLowerCase().trim() === key) ||
      (v.id && normalized.id && v.id === normalized.id)
    );

    if (eventType === 'DELETE' || !_isVendorPublic(normalized)) {
      // Vendor was deleted or suspended -> Remove card immediately (Section 13)
      if (existingIdx !== -1) {
        const removed = _vendors.splice(existingIdx, 1)[0];
        console.log(`[EVENTORA] UI updated: Vendor "${removed.name}" removed from view.`);
        if (window.Toast && !_isVendorPublic(normalized)) {
          window.Toast.show('info', 'Marketplace Notice', `${removed.name} is currently offline.`);
        }
        renderMarketplace();
      }
    } else if (eventType === 'INSERT') {
      // Brand new vendor created -> Insert immediately without refresh (Section 10 & 31)
      if (existingIdx === -1) {
        _vendors.unshift(normalized);
        console.log(`[EVENTORA] UI updated: New vendor "${normalized.name}" added instantly.`);
        if (window.Toast) {
          window.Toast.show(
            'success',
            `✨ New Partner Live on Eventora!`,
            `${normalized.name} (${normalized.category}) is now available in ${normalized.city}!`
          );
        }
      } else {
        // Prevent duplicate rendering
        _vendors[existingIdx] = { ..._vendors[existingIdx], ...normalized };
        console.log(`[EVENTORA] UI updated: Vendor "${normalized.name}" updated in place.`);
      }
      renderMarketplace();
    } else if (eventType === 'UPDATE') {
      // Vendor updated details -> Re-render in place (Section 12)
      if (existingIdx !== -1) {
        _vendors[existingIdx] = { ..._vendors[existingIdx], ...normalized };
        console.log(`[EVENTORA] UI updated: Vendor "${normalized.name}" updated instantly.`);
      } else {
        _vendors.unshift(normalized);
      }
      renderMarketplace();
    }
  };

  const _handleBookingStatusChange = (booking) => {
    if (!booking) return;
    const status = booking.booking_status || booking.status;
    const map = {
      'ACCEPTED':    { t: '✅ Booking Accepted!',    m: 'The partner accepted your booking. Operations lead dispatched.' },
      'Confirmed':   { t: '🎉 Booking Confirmed!',   m: 'Contract locked & operations protected by Eventora.' },
      'CONFIRMED':   { t: '🎉 Booking Confirmed!',   m: 'Contract locked & operations protected by Eventora.' },
      'REJECTED':    { t: '❌ Booking Declined',      m: 'The partner could not accommodate your requested date.' },
      'IN_PROGRESS': { t: '⚡ Event In Progress',    m: 'Eventora field staff are on site managing execution.' },
      'COMPLETED':   { t: '🏆 Event Completed!',     m: 'Your event was completed successfully! Leave a verified review.' }
    };
    const info = map[status];
    if (info && window.Toast) {
      window.Toast.show('success', info.t, info.m);
    }
  };

  // ── Public Initialization ───────────────────────────────────────────────
  const init = async () => {
    const user = window.AuthModule?.getUser();
    console.log('[EVENTORA] Authenticated user:', user ? user.email : 'Guest / Demo Mode');

    _isLoading = true;
    _loadError = null;
    renderMarketplace();

    _vendors = await _fetchVendorsFromDB();
    _isLoading = false;
    renderMarketplace();

    _subscribeRealtime();
    _initialized = true;
  };

  const cleanup = () => {
    const client = sb();
    if (client) {
      Object.values(_realtimeChannels).forEach(ch => {
        try { client.removeChannel(ch); } catch(e) {}
      });
    }
    _realtimeChannels = {};
  };

  // ── Filter & Search Control (Section 17) ────────────────────────────────
  const setCategory = (catId) => {
    _activeCategory = catId;
    renderMarketplace();
  };

  const setSearch = (query) => {
    _searchQuery = query || '';
    renderMarketplace();
  };

  // ── UI Rendering (Section 10, 15, 16, 17, 39) ───────────────────────────
  const renderMarketplace = (targetElId = 'marketplaceContainer') => {
    const container = document.getElementById(targetElId);
    if (!container) return;

    const filtered = _vendors.filter(v => {
      if (_activeCategory !== 'All' && v.category !== _activeCategory) return false;
      if (_searchQuery) {
        const q = _searchQuery.toLowerCase().trim();
        const matchName = (v.name || '').toLowerCase().includes(q);
        const matchCat = (v.category || '').toLowerCase().includes(q);
        const matchCity = (v.city || '').toLowerCase().includes(q);
        const matchDesc = (v.desc || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchCity && !matchDesc) return false;
      }
      return true;
    });

    const activeEventId = window.EventoraDB ? EventoraDB.getActiveEventId() : null;
    const activeEvent = activeEventId ? EventoraDB.getEvent(activeEventId) : null;

    container.innerHTML = `
      <div class="marketplace-wrap">
        <!-- Editorial Hero Header -->
        <div class="marketplace-hero-hd">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:8px">
            <div class="tag-pill">Eventora Partner Network</div>
            <div id="mktLiveIndicator">
              <span style="color:#10b981;font-size:12px;font-weight:700">● Live Real-Time Sync Active</span>
            </div>
          </div>
          <h2 class="marketplace-title">Discover Verified Event Services</h2>
          <p class="marketplace-sub">
            From royal catering banquets to cinematic photography and luxury decor. Browse verified partners with real-time availability and coordinated execution.
          </p>
        </div>

        <!-- Filter Row -->
        <div class="mkt-filter-row">
          <div class="mkt-categories-scroll">
            ${CATEGORIES.map(c => `
              <button class="mkt-cat-btn ${c.id === _activeCategory ? 'active' : ''}" onclick="LiveMarketplace.setCategory('${c.id}')">
                <span>${c.icon}</span> ${c.label}
              </button>
            `).join('')}
          </div>
          <div class="mkt-search-wrap">
            <span style="font-size:14px;opacity:0.6">🔍</span>
            <input class="mkt-search-input" placeholder="Search by cuisine, partner, or city..." value="${_searchQuery}" oninput="LiveMarketplace.setSearch(this.value)">
          </div>
        </div>

        <!-- Active Event Context -->
        ${activeEvent ? `
          <div class="mkt-event-context-pill">
            <span>Planning for: <strong>${activeEvent.title}</strong> (${activeEvent.eventDate || 'Date TBD'})</span>
            <span class="mkt-context-tag">Target: ${activeEvent.guestCapacity || 100} Guests</span>
          </div>
        ` : ''}

        <!-- Cards Grid -->
        <div class="mkt-cards-grid" id="mktCardsGrid">
          ${_renderCardsHTML(filtered)}
        </div>
      </div>
    `;
  };

  const _renderCardsHTML = (filtered) => {
    if (_isLoading) {
      return `
        <div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px">
          ${[1, 2, 3].map(() => `
            <div class="mkt-card" style="opacity:0.6;animation:loadingPulse 1.2s infinite ease-in-out">
              <div style="height:200px;background:var(--bg-subtle)"></div>
              <div style="padding:20px">
                <div style="height:20px;background:var(--border);border-radius:4px;margin-bottom:12px"></div>
                <div style="height:14px;background:var(--border);border-radius:4px;width:60%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (_loadError && _vendors.length === 0) {
      return `
        <div style="grid-column:1/-1;padding:60px 20px;text-align:center;background:var(--bg-white);border:1.5px solid var(--border);border-radius:var(--r-lg)">
          <div style="font-size:48px;margin-bottom:12px">⚠️</div>
          <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin:0 0 6px 0">Unable to load vendors from database</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px 0">${_loadError}</p>
          <button class="btn btn-primary btn-sm" onclick="LiveMarketplace.init()">🔄 Retry Connection</button>
        </div>
      `;
    }

    if (filtered.length === 0) {
      return `
        <div style="grid-column:1/-1;padding:60px 20px;text-align:center;background:var(--bg-white);border:1.5px solid var(--border);border-radius:var(--r-lg)">
          <div style="font-size:48px;margin-bottom:12px">🔍</div>
          <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin:0 0 6px 0">No businesses match your search</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px 0">
            ${_vendors.length === 0 ? 'No businesses registered yet. Create one from the Vendor Portal!' : 'Try clearing your search or category filter.'}
          </p>
          <button class="btn btn-secondary btn-sm" onclick="LiveMarketplace.setCategory('All');LiveMarketplace.setSearch('')">Show All Services</button>
        </div>
      `;
    }

    return filtered.map(v => {
      const em = _catIcon(v.category);
      const imgUrl = v.img || _catImg(v.category);

      // Section 15: Fix Current ₹0 Problem (NEVER display "₹0")
      const priceDisplay = v.price > 0
        ? `₹${Number(v.price).toLocaleString('en-IN')}<span style="font-size:12px;font-weight:400;color:var(--text-muted)">/${v.priceUnit || 'person'}</span>`
        : `<span style="font-size:14px;font-weight:700;color:var(--brand)">Price on request</span>`;

      // Section 16: Fix Current Fake Rating Problem (NEVER display "5.0 (0)")
      const ratingDisplay = (v.reviewCount && v.reviewCount > 0)
        ? `<span class="mkt-star">★</span><strong>${Number(v.rating).toFixed(1)}</strong><span class="mkt-rev-cnt">(${v.reviewCount})</span>`
        : `<span style="font-size:12px;font-weight:800;color:var(--accent);background:rgba(245,158,11,0.1);padding:2px 8px;border-radius:999px">✨ New</span>`;

      return `
        <div class="mkt-card hover-lift-sm" id="vendor-card-${v.id}">
          <div class="mkt-card-media" style="position:relative">
            <img src="${imgUrl}" alt="${v.name}" loading="lazy" onerror="this.onerror=null;this.src='${_catImg(v.category)}'">
            <div class="mkt-verified-badge">✓ Active Partner</div>
            <div class="mkt-category-chip">${em} ${v.category}</div>
          </div>
          <div class="mkt-card-body">
            <div class="mkt-card-top">
              <div>
                <h3 class="mkt-vendor-name">${v.name}</h3>
                <div class="mkt-vendor-location">📍 ${v.city} · ${v.serviceArea}</div>
              </div>
              <div class="mkt-rating-box">
                ${ratingDisplay}
              </div>
            </div>
            <p class="mkt-vendor-desc">${v.desc}</p>
            <div class="mkt-perks-row">
              <span class="mkt-perk">⚡ Quick Response</span>
              <span class="mkt-perk">🛡️ Operations Protected</span>
            </div>
            <div class="mkt-card-footer">
              <div>
                <div class="mkt-price-label">Starting from</div>
                <div class="mkt-price-val">${priceDisplay}</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="LiveMarketplace.openVendorDetail('${v.id}')">
                View Menu & Book
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  };

  // ── Vendor Detail & Booking Modal ───────────────────────────────────────
  const openVendorDetail = (vendorId) => {
    const v = _vendors.find(x => x.id === vendorId || x.vendor_id === vendorId || ('v-' + x.vendor_id) === vendorId);
    if (!v) return;

    _activeVendor = v;
    _selectedPkg = v.packages && v.packages.length > 0 ? v.packages[0] : null;

    const activeEventId = window.EventoraDB ? EventoraDB.getActiveEventId() : null;
    const activeEvent = activeEventId ? EventoraDB.getEvent(activeEventId) : null;
    _guestCount = activeEvent?.guestCapacity || 100;

    _renderBookingModalContent();
  };

  const _renderBookingModalContent = () => {
    const v = _activeVendor;
    if (!v) return;

    const basePkgPrice = _selectedPkg ? Number(_selectedPkg.price) : Number(v.price);
    const subtotal = basePkgPrice * _guestCount;
    const tax = Math.round(subtotal * 0.18);
    const coordinationFee = Math.round(subtotal * 0.05);
    const total = subtotal + tax + coordinationFee;

    const content = `
      <div style="display:flex;flex-direction:column;gap:20px">
        <!-- Vendor Overview -->
        <div style="display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--border);padding-bottom:16px">
          <div style="width:52px;height:52px;border-radius:var(--r-md);background:var(--bg-subtle);display:flex;align-items:center;justify-content:center;font-size:28px">
            ${_catIcon(v.category)}
          </div>
          <div>
            <h3 style="font-size:18px;font-weight:900;margin:0">${v.name}</h3>
            <div style="font-size:13px;color:var(--text-muted)">
              📍 ${v.city} · ${v.category} · ${v.reviewCount > 0 ? `⭐ ${v.rating.toFixed(1)} (${v.reviewCount})` : '✨ New Listing'}
            </div>
          </div>
        </div>

        <!-- Package Selection -->
        <div>
          <label class="form-label" style="font-weight:700">Select Service / Package</label>
          <div style="display:grid;gap:10px">
            ${v.packages.map(pkg => `
              <div onclick="LiveMarketplace.selectPackage('${pkg.id}')"
                   style="cursor:pointer;padding:14px;border-radius:var(--r-md);border:2px solid ${_selectedPkg?.id === pkg.id ? 'var(--brand)' : 'var(--border)'};background:${_selectedPkg?.id === pkg.id ? 'rgba(124,58,237,0.04)' : 'var(--bg-white)'};display:flex;justify-content:space-between;align-items:center">
                <div>
                  <div style="font-weight:800;font-size:15px;color:var(--text-primary)">${pkg.name}</div>
                  <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${pkg.description || 'Full banquet coverage with Eventora lead'}</div>
                </div>
                <div style="font-family:var(--font-mono);font-weight:800;font-size:16px;color:var(--brand)">
                  ${pkg.price > 0 ? `₹${Number(pkg.price).toLocaleString('en-IN')}/${pkg.priceType || 'person'}` : 'Custom Quote'}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Guest Count Selector -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label class="form-label" style="font-weight:700;margin:0">Guest Count / Scale</label>
            <span style="font-family:var(--font-mono);font-weight:800;color:var(--brand);font-size:16px">${_guestCount} Guests</span>
          </div>
          <input type="range" class="input" min="25" max="1500" step="25" value="${_guestCount}" oninput="LiveMarketplace.setGuestCount(this.value)" style="padding:0">
        </div>

        <!-- Order Summary & Transparent Pricing -->
        <div style="background:var(--bg-subtle);border-radius:var(--r-md);padding:16px;border:1px solid var(--border)">
          <div style="font-size:13px;display:flex;justify-content:space-between;margin-bottom:6px">
            <span>Package Subtotal (${_guestCount} × ₹${basePkgPrice}):</span>
            <span style="font-family:var(--font-mono)">₹${subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div style="font-size:13px;display:flex;justify-content:space-between;margin-bottom:6px">
            <span>GST & Catering Tax (18%):</span>
            <span style="font-family:var(--font-mono)">₹${tax.toLocaleString('en-IN')}</span>
          </div>
          <div style="font-size:13px;display:flex;justify-content:space-between;margin-bottom:8px">
            <span>Operations & Field Staff Coordination (5%):</span>
            <span style="font-family:var(--font-mono)">₹${coordinationFee.toLocaleString('en-IN')}</span>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:800;font-size:16px">Total Guaranteed Quote:</span>
            <span style="font-family:var(--font-mono);font-size:22px;font-weight:900;color:var(--brand)">₹${total.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div class="modal-footer" style="padding-top:0">
          <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary btn-sm" onclick="LiveMarketplace.submitBooking()">
            🎉 Confirm & Request Booking
          </button>
        </div>
      </div>
    `;

    Modal.open('Book Partner Service', content);
  };

  const selectPackage = (pkgId) => {
    if (!_activeVendor) return;
    _selectedPkg = _activeVendor.packages.find(p => p.id === pkgId) || _activeVendor.packages[0];
    _renderBookingModalContent();
  };

  const setGuestCount = (val) => {
    _guestCount = Number(val) || 100;
    _renderBookingModalContent();
  };

  // ── Submit Booking Flow ─────────────────────────────────────────────────
  const submitBooking = async () => {
    const v = _activeVendor;
    if (!v) return;

    const client = sb();
    const user = window.AuthModule?.getUser();
    const activeEventId = window.EventoraDB ? EventoraDB.getActiveEventId() : null;

    const basePkgPrice = _selectedPkg ? Number(_selectedPkg.price) : Number(v.price);
    const subtotal = basePkgPrice * _guestCount;
    const tax = Math.round(subtotal * 0.18);
    const coordinationFee = Math.round(subtotal * 0.05);
    const total = subtotal + tax + coordinationFee;

    // 1. Local state booking creation via EventoraDB
    let localBooking = null;
    if (window.EventoraDB) {
      localBooking = EventoraDB.requestBooking({
        eventId: activeEventId || 'ev-default',
        vendorId: v.id,
        service: v.category,
        packageId: _selectedPkg?.id || 'pkg-default',
        packageName: _selectedPkg?.name || 'Standard Package',
        guestCount: _guestCount,
        cost: subtotal,
        notes: 'Coordinated via Eventora Live Marketplace'
      });
    }

    // 2. Supabase booking insertion (if connected)
    if (client) {
      try {
        const vendorNumericId = v.vendor_id ? Number(v.vendor_id) : 1;
        const bookingPayload = {
          event_id: 1,
          vendor_id: vendorNumericId,
          agreed_cost: total,
          booking_status: 'Pending',
          service_notes: `Requested for ${_guestCount} guests via Eventora Live Marketplace`
        };

        const { data: sbBooking, error: sbError } = await client
          .from('bookings')
          .insert([bookingPayload])
          .select();

        if (sbError) {
          console.warn('[EVENTORA] Supabase booking insert notice:', sbError.message);
        } else {
          console.log('[EVENTORA] Booking created in Supabase:', sbBooking);
        }
      } catch (err) {
        console.warn('[EVENTORA] Booking sync exception:', err);
      }
    }

    Modal.close();
    if (window.Toast) {
      window.Toast.show(
        'success',
        '🎉 Booking Request Sent!',
        `Request for ${v.name} placed. Partner and Operations lead have been notified in real time!`
      );
    }
  };

  // ── Vendor Creation Flow (Section 1, 2 & 3) ─────────────────────────────
  // Saves to REAL Supabase vendors table -> Broadcasts Realtime INSERT -> ALL customers see it!
  const createVendorBusiness = async (formData) => {
    const client = sb();
    const user = window.AuthModule?.getUser();

    console.log('[EVENTORA] Vendor creating business:', formData);

    const price = Number(formData.starting_price || formData.base_price || formData.price || 0);
    const cat = _normCat(formData.service_category || formData.category || 'Catering');
    const dbCategory = _toDBServiceCategory(cat);

    // 1. Register in local DB state for instant local access
    let localVendor = null;
    if (window.EventoraDB) {
      localVendor = EventoraDB.registerVendor({
        name: formData.business_name,
        category: cat,
        city: formData.location || 'Hyderabad',
        serviceArea: formData.service_area || 'Telangana & AP',
        phone: formData.phone || '',
        price: price,
        desc: formData.description || `Premium ${cat} services coordinated directly by Eventora operations.`,
        verified: false,
        verificationStatus: 'Pending Verification',
        storefrontOnline: true,
        storefront_status: 'ONLINE',
        is_published: true
      });
    }

    // 2. Insert into REAL Supabase database (Single Source of Truth)
    if (client) {
      try {
        const payload = {
          business_name: formData.business_name,
          service_category: dbCategory,
          contact_name: formData.contact_name || user?.user_metadata?.full_name || 'Eventora Partner',
          email: formData.email || user?.email || `partner-${Date.now()}@eventora.io`,
          phone: formData.phone || '+91 99999 99999',
          base_price: price,
          rating: 5.0,
          is_verified: true
        };

        console.log('[EVENTORA] Inserting into Supabase vendors table:', payload);
        const { data, error } = await client
          .from('vendors')
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error('[EVENTORA] Supabase insert vendor error:', error.message);
        } else if (data) {
          console.log('[EVENTORA] Business saved to Supabase database successfully:', data);
          if (localVendor && data.vendor_id) {
            localVendor.vendor_id = data.vendor_id;
          }
          const norm = _normalizeVendor(data);
          const key = norm.name.toLowerCase().trim();
          const existingIdx = _vendors.findIndex(v =>
            (v.vendor_id && norm.vendor_id && Number(v.vendor_id) === Number(norm.vendor_id)) ||
            (v.name && v.name.toLowerCase().trim() === key)
          );
          if (existingIdx === -1) {
            _vendors.unshift(norm);
          } else {
            _vendors[existingIdx] = { ..._vendors[existingIdx], ...norm };
          }
          renderMarketplace();
          return data;
        }
      } catch (err) {
        console.warn('[EVENTORA] Exception inserting vendor in Supabase:', err);
      }
    }

    if (localVendor) {
      const norm = _normalizeVendor(localVendor);
      const key = norm.name.toLowerCase().trim();
      const existingIdx = _vendors.findIndex(v => (v.name && v.name.toLowerCase().trim() === key));
      if (existingIdx === -1) {
        _vendors.unshift(norm);
      } else {
        _vendors[existingIdx] = { ..._vendors[existingIdx], ...norm };
      }
      renderMarketplace();
    }

    return localVendor;
  };

  // ── Vendor Storefront Toggle (Section 7 & 13) ───────────────────────────
  const vendorToggleStorefront = async (vendorId, isOnline) => {
    console.log('[EVENTORA] Toggling storefront visibility:', vendorId, isOnline);
    const client = sb();

    if (window.EventoraDB && typeof EventoraDB.updateVendorStorefront === 'function') {
      EventoraDB.updateVendorStorefront(vendorId, isOnline);
    }

    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          const { data, error } = await client
            .from('vendors')
            .update({ is_verified: isOnline })
            .eq('vendor_id', numId)
            .select();

          if (error) console.error('[EVENTORA] Storefront update error:', error);
          else console.log('[EVENTORA] Storefront status updated in Supabase:', data);
        } catch (e) {
          console.warn('[EVENTORA] Exception updating storefront:', e);
        }
      }
    }

    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  // ── Vendor Edit Listing (Section 5 & 12) ────────────────────────────────
  const vendorUpdateBusiness = async (vendorId, updates) => {
    console.log('[EVENTORA] Vendor updating business:', vendorId, updates);
    const client = sb();

    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          const dbUpdates = {};
          if (updates.business_name) dbUpdates.business_name = updates.business_name;
          if (updates.service_category) dbUpdates.service_category = _toDBServiceCategory(updates.service_category);
          if (updates.contact_name) dbUpdates.contact_name = updates.contact_name;
          if (updates.phone) dbUpdates.phone = updates.phone;
          if (updates.base_price !== undefined) dbUpdates.base_price = Number(updates.base_price);

          const { data, error } = await client
            .from('vendors')
            .update(dbUpdates)
            .eq('vendor_id', numId)
            .select();

          if (error) console.error('[EVENTORA] Supabase vendor update error:', error);
          else console.log('[EVENTORA] Supabase vendor updated successfully:', data);
        } catch (e) {
          console.warn('[EVENTORA] Exception updating vendor:', e);
        }
      }
    }
  };

  // ── Vendor Delete Listing (Section 7 & 13) ──────────────────────────────
  const vendorDeleteBusiness = async (vendorId) => {
    console.log('[EVENTORA] Vendor deleting business:', vendorId);
    const client = sb();

    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          const { error } = await client
            .from('vendors')
            .delete()
            .eq('vendor_id', numId);

          if (error) console.error('[EVENTORA] Supabase vendor delete error:', error);
          else console.log('[EVENTORA] Supabase vendor deleted successfully from DB');
        } catch (e) {
          console.warn('[EVENTORA] Exception deleting vendor:', e);
        }
      }
    }
  };

  // ── Booking Actions for Vendor Portal (Section 18) ──────────────────────
  const vendorAcceptBooking = async (bookingId) => {
    const client = sb();
    if (client) {
      const numId = Number(bookingId);
      if (!isNaN(numId)) {
        try {
          await client.from('bookings').update({ booking_status: 'Confirmed' }).eq('booking_id', numId);
        } catch(e) {}
      }
    }
  };

  const vendorRejectBooking = async (bookingId, reason) => {
    const client = sb();
    if (client) {
      const numId = Number(bookingId);
      if (!isNaN(numId)) {
        try {
          await client.from('bookings').update({ booking_status: 'Cancelled', service_notes: reason }).eq('booking_id', numId);
        } catch(e) {}
      }
    }
  };

  const loadVendorDashboardData = async (vendorId) => {
    const client = sb();
    if (!client) return [];
    try {
      const { data } = await client.from('bookings').select('*').eq('vendor_id', Number(vendorId));
      return data || [];
    } catch(e) {
      return [];
    }
  };

  const subscribeVendorBookings = (vendorId, callback) => {
    const client = sb();
    if (!client) return null;
    return client.channel('vendor-bookings-' + vendorId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `vendor_id=eq.${vendorId}` }, () => {
        if (callback) callback();
      })
      .subscribe();
  };

  // ── Admin Governance Actions (Section 29) ───────────────────────────────
  const adminApproveVendor = async (vendorId) => {
    console.log('[EVENTORA] Admin approving vendor:', vendorId);
    if (window.EventoraDB) EventoraDB.updateVendorVerification(vendorId, 'Verified');
    const client = sb();
    if (client && !isNaN(Number(vendorId))) {
      try {
        await client.from('vendors').update({ is_verified: true }).eq('vendor_id', Number(vendorId));
      } catch(e) {}
    }
    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  const adminRejectVendor = async (vendorId, reason = 'Incomplete details') => {
    console.log('[EVENTORA] Admin rejecting vendor:', vendorId, reason);
    if (window.EventoraDB) EventoraDB.updateVendorVerification(vendorId, 'Rejected');
    const client = sb();
    if (client && !isNaN(Number(vendorId))) {
      try {
        await client.from('vendors').update({ is_verified: false }).eq('vendor_id', Number(vendorId));
      } catch(e) {}
    }
    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  const adminSuspendVendor = async (vendorId) => {
    console.log('[EVENTORA] Admin suspending vendor:', vendorId);
    if (window.EventoraDB) EventoraDB.updateVendorVerification(vendorId, 'Suspended');
    const client = sb();
    if (client && !isNaN(Number(vendorId))) {
      try {
        await client.from('vendors').update({ is_verified: false }).eq('vendor_id', Number(vendorId));
      } catch(e) {}
    }
    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  return {
    init,
    cleanup,
    setCategory,
    setSearch,
    setGuestCount,
    selectPackage,
    openVendorDetail,
    submitBooking,
    createVendorBusiness,
    vendorToggleStorefront,
    vendorUpdateBusiness,
    vendorDeleteBusiness,
    vendorAcceptBooking,
    vendorRejectBooking,
    loadAllVendorsForAdmin: () => _fetchVendorsFromDB(),
    loadVendorDashboardData,
    subscribeVendorBookings,
    adminApproveVendor,
    adminRejectVendor,
    adminSuspendVendor,
    handleVendorRealtimeChange: _handleVendorRealtimeChange,
    getVendors: () => [..._vendors],
    renderMarketplace
  };
})();
