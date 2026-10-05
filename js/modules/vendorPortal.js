/**
 * EVENTORA — Vendor Partner Portal Module
 * Dedicated merchant dashboard: Booking requests, one-click accept/reject,
 * package & service management, revenue & commission ledger, and customer reviews.
 */
window.VendorPortalModule = (() => {
  let _activeVendorId = 'v-royal-feast';
  let _currentTab = 'bookings';
  let _liveBookings = null;      // null = not yet loaded from Supabase
  let _supabaseVendorId = null;  // numeric vendor_id from Supabase vendors table
  let _realtimeChannel = null;

  const setVendor = (vendorId) => {
    _activeVendorId = vendorId;
    renderPortal();
  };

  const setTab = (tab) => {
    _currentTab = tab;
    renderPortal();
  };

  // Look up this vendor's numeric Supabase vendor_id by matching user email/id
  const _resolveSupabaseVendorId = async () => {
    const client = window.EventoraSupabase?.client;
    const user = window.AuthModule?.getUser();
    if (!client || !user) return null;
    const { data } = await client
      .from('vendors')
      .select('vendor_id')
      .eq('user_id', user.id)
      .maybeSingle();
    return data?.vendor_id || null;
  };

  // Subscribe to real-time booking updates for this vendor
  const _subscribeBookings = (vendorId) => {
    if (!window.LiveMarketplace) return;
    if (_realtimeChannel) {
      const client = window.EventoraSupabase?.client;
      if (client) client.removeChannel(_realtimeChannel);
    }
    _realtimeChannel = LiveMarketplace.subscribeVendorBookings(vendorId, () => {
      if (window.Toast) Toast.show('info', '🛎️ Booking Update', 'A booking was updated. Refreshing...');
      renderPortal();
    });
  };

  const resolveActiveVendor = () => {
    const user = window.AuthModule ? AuthModule.getUser() : null;
    const userEmail = (user?.email || '').toLowerCase();
    const catalog = EventoraDB.getVendorCatalog();
    if (user?.user_metadata?.vendorId) {
      const v = EventoraDB.getVendorById(user.user_metadata.vendorId);
      if (v) return v;
    }
    if (userEmail) {
      const matched = catalog.find(v => (v.email || '').toLowerCase() === userEmail);
      if (matched) return matched;
    }
    if (user?.user_metadata?.businessName) {
      const matched = catalog.find(v => (v.name || '').toLowerCase() === user.user_metadata.businessName.toLowerCase());
      if (matched) return matched;
    }
    return EventoraDB.getVendorById(_activeVendorId) || catalog[catalog.length - 1] || catalog[0];
  };

  const renderPortal = async (containerId = 'vendorPortalContainer') => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const vendor = resolveActiveVendor();

    // ── Load live bookings from Supabase / EventoraDB ──────────────────────
    let allBookings = [], pendingBookings = [], activeBookings = [], completedBookings = [];
    if (window.LiveMarketplace && window.EventoraSupabase?.isConnected) {
      if (!_supabaseVendorId) {
        _supabaseVendorId = await _resolveSupabaseVendorId();
      }
      if (_supabaseVendorId) {
        const raw = await LiveMarketplace.loadVendorDashboardData(_supabaseVendorId) || [];
        _liveBookings = raw;
        _subscribeBookings(_supabaseVendorId);
        allBookings = raw;
        pendingBookings = raw.filter(b => b.booking_status === 'REQUESTED' || b.booking_status === 'PENDING_VENDOR');
        activeBookings  = raw.filter(b => ['ACCEPTED','CONFIRMED','IN_PROGRESS'].includes(b.booking_status));
        completedBookings = raw.filter(b => b.booking_status === 'COMPLETED');
      }
    }
    if (allBookings.length === 0) {
      allBookings = EventoraDB.getBookingsForVendor(vendor.id);
      pendingBookings   = allBookings.filter(b => b.status === EventoraDB.BOOKING_STATUS.REQUESTED || b.status === EventoraDB.BOOKING_STATUS.PENDING_VENDOR);
      activeBookings    = allBookings.filter(b => [EventoraDB.BOOKING_STATUS.ACCEPTED, EventoraDB.BOOKING_STATUS.CONFIRMED, EventoraDB.BOOKING_STATUS.IN_PROGRESS].includes(b.status));
      completedBookings = allBookings.filter(b => b.status === EventoraDB.BOOKING_STATUS.COMPLETED);
    }
    // ─────────────────────────────────────────────────────────────────────

    const grossRevenue = completedBookings.reduce((s,b) => s + (Number(b.total_amount || b.total) || 0), 0)
                       + activeBookings.reduce((s,b) => s + (Number(b.total_amount || b.total) || 0), 0);
    const platformCommission = Math.round(grossRevenue * 0.10);
    const netPayout = grossRevenue - platformCommission;

    const reviews = EventoraDB.getReviewsForVendor(vendor.id);

    const categoryIcons = {
      'Catering': '🍽️',
      'Venues': '🏠',
      'Photography': '📸',
      'Decor': '🌸',
      'Entertainment': '🎵',
      'Transport': '🚌',
      'Security': '🛡️'
    };
    const catIcon = categoryIcons[vendor.category] || '🏢';

    // Update topbar identity
    const navBizName = document.getElementById('vendorNavBusinessName');
    if (navBizName) navBizName.textContent = vendor.name;
    const navEmail = document.getElementById('vendorNavUserEmail');
    if (navEmail) navEmail.textContent = `${vendor.category} Specialist · ${vendor.city}`;
    const navCatIcon = document.getElementById('vendorNavCategoryIcon');
    if (navCatIcon) navCatIcon.textContent = catIcon;
    const navCatTitle = document.getElementById('vendorNavCategoryTitle');
    if (navCatTitle) navCatTitle.textContent = `${vendor.category} Partner Portal`;
    const navAvatar = document.getElementById('vendorNavAvatar');
    if (navAvatar) navAvatar.textContent = catIcon;

    container.innerHTML = `
      <div class="vendor-portal-wrap">
        <!-- Vendor Header -->
        <div class="vendor-top-banner card" style="background:var(--bg-white);border:1.5px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
            <div style="display:flex;align-items:center;gap:16px">
              <div class="vendor-avatar-box">
                <span style="font-size:28px">${catIcon}</span>
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:10px">
                  <h1 style="font-family:var(--font-head);font-size:26px;font-weight:900;color:var(--text-primary);margin:0">${vendor.name}</h1>
                  <span class="badge ${vendor.verified ? 'badge-green' : (vendor.verificationStatus === 'Suspended' ? 'badge-red' : 'badge-amber')}">${vendor.verificationStatus || 'Verified Partner'}</span>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
                  ${vendor.category} · 📍 ${vendor.city} · 📞 ${vendor.phone} · ⭐ <strong>${Number(vendor.rating || 5.0).toFixed(1)}</strong> (${(vendor.reviewCount || 0) + reviews.length} Reviews)
                </div>
              </div>
            </div>

            <!-- Verified Category & Storefront Status -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="badge badge-purple" style="font-size:12px;font-weight:700;padding:5px 12px">
                🏷️ Category: ${vendor.category}
              </span>
              <button class="btn btn-xs ${vendor.storefrontOnline !== false && vendor.storefront_status !== 'OFFLINE' ? 'btn-success' : 'btn-secondary'}" onclick="VendorPortalModule.toggleStorefront()" style="font-weight:700;padding:5px 12px;cursor:pointer">
                ${vendor.storefrontOnline !== false && vendor.storefront_status !== 'OFFLINE' ? '● Storefront Online' : '○ Storefront Offline'}
              </button>
              <button class="btn btn-secondary btn-xs" onclick="VendorPortalModule.showCreateBusinessModal()" style="font-weight:700">
                + Register Business
              </button>
              ${(window.AuthModule && AuthModule.getUserRole() === 'admin') ? `
              <div style="display:flex;align-items:center;gap:6px;background:var(--bg-subtle);padding:4px 8px;border-radius:var(--r-md);border:1px solid var(--border)">
                <span style="font-size:10px;font-weight:800;color:var(--brand)">ADMIN SWITCH:</span>
                <select class="input input-sm" style="font-weight:600;font-size:11px" onchange="VendorPortalModule.setVendor(this.value)">
                  ${EventoraDB.getVendorCatalog().map(v => `
                    <option value="${v.id}" ${v.id === vendor.id ? 'selected' : ''}>${v.name} (${v.category})</option>
                  `).join('')}
                </select>
              </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="vendor-kpi-grid">
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Pending Requests</div>
            <div class="vendor-kpi-val" style="color:var(--accent)">${pendingBookings.length}</div>
            <div class="vendor-kpi-sub">Awaiting your confirmation</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Active Bookings</div>
            <div class="vendor-kpi-val" style="color:var(--info)">${activeBookings.length}</div>
            <div class="vendor-kpi-sub">Coordinated by Eventora</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Completed Jobs</div>
            <div class="vendor-kpi-val" style="color:var(--success)">${completedBookings.length}</div>
            <div class="vendor-kpi-sub">Fully settled</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Net Revenue (After 10% Comm.)</div>
            <div class="vendor-kpi-val" style="color:var(--brand)">${EventoraDB.formatCurrency(netPayout)}</div>
            <div class="vendor-kpi-sub">Gross: ${EventoraDB.formatCurrency(grossRevenue)}</div>
          </div>
        </div>

        <!-- Portal Tab Bar -->
        <div class="portal-tab-bar">
          <button class="portal-tab-btn ${_currentTab === 'bookings' ? 'active' : ''}" onclick="VendorPortalModule.setTab('bookings')">
            🛎️ Booking Requests & Schedule <span class="badge badge-amber" style="margin-left:6px">${pendingBookings.length}</span>
          </button>
          <button class="portal-tab-btn ${_currentTab === 'packages' ? 'active' : ''}" onclick="VendorPortalModule.setTab('packages')">
            📋 Services & Packages
          </button>
          <button class="portal-tab-btn ${_currentTab === 'earnings' ? 'active' : ''}" onclick="VendorPortalModule.setTab('earnings')">
            💰 Earnings & Payouts
          </button>
          <button class="portal-tab-btn ${_currentTab === 'reviews' ? 'active' : ''}" onclick="VendorPortalModule.setTab('reviews')">
            ⭐ Reviews (${reviews.length})
          </button>
        </div>

        <!-- Tab Content -->
        <div class="portal-tab-content">
          ${_renderTabContent(vendor, allBookings, pendingBookings, activeBookings, completedBookings, netPayout, platformCommission, reviews)}
        </div>
      </div>
    `;
  };

  const _renderTabContent = (vendor, allBookings, pendingBookings, activeBookings, completedBookings, netPayout, platformCommission, reviews) => {
    if (_currentTab === 'bookings') {
      return `
        <!-- Pending Bookings Section -->
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">🛎️ Incoming Customer Requests</div>
            <span class="badge badge-amber">${pendingBookings.length} Action Needed</span>
          </div>

          ${pendingBookings.length === 0 ? `
            <div class="empty-state-box card">
              <div style="font-size:36px;margin-bottom:8px">🎉</div>
              <div style="font-weight:800;font-size:16px">No pending booking requests</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">You're all caught up! New customer requests will appear here in real time.</div>
            </div>
          ` : `
            <div class="vendor-request-list">
              ${pendingBookings.map(b => `
                <div class="vendor-request-card card">
                  <div class="vendor-req-top">
                    <div>
                      <div class="badge badge-amber" style="font-size:11px;margin-bottom:6px">Pending Your Acceptance</div>
                      <h3 style="font-size:18px;font-weight:800;margin:0">${b.eventName}</h3>
                      <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
                        📅 Event Date: <strong>${b.eventDate}</strong> · 👥 Guests: <strong>${b.guestCount}</strong>
                      </div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:12px;color:var(--text-muted)">Agreed Value</div>
                      <div style="font-family:var(--font-head);font-size:22px;font-weight:900;color:var(--brand)">${EventoraDB.formatCurrency(b.total)}</div>
                    </div>
                  </div>

                  <div style="background:var(--bg-subtle);padding:12px;border-radius:var(--r-md);margin:14px 0;font-size:13px">
                    <div><strong>Selected Package:</strong> ${b.packageName}</div>
                    ${b.notes ? `<div style="margin-top:4px;color:var(--text-secondary)"><strong>Customer Notes:</strong> ${b.notes}</div>` : ''}
                  </div>

                  <div class="vendor-req-actions">
                    <button class="btn btn-secondary btn-sm" onclick="VendorPortalModule.rejectBooking('${b.id}')">Decline Request</button>
                    <button class="btn btn-primary btn-sm" onclick="VendorPortalModule.acceptBooking('${b.id}')">✓ Accept Booking & Dispatch Operations</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Confirmed / Active Bookings -->
        <div class="workspace-section" style="margin-top:32px">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">✅ Active & Confirmed Bookings</div>
            <span class="badge badge-green">${activeBookings.length} Active</span>
          </div>

          ${activeBookings.length === 0 ? `
            <div class="empty-state-box card" style="padding:24px">
              <div style="font-size:13px;color:var(--text-muted)">No active bookings right now.</div>
            </div>
          ` : `
            <div class="card" style="padding:0;overflow:hidden">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Package</th>
                    <th>Value</th>
                    <th>Assigned Field Lead</th>
                    <th>Operational Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeBookings.map(b => `
                    <tr>
                      <td><strong>${b.eventName}</strong></td>
                      <td>${b.eventDate}</td>
                      <td><span class="badge badge-gray">${b.packageName}</span></td>
                      <td style="font-family:var(--font-mono);font-weight:700">${EventoraDB.formatCurrency(b.total)}</td>
                      <td>
                        <div style="display:flex;align-items:center;gap:6px">
                          <span style="font-size:14px">👷</span>
                          <span>${b.assignedEmployeeName || 'Pending Lead Assignment'}</span>
                        </div>
                      </td>
                      <td><span class="badge badge-green">${b.operationalStatus || b.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
    }

    if (_currentTab === 'packages') {
      const pkgs = vendor.packages || [];
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">📦 Configured Packages (${pkgs.length})</div>
            <button class="btn btn-primary btn-sm" onclick="Toast.show('info','Package Builder','Package editor modal is ready.')">+ Add New Package</button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;margin-top:16px">
            ${pkgs.map(p => `
              <div class="card" style="padding:20px;border:1.5px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <h3 style="font-size:16px;font-weight:800;margin:0">${p.name}</h3>
                    <div style="font-family:var(--font-head);font-size:20px;font-weight:900;color:var(--brand);margin-top:4px">
                      ₹${p.price} <small style="font-size:12px;font-weight:400;color:var(--text-muted)">/${p.priceType || 'person'}</small>
                    </div>
                  </div>
                  ${p.isPopular ? `<span class="badge badge-amber">Popular</span>` : ''}
                </div>
                <p style="font-size:13px;color:var(--text-muted);margin:12px 0">${p.description}</p>
                <div style="font-size:12px;background:var(--bg-subtle);padding:10px;border-radius:var(--r-sm)">
                  ${p.starters ? `<div><strong>Starters:</strong> ${p.starters.join(', ')}</div>` : ''}
                  ${p.mains ? `<div style="margin-top:4px"><strong>Mains:</strong> ${p.mains.join(', ')}</div>` : ''}
                  ${p.desserts ? `<div style="margin-top:4px"><strong>Desserts:</strong> ${p.desserts.join(', ')}</div>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (_currentTab === 'earnings') {
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">💰 Financial Ledger & Commission Settlement</div>
          </div>

          <div class="card" style="margin-top:16px;padding:24px;border:1.5px solid var(--border)">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:24px">
              <div>
                <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Gross Contract Value</div>
                <div style="font-family:var(--font-head);font-size:26px;font-weight:900;color:var(--text-primary);margin-top:4px">
                  ${EventoraDB.formatCurrency(netPayout + platformCommission)}
                </div>
              </div>
              <div>
                <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Platform Coordination (10%)</div>
                <div style="font-family:var(--font-head);font-size:26px;font-weight:900;color:var(--danger);margin-top:4px">
                  - ${EventoraDB.formatCurrency(platformCommission)}
                </div>
              </div>
              <div>
                <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Your Net Earnings (90%)</div>
                <div style="font-family:var(--font-head);font-size:26px;font-weight:900;color:var(--success);margin-top:4px">
                  ${EventoraDB.formatCurrency(netPayout)}
                </div>
              </div>
            </div>

            <div style="background:var(--bg-subtle);padding:14px;border-radius:var(--r-md);font-size:13px;color:var(--text-secondary)">
              🛡️ <strong>Automatic Escrow Protection:</strong> Customer funds are held securely by Eventora and paid out into your registered bank account upon job completion sign-off by assigned Eventora field staff.
            </div>
          </div>
        </div>
      `;
    }

    if (_currentTab === 'reviews') {
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">⭐ Customer Reviews & Feedback (${reviews.length})</div>
          </div>

          ${reviews.length === 0 ? `
            <div class="empty-state-box card" style="padding:28px">
              <div style="font-weight:800;font-size:15px">No reviews recorded yet</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Reviews from verified customers appear here once bookings reach completion.</div>
            </div>
          ` : `
            <div style="display:grid;gap:16px;margin-top:16px">
              ${reviews.map(r => `
                <div class="card" style="padding:18px;border:1.5px solid var(--border)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <div>
                      <strong>${r.customerName || 'Verified Client'}</strong>
                      <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${r.dateStr || 'Recent'}</span>
                    </div>
                    <div style="color:var(--accent);font-weight:800;font-size:15px">
                      ${'★'.repeat(r.rating || 5)} (${r.rating || 5}.0)
                    </div>
                  </div>
                  <p style="font-size:14px;color:var(--text-secondary);margin:8px 0 0">${r.comment || 'Excellent service and coordination!'}</p>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }

    return '';
  };

  // ── Create Business Prompt ─────────────────────────────────────────────
  const _renderCreateBusinessPrompt = (container, vendor) => {
    container.innerHTML = `
      <div class="vendor-portal-wrap">
        <div class="card" style="max-width:560px;margin:60px auto;padding:40px;text-align:center;border:1.5px solid var(--border)">
          <div style="font-size:48px;margin-bottom:16px">🏢</div>
          <h2 style="font-family:var(--font-head);font-size:24px;font-weight:900;margin:0 0 8px">Set Up Your Business</h2>
          <p style="font-size:14px;color:var(--text-muted);margin-bottom:28px">
            You haven't registered a business on Eventora yet. Create your business profile to start receiving bookings.
          </p>
          <button class="btn btn-primary btn-lg" onclick="VendorPortalModule.showCreateBusinessModal()">
            + Create My Business
          </button>
        </div>
      </div>
    `;
  };

  const showCreateBusinessModal = () => {
    const categories = ['Catering','Photography','Decor','Entertainment','Venues','Transport','Security','Other'];
    Modal.open('Create Your Business', `
      <div style="display:grid;gap:16px">
        <div class="form-group">
          <label class="form-label">Business Name *</label>
          <input class="input" id="bizName" placeholder="e.g. SS Business" required>
        </div>
        <div class="form-group">
          <label class="form-label">Category *</label>
          <select class="input" id="bizCategory">
            ${categories.map(c => `<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="input" id="bizDesc" rows="3" placeholder="Tell customers about your services..."></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">City / Location *</label>
            <input class="input" id="bizCity" placeholder="Hyderabad" value="Hyderabad">
          </div>
          <div class="form-group">
            <label class="form-label">Service Area</label>
            <input class="input" id="bizArea" placeholder="Telangana & AP">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Phone *</label>
            <input class="input" id="bizPhone" placeholder="+91 XXXXX XXXXX">
          </div>
          <div class="form-group">
            <label class="form-label">Starting Price (₹)</label>
            <input class="input" type="number" id="bizPrice" placeholder="499" min="0">
          </div>
        </div>
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:var(--r-md);padding:12px;font-size:13px;color:#065f46">
          ✨ Your business is instantly saved to the database and live on the Customer Marketplace without delay.
        </div>
      </div>
    `, async () => {
      const name = document.getElementById('bizName')?.value?.trim();
      const category = document.getElementById('bizCategory')?.value;
      if (!name) { Toast.show('warning','Required','Please enter a business name.'); return; }

      const btn = document.getElementById('modalConfirmBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving to Database...'; }

      try {
        const created = await LiveMarketplace.createVendorBusiness({
          business_name: name,
          service_category: category,
          description: document.getElementById('bizDesc')?.value?.trim() || '',
          location: document.getElementById('bizCity')?.value?.trim() || 'Hyderabad',
          service_area: document.getElementById('bizArea')?.value?.trim() || 'Telangana & AP',
          phone: document.getElementById('bizPhone')?.value?.trim() || '',
          starting_price: document.getElementById('bizPrice')?.value || 0,
        });
        Modal.close();
        Toast.show('success', '🎉 Business Created!', 'Your business is live in the database and visible to all customers.');
        _supabaseVendorId = created?.vendor_id || null;
        if (created?.id) _activeVendorId = created.id;
        renderPortal();
      } catch (err) {
        Toast.show('error', 'Creation Failed', err.message || 'Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Create Business'; }
      }
    }, 'Create Business');
  };

  const toggleStorefront = async () => {
    const vendor = resolveActiveVendor();
    if (!vendor) return;
    const isCurrentlyOnline = vendor.storefrontOnline !== false && vendor.storefront_status !== 'OFFLINE';
    const newStatus = !isCurrentlyOnline;

    if (window.LiveMarketplace) {
      await LiveMarketplace.vendorToggleStorefront(vendor.vendor_id || vendor.id, newStatus);
    }
    vendor.storefrontOnline = newStatus;
    vendor.storefront_status = newStatus ? 'ONLINE' : 'OFFLINE';
    vendor.is_published = newStatus;

    if (window.EventoraDB && typeof EventoraDB.updateVendorStorefront === 'function') {
      EventoraDB.updateVendorStorefront(vendor.id, newStatus);
    }

    if (window.Toast) {
      Toast.show(
        newStatus ? 'success' : 'info',
        newStatus ? 'Storefront Online' : 'Storefront Offline',
        newStatus ? 'Your business is live and accepting customer bookings.' : 'Your business is temporarily hidden from the customer marketplace.'
      );
    }
    renderPortal();
  };

  const acceptBooking = async (bookingId) => {
    // Try live Supabase first
    if (window.LiveMarketplace && window.EventoraSupabase?.isConnected) {
      try {
        await LiveMarketplace.vendorAcceptBooking(Number(bookingId) || bookingId);
        Toast.show('success', '✅ Booking Accepted!', 'Customer has been notified. Eventora operations will coordinate.');
        renderPortal();
      } catch (err) {
        Toast.show('error', 'Accept Failed', err.message || 'Please try again.');
      }
    } else {
      // Local fallback
      const updated = EventoraDB.vendorAcceptBooking(bookingId);
      if (updated) {
        Toast.show('success', 'Booking Accepted! 🎉', 'Field Staff Lead assigned. Operations dispatch notified.');
        renderPortal();
        if (window.App && typeof App.refreshSidebarEvent === 'function') App.refreshSidebarEvent();
      }
    }
  };

  const rejectBooking = (bookingId) => {
    Modal.open('Decline Booking Request', `
      <div>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Please specify a reason for the customer:</p>
        <select class="input" id="rejectReasonSelect">
          <option>Fully booked on selected event date</option>
          <option>Guest capacity exceeds current limits</option>
          <option>Venue outside service perimeter</option>
          <option>Custom requirement cannot be fulfilled</option>
        </select>
      </div>
    `, async () => {
      const reason = document.getElementById('rejectReasonSelect')?.value || 'Unavailable';
      if (window.LiveMarketplace && window.EventoraSupabase?.isConnected) {
        try {
          await LiveMarketplace.vendorRejectBooking(Number(bookingId) || bookingId, reason);
          Toast.show('info', 'Booking Declined', 'The customer has been notified.');
          renderPortal();
        } catch (err) {
          Toast.show('error', 'Reject Failed', err.message || 'Please try again.');
        }
      } else {
        EventoraDB.vendorRejectBooking(bookingId, reason);
        Toast.show('info', 'Booking Declined', 'The customer has been notified.');
        renderPortal();
      }
    }, 'Confirm Decline');
  };

  return {
    setVendor,
    setTab,
    renderPortal,
    acceptBooking,
    rejectBooking,
    toggleStorefront,
    showCreateBusinessModal,
  };
})();
