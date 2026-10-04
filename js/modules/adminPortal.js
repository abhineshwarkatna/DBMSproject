/**
 * EVENTORA — Admin & Operations Command Center Module
 * Comprehensive ecosystem control: GMV analytics, commission tracking,
 * vendor verification & governance, field staff dispatch engine, and live audit logs.
 */
window.AdminPortalModule = (() => {
  let _currentTab = 'overview';

  const setTab = (tab) => {
    _currentTab = tab;
    renderPortal();
  };

  const renderPortal = (containerId = 'adminPortalContainer') => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const stats = EventoraDB.getPlatformAnalytics();
    const vendors = EventoraDB.getVendorCatalog();
    const bookings = EventoraDB.getAllBookings();
    const employees = [
      { id: 'emp-1', name: 'Rahul Verma', role: 'Catering Setup Lead', area: 'Hyderabad Central', status: 'Available' },
      { id: 'emp-2', name: 'Sneha Nair', role: 'Venue & Decor Inspector', area: 'Cyberabad', status: 'Available' },
      { id: 'emp-3', name: 'Vikram Rao', role: 'Stage & AV Supervisor', area: 'Secunderabad', status: 'Available' },
      { id: 'emp-4', name: 'Ananya Patel', role: 'VIP & Transport Coordinator', area: 'Shamshabad', status: 'Available' }
    ];
    const auditLogs = EventoraDB.getAuditLogs();

    container.innerHTML = `
      <div class="admin-portal-wrap">
        <!-- Admin Command Header -->
        <div class="card" style="background:var(--bg-white);border:1.5px solid var(--border);padding:24px;margin-bottom:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
            <div style="display:flex;align-items:center;gap:16px">
              <div style="width:52px;height:52px;border-radius:var(--r-md);background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px">
                🛡️
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:10px">
                  <h1 style="font-family:var(--font-head);font-size:24px;font-weight:900;color:var(--text-primary);margin:0">Platform Command Center</h1>
                  <span class="badge badge-green">Operations Live</span>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
                  Central Eventora Ecosystem Dispatch, Governance & Commission Gateway
                </div>
              </div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn btn-secondary btn-sm" onclick="AdminPortalModule.refreshAll()">🔄 Refresh Data</button>
            </div>
          </div>
        </div>

        <!-- Ecosystem KPI Cards -->
        <div class="vendor-kpi-grid" style="margin-bottom:28px">
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Gross Merchandise Value (GMV)</div>
            <div class="vendor-kpi-val" style="color:var(--brand)">${EventoraDB.formatCurrency(stats.gmv)}</div>
            <div class="vendor-kpi-sub">Total marketplace contracts</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Eventora Net Commission (10%)</div>
            <div class="vendor-kpi-val" style="color:var(--success)">${EventoraDB.formatCurrency(stats.commission)}</div>
            <div class="vendor-kpi-sub">Platform earned margin</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Active Bookings</div>
            <div class="vendor-kpi-val" style="color:var(--info)">${bookings.length}</div>
            <div class="vendor-kpi-sub">${stats.confirmedBookings} confirmed / completed</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Network Partners</div>
            <div class="vendor-kpi-val" style="color:var(--accent)">${vendors.length} Vendors</div>
            <div class="vendor-kpi-sub">${employees.length} Field Coordinators</div>
          </div>
        </div>

        <!-- Tab Bar -->
        <div class="portal-tab-bar">
          <button class="portal-tab-btn ${_currentTab === 'overview' ? 'active' : ''}" onclick="AdminPortalModule.setTab('overview')">
            📊 Ecosystem Overview & Bookings
          </button>
          <button class="portal-tab-btn ${_currentTab === 'vendors' ? 'active' : ''}" onclick="AdminPortalModule.setTab('vendors')">
            🤝 Vendor Verification & Governance (${vendors.length})
          </button>
          <button class="portal-tab-btn ${_currentTab === 'employees' ? 'active' : ''}" onclick="AdminPortalModule.setTab('employees')">
            👷 Field Staff Dispatch Engine
          </button>
          <button class="portal-tab-btn ${_currentTab === 'audit' ? 'active' : ''}" onclick="AdminPortalModule.setTab('audit')">
            📜 Live Audit Trail (${auditLogs.length})
          </button>
        </div>

        <!-- Tab Content -->
        <div class="portal-tab-content">
          ${_renderTab(vendors, bookings, employees, auditLogs)}
        </div>
      </div>
    `;
  };

  const _renderTab = (vendors, bookings, employees, auditLogs) => {
    if (_currentTab === 'overview') {
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">🛎️ Platform-Wide Bookings Matrix</div>
            <span class="badge badge-gray">${bookings.length} Records</span>
          </div>

          ${bookings.length === 0 ? `
            <div class="empty-state-box card" style="padding:28px">
              <div style="font-size:13px;color:var(--text-muted)">No bookings in the platform yet.</div>
            </div>
          ` : `
            <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Event</th>
                    <th>Vendor</th>
                    <th>Package / Service</th>
                    <th>Total</th>
                    <th>Commission (10%)</th>
                    <th>Status</th>
                    <th>Assigned Lead</th>
                  </tr>
                </thead>
                <tbody>
                  ${bookings.map(b => `
                    <tr>
                      <td><span style="font-family:var(--font-mono);font-size:12px">${b.id}</span></td>
                      <td><strong>${b.eventName}</strong></td>
                      <td>${b.vendorName}</td>
                      <td><span class="badge badge-gray">${b.packageName || b.service}</span></td>
                      <td style="font-family:var(--font-mono);font-weight:700">${EventoraDB.formatCurrency(b.total)}</td>
                      <td style="font-family:var(--font-mono);color:var(--success)">${EventoraDB.formatCurrency(b.commission || Math.round(b.total*0.10))}</td>
                      <td><span class="badge ${b.status === 'COMPLETED' ? 'badge-green' : b.status === 'ACCEPTED' ? 'badge-info' : 'badge-amber'}">${b.status}</span></td>
                      <td>${b.assignedEmployeeName ? `👷 ${b.assignedEmployeeName}` : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
    }

    if (_currentTab === 'vendors') {
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">🤝 Partner Verification & Compliance</div>
          </div>

          <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Vendor Business</th>
                  <th>Category</th>
                  <th>City / Area</th>
                  <th>Rating</th>
                  <th>Status</th>
                  <th>Governance Actions</th>
                </tr>
              </thead>
              <tbody>
                ${vendors.map(v => `
                  <tr>
                    <td>
                      <strong>${v.name}</strong>
                      <div style="font-size:11px;color:var(--text-muted)">${v.email || 'partner@eventora.io'}</div>
                    </td>
                    <td><span class="badge badge-gray">${v.category}</span></td>
                    <td>${v.city}</td>
                    <td>⭐ <strong>${v.rating}</strong> (${v.reviewCount})</td>
                    <td>
                      <span class="badge ${v.verificationStatus === 'Verified' ? 'badge-green' : v.verificationStatus === 'Rejected' ? 'badge-red' : 'badge-amber'}">
                        ${v.verificationStatus || 'Verified'}
                      </span>
                    </td>
                    <td>
                      <div style="display:flex;gap:6px">
                        ${v.verificationStatus !== 'Verified' ? `
                          <button class="btn btn-primary btn-xs" onclick="AdminPortalModule.updateVendorStatus('${v.id}','Verified')">Approve</button>
                        ` : `
                          <button class="btn btn-secondary btn-xs" onclick="AdminPortalModule.updateVendorStatus('${v.id}','Suspended')">Suspend</button>
                        `}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (_currentTab === 'employees') {
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">👷 Field Staff Dispatch Roster</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;margin-top:16px">
            ${employees.map(e => `
              <div class="card" style="padding:20px;border:1.5px solid var(--border)">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                  <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-subtle);display:flex;align-items:center;justify-content:center;font-size:20px">
                    👷
                  </div>
                  <div>
                    <h3 style="font-size:16px;font-weight:800;margin:0">${e.name}</h3>
                    <div style="font-size:12px;color:var(--text-muted)">${e.role}</div>
                  </div>
                </div>
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">📍 ${e.area}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
                  <span class="badge badge-green">✓ ${e.status}</span>
                  <button class="btn btn-ghost btn-xs" onclick="Toast.show('info','Employee Profile','Dispatched telemetry active.')">View Roster</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (_currentTab === 'audit') {
      return `
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">📜 Platform Audit & Telemetry Trail</div>
          </div>

          <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Event Details</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.map(a => `
                  <tr>
                    <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">${a.date} ${a.timestamp}</td>
                    <td><span class="badge badge-gray">${a.action}</span></td>
                    <td>${a.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return '';
  };

  const updateVendorStatus = (vendorId, status) => {
    EventoraDB.updateVendorVerification(vendorId, status);
    Toast.show('success', 'Status Updated', `Vendor status changed to ${status}.`);
    renderPortal();
  };

  const refreshAll = () => {
    renderPortal();
    Toast.show('info', 'Command Center Refreshed', 'Latest bookings and audit telemetry synchronized.');
  };

  return {
    setTab,
    renderPortal,
    updateVendorStatus,
    refreshAll
  };
})();
