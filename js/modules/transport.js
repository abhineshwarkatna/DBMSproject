/**
 * EVENTORA 3.0 — Transport Module
 */
window.TransportModule = (() => {
  const FLEET = [
    {id:'t1',type:'AC Coach Bus',capacity:45,driver:'Suresh P',phone:'9800001111',pickup:'HITEC City',dropoff:'Taj Falaknuma',time:'09:30',status:'Scheduled',img:'bus'},
    {id:'t2',type:'Tempo Traveller',capacity:14,driver:'Ramesh K',phone:'9800002222',pickup:'Banjara Hills',dropoff:'Venue',time:'10:00',status:'In Transit',img:'car'},
    {id:'t3',type:'Luxury Sedan',capacity:4,driver:'Vijay S',phone:'9800003333',pickup:'Airport',dropoff:'Hotel',time:'11:00',status:'Completed',img:'car'},
  ];

  const render = (evId) => {
    const c = document.getElementById('tab-transport');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">🚌 Transport Management</div>
          <div class="mod-subtitle">Manage guest pickup, fleet, and routes</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="TransportModule.addRoute('${evId}')">🗺️ Add Route</button>
          <button class="btn btn-primary btn-sm" onclick="TransportModule.addVehicle('${evId}')">+ Add Vehicle</button>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${[
          {icon:'🚌',label:'Vehicles',val:FLEET.length},
          {icon:'👥',label:'Capacity',val:FLEET.reduce((a,b)=>a+b.capacity,0)+' seats'},
          {icon:'✅',label:'Scheduled',val:FLEET.filter(f=>f.status==='Scheduled').length},
          {icon:'🔵',label:'In Transit',val:FLEET.filter(f=>f.status==='In Transit').length},
          {icon:'✓',label:'Completed',val:FLEET.filter(f=>f.status==='Completed').length},
        ].map(s=>`
          <div class="card-sm card" style="padding:14px;text-align:center">
            <div style="font-size:22px">${s.icon}</div>
            <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--brand);margin:4px 0">${s.val}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Fleet Cards -->
      <div class="workspace-section-title" style="margin-bottom:16px">🚗 Fleet Overview</div>
      <div class="transport-fleet-grid" style="margin-bottom:24px">
        ${FLEET.map(v => `
          <div class="fleet-card">
            <div class="fleet-card-img img-hover-zoom">
              <img src="${IMGS[v.img]}?w=400&q=75&auto=format&fit=crop" alt="${v.type}" loading="lazy">
              <div style="position:absolute;top:10px;left:10px">
                <span class="badge ${v.status==='Completed'?'badge-green':v.status==='In Transit'?'badge-blue':'badge-amber'}">${v.status}</span>
              </div>
            </div>
            <div class="fleet-card-body">
              <div class="fleet-card-name">${v.type}</div>
              <div class="fleet-card-meta">👤 ${v.capacity} seats · 📞 ${v.phone}</div>
              <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
                <div style="font-size:12px;color:var(--text-muted)">🚩 <strong>From:</strong> ${v.pickup}</div>
                <div style="font-size:12px;color:var(--text-muted)">🏁 <strong>To:</strong> ${v.dropoff}</div>
                <div style="font-size:12px;color:var(--text-muted)">⏰ <strong>Departs:</strong> ${v.time}</div>
                <div style="font-size:12px;color:var(--text-muted)">🧑‍✈️ <strong>Driver:</strong> ${v.driver}</div>
              </div>
              <div style="display:flex;gap:6px;margin-top:12px">
                <button class="btn btn-secondary btn-xs btn-full" onclick="TransportModule.callDriver('${v.phone}')">📞 Call Driver</button>
                <button class="btn btn-primary btn-xs btn-full" onclick="TransportModule.updateStatus('${v.id}')">Update →</button>
              </div>
            </div>
          </div>`).join('')}

        <!-- Add Vehicle card -->
        <div class="fleet-card" style="border:2px dashed var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:280px" onclick="TransportModule.addVehicle('${evId}')">
          <div style="text-align:center;color:var(--text-subtle)">
            <div style="font-size:40px;margin-bottom:8px">🚌</div>
            <div style="font-size:14px;font-weight:600">Add Vehicle</div>
          </div>
        </div>
      </div>

      <!-- Guest Pickup List -->
      <div class="card">
        <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:14px">👥 Guest Pickup Assignments</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">Assign guests to specific vehicles for pickup coordination.</div>
        ${EventoraDB.getGuests(evId).slice(0,5).map(g => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--brand);flex-shrink:0">${g.name.charAt(0)}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600">${g.name}</div>
              <div style="font-size:11px;color:var(--text-muted)">${g.role||'Guest'}</div>
            </div>
            <select class="input input-sm" style="width:160px">
              <option value="">Not assigned</option>
              ${FLEET.map(v=>`<option>${v.type} (${v.time})</option>`).join('')}
            </select>
          </div>`).join('') || '<div style="color:var(--text-muted);font-size:13px">No guests added yet.</div>'}
        ${EventoraDB.getGuests(evId).length > 5 ? `<div style="text-align:center;margin-top:10px"><button class="btn btn-secondary btn-sm" onclick="App.switchTab('guests')">View All ${EventoraDB.getGuests(evId).length} Guests →</button></div>` : ''}
      </div>`;
  };

  const addVehicle = (evId) => {
    Modal.open('Add Vehicle',
      `<div class="form-row">
        <div class="form-group"><label class="form-label">Vehicle Type *</label><select class="input" id="vType"><option>AC Coach Bus</option><option>Tempo Traveller</option><option>Luxury Sedan</option><option>SUV</option><option>Minivan</option></select></div>
        <div class="form-group"><label class="form-label">Seating Capacity</label><input class="input" id="vCap" type="number" placeholder="e.g., 45"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Driver Name</label><input class="input" id="vDriver" placeholder="Driver's name"></div>
        <div class="form-group"><label class="form-label">Driver Phone</label><input class="input" id="vPhone" placeholder="10-digit"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Pickup Point</label><input class="input" id="vPickup" placeholder="e.g., HITEC City"></div>
        <div class="form-group"><label class="form-label">Drop Point</label><input class="input" id="vDrop" placeholder="Venue name"></div>
      </div>
      <div class="form-group"><label class="form-label">Departure Time</label><input class="input" id="vTime" type="time" value="09:00"></div>`,
      () => Toast.show('success','Vehicle Added',''), 'Add Vehicle');
  };

  const addRoute = (evId) => Toast.show('info','Route Builder','Map-based route builder coming soon!');
  const callDriver = (phone) => Toast.show('info','Calling Driver', `📞 ${phone}`);
  const updateStatus = (id) => Toast.show('success','Status Updated','Vehicle status updated.');

  return { render, addVehicle, addRoute, callDriver, updateStatus };
})();
