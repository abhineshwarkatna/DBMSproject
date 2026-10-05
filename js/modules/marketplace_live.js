/**
 * EVENTORA — Live Connected Marketplace Engine
 * =============================================
 * Single Source of Truth: Supabase
 *
 * Vendor creates business → Supabase
 * Admin approves → Supabase update → Realtime push
 * Customer marketplace → Supabase query + Realtime subscription
 * Customer books → Supabase booking → Vendor receives real-time notification
 * Vendor accepts → Customer receives real-time notification
 */
window.LiveMarketplace = (() => {
  let _vendors = [];
  let _services = {};
  let _packages = {};
  let _notifications = [];
  let _realtimeChannels = [];
  let _activeCategory = 'All';
  let _searchQuery = '';
  let _activeVendorDetail = null;
  let _selectedPkg = null;
  let _guestCount = 100;
  let _unreadCount = 0;

  const CATEGORIES = [
    { id: 'All',           label: 'All Services',    icon: '✨' },
    { id: 'Catering',      label: 'Food & Catering', icon: '🍽️' },
    { id: 'Photography',   label: 'Photography',     icon: '📸' },
    { id: 'Decor',         label: 'Decor & Floral',  icon: '🌸' },
    { id: 'Entertainment', label: 'DJ & Sound',      icon: '🎵' },
    { id: 'Venues',        label: 'Venues',          icon: '🏠' },
    { id: 'Transport',     label: 'Transport',       icon: '🚌' },
    { id: 'Security',      label: 'Security',        icon: '🛡️' },
  ];

  const sb = () => window.EventoraSupabase?.client;

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadVendors = async () => {
    const client = sb();
    if (!client) return [];
    const { data, error } = await client
      .from('vendors').select('*')
      .eq('verification_status', 'Verified')
      .order('vendor_id', { ascending: true });
    if (error) { console.error('[LiveMarketplace] loadVendors:', error); return []; }
    return data || [];
  };

  const loadServicesForVendor = async (vendorId) => {
    const client = sb();
    if (!client) return [];
    const { data } = await client.from('vendor_services').select('*')
      .eq('vendor_id', vendorId).eq('is_active', true);
    return data || [];
  };

  const loadPackagesForVendor = async (vendorId) => {
    const client = sb();
    if (!client) return [];
    const { data } = await client.from('vendor_packages').select('*').eq('vendor_id', vendorId);
    return data || [];
  };

  const loadNotificationsForUser = async (userId) => {
    const client = sb();
    if (!client) return [];
    const { data } = await client.from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(30);
    return data || [];
  };

  // ── Init ──────────────────────────────────────────────────────────────────

  const init = async () => {
    if (!sb()) return;
    _vendors = await loadVendors();
    renderMarketplace();
    const user = window.AuthModule?.getUser();
    if (user) {
      _notifications = await loadNotificationsForUser(user.id);
      _unreadCount = _notifications.filter(n => !n.is_read).length;
      updateNotificationBadge();
    }
    _subscribeRealtime();
  };

  const _subscribeRealtime = () => {
    const client = sb();
    if (!client) return;
    _realtimeChannels.forEach(ch => client.removeChannel(ch));
    _realtimeChannels = [];

    const vendorChannel = client.channel('marketplace-vendors-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, _handleVendorChange)
      .subscribe();
    _realtimeChannels.push(vendorChannel);

    const user = window.AuthModule?.getUser();
    if (user) {
      const notifChannel = client.channel('user-notifications-live')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => _handleNewNotification(payload.new))
        .subscribe();
      _realtimeChannels.push(notifChannel);

      if (window.AuthModule?.getUserRole() === 'customer') {
        const bookingChannel = client.channel('customer-bookings-live')
          .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'bookings',
            filter: `customer_id=eq.${user.id}`
          }, (payload) => _handleBookingStatusChange(payload.new))
          .subscribe();
        _realtimeChannels.push(bookingChannel);
      }
    }
  };

  const cleanup = () => {
    const client = sb();
    if (!client) return;
    _realtimeChannels.forEach(ch => client.removeChannel(ch));
    _realtimeChannels = [];
  };

  // ── Realtime Handlers ─────────────────────────────────────────────────────

  const _handleVendorChange = (payload) => {
    const vendor = payload.new || payload.old;
    const eventType = payload.eventType;
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (vendor.verification_status === 'Verified') {
        const idx = _vendors.findIndex(v => v.vendor_id === vendor.vendor_id);
        if (idx === -1) {
          _vendors.push(vendor);
          const role = window.AuthModule?.getUserRole();
          if (role === 'customer' || !window.AuthModule?.getUser()) _showNewVendorToast(vendor);
        } else {
          _vendors[idx] = vendor;
        }
      } else {
        _vendors = _vendors.filter(v => v.vendor_id !== vendor.vendor_id);
      }
    } else if (eventType === 'DELETE') {
      _vendors = _vendors.filter(v => v.vendor_id !== (vendor.vendor_id));
    }
    renderMarketplace();
  };

  const _handleNewNotification = (notif) => {
    _notifications.unshift(notif);
    _unreadCount++;
    updateNotificationBadge();
    if (window.Toast) Toast.show('info', notif.title, notif.message);
  };

  const _handleBookingStatusChange = (booking) => {
    const map = {
      'ACCEPTED':    { t: '✅ Booking Accepted!',      m: 'The vendor has accepted your booking.' },
      'REJECTED':    { t: '❌ Booking Declined',        m: 'The vendor could not accommodate your request.' },
      'CONFIRMED':   { t: '🎉 Booking Confirmed!',     m: 'Eventora operations will coordinate your event.' },
      'ASSIGNED':    { t: '👷 Coordinator Assigned',   m: 'An Eventora field coordinator has been assigned.' },
      'IN_PROGRESS': { t: '⚡ Event in Progress',      m: 'Eventora staff are on site.' },
      'COMPLETED':   { t: '🏆 Event Completed!',       m: 'Your event has been successfully completed!' },
    };
    const msg = map[booking.booking_status];
    if (msg && window.Toast) Toast.show('success', msg.t, msg.m);
  };

  const _showNewVendorToast = (vendor) => {
    if (!window.Toast) return;
    const e = {'Catering':'🍽️','Photography':'📸','Decor':'🌸','Entertainment':'🎵','Venues':'🏠','Transport':'🚌','Security':'🛡️'};
    Toast.show('info', `${e[vendor.service_category]||'🏢'} New Partner on Eventora!`,
      `${vendor.business_name} is now available in ${vendor.location || 'your area'}.`);
  };

  // ── Marketplace Render ────────────────────────────────────────────────────

  const _img = (cat) => {
    const imgs = {
      'Catering':'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80',
      'Photography':'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
      'Decor':'https://images.unsplash.com/photo-1519225421-2c890c5c2d59?w=600&q=80',
      'Entertainment':'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
      'Venues':'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&q=80',
      'Transport':'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=80',
      'Security':'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    };
    return imgs[cat] || 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=80';
  };

  const _emoji = (cat) => ({'Catering':'🍽️','Photography':'📸','Decor':'🌸','Entertainment':'🎵','Venues':'🏠','Transport':'🚌','Security':'🛡️'}[cat]||'🏢');

  const renderMarketplace = (targetElId = 'marketplaceContainer') => {
    const container = document.getElementById(targetElId);
    if (!container) return;

    const filtered = _vendors.filter(v => {
      if (_activeCategory !== 'All' && v.service_category !== _activeCategory) return false;
      if (_searchQuery) {
        const q = _searchQuery;
        return (v.business_name||'').toLowerCase().includes(q)
          || (v.service_category||'').toLowerCase().includes(q)
          || (v.location||'').toLowerCase().includes(q)
          || (v.description||'').toLowerCase().includes(q);
      }
      return true;
    });

    const connected = window.EventoraSupabase?.isConnected;
    const statusDot = connected ? '#10b981' : '#f59e0b';
    const statusText = connected
      ? `Live data · ${_vendors.length} verified partner${_vendors.length!==1?'s':''} · Realtime`
      : 'Connecting to marketplace...';

    const catButtons = CATEGORIES.map(c =>
      `<button class="mkt-cat-btn ${c.id===_activeCategory?'active':''}" onclick="LiveMarketplace.setCategory('${c.id}')"><span>${c.icon}</span> ${c.label}</button>`
    ).join('');

    const cards = filtered.length === 0
      ? `<div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--text-muted)">
           <div style="font-size:48px;margin-bottom:12px">🔍</div>
           <div style="font-size:16px;font-weight:700">No vendors found</div>
           <div style="font-size:13px;margin-top:6px">${_vendors.length===0?'No verified vendors yet.':'Try a different filter.'}</div>
         </div>`
      : filtered.map(v => {
          const em = _emoji(v.service_category);
          const imgUrl = _img(v.service_category);
          const price = v.starting_price > 0 ? `₹${Number(v.starting_price).toLocaleString('en-IN')}` : 'Contact for quote';
          return `<div class="mkt-card hover-lift-sm">
            <div class="mkt-card-media" style="position:relative">
              <img src="${v.logo_url||imgUrl}" alt="${v.business_name}" loading="lazy" onerror="this.src='${imgUrl}'">
              <div class="mkt-verified-badge">✓ Verified Partner</div>
              <div class="mkt-category-chip">${em} ${v.service_category}</div>
            </div>
            <div class="mkt-card-body">
              <div class="mkt-card-top">
                <div>
                  <h3 class="mkt-vendor-name">${v.business_name}</h3>
                  <div class="mkt-vendor-location">📍 ${v.location||'Hyderabad'} · ${v.service_area||'Citywide'}</div>
                </div>
                <div class="mkt-rating-box"><span class="mkt-star">★</span><strong>${Number(v.rating||4.8).toFixed(1)}</strong><span class="mkt-rev-cnt">(${v.review_count||0})</span></div>
              </div>
              <p class="mkt-vendor-desc">${v.description||'Professional event services in '+(v.location||'Hyderabad')+'.'}</p>
              <div class="mkt-perks-row"><span class="mkt-perk">⚡ Quick Response</span><span class="mkt-perk">🛡️ Eventora Protected</span></div>
              <div class="mkt-card-footer">
                <div><div class="mkt-price-label">Starting from</div><div class="mkt-price-val">${price}</div></div>
                <button class="btn btn-primary btn-sm" onclick="LiveMarketplace.openVendorDetail(${v.vendor_id})">View &amp; Book</button>
              </div>
            </div>
          </div>`;
        }).join('');

    container.innerHTML = `<div class="marketplace-wrap">
      <div class="marketplace-hero-hd">
        <div class="tag-pill">Live Eventora Network</div>
        <h2 class="marketplace-title">Discover Verified Event Services</h2>
        <p class="marketplace-sub">Real businesses. Live from Supabase. Coordinated by Eventora operations.</p>
      </div>
      <div class="mkt-filter-row">
        <div class="mkt-categories-scroll">${catButtons}</div>
        <div class="mkt-search-wrap">
          <span style="font-size:14px;opacity:0.6">🔍</span>
          <input class="mkt-search-input" placeholder="Search by name, category, or city..." value="${_searchQuery}" oninput="LiveMarketplace.setSearch(this.value)">
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:12px;color:var(--text-muted)">
        <span style="width:8px;height:8px;border-radius:50%;background:${statusDot};display:inline-block"></span>
        ${statusText}
      </div>
      <div class="mkt-cards-grid">${cards}</div>
    </div>`;
  };

  // ── Vendor Detail Modal ───────────────────────────────────────────────────

  const openVendorDetail = async (vendorId) => {
    const vendor = _vendors.find(v => v.vendor_id === vendorId);
    if (!vendor) return;
    _activeVendorDetail = vendor;
    const [services, packages] = await Promise.all([
      loadServicesForVendor(vendorId),
      loadPackagesForVendor(vendorId),
    ]);
    _services[vendorId] = services;
    _packages[vendorId] = packages;
    _selectedPkg = packages.length > 0 ? packages[0] : null;
    _renderDetailModal(vendor, services, packages);
  };

  const _renderDetailModal = (v, services, packages) => {
    const em = _emoji(v.service_category);

    const servicesHtml = services.length > 0 ? `
      <div style="margin-top:20px">
        <div style="font-weight:800;font-size:14px;margin-bottom:10px">📋 Services Offered</div>
        <div style="display:grid;gap:8px">${services.map(s => `
          <div style="padding:12px;background:var(--bg-subtle);border-radius:var(--r-md);border:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div><div style="font-weight:700">${s.name}</div><div style="font-size:12px;color:var(--text-muted)">${s.description||''}</div></div>
              <div style="font-family:var(--font-head);font-weight:900;color:var(--brand)">₹${Number(s.base_price).toLocaleString('en-IN')}<small style="font-size:11px;font-weight:400;color:var(--text-muted)">/${s.pricing_model.replace('_',' ')}</small></div>
            </div>
          </div>`).join('')}
        </div>
      </div>` : '';

    const packagesHtml = packages.length > 0 ? `
      <div style="margin-top:20px">
        <label class="form-label" style="font-size:14px;font-weight:700">📦 Select Package</label>
        <div class="mkt-package-grid">${packages.map(p => `
          <div class="mkt-package-card ${_selectedPkg&&_selectedPkg.package_id===p.package_id?'selected':''}" onclick="LiveMarketplace.selectPackage(${p.package_id})">
            ${p.is_popular?'<div class="mkt-popular-tag">MOST POPULAR</div>':''}
            <div style="font-weight:800;font-size:15px;margin-bottom:4px">${p.name}</div>
            <div style="font-family:var(--font-head);font-size:20px;font-weight:900;color:var(--brand);margin-bottom:8px">₹${Number(p.price).toLocaleString('en-IN')}<small style="font-size:12px;font-weight:400;color:var(--text-muted)">/${p.price_type||'person'}</small></div>
            <p style="font-size:12px;color:var(--text-muted);line-height:1.4">${p.description||''}</p>
          </div>`).join('')}
        </div>
      </div>` : '';

    let priceHtml = '';
    if (_selectedPkg) {
      const pp = (_selectedPkg.price_type||'').toLowerCase().includes('person');
      const base = Number(_selectedPkg.price||0);
      const sub = pp ? base*_guestCount : base;
      const tax = Math.round(sub*0.05);
      const fee = Math.round(sub*0.02);
      const tot = sub+tax+fee;
      priceHtml = `<div class="mkt-cost-box card" style="margin-top:20px;border:1.5px solid var(--border)">
        <div style="font-weight:800;font-size:15px;margin-bottom:12px">💰 Price Estimate</div>
        <div class="mkt-cost-row"><span>Package subtotal</span><strong>₹${sub.toLocaleString('en-IN')}</strong></div>
        <div class="mkt-cost-row"><span>GST (5%)</span><span style="color:var(--text-muted)">₹${tax.toLocaleString('en-IN')}</span></div>
        <div class="mkt-cost-row"><span>Eventora fee (2%)</span><span style="color:var(--text-muted)">₹${fee.toLocaleString('en-IN')}</span></div>
        <div class="mkt-cost-row total" style="border-top:1px solid var(--border);padding-top:10px;margin-top:8px">
          <span style="font-size:16px;font-weight:800">Total Estimate</span>
          <span style="font-family:var(--font-head);font-size:22px;font-weight:900;color:var(--brand)">₹${tot.toLocaleString('en-IN')}</span>
        </div>
      </div>`;
    }

    const html = `<div class="mkt-detail-layout">
      <div class="mkt-detail-header">
        <div style="display:flex;align-items:center;gap:10px">
          <h2 style="font-family:var(--font-head);font-size:24px;font-weight:900;margin:0">${v.business_name}</h2>
          <span class="badge badge-green">✓ Verified</span>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${em} ${v.service_category} · 📍 ${v.location||'Hyderabad'} · 📞 ${v.phone||''}</div>
        <p style="font-size:13px;margin:10px 0 0;color:var(--text-secondary)">${v.description||''}</p>
      </div>
      ${servicesHtml}
      ${packagesHtml}
      <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="form-label" style="font-weight:700">Expected Guests</label>
          <input class="input" type="number" min="10" max="5000" value="${_guestCount}" oninput="LiveMarketplace.setGuestCount(this.value)">
        </div>
        <div>
          <label class="form-label" style="font-weight:700">Starting Price</label>
          <input class="input" disabled value="₹${Number(v.starting_price||0).toLocaleString('en-IN')}" style="background:var(--bg-subtle)">
        </div>
      </div>
      ${priceHtml}
      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-lg" onclick="LiveMarketplace.submitBooking()">⚡ Request Booking</button>
      </div>
    </div>`;

    if (window.Modal) Modal.open(`Book ${v.business_name}`, html);
  };

  const selectPackage = (pkgId) => {
    const vendorId = _activeVendorDetail?.vendor_id;
    if (!vendorId) return;
    const pkgs = _packages[vendorId] || [];
    _selectedPkg = pkgs.find(p => p.package_id === pkgId) || pkgs[0];
    _renderDetailModal(_activeVendorDetail, _services[vendorId]||[], pkgs);
  };

  const setGuestCount = (cnt) => { _guestCount = Math.max(10, Math.min(5000, Number(cnt)||10)); };

  // ── Submit Booking ────────────────────────────────────────────────────────

  const submitBooking = async () => {
    const client = sb();
    const user = window.AuthModule?.getUser();
    if (!user) {
      if (window.Toast) Toast.show('warning','Sign In Required','Please sign in to book a service.');
      if (window.Modal) Modal.close();
      return;
    }
    if (!_activeVendorDetail) return;

    const activeEventId = window.EventoraDB?.getActiveEventId?.();
    if (!activeEventId) {
      if (window.Toast) Toast.show('warning','Create an Event First','Please create an event before booking vendors.');
      if (window.Modal) Modal.close();
      return;
    }

    const v = _activeVendorDetail;
    const pkg = _selectedPkg;
    const pp = pkg ? (pkg.price_type||'').toLowerCase().includes('person') : false;
    const base = pkg ? Number(pkg.price||0) : Number(v.starting_price||0);
    const sub = pp ? base*_guestCount : base;
    const tax = Math.round(sub*0.05);
    const fee = Math.round(sub*0.02);
    const total = sub+tax+fee;

    const btns = document.querySelectorAll('.mkt-detail-layout .btn-primary');
    btns.forEach(b => { b.disabled = true; b.textContent = 'Requesting...'; });

    try {
      if (!client) throw new Error('Not connected to Supabase');

      const { data: booking, error } = await client.from('bookings').insert([{
        customer_id: user.id,
        event_id: activeEventId,
        vendor_id: v.vendor_id,
        service_id: _services[v.vendor_id]?.[0]?.service_id || null,
        package_id: pkg?.package_id || null,
        event_date: new Date().toISOString().slice(0,10),
        guest_count: _guestCount,
        subtotal: sub,
        tax,
        service_fee: fee,
        commission_rate: 0.10,
        commission_amount: Math.round(total*0.10),
        total_amount: total,
        booking_status: 'REQUESTED',
      }]).select().single();

      if (error) throw error;

      // Notify vendor
      if (v.user_id) {
        await client.from('notifications').insert([{
          user_id: v.user_id, role: 'vendor',
          title: '🛎️ New Booking Request!',
          message: `${user.user_metadata?.full_name||user.email} requested a booking. Total: ₹${total.toLocaleString('en-IN')}`,
          link: '/vendor-portal', is_read: false,
        }]);
      }

      if (window.Modal) Modal.close();
      if (window.Toast) Toast.show('success','🚀 Booking Requested!',`Request sent to ${v.business_name}. You will be notified when they respond.`);

    } catch (err) {
      console.error('[LiveMarketplace] submitBooking:', err);
      if (window.Toast) Toast.show('error','Booking Failed', err.message||'Please try again.');
      btns.forEach(b => { b.disabled = false; b.textContent = '⚡ Request Booking'; });
    }
  };

  // ── Notifications ─────────────────────────────────────────────────────────

  const updateNotificationBadge = () => {
    const badge = document.getElementById('notifBadgeCount');
    if (!badge) return;
    badge.textContent = _unreadCount > 0 ? _unreadCount : '';
    badge.style.display = _unreadCount > 0 ? 'flex' : 'none';
  };

  const markAllRead = async () => {
    const client = sb();
    const user = window.AuthModule?.getUser();
    if (!client || !user) return;
    await client.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    _notifications = _notifications.map(n => ({ ...n, is_read: true }));
    _unreadCount = 0;
    updateNotificationBadge();
  };

  const renderNotificationPanel = (containerId = 'notifPanelBody') => {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (_notifications.length === 0) {
      el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:8px">🔔</div><div style="font-weight:700">No notifications yet</div></div>`;
      return;
    }
    el.innerHTML = _notifications.map(n => `
      <div style="padding:14px 20px;border-bottom:1px solid var(--border);background:${n.is_read?'transparent':'rgba(139,92,246,0.05)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${n.title}</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-top:2px">${n.message}</div>
          </div>
          ${!n.is_read?'<span style="width:8px;height:8px;min-width:8px;border-radius:50%;background:var(--brand);margin-top:4px"></span>':''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
          ${new Date(n.created_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}
        </div>
      </div>`).join('');
  };

  // ── Vendor Dashboard (Live) ───────────────────────────────────────────────

  const loadVendorDashboardData = async (vendorId) => {
    const client = sb();
    if (!client || !vendorId) return null;
    const { data, error } = await client.from('bookings')
      .select('*, events:event_id(title,event_date,target_guests), vendor_packages:package_id(name,price)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[LiveMarketplace] loadVendorDashboard:', error); return null; }
    return data || [];
  };

  const subscribeVendorBookings = (vendorId, onUpdate) => {
    const client = sb();
    if (!client) return null;
    const ch = client.channel(`vendor-bookings-${vendorId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `vendor_id=eq.${vendorId}`
      }, onUpdate)
      .subscribe();
    _realtimeChannels.push(ch);
    return ch;
  };

  // ── Vendor Creates Business ───────────────────────────────────────────────

  const createVendorBusiness = async (formData) => {
    const client = sb();
    const user = window.AuthModule?.getUser();
    if (!client || !user) throw new Error('Not authenticated');

    const { data: existing } = await client.from('vendors').select('vendor_id').eq('user_id', user.id).maybeSingle();
    if (existing) throw new Error('You already have a registered business.');

    const { data: vendor, error } = await client.from('vendors').insert([{
      user_id: user.id,
      business_name: formData.business_name,
      service_category: formData.service_category,
      contact_name: formData.contact_name || user.user_metadata?.full_name || '',
      email: formData.email || user.email,
      phone: formData.phone || '',
      location: formData.location || 'Hyderabad',
      service_area: formData.service_area || 'Telangana & AP',
      starting_price: Number(formData.starting_price) || 0,
      description: formData.description || '',
      is_verified: false,
      verification_status: 'Pending',
    }]).select().single();

    if (error) throw error;
    await _notifyAdmins(vendor);
    return vendor;
  };

  const _notifyAdmins = async (vendor) => {
    const client = sb();
    if (!client) return;
    const { data: admins } = await client.from('profiles').select('id').eq('role', 'admin');
    if (!admins || !admins.length) return;
    await client.from('notifications').insert(admins.map(a => ({
      user_id: a.id, role: 'admin',
      title: '🏢 New Vendor Awaiting Verification',
      message: `${vendor.business_name} (${vendor.service_category} in ${vendor.location}) submitted for verification.`,
      link: '/admin', is_read: false,
    })));
  };

  // ── Admin: Approve / Reject Vendor ───────────────────────────────────────

  const adminApproveVendor = async (vendorId) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data: vendor, error } = await client.from('vendors')
      .update({ verification_status: 'Verified', is_verified: true })
      .eq('vendor_id', vendorId).select().single();
    if (error) throw error;

    if (vendor.user_id) {
      await client.from('notifications').insert([{
        user_id: vendor.user_id, role: 'vendor',
        title: '✅ Business Verified!',
        message: `${vendor.business_name} is now live on the Eventora marketplace!`,
        is_read: false,
      }]);
    }
    await _notifyCustomersNewVendor(vendor);
    return vendor;
  };

  const adminRejectVendor = async (vendorId, reason) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data: vendor, error } = await client.from('vendors')
      .update({ verification_status: 'Rejected' })
      .eq('vendor_id', vendorId).select().single();
    if (error) throw error;
    if (vendor.user_id) {
      await client.from('notifications').insert([{
        user_id: vendor.user_id, role: 'vendor',
        title: '❌ Business Verification Not Approved',
        message: reason || 'Your verification could not be approved. Please contact support.',
        is_read: false,
      }]);
    }
    return vendor;
  };

  const _notifyCustomersNewVendor = async (vendor) => {
    const client = sb();
    if (!client) return;
    const { data: customers } = await client.from('profiles').select('id').eq('role', 'customer');
    if (!customers || !customers.length) return;
    const em = _emoji(vendor.service_category);
    await client.from('notifications').insert(customers.map(c => ({
      user_id: c.id, role: 'customer',
      title: `${em} New Partner in ${vendor.location||'your area'}`,
      message: `${vendor.business_name} is now available for ${vendor.service_category} services.`,
      link: '/marketplace', is_read: false,
    })));
  };

  const loadPendingVendors = async () => {
    const client = sb();
    if (!client) return [];
    const { data } = await client.from('vendors').select('*').eq('verification_status','Pending').order('created_at',{ascending:true});
    return data || [];
  };

  const loadAllVendorsForAdmin = async () => {
    const client = sb();
    if (!client) return [];
    const { data } = await client.from('vendors').select('*').order('created_at',{ascending:false});
    return data || [];
  };

  // ── Vendor Accept / Reject Booking ────────────────────────────────────────

  const vendorAcceptBooking = async (bookingId) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data: booking, error } = await client.from('bookings')
      .update({ booking_status: 'ACCEPTED' }).eq('booking_id', bookingId).select().single();
    if (error) throw error;
    if (booking.customer_id) {
      await client.from('notifications').insert([{
        user_id: booking.customer_id, role: 'customer',
        title: '✅ Booking Accepted!',
        message: 'Your booking request has been accepted. Eventora operations will coordinate your event.',
        is_read: false,
      }]);
    }
    return booking;
  };

  const vendorRejectBooking = async (bookingId, reason) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data: booking, error } = await client.from('bookings')
      .update({ booking_status: 'REJECTED' }).eq('booking_id', bookingId).select().single();
    if (error) throw error;
    if (booking.customer_id) {
      await client.from('notifications').insert([{
        user_id: booking.customer_id, role: 'customer',
        title: '❌ Booking Not Available',
        message: reason || 'The vendor could not accommodate your request.',
        is_read: false,
      }]);
    }
    return booking;
  };

  // ── Services & Packages CRUD ──────────────────────────────────────────────

  const addVendorService = async (vendorId, data) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data: svc, error } = await client.from('vendor_services').insert([{vendor_id:vendorId,...data}]).select().single();
    if (error) throw error;
    return svc;
  };

  const addVendorPackage = async (vendorId, data) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data: pkg, error } = await client.from('vendor_packages').insert([{vendor_id:vendorId,...data}]).select().single();
    if (error) throw error;
    return pkg;
  };

  const toggleServiceActive = async (serviceId, isActive) => {
    const client = sb();
    if (!client) throw new Error('Not connected');
    const { data, error } = await client.from('vendor_services').update({is_active:isActive}).eq('service_id',serviceId).select().single();
    if (error) throw error;
    return data;
  };

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    init, cleanup,
    setCategory: (cat) => { _activeCategory = cat; renderMarketplace(); },
    setSearch: (q) => { _searchQuery = (q||'').toLowerCase().trim(); renderMarketplace(); },
    renderMarketplace, openVendorDetail, selectPackage, setGuestCount, submitBooking,
    updateNotificationBadge, markAllRead, renderNotificationPanel,
    createVendorBusiness, loadVendorDashboardData, subscribeVendorBookings,
    addVendorService, addVendorPackage, toggleServiceActive,
    vendorAcceptBooking, vendorRejectBooking,
    adminApproveVendor, adminRejectVendor, loadPendingVendors, loadAllVendorsForAdmin,
    getVendors: () => _vendors,
    getNotifications: () => _notifications,
    getUnreadCount: () => _unreadCount,
  };
})();
