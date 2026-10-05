/**
 * EVENTORA — Live Connected Marketplace Engine v3
 * ================================================
 * Single Source of Truth: Supabase PostgreSQL + Realtime + Dual-Mode Local Sync
 *
 * Lifecycle:
 * 1. Vendor registers business -> Supabase 'vendors' (is_verified = false, verification_status = 'Pending')
 * 2. Admin Command Center -> Live verification governance -> Approve / Reject / Suspend
 * 3. Customer Marketplace -> Supabase query (is_verified = true & storefront online)
 * 4. Supabase Realtime -> Instant push to customer marketplace (no page refresh)
 * 5. Customer books package -> Real-time dispatch to Vendor Portal -> Operations Lead Assigned
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
      el.innerHTML = '<span style="color:#10b981;font-size:12px;font-weight:700">● Live updates enabled</span>';
    } else if (state === 'disconnected') {
      el.innerHTML = '<span style="color:#ef4444;font-size:12px;font-weight:700">○ Reconnecting...</span>';
    } else {
      el.innerHTML = '<span style="color:#f59e0b;font-size:12px;font-weight:700">◌ Connecting...</span>';
    }
  };

  // ── Helper: Check Vendor Visibility ─────────────────────────────────────
  const _isVendorPublic = (v) => {
    if (!v) return false;
    const isVerified = (v.is_verified === true || v.verification_status === 'Verified' || v.verificationStatus === 'Verified' || v.verified === true);
    const notSuspended = v.verification_status !== 'Suspended' && v.verificationStatus !== 'Suspended' && v.verification_status !== 'Rejected' && v.verificationStatus !== 'Rejected';
    const isOnline = v.storefront_status !== 'OFFLINE' && v.storefrontOnline !== false && v.is_published !== false;
    return isVerified && notSuspended && isOnline;
  };

  // ── Helper: Normalize Vendor Record ─────────────────────────────────────
  const _normalizeVendor = (raw) => {
    const vId = raw.vendor_id ? Number(raw.vendor_id) : raw.id;
    const baseId = raw.id || ('v-' + raw.vendor_id);
    const cat = _normCat(raw.service_category || raw.category || 'Catering');
    const price = Number(raw.starting_price || raw.base_price || raw.price || 0);

    return {
      vendor_id: raw.vendor_id || null,
      id: baseId,
      name: raw.business_name || raw.name || 'Eventora Partner',
      business_name: raw.business_name || raw.name || 'Eventora Partner',
      category: cat,
      service_category: cat,
      city: raw.location || raw.city || 'Hyderabad',
      location: raw.location || raw.city || 'Hyderabad',
      serviceArea: raw.service_area || raw.serviceArea || 'Telangana & AP',
      service_area: raw.service_area || raw.serviceArea || 'Telangana & AP',
      price: price,
      starting_price: price,
      base_price: price,
      priceUnit: raw.priceUnit || 'per person',
      rating: raw.rating !== undefined ? Number(raw.rating) : 5.0,
      reviewCount: Number(raw.review_count || raw.reviewCount || 0),
      review_count: Number(raw.review_count || raw.reviewCount || 0),
      verified: raw.is_verified === true || raw.verification_status === 'Verified' || raw.verificationStatus === 'Verified' || raw.verified === true,
      is_verified: raw.is_verified === true || raw.verification_status === 'Verified' || raw.verificationStatus === 'Verified' || raw.verified === true,
      verification_status: raw.verification_status || raw.verificationStatus || (raw.is_verified ? 'Verified' : 'Pending'),
      verificationStatus: raw.verification_status || raw.verificationStatus || (raw.is_verified ? 'Verified' : 'Pending'),
      storefront_status: raw.storefront_status || (raw.storefrontOnline === false ? 'OFFLINE' : 'ONLINE'),
      storefrontOnline: raw.storefront_status !== 'OFFLINE' && raw.storefrontOnline !== false && raw.is_published !== false,
      is_published: raw.is_published !== false && raw.storefront_status !== 'OFFLINE',
      description: raw.description || raw.desc || `Premium ${cat} services coordinated directly by Eventora.`,
      desc: raw.description || raw.desc || `Premium ${cat} services coordinated directly by Eventora.`,
      phone: raw.phone || '+91 91234 56780',
      email: raw.email || 'partner@eventora.io',
      logo_url: raw.logo_url || null,
      img: raw.logo_url || _catImg(cat),
      packages: raw.packages || [
        {
          id: 'pkg-standard-' + baseId,
          name: 'Standard ' + cat + ' Package',
          price: price > 0 ? price : 499,
          priceType: 'per person',
          description: `Complete ${cat} setup with dedicated Eventora on-site operations coordinator.`
        }
      ]
    };
  };

  // ── Database Fetching ───────────────────────────────────────────────────
  const _fetchVendorsFromDB = async () => {
    const client = sb();
    let supabaseVendors = [];

    if (client) {
      try {
        // Query vendors table — safe select without filtering on optional verification_status
        const { data, error } = await client
          .from('vendors')
          .select('*')
          .order('vendor_id', { ascending: false });

        if (error) {
          console.error('[LiveMarketplace] Supabase fetchVendors error:', error);
          _loadError = error.message;
        } else if (data) {
          supabaseVendors = data.map(_normalizeVendor);
        }
      } catch (err) {
        console.warn('[LiveMarketplace] Supabase query exception:', err);
        _loadError = err.message;
      }
    }

    // Merge with local catalog (for fallback and rich package details)
    const localCatalog = (window.EventoraDB ? EventoraDB.getVendorCatalog() : []).map(_normalizeVendor);

    const mergedMap = new Map();

    // Add local vendors first
    localCatalog.forEach(v => {
      if (_isVendorPublic(v)) mergedMap.set(v.name.toLowerCase().trim(), v);
    });

    // Supabase vendors override local vendors with same name/id, and add new ones
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
        // If Supabase says this vendor is NOT public (suspended or offline or rejected), ensure it's removed!
        mergedMap.delete(key);
      }
    });

    return Array.from(mergedMap.values());
  };

  // ── Realtime Channel Setup ──────────────────────────────────────────────
  const _subscribeRealtime = () => {
    const client = sb();
    if (!client) {
      _updateConnectionIndicator('disconnected');
      return;
    }

    // Cleanup previous subscriptions
    cleanup();

    try {
      _updateConnectionIndicator('connecting');

      // 1. Channel for Vendors Table changes
      const vendorChannel = client.channel('customer-marketplace-vendors-v3')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, (payload) => {
          console.log('[LiveMarketplace Realtime] Vendors change received:', payload.eventType, payload);
          _handleVendorRealtimeChange(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            _updateConnectionIndicator('connected');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            _updateConnectionIndicator('disconnected');
          }
        });

      _realtimeChannels['vendors'] = vendorChannel;

      // 2. Channel for Customer Notifications & Bookings
      const user = window.AuthModule?.getUser();
      if (user) {
        const notifChannel = client.channel('user-notifs-' + user.id)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            _handleNewNotification(payload.new);
          })
          .subscribe();
        _realtimeChannels['notifications'] = notifChannel;

        const bookingChannel = client.channel('user-bookings-' + user.id)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'bookings'
          }, (payload) => {
            _handleBookingStatusChange(payload.new);
          })
          .subscribe();
        _realtimeChannels['bookings'] = bookingChannel;
      }
    } catch (e) {
      console.warn('[LiveMarketplace] Realtime subscription failed:', e);
      _updateConnectionIndicator('disconnected');
    }
  };

  // ── Realtime Event Handlers ─────────────────────────────────────────────
  const _handleVendorRealtimeChange = (payload) => {
    const raw = payload.new || payload.old;
    if (!raw) return;

    const normalized = _normalizeVendor(raw);
    const eventType = payload.eventType;

    const key = normalized.name.toLowerCase().trim();
    const existingIdx = _vendors.findIndex(v =>
      (v.vendor_id && v.vendor_id === normalized.vendor_id) ||
      (v.name.toLowerCase().trim() === key) ||
      (v.id === normalized.id)
    );

    if (eventType === 'DELETE' || !_isVendorPublic(normalized)) {
      // Vendor was deleted or turned Offline / Suspended / Rejected -> Remove from list
      if (existingIdx !== -1) {
        const removed = _vendors.splice(existingIdx, 1)[0];
        console.log(`[LiveMarketplace Realtime] Removed vendor "${removed.name}" from public view.`);
        if (window.Toast && !_isVendorPublic(normalized)) {
          Toast.show('info', 'Marketplace Notice', `${removed.name} is currently offline.`);
        }
        renderMarketplace();
      }
    } else {
      // Vendor is Public / Verified / Storefront Online
      if (existingIdx === -1) {
        // Brand new verified vendor -> Add to top of list!
        _vendors.unshift(normalized);
        console.log(`[LiveMarketplace Realtime] Added new verified vendor: "${normalized.name}"`);
        if (window.Toast) {
          Toast.show(
            'info',
            `${_catIcon(normalized.category)} New Partner on Eventora!`,
            `${normalized.name} is now live and accepting bookings in ${normalized.city}!`
          );
        }
      } else {
        // Existing vendor updated -> Update in place
        _vendors[existingIdx] = { ..._vendors[existingIdx], ...normalized };
        console.log(`[LiveMarketplace Realtime] Updated vendor: "${normalized.name}"`);
      }
      renderMarketplace();
    }
  };

  const _handleNewNotification = (notif) => {
    if (!notif) return;
    _notifications.unshift(notif);
    _unreadCount++;
    updateNotificationBadge();
    if (window.Toast) {
      Toast.show('info', notif.title || 'New Notification', notif.message || '');
    }
  };

  const _handleBookingStatusChange = (booking) => {
    if (!booking) return;
    const status = booking.booking_status || booking.status;
    const map = {
      'ACCEPTED':    { t: '✅ Booking Accepted!',    m: 'The vendor accepted your booking. Operations coordinator dispatched.' },
      'REJECTED':    { t: '❌ Booking Declined',      m: 'The vendor could not accommodate your requested date.' },
      'CONFIRMED':   { t: '🎉 Booking Confirmed!',   m: 'Contract locked & operations protected by Eventora.' },
      'IN_PROGRESS': { t: '⚡ Event In Progress',    m: 'Eventora field staff are on site managing execution.' },
      'COMPLETED':   { t: '🏆 Event Completed!',     m: 'Your event was completed successfully! Leave a verified review.' }
    };
    const info = map[status];
    if (info && window.Toast) {
      Toast.show('success', info.t, info.m);
    }
  };

  // ── Public Initialization ───────────────────────────────────────────────
  const init = async () => {
    _isLoading = true;
    _loadError = null;
    renderMarketplace();

    _vendors = await _fetchVendorsFromDB();
    _isLoading = false;
    renderMarketplace();

    const user = window.AuthModule?.getUser();
    if (user && sb()) {
      try {
        const { data } = await sb().from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
        _notifications = data || [];
        _unreadCount = _notifications.filter(n => !n.is_read).length;
        updateNotificationBadge();
      } catch(e) {}
    }

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

  // ── UI Rendering ────────────────────────────────────────────────────────
  const renderMarketplace = (targetElId = 'marketplaceContainer') => {
    const container = document.getElementById(targetElId);
    if (!container) return;

    const filtered = _vendors.filter(v => {
      if (_activeCategory !== 'All' && v.category !== _activeCategory) return false;
      if (_searchQuery) {
        const q = _searchQuery.toLowerCase();
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
            <div class="tag-pill">Curated Eventora Network</div>
            <div id="mktLiveIndicator">
              <span style="color:#10b981;font-size:12px;font-weight:700">● Live updates enabled</span>
            </div>
          </div>
          <h2 class="marketplace-title">Discover Verified Event Services</h2>
          <p class="marketplace-sub">
            From royal catering banquets to cinematic photography and luxury transport. Book verified partners coordinated directly by Eventora operations.
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
            <input class="mkt-search-input" placeholder="Search by cuisine, vendor, or city..." value="${_searchQuery}" oninput="LiveMarketplace.setSearch(this.value)">
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
              <div style="padding:20px"><div style="height:20px;background:var(--border);border-radius:4px;margin-bottom:12px"></div><div style="height:14px;background:var(--border);border-radius:4px;width:60%"></div></div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (_loadError && _vendors.length === 0) {
      return `
        <div style="grid-column:1/-1;padding:60px 20px;text-align:center;background:var(--bg-white);border:1.5px solid var(--border);border-radius:var(--r-lg)">
          <div style="font-size:48px;margin-bottom:12px">⚠️</div>
          <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin:0 0 6px 0">Unable to load vendors</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px 0">${_loadError}</p>
          <button class="btn btn-primary btn-sm" onclick="LiveMarketplace.init()">🔄 Retry Connection</button>
        </div>
      `;
    }

    if (filtered.length === 0) {
      return `
        <div style="grid-column:1/-1;padding:60px 20px;text-align:center;background:var(--bg-white);border:1.5px solid var(--border);border-radius:var(--r-lg)">
          <div style="font-size:48px;margin-bottom:12px">🔍</div>
          <h3 style="font-size:18px;font-weight:800;color:var(--text-primary);margin:0 0 6px 0">No vendors found</h3>
          <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px 0">
            ${_vendors.length === 0 ? 'No verified vendors available yet.' : 'No active partners match your current filter or search criteria.'}
          </p>
          <button class="btn btn-secondary btn-sm" onclick="LiveMarketplace.setCategory('All');LiveMarketplace.setSearch('')">Show All Services</button>
        </div>
      `;
    }

    return filtered.map(v => {
      const em = _catIcon(v.category);
      const imgUrl = v.img || _catImg(v.category);

      // Price Formatting: Never display "₹0"
      const priceDisplay = v.price > 0
        ? `₹${Number(v.price).toLocaleString('en-IN')}<span style="font-size:12px;font-weight:400;color:var(--text-muted)">/${v.priceUnit || 'person'}</span>`
        : `<span style="font-size:14px;font-weight:700;color:var(--brand)">Price on request</span>`;

      // Rating Formatting: "New" if 0 reviews
      const ratingDisplay = v.reviewCount > 0
        ? `<span class="mkt-star">★</span><strong>${Number(v.rating).toFixed(1)}</strong><span class="mkt-rev-cnt">(${v.reviewCount})</span>`
        : `<span style="font-size:12px;font-weight:800;color:var(--accent)">✨ New</span>`;

      return `
        <div class="mkt-card hover-lift-sm" id="vendor-card-${v.id}">
          <div class="mkt-card-media" style="position:relative">
            <img src="${imgUrl}" alt="${v.name}" loading="lazy" onerror="this.onerror=null;this.src='${_catImg(v.category)}'">
            <div class="mkt-verified-badge">✓ Verified Partner</div>
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
              📍 ${v.city} · ${v.category} · ⭐ ${v.reviewCount > 0 ? v.rating.toFixed(1) : 'New'}
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
                  ₹${pkg.price}/${pkg.priceType || 'person'}
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
    if (client && user) {
      try {
        const vendorNumericId = v.vendor_id ? Number(v.vendor_id) : 1;
        const bookingPayload = {
          customer_id: user.id,
          vendor_id: vendorNumericId,
          agreed_cost: total,
          booking_status: 'REQUESTED',
          service_notes: `Requested for ${_guestCount} guests via Eventora Live Marketplace`
        };

        const { data: sbBooking, error: sbError } = await client
          .from('bookings')
          .insert([bookingPayload])
          .select();

        if (sbError) {
          console.warn('[LiveMarketplace] Supabase booking insert notice:', sbError.message);
        } else {
          console.log('[LiveMarketplace] Booking created in Supabase:', sbBooking);
        }

        // Notify Vendor
        try {
          await client.from('notifications').insert([{
            user_id: user.id,
            role: 'vendor',
            title: '🛎️ New Booking Request!',
            message: `New booking for ${_guestCount} guests by ${user.user_metadata?.full_name || 'Customer'}.`,
            is_read: false
          }]);
        } catch(e) {}
      } catch (err) {
        console.warn('[LiveMarketplace] Booking sync exception:', err);
      }
    }

    Modal.close();
    if (window.Toast) {
      Toast.show(
        'success',
        '🎉 Booking Request Sent!',
        `Request for ${v.name} placed. Partner and Operations lead have been notified in real time!`
      );
    }
  };

  // ── Vendor Creation Flow (Called by Vendor Portal) ──────────────────────
  const createVendorBusiness = async (formData) => {
    const client = sb();
    const user = window.AuthModule?.getUser();

    console.log('[LiveMarketplace] Creating vendor business:', formData);

    const price = Number(formData.starting_price || formData.base_price || 0);
    const cat = _normCat(formData.service_category || formData.category || 'Catering');

    // 1. Always create in local EventoraDB
    let localVendor = null;
    if (window.EventoraDB) {
      localVendor = EventoraDB.registerVendor({
        name: formData.business_name,
        category: cat,
        city: formData.location || 'Hyderabad',
        serviceArea: formData.service_area || 'Telangana & AP',
        phone: formData.phone || '',
        price: price,
        desc: formData.description || '',
        verified: false,
        verificationStatus: 'Pending Verification',
        storefrontOnline: true,
        storefront_status: 'ONLINE',
        is_published: true
      });
    }

    // 2. Insert into Supabase 'vendors' table (if connected)
    if (client) {
      try {
        const payload = {
          business_name: formData.business_name,
          service_category: cat,
          contact_name: formData.contact_name || user?.user_metadata?.full_name || 'Partner Manager',
          email: formData.email || user?.email || `partner-${Date.now()}@eventora.io`,
          phone: formData.phone || '+91 99999 99999',
          base_price: price,
          rating: 5.0,
          is_verified: false
        };

        const { data, error } = await client
          .from('vendors')
          .insert([payload])
          .select()
          .single();

        if (error) {
          console.error('[LiveMarketplace] Supabase insert vendor error:', error);
        } else {
          console.log('Vendor created in Supabase:', data);
          return data;
        }
      } catch (err) {
        console.warn('[LiveMarketplace] Exception inserting vendor in Supabase:', err);
      }
    }

    return localVendor;
  };

  // ── Admin Governance Actions ────────────────────────────────────────────
  const adminApproveVendor = async (vendorId) => {
    console.log('[LiveMarketplace] Approving vendor:', vendorId);
    const client = sb();

    // 1. Update local DB
    if (window.EventoraDB) {
      EventoraDB.updateVendorVerification(vendorId, 'Verified');
    }

    // 2. Update Supabase
    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          const { data, error } = await client
            .from('vendors')
            .update({ is_verified: true })
            .eq('vendor_id', numId)
            .select();

          if (error) {
            console.error('[LiveMarketplace] Supabase approve error:', error);
          } else {
            console.log('[LiveMarketplace] Supabase vendor approved:', data);
          }
        } catch (err) {
          console.warn('[LiveMarketplace] Exception updating Supabase vendor:', err);
        }
      }
    }

    // Refresh list locally
    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  const adminRejectVendor = async (vendorId, reason = 'Incomplete details') => {
    console.log('[LiveMarketplace] Rejecting vendor:', vendorId, reason);
    const client = sb();

    if (window.EventoraDB) {
      EventoraDB.updateVendorVerification(vendorId, 'Rejected');
    }

    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          await client.from('vendors').update({ is_verified: false }).eq('vendor_id', numId);
        } catch(e) {}
      }
    }

    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  const adminSuspendVendor = async (vendorId) => {
    console.log('[LiveMarketplace] Suspending vendor:', vendorId);
    const client = sb();

    if (window.EventoraDB) {
      EventoraDB.updateVendorVerification(vendorId, 'Suspended');
    }

    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          await client.from('vendors').update({ is_verified: false }).eq('vendor_id', numId);
        } catch(e) {}
      }
    }

    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  // ── Vendor Storefront Toggle ────────────────────────────────────────────
  const vendorToggleStorefront = async (vendorId, isOnline) => {
    console.log(`[LiveMarketplace] Toggling storefront for ${vendorId}: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    const client = sb();

    if (window.EventoraDB && typeof EventoraDB.updateVendorStorefront === 'function') {
      EventoraDB.updateVendorStorefront(vendorId, isOnline);
    }

    if (client) {
      const numId = Number(vendorId);
      if (!isNaN(numId)) {
        try {
          await client.from('vendors').update({ is_verified: isOnline }).eq('vendor_id', numId);
        } catch(e) {}
      }
    }

    _vendors = await _fetchVendorsFromDB();
    renderMarketplace();
  };

  // ── Notification Panel & Badge ──────────────────────────────────────────
  const updateNotificationBadge = () => {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (_unreadCount > 0) {
      badge.textContent = _unreadCount > 9 ? '9+' : _unreadCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  };

  const renderNotificationPanel = (containerId = 'notifPanelBody') => {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (_notifications.length === 0) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">No notifications yet</div>';
      return;
    }

    el.innerHTML = _notifications.map(n => `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);background:${n.is_read ? 'transparent' : 'rgba(124,58,237,0.05)'}">
        <div style="font-weight:700;font-size:13px;color:var(--text-primary)">${n.title}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${n.message}</div>
      </div>
    `).join('');
  };

  // ── Admin & Vendor Support Methods ─────────────────────────────────────
  const loadAllVendorsForAdmin = async () => {
    const client = sb();
    let supabaseVendors = [];
    if (client) {
      try {
        const { data, error } = await client.from('vendors').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          supabaseVendors = data.map(_normalizeVendor);
        }
      } catch(e) {}
    }
    const localVendors = (window.EventoraDB ? EventoraDB.getVendorCatalog() : []).map(_normalizeVendor);
    const map = new Map();
    localVendors.forEach(v => map.set(v.name.toLowerCase().trim(), v));
    supabaseVendors.forEach(v => map.set(v.name.toLowerCase().trim(), v));
    return Array.from(map.values());
  };

  const loadVendorDashboardData = async (vendorId) => {
    const client = sb();
    if (!client) return [];
    try {
      const numId = Number(vendorId);
      const query = client.from('bookings').select('*');
      if (!isNaN(numId)) {
        query.eq('vendor_id', numId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch(e) {}
    return [];
  };

  const subscribeVendorBookings = (vendorId, callback) => {
    const client = sb();
    if (!client) return null;
    const channelName = 'vendor-bookings-' + vendorId + '-' + Date.now();
    const ch = client.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        if (callback) callback(payload);
      })
      .subscribe();
    return ch;
  };

  const vendorAcceptBooking = async (bookingId) => {
    const client = sb();
    if (client) {
      try {
        await client.from('bookings').update({ booking_status: 'ACCEPTED' }).eq('booking_id', Number(bookingId) || bookingId);
      } catch(e) {}
    }
    if (window.EventoraDB) {
      EventoraDB.vendorAcceptBooking(bookingId);
    }
  };

  const vendorRejectBooking = async (bookingId, reason) => {
    const client = sb();
    if (client) {
      try {
        await client.from('bookings').update({ booking_status: 'REJECTED' }).eq('booking_id', Number(bookingId) || bookingId);
      } catch(e) {}
    }
    if (window.EventoraDB) {
      EventoraDB.vendorRejectBooking(bookingId, reason);
    }
  };

  // ── Public API ──────────────────────────────────────────────────────────
  return {
    init,
    cleanup,
    setCategory: (cat) => { _activeCategory = cat; renderMarketplace(); },
    setSearch: (q) => { _searchQuery = (q || '').trim(); renderMarketplace(); },
    renderMarketplace,
    openVendorDetail,
    selectPackage,
    setGuestCount,
    submitBooking,
    createVendorBusiness,
    adminApproveVendor,
    adminRejectVendor,
    adminSuspendVendor,
    vendorToggleStorefront,
    loadAllVendorsForAdmin,
    loadVendorDashboardData,
    subscribeVendorBookings,
    vendorAcceptBooking,
    vendorRejectBooking,
    updateNotificationBadge,
    renderNotificationPanel,
    getVendors: () => _vendors,
    getNotifications: () => _notifications,
    getUnreadCount: () => _unreadCount
  };
})();
