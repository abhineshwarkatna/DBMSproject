/**
 * EVENTORA 3.0 — Guests & People Module
 */
window.GuestsModule = (() => {
  let filter = 'All', search = '';
  const COLORS = ['#7C3AED','#06B6D4','#10B981','#F59E0B','#EC4899','#3B82F6','#EF4444'];

  const avatarColor = (name) => COLORS[name.charCodeAt(0) % COLORS.length];
  const initials    = (name) => name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);

  const render = (evId) => {
    const c = document.getElementById('tab-guests');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);
    if (!ev) return;
    const guests = EventoraDB.getGuests(evId);

    const attending = guests.filter(g => g.rsvp === 'Attending').length;
    const pending   = guests.filter(g => g.rsvp === 'Pending').length;
    const declined  = guests.filter(g => g.rsvp === 'Declined').length;
    const checkedIn = guests.filter(g => g.checkedIn).length;

    let filtered = guests.filter(g => {
      if (filter !== 'All' && g.rsvp !== filter && g.role !== filter) return false;
      if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !g.email?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">👥 Guests & People</div>
          <div class="mod-subtitle">${guests.length} total · ${attending} attending · ${checkedIn} checked in</div>
        </div>
        <div class="mod-actions">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input class="input input-sm" id="guestSearch" placeholder="Search guests..." value="${search}" oninput="GuestsModule.setSearch(this.value,'${evId}')">
          </div>
          <button class="btn btn-secondary btn-sm" onclick="GuestsModule.importCSV('${evId}')">📥 Import CSV</button>
          <button class="btn btn-primary btn-sm" onclick="GuestsModule.openAddGuest('${evId}')">+ Add Guest</button>
        </div>
      </div>

      <!-- Stats bar -->
      <div class="guest-stat-bar">
        ${[
          {val:guests.length,     label:'Total',      bg:'var(--bg-subtle)'},
          {val:attending,         label:'Attending',  bg:'var(--success-bg)', col:'var(--success)'},
          {val:pending,           label:'Pending',    bg:'var(--warning-bg)', col:'var(--warning)'},
          {val:declined,          label:'Declined',   bg:'var(--danger-bg)',  col:'var(--danger)'},
          {val:checkedIn,         label:'Checked In', bg:'var(--info-bg)',    col:'var(--info)'},
          {val:guests.filter(g=>g.role==='VIP').length, label:'VIP', bg:'#EDE9FE', col:'var(--brand)'},
        ].map(s => `
          <div class="guest-stat-card" style="background:${s.bg}">
            <div class="gsc-val" style="${s.col?`color:${s.col}`:'color:var(--text-primary)'}">${s.val}</div>
            <div class="gsc-label">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Filter chips -->
      <div class="filter-bar">
        ${['All','Attending','Pending','Declined','VIP','Speaker','Staff'].map(f => `
          <div class="filter-chip ${filter===f?'active':''}" onclick="GuestsModule.setFilter('${f}','${evId}')">${f}</div>`).join('')}
        <div style="margin-left:auto;font-size:13px;color:var(--text-muted)">${filtered.length} shown</div>
      </div>

      <!-- Table -->
      <div class="card" style="padding:0;overflow:hidden">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <div class="empty-title">No guests found</div>
            <div class="empty-sub">${guests.length === 0 ? 'Add your first guest to get started.' : 'Try changing the filter or search.'}</div>
            <button class="btn btn-primary" onclick="GuestsModule.openAddGuest('${evId}')">+ Add Guest</button>
          </div>` :
        `<table class="data-table">
          <thead>
            <tr>
              <th>Name</th><th>RSVP</th><th>Role</th><th>Table</th><th>Dietary</th><th>Check-In</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(g => `
              <tr>
                <td>
                  <div class="guest-row">
                    <div class="guest-avatar" style="background:${avatarColor(g.name)}">${initials(g.name)}</div>
                    <div>
                      <div class="guest-name">${g.name}</div>
                      <div class="guest-email">${g.email||''}${g.phone?' · '+g.phone:''}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select style="border:1.5px solid var(--border);border-radius:var(--r-sm);padding:4px 8px;font-size:12px;font-weight:600;background:${g.rsvp==='Attending'?'var(--success-bg)':g.rsvp==='Declined'?'var(--danger-bg)':'var(--warning-bg)'};color:${g.rsvp==='Attending'?'var(--success)':g.rsvp==='Declined'?'var(--danger)':'var(--warning)'}"
                    onchange="GuestsModule.updateRSVP('${evId}','${g.id}',this.value)">
                    <option ${g.rsvp==='Attending'?'selected':''}>Attending</option>
                    <option ${g.rsvp==='Pending'?'selected':''}>Pending</option>
                    <option ${g.rsvp==='Declined'?'selected':''}>Declined</option>
                  </select>
                </td>
                <td><span class="badge ${g.role==='VIP'?'badge-violet':g.role==='Speaker'?'badge-blue':'badge-gray'}">${g.role||'Guest'}</span></td>
                <td style="font-family:var(--font-mono);font-size:12px">${g.table||'—'}</td>
                <td style="font-size:12px;color:var(--text-muted)">${g.dietary||'—'}</td>
                <td>
                  <div class="checkin-btn ${g.checkedIn?'checked':''}" onclick="GuestsModule.toggleCheckin('${evId}','${g.id}')" title="${g.checkedIn?'Checked In':'Mark as arrived'}">
                    ${g.checkedIn?'✓':''}
                  </div>
                </td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-ghost btn-xs" onclick="GuestsModule.editGuest('${evId}','${g.id}')">✏️</button>
                    <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="GuestsModule.deleteGuest('${evId}','${g.id}')">🗑️</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`}
      </div>`;
  };

  const setFilter = (f, evId) => { filter = f; render(evId); };
  const setSearch = (s, evId) => { search = s; render(evId); };

  const toggleCheckin = (evId, gId) => {
    const g = EventoraDB.getGuests(evId).find(x => x.id === gId);
    if (g) {
      EventoraDB.updateGuest(evId, gId, { checkedIn: !g.checkedIn });
      Toast.show(g.checkedIn ? 'info':'success', g.checkedIn ? 'Checked Out':'Checked In', g.name);
      render(evId);
    }
  };

  const updateRSVP = (evId, gId, rsvp) => {
    EventoraDB.updateGuest(evId, gId, { rsvp });
    App.refreshSidebar();
    render(evId);
  };

  const openAddGuest = (evId, gId) => {
    const existing = gId ? EventoraDB.getGuests(evId).find(g => g.id === gId) : null;
    const g = existing || {};
    Modal.open(existing ? 'Edit Guest' : 'Add Guest',
      `<form id="guestForm">
        <div class="form-row">
          <div class="form-group"><label class="form-label">Full Name *</label><input class="input" id="gfName" value="${g.name||''}" placeholder="e.g., Priya Sharma" required></div>
          <div class="form-group"><label class="form-label">Phone</label><input class="input" id="gfPhone" value="${g.phone||''}" placeholder="10-digit number"></div>
        </div>
        <div class="form-group"><label class="form-label">Email</label><input class="input" id="gfEmail" type="email" value="${g.email||''}" placeholder="email@example.com"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">RSVP</label><select class="input" id="gfRsvp"><option ${g.rsvp==='Attending'?'selected':''}>Attending</option><option ${g.rsvp==='Pending'?'selected':''}>Pending</option><option ${g.rsvp==='Declined'?'selected':''}>Declined</option></select></div>
          <div class="form-group"><label class="form-label">Role</label><select class="input" id="gfRole"><option ${g.role==='Guest'?'selected':''}>Guest</option><option ${g.role==='VIP'?'selected':''}>VIP</option><option ${g.role==='Speaker'?'selected':''}>Speaker</option><option ${g.role==='Staff'?'selected':''}>Staff</option><option ${g.role==='Host'?'selected':''}>Host</option></select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Table / Seat</label><input class="input" id="gfTable" value="${g.table||''}" placeholder="e.g., A1, VIP-01"></div>
          <div class="form-group"><label class="form-label">Dietary Preference</label><select class="input" id="gfDiet"><option ${g.dietary==='Vegetarian'?'selected':''}>Vegetarian</option><option ${g.dietary==='Non-Vegetarian'?'selected':''}>Non-Vegetarian</option><option ${g.dietary==='Vegan'?'selected':''}>Vegan</option><option ${g.dietary==='Jain'?'selected':''}>Jain</option><option ${g.dietary==='Halal'?'selected':''}>Halal</option><option ${g.dietary==='No restriction'?'selected':''}>No restriction</option></select></div>
        </div>
      </form>`,
      () => {
        const name = document.getElementById('gfName')?.value?.trim();
        if (!name) { Toast.show('warning','Name required','Enter the guest name.'); return; }
        const data = {
          name, phone: document.getElementById('gfPhone')?.value||'',
          email: document.getElementById('gfEmail')?.value||'',
          rsvp: document.getElementById('gfRsvp')?.value||'Pending',
          role: document.getElementById('gfRole')?.value||'Guest',
          table: document.getElementById('gfTable')?.value||'',
          dietary: document.getElementById('gfDiet')?.value||'Vegetarian',
        };
        if (existing) { EventoraDB.updateGuest(evId, gId, data); Toast.show('success','Guest Updated', data.name); }
        else { EventoraDB.addGuest(evId, data); Toast.show('success','Guest Added', data.name); }
        App.refreshSidebar(); render(evId);
      }, existing ? 'Save Changes' : 'Add Guest');
  };

  const editGuest   = (evId, gId) => openAddGuest(evId, gId);
  const deleteGuest = (evId, gId) => {
    const g = EventoraDB.getGuests(evId).find(x => x.id === gId);
    if (!g) return;
    Modal.open('Delete Guest', `<p>Remove <strong>${g.name}</strong> from the guest list?</p>`,
      () => { EventoraDB.deleteGuest(evId, gId); Toast.show('info','Guest Removed',g.name); App.refreshSidebar(); render(evId); }, 'Delete');
  };

  const importCSV = (evId) => {
    Toast.show('info','CSV Import','Paste guest data in format: Name, Email, Phone, Role per line.');
    Modal.open('Bulk Import Guests',
      `<div class="form-group">
        <label class="form-label">Paste CSV data (Name, Email, Phone, Role)</label>
        <textarea class="input" id="csvData" rows="8" placeholder="Priya Sharma, priya@email.com, 9876543210, VIP&#10;Rahul Kumar, rahul@email.com, 9876543211, Guest"></textarea>
        <div class="form-help">One guest per line. Email and Phone are optional.</div>
      </div>`,
      () => {
        const text = document.getElementById('csvData')?.value || '';
        let count = 0;
        text.split('\n').forEach(line => {
          const parts = line.split(',').map(s => s.trim());
          if (parts[0]) { EventoraDB.addGuest(evId, { name:parts[0], email:parts[1]||'', phone:parts[2]||'', role:parts[3]||'Guest', rsvp:'Pending' }); count++; }
        });
        Toast.show('success','Imported', `${count} guests added`);
        App.refreshSidebar(); render(evId);
      }, `Import Guests`);
  };

  return { render, setFilter, setSearch, toggleCheckin, updateRSVP, openAddGuest, editGuest, deleteGuest, importCSV };
})();
