/**
 * EVENTORA — Vendor Partner Portal Module
 * Dedicated merchant dashboard: Booking requests, one-click accept/reject,
 * package & service management, revenue & commission ledger, and customer reviews.
 */
window.VendorPortalModule = (() => {
  let _activeVendorId = 'v-royal-feast'; // Default active vendor for partner portal
  let _currentTab = 'bookings';

  const setVendor = (vendorId) => {
    _activeVendorId = vendorId;
    renderPortal();
  };

  const setTab = (tab) => {
    _currentTab = tab;
    renderPortal();
  };

  const renderPortal = (containerId = 'vendorPortalContainer') => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const vendor = EventoraDB.getVendorById(_activeVendorId) || EventoraDB.getVendorCatalog()[0];
    const allBookings = EventoraDB.getBookingsForVendor(vendor.id);
    const pendingBookings = allBookings.filter(b => b.status === EventoraDB.BOOKING_STATUS.REQUESTED || b.status === EventoraDB.BOOKING_STATUS.PENDING_VENDOR);
    const activeBookings = allBookings.filter(b => b.status === EventoraDB.BOOKING_STATUS.ACCEPTED || b.status === EventoraDB.BOOKING_STATUS.CONFIRMED || b.status === EventoraDB.BOOKING_STATUS.IN_PROGRESS);
    const completedBookings = allBookings.filter(b => b.status === EventoraDB.BOOKING_STATUS.COMPLETED);

    const grossRevenue = completedBookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0) +
                         activeBookings.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
    const platformCommission = Math.round(grossRevenue * 0.10);
    const netPayout = grossRevenue - platformCommission;

    const reviews = EventoraDB.getReviewsForVendor(vendor.id);

    container.innerHTML = `
      <div class="vendor-portal-wrap">
        <!-- Vendor Header -->
        <div class="vendor-top-banner card" style="background:var(--bg-white);border:1.5px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
            <div style="display:flex;align-items:center;gap:16px">
              <div class="vendor-avatar-box">
                <span style="font-size:28px">🍽️</span>
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:10px">
                  <h1 style="font-family:var(--font-head);font-size:26px;font-weight:900;color:var(--text-primary);margin:0">${vendor.name}</h1>
                  <span class="badge ${vendor.verified ? 'badge-green' : 'badge-amber'}">${vendor.verificationStatus || 'Verified Partner'}</span>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
                  ${vendor.category} · 📍 ${vendor.city} · 📞 ${vendor.phone} · ⭐ <strong>${vendor.rating}</strong> (${vendor.reviewCount + reviews.length} Reviews)
                </div>
              </div>
            </div>

            <!-- Vendor Switcher (for demo/testing multi-partner workflow) -->
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:12px;font-weight:700;color:var(--text-muted)">SWITCH VENDOR:</span>
              <select class="input input-sm" style="font-weight:700" onchange="VendorPortalModule.setVendor(this.value)">
                ${EventoraDB.getVendorCatalog().map(v => `
                  <option value="${v.id}" ${v.id === vendor.id ? 'selected' : ''}>${v.name} (${v.category})</option>
                `).join('')}
              </select>
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

  const acceptBooking = (bookingId) => {
    const updated = EventoraDB.vendorAcceptBooking(bookingId);
    if (updated) {
      Toast.show('success', 'Booking Accepted! 🎉', `Field Staff Lead assigned. Operations dispatch notified.`);
      renderPortal();
      // Also update customer view if open
      if (window.App && typeof App.refreshSidebarEvent === 'function') {
        App.refreshSidebarEvent();
      }
    }
  };

  const rejectBooking = (bookingId) => {
    Modal.open(
      'Decline Booking Request',
      `
        <div>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Please specify a reason for the customer:</p>
          <select class="input" id="rejectReasonSelect">
            <option>Fully booked on selected event date</option>
            <option>Guest capacity exceeds current kitchen limits</option>
            <option>Venue outside standard travel perimeter</option>
            <option>Custom requirement cannot be fulfilled</option>
          </select>
        </div>
      `,
      () => {
        const reason = document.getElementById('rejectReasonSelect')?.value || 'Unavailable';
        EventoraDB.vendorRejectBooking(bookingId, reason);
        Toast.show('info', 'Booking Declined', 'The customer has been notified.');
        renderPortal();
      },
      'Confirm Decline'
    );
  };

  return {
    setVendor,
    setTab,
    renderPortal,
    acceptBooking,
    rejectBooking
  };
})();
