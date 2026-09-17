/**
 * EVENTORA 3.0 — Dashboard / Overview Module
 */
window.DashboardModule = (() => {
  const render = (evId) => {
    const c = document.getElementById('tab-overview');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);
    if (!ev) { c.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No event selected</div><button class="btn btn-primary mt-4" onclick="App.goWizard()">+ Create Event</button></div>`; return; }

    const guests   = EventoraDB.getGuests(evId);
    const tasks    = EventoraDB.getTasks(evId);
    const expenses = EventoraDB.getExpenses(evId);
    const schedule = EventoraDB.getSchedule(evId);
    const bookings = EventoraDB.getBookings(evId);

    const attending = guests.filter(g => g.rsvp === 'Attending').length;
    const taskDone  = tasks.filter(t => t.status === 'Done').length;
    const totalSpent = expenses.reduce((a, b) => a + (b.actual || 0), 0);
    const budget = ev.budget || 0;
    const daysLeft = ev.eventDate ? Math.max(0, Math.round((new Date(ev.eventDate) - new Date()) / 86400000)) : '—';
    const pct = budget ? Math.min(100, Math.round(totalSpent / budget * 100)) : 0;
    const taskPct = tasks.length ? Math.round(taskDone / tasks.length * 100) : 0;
    const coverImg = IMGS[ev.coverImage] || IMGS.wedding;

    // Stage
    const stages = ['Planning','Pre-Event','Setup','Live Event','Post-Event'];
    const stageIdx = {Planning:0,'Pre-Event':1,Setup:2,Active:3,Completed:4}[ev.status] || 0;

    // Pending items
    const pendingTasks = tasks.filter(t => t.status !== 'Done').slice(0, 3);
    const pendingGuests = guests.filter(g => g.rsvp === 'Pending').slice(0, 3);
    const todayItems = schedule.filter(s => {
      if (!ev.eventDate) return false;
      const today = new Date().toLocaleDateString();
      const evDate = new Date(ev.eventDate).toLocaleDateString();
      return today === evDate;
    }).slice(0, 4);

    c.innerHTML = `
      <!-- Event Workspace Header -->
      <div class="event-workspace-header">
        <div class="ewh-cover">
          <img src="${coverImg}?w=1200&q=80&auto=format&fit=crop" alt="${ev.title}" loading="lazy"
               onerror="this.onerror=null;this.src='${IMGS.wedding}?w=1200&q=80&auto=format&fit=crop'">

          <div class="ewh-cover-overlay"></div>
          <div class="ewh-cover-content">
            <div class="ewh-event-name">${ev.title}</div>
            <div class="ewh-event-meta">
              <span>📂 ${ev.category}${ev.subtype ? ' · '+ev.subtype : ''}</span>
              ${ev.eventDate ? `<span>📅 ${new Date(ev.eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span>` : ''}
              ${ev.venueName ? `<span>📍 ${ev.venueName}${ev.venueCity?', '+ev.venueCity:''}</span>` : ''}
              <span>👥 ${ev.guestCapacity || '?'} guests expected</span>
            </div>
          </div>
          <div class="ewh-actions">
            <button class="ewh-action-btn" onclick="App.switchTab('live')">🔴 Go Live</button>
            <button class="ewh-action-btn" onclick="App.openEventSwitcher()">🔄 Switch</button>
          </div>
        </div>
        <!-- Stage progress -->
        <div style="padding:14px 24px;border-bottom:1px solid var(--border);display:flex;gap:0;align-items:center;overflow-x:auto">
          ${stages.map((s, i) => `
            <div style="display:flex;align-items:center;gap:0;flex-shrink:0">
              <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="width:28px;height:28px;border-radius:50%;background:${i<=stageIdx?'var(--brand)':'var(--bg-muted)'};border:2px solid ${i<=stageIdx?'var(--brand)':'var(--border-md)'};display:flex;align-items:center;justify-content:center;color:${i<=stageIdx?'#fff':'var(--text-subtle)'};font-size:11px;font-weight:700">
                  ${i < stageIdx ? '✓' : i + 1}
                </div>
                <div style="font-size:10px;font-weight:600;color:${i===stageIdx?'var(--brand)':'var(--text-subtle)'};white-space:nowrap">${s}</div>
              </div>
              ${i < stages.length-1 ? `<div style="width:48px;height:2px;background:${i<stageIdx?'var(--brand)':'var(--border)'};margin:0 4px;margin-bottom:18px;flex-shrink:0"></div>` : ''}
            </div>`).join('')}
        </div>
        <!-- Metrics -->
        <div class="ewh-metrics">
          <div class="ewh-metric">
            <div class="ewh-metric-label">Days to Event</div>
            <div class="ewh-metric-val" style="color:${daysLeft < 14 ? 'var(--danger)' : daysLeft < 30 ? 'var(--warning)' : 'var(--brand)'}">${daysLeft}</div>
            <div class="ewh-metric-sub">${ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) : 'Date TBD'}</div>
          </div>
          <div class="ewh-metric">
            <div class="ewh-metric-label">Guests</div>
            <div class="ewh-metric-val">${attending}<span style="font-size:14px;font-weight:400;color:var(--text-muted)">/${guests.length}</span></div>
            <div class="ewh-metric-sub">${guests.filter(g=>g.checkedIn).length} checked in</div>
          </div>
          <div class="ewh-metric">
            <div class="ewh-metric-label">Tasks Done</div>
            <div class="ewh-metric-val">${taskDone}<span style="font-size:14px;font-weight:400;color:var(--text-muted)">/${tasks.length}</span></div>
            <div class="ewh-metric-sub">${taskPct}% complete</div>
          </div>
          <div class="ewh-metric">
            <div class="ewh-metric-label">Budget Used</div>
            <div class="ewh-metric-val" style="color:${pct>90?'var(--danger)':pct>70?'var(--warning)':'var(--text-primary)'}">
              ${EventoraDB.formatCurrency(totalSpent)}
            </div>
            <div class="ewh-metric-sub">${pct}% of ${EventoraDB.formatCurrency(budget)}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <!-- Quick Actions -->
        <div class="card">
          <div class="workspace-section-title" style="margin-bottom:12px">⚡ Quick Actions</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[
              {icon:'👥',label:'Add Guest',  tab:'guests'},
              {icon:'✅',label:'Add Task',   tab:'tasks'},
              {icon:'💰',label:'Log Expense',tab:'budget'},
              {icon:'🤝',label:'Find Vendor',tab:'vendors'},
              {icon:'📅',label:'Add to Schedule',tab:'schedule'},
              {icon:'🔴',label:'Go Live',   tab:'live'},
            ].map(a => `
              <button class="btn btn-secondary btn-sm" onclick="App.switchTab('${a.tab}')" style="justify-content:flex-start;gap:8px">
                <span>${a.icon}</span>${a.label}
              </button>`).join('')}
          </div>
        </div>

        <!-- Needs Attention -->
        <div class="card">
          <div class="workspace-section-title" style="margin-bottom:12px">🔔 Needs Attention</div>
          ${pendingTasks.length === 0 && pendingGuests.length === 0 ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:14px">✅ Nothing pending — you're all good!</div>` :
          `<div style="display:flex;flex-direction:column;gap:8px">
            ${pendingTasks.map(t => `
              <div class="attention-card" onclick="App.switchTab('tasks')">
                <div class="attention-card-icon">⚠️</div>
                <div><div class="attention-card-title">${t.name}</div><div class="attention-card-sub">Task due ${t.deadline||'No deadline'}</div></div>
                <span class="priority-${t.priority?.toLowerCase()||'medium'}">${t.priority||'Medium'}</span>
              </div>`).join('')}
            ${pendingGuests.length > 0 ? `
              <div class="attention-card" onclick="App.switchTab('guests')">
                <div class="attention-card-icon">👥</div>
                <div><div class="attention-card-title">${pendingGuests.length} RSVP${pendingGuests.length>1?'s':''} pending</div>
                <div class="attention-card-sub">${pendingGuests.map(g=>g.name).join(', ')}</div></div>
              </div>` : ''}
          </div>`}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <!-- Today / Event Schedule -->
        <div class="card">
          <div class="workspace-section-title" style="margin-bottom:4px">
            📅 ${todayItems.length > 0 ? "Today's Schedule" : "Event Schedule Highlights"}
          </div>
          <div class="schedule-today">
            ${(todayItems.length > 0 ? todayItems : schedule.slice(0,4)).map(s => `
              <div class="schedule-today-item">
                <div class="sti-time">
                  <div class="sti-time-main">${s.startTime||''}</div>
                  <div class="sti-time-end">${s.endTime||''}</div>
                </div>
                <div class="sti-dot-line"><div class="sti-dot"></div><div class="sti-line"></div></div>
                <div class="sti-content">
                  <div class="sti-title">${s.title}</div>
                  <div class="sti-loc">${s.location||''}</div>
                  <span class="sti-type-badge" style="background:var(--brand-light);color:var(--brand);font-size:10px;padding:2px 8px;border-radius:var(--r-full)">${s.type||'session'}</span>
                </div>
              </div>`).join('') || `<div style="padding:20px;text-align:center;color:var(--text-muted)">No schedule items yet.<br><button class="btn btn-primary btn-sm mt-3" onclick="App.switchTab('schedule')">Add Schedule</button></div>`}
          </div>
          ${schedule.length > 4 ? `<a style="font-size:13px;font-weight:600;color:var(--brand);cursor:pointer;display:block;margin-top:12px" onclick="App.switchTab('schedule')">View all ${schedule.length} items →</a>` : ''}
        </div>

        <!-- Budget Progress -->
        <div class="card">
          <div class="workspace-section-title" style="margin-bottom:4px">💰 Budget Overview</div>
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:13px;color:var(--text-muted)">Total Spent</span>
              <span style="font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--text-primary)">${EventoraDB.formatCurrency(totalSpent)}</span>
            </div>
            <div class="prog-track" style="height:10px;border-radius:var(--r-full)">
              <div class="prog-fill gradient" style="width:${pct}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:6px">
              <span style="font-size:12px;color:var(--text-subtle)">${pct}% used</span>
              <span style="font-size:12px;color:var(--success);font-weight:600">Remaining: ${EventoraDB.formatCurrency(budget - totalSpent)}</span>
            </div>
          </div>
          ${expenses.slice(0,4).map(e => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="width:32px;height:32px;border-radius:var(--r-sm);background:var(--bg-subtle);display:flex;align-items:center;justify-content:center;font-size:14px">
                ${{Catering:'🍽️',Decor:'🌸',Photography:'📸',Venue:'🏠',Transport:'🚌'}[e.category]||'💰'}
              </div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${e.description}</div>
                <div style="font-size:11px;color:var(--text-muted)">${e.category}</div>
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);text-align:right">${EventoraDB.formatCurrency(e.actual)}</div>
                <div style="font-size:10px;text-align:right"><span class="badge ${e.status==='Paid'?'badge-green':e.status==='Due'?'badge-red':'badge-amber'}">${e.status}</span></div>
              </div>
            </div>`).join('')}
          <a style="font-size:13px;font-weight:600;color:var(--brand);cursor:pointer;display:block;margin-top:12px" onclick="App.switchTab('budget')">View full budget →</a>
        </div>
      </div>

      <!-- Vendors Summary -->
      ${bookings.length > 0 ? `
      <div class="card">
        <div class="workspace-section-title" style="margin-bottom:16px">🤝 Booked Vendors</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${bookings.slice(0,4).map(b => `
            <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-subtle);border-radius:var(--r-md);border:1px solid var(--border)">
              <div style="width:40px;height:40px;border-radius:var(--r-sm);background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🤝</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.vendorName}</div>
                <div style="font-size:11px;color:var(--text-muted)">${b.service}</div>
              </div>
              <span class="badge ${b.status==='Confirmed'?'badge-green':'badge-amber'}">${b.status}</span>
            </div>`).join('')}
        </div>
        <a style="font-size:13px;font-weight:600;color:var(--brand);cursor:pointer;display:block;margin-top:12px" onclick="App.switchTab('vendors')">Manage vendors →</a>
      </div>` : ''}`;
  };

  return { render };
})();
