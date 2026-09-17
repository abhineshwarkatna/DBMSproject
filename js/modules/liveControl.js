/**
 * EVENTORA 3.0 — Live Control Center
 */
window.LiveModule = (() => {
  let liveTimer = null;
  let elapsedSec = 0;

  const render = (evId) => {
    const c = document.getElementById('tab-live');
    if (!c) return;
    const ev      = EventoraDB.getEvent(evId);
    const guests  = EventoraDB.getGuests(evId);
    const schedule= EventoraDB.getSchedule(evId);
    const alerts  = EventoraDB.getAlerts(evId);

    const checkedIn  = guests.filter(g => g.checkedIn).length;
    const attending  = guests.filter(g => g.rsvp === 'Attending').length;
    const arrivalPct = attending > 0 ? Math.round(checkedIn / attending * 100) : 0;

    c.innerHTML = `
      <!-- Live Banner -->
      <div class="live-banner">
        <div class="live-banner-left">
          <div style="width:48px;height:48px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center">
            <div class="live-dot" style="width:16px;height:16px"></div>
          </div>
          <div>
            <div class="live-banner-title">🔴 LIVE: ${ev?.title || 'Your Event'}</div>
            <div class="live-banner-sub">Event is active · Timer: <span id="liveTimerDisplay" style="font-family:var(--font-mono);font-weight:700">--:--:--</span></div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="livePauseBtn" onclick="LiveModule.toggleTimer()">⏸️ Pause</button>
          <button class="btn btn-danger btn-sm" onclick="LiveModule.endEvent('${evId}')">⏹️ End Event</button>
          <button class="btn btn-primary btn-sm" onclick="LiveModule.openAddAlert('${evId}')">+ Add Alert</button>
        </div>
      </div>

      <!-- Live Metrics -->
      <div class="live-metrics">
        <div class="live-metric-card">
          <div class="lmc-val" style="color:var(--brand)">${checkedIn}</div>
          <div class="lmc-label">Checked In</div>
          <div class="prog-track mt-2" style="width:120px;margin:8px auto 0"><div class="prog-fill brand" style="width:${arrivalPct}%"></div></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${arrivalPct}% of expected</div>
        </div>
        <div class="live-metric-card">
          <div class="lmc-val" style="color:var(--success)">${attending}</div>
          <div class="lmc-label">Expected Guests</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${guests.length - checkedIn} not yet arrived</div>
        </div>
        <div class="live-metric-card">
          <div class="lmc-val" style="color:var(--warning)">${schedule.length}</div>
          <div class="lmc-label">Schedule Items</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Click to view timeline</div>
        </div>
        <div class="live-metric-card">
          <div class="lmc-val" style="color:var(--danger)">${alerts.filter(a=>a.type==='danger'||a.type==='warning').length}</div>
          <div class="lmc-label">Active Alerts</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px">${alerts.length} total since start</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Quick Check-In -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div class="workspace-section-title">👥 Quick Check-In</div>
            <button class="btn btn-primary btn-xs" onclick="App.switchTab('guests')">Manage All →</button>
          </div>
          <div class="search-box mb-3">
            <span class="search-icon">🔍</span>
            <input class="input input-sm" id="liveCheckinSearch" placeholder="Search guest name..." oninput="LiveModule.filterGuests(this.value,'${evId}')">
          </div>
          <div id="liveGuestList" style="max-height:300px;overflow-y:auto">
            ${guests.slice(0,8).map(g => `
              <div class="schedule-today-item" style="padding:8px 0">
                <div style="width:32px;height:32px;border-radius:50%;background:${g.checkedIn?'var(--success)':'var(--bg-muted)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${g.checkedIn?'#fff':'var(--text-muted)'};flex-shrink:0">
                  ${g.name.charAt(0).toUpperCase()}
                </div>
                <div class="sti-content">
                  <div style="font-size:13px;font-weight:600">${g.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${g.role||'Guest'} · ${g.rsvp}</div>
                </div>
                <button class="btn ${g.checkedIn?'btn-secondary':'btn-success'} btn-xs" onclick="LiveModule.quickCheckin('${evId}','${g.id}')">
                  ${g.checkedIn ? '✓ In' : 'Check In'}
                </button>
              </div>`).join('') || '<div style="color:var(--text-muted);font-size:13px">No guests added yet.</div>'}
          </div>
        </div>

        <!-- Alert Feed -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div class="workspace-section-title">📢 Event Alerts</div>
            <button class="btn btn-primary btn-xs" onclick="LiveModule.openAddAlert('${evId}')">+ Add</button>
          </div>
          <div class="alert-feed" id="alertFeedList">
            ${alerts.length === 0 ? `<div class="empty-state" style="padding:20px"><div class="empty-icon">📢</div><div class="empty-title">No alerts yet</div></div>` :
            alerts.map(a => `
              <div class="alert-item ${a.type||'info'}">
                <span style="font-size:16px">${a.icon||'ℹ️'}</span>
                <span style="flex:1;font-size:13px">${a.message}</span>
                <span class="alert-time">${a.timestamp||''}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Now Playing Schedule -->
      ${schedule.length > 0 ? `
      <div class="card" style="margin-top:20px">
        <div class="workspace-section-title" style="margin-bottom:16px">📅 Event Timeline (Today)</div>
        <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">
          ${schedule.map((s, i) => `
            <div style="flex-shrink:0;width:180px;background:${i===0?'var(--brand-light)':'var(--bg-subtle)'};border:1.5px solid ${i===0?'var(--brand)':'var(--border)'};border-radius:var(--r-md);padding:12px">
              <div style="font-size:10px;font-weight:700;color:${i===0?'var(--brand)':'var(--text-subtle)'};text-transform:uppercase;margin-bottom:4px">${i===0?'▶ CURRENT':'UPCOMING'}</div>
              <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:2px">${s.title}</div>
              <div style="font-size:11px;color:var(--text-muted)">${s.startTime||''} ${s.endTime?'– '+s.endTime:''}</div>
              ${s.location?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px">📍 ${s.location}</div>`:''}
            </div>`).join('')}
        </div>
      </div>` : ''}`;

    startTimer();
  };

  const startTimer = () => {
    if (liveTimer) return;
    liveTimer = setInterval(() => {
      elapsedSec++;
      const h = String(Math.floor(elapsedSec/3600)).padStart(2,'0');
      const m = String(Math.floor((elapsedSec%3600)/60)).padStart(2,'0');
      const s = String(elapsedSec%60).padStart(2,'0');
      const d = document.getElementById('liveTimerDisplay');
      if (d) d.textContent = `${h}:${m}:${s}`;
    }, 1000);
  };

  const toggleTimer = () => {
    const btn = document.getElementById('livePauseBtn');
    if (liveTimer) {
      clearInterval(liveTimer); liveTimer = null;
      if (btn) btn.textContent = '▶ Resume';
    } else {
      startTimer();
      if (btn) btn.textContent = '⏸️ Pause';
    }
  };

  const quickCheckin = (evId, gId) => {
    const g = EventoraDB.getGuests(evId).find(x => x.id === gId);
    if (!g) return;
    EventoraDB.updateGuest(evId, gId, { checkedIn: !g.checkedIn });
    Toast.show(g.checkedIn ? 'info':'success', g.checkedIn ? 'Checked Out':'✓ Checked In', g.name);
    render(evId);
  };

  const filterGuests = (q, evId) => {
    const guests = EventoraDB.getGuests(evId).filter(g => g.name.toLowerCase().includes(q.toLowerCase()));
    const list = document.getElementById('liveGuestList');
    if (!list) return;
    list.innerHTML = guests.slice(0,8).map(g => `
      <div class="schedule-today-item" style="padding:8px 0">
        <div style="width:32px;height:32px;border-radius:50%;background:${g.checkedIn?'var(--success)':'var(--bg-muted)'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${g.checkedIn?'#fff':'var(--text-muted)'};flex-shrink:0">${g.name.charAt(0)}</div>
        <div class="sti-content"><div style="font-size:13px;font-weight:600">${g.name}</div><div style="font-size:11px;color:var(--text-muted)">${g.role||'Guest'}</div></div>
        <button class="btn ${g.checkedIn?'btn-secondary':'btn-success'} btn-xs" onclick="LiveModule.quickCheckin('${evId}','${g.id}')">${g.checkedIn?'✓ In':'Check In'}</button>
      </div>`).join('');
  };

  const openAddAlert = (evId) => {
    Modal.open('Add Event Alert',
      `<div class="form-group"><label class="form-label">Alert Message *</label><input class="input" id="alertMsg" placeholder="e.g., Sound issue at Stage B"></div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Type</label><select class="input" id="alertType"><option value="success">Success ✅</option><option value="info">Info ℹ️</option><option value="warning" selected>Warning ⚠️</option><option value="danger">Emergency 🔴</option></select></div>
         <div class="form-group"><label class="form-label">Priority</label><select class="input" id="alertPrio"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div>
       </div>`,
      () => {
        const msg = document.getElementById('alertMsg')?.value?.trim();
        if (!msg) { Toast.show('warning','Alert message needed',''); return; }
        const type = document.getElementById('alertType')?.value || 'info';
        const icons = { success:'✅', info:'ℹ️', warning:'⚠️', danger:'🚨' };
        EventoraDB.addAlert(evId, { type, message:msg, icon:icons[type], priority:document.getElementById('alertPrio')?.value });
        Toast.show(type, 'Alert Added', msg);
        render(evId);
      }, 'Add Alert');
  };

  const endEvent = (evId) => {
    Modal.open('End Event?', '<p>This will mark the event as <strong>Completed</strong>. You can still access all data afterwards.</p>',
      () => {
        if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
        EventoraDB.updateEvent(evId, { status:'Completed' });
        Toast.show('success','Event Ended!','Thank you for using EVENTORA!', 6000);
        App.refreshSidebar();
        App.switchTab('analytics');
      }, 'End Event');
  };

  return { render, toggleTimer, quickCheckin, filterGuests, openAddAlert, endEvent };
})();
