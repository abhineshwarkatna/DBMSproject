/**
 * EVENTORA 3.0 — Accommodation Module
 */
window.AccommodationModule = (() => {
  const ROOMS = [
    {id:'r1',name:'Presidential Suite',type:'Suite',capacity:2,floor:'7th',status:'Reserved',guest:'Dr. Pradeep Kiran',checkIn:'Nov 14',checkOut:'Nov 16',rate:18000,img:'room1'},
    {id:'r2',name:'Deluxe Room 301',type:'Deluxe',capacity:2,floor:'3rd',status:'Occupied',guest:'Sarah Mitchell',checkIn:'Nov 14',checkOut:'Nov 16',rate:8500,img:'room2'},
    {id:'r3',name:'Standard Room 204',type:'Standard',capacity:2,floor:'2nd',status:'Available',guest:'',checkIn:'',checkOut:'',rate:5500,img:'room1'},
    {id:'r4',name:'Standard Room 205',type:'Standard',capacity:2,floor:'2nd',status:'Available',guest:'',checkIn:'',checkOut:'',rate:5500,img:'room2'},
    {id:'r5',name:'Deluxe Room 302',type:'Deluxe',capacity:2,floor:'3rd',status:'Reserved',guest:'Vikram Nair',checkIn:'Nov 15',checkOut:'Nov 16',rate:8500,img:'room1'},
  ];

  const render = (evId) => {
    const c = document.getElementById('tab-accommodation');
    if (!c) return;
    const occupied  = ROOMS.filter(r=>r.status==='Occupied').length;
    const reserved  = ROOMS.filter(r=>r.status==='Reserved').length;
    const available = ROOMS.filter(r=>r.status==='Available').length;
    const totalCost = ROOMS.filter(r=>r.status!=='Available').reduce((a,b)=>a+b.rate*2,0);

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">🏨 Accommodation</div>
          <div class="mod-subtitle">${ROOMS.length} rooms · ${occupied} occupied · ${available} available</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-primary btn-sm" onclick="AccommodationModule.addRoom('${evId}')">+ Add Room</button>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${[
          {icon:'🏨',label:'Total Rooms',val:ROOMS.length,color:'var(--brand)'},
          {icon:'✓',label:'Occupied',val:occupied,color:'var(--danger)'},
          {icon:'📋',label:'Reserved',val:reserved,color:'var(--warning)'},
          {icon:'✅',label:'Available',val:available,color:'var(--success)'},
          {icon:'💰',label:'Total Cost',val:'₹'+totalCost.toLocaleString('en-IN'),color:'var(--brand)'},
        ].map(s=>`
          <div class="card-sm card" style="padding:14px;text-align:center">
            <div style="font-size:22px">${s.icon}</div>
            <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:${s.color};margin:4px 0">${s.val}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Room Grid -->
      <div class="accom-rooms-grid" style="margin-bottom:24px">
        ${ROOMS.map(r => `
          <div class="room-card hover-lift-sm">
            <div class="room-card-img">
              <img src="${IMGS[r.img]}?w=300&q=75&auto=format&fit=crop" alt="${r.name}" loading="lazy">
              <div style="position:absolute;top:8px;right:8px">
                <span class="badge ${r.status==='Available'?'badge-green':r.status==='Occupied'?'badge-red':'badge-amber'}">${r.status}</span>
              </div>
            </div>
            <div class="room-card-body">
              <div class="room-card-name">${r.name}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${r.type} · Floor ${r.floor} · ${r.capacity} guests</div>
              <div style="font-size:13px;font-weight:700;color:var(--brand)">₹${r.rate.toLocaleString('en-IN')}/night</div>
              ${r.guest ? `
                <div style="margin-top:8px;padding:8px;background:var(--bg-subtle);border-radius:var(--r-sm)">
                  <div style="font-size:12px;font-weight:700;color:var(--text-primary)">👤 ${r.guest}</div>
                  <div style="font-size:11px;color:var(--text-muted)">📅 ${r.checkIn} → ${r.checkOut}</div>
                </div>` : `<div style="margin-top:8px"><button class="btn btn-primary btn-xs btn-full" onclick="AccommodationModule.assignRoom('${r.id}','${evId}')">Assign Guest</button></div>`}
            </div>
          </div>`).join('')}

        <!-- Add Room -->
        <div class="room-card" style="border:2px dashed var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:250px" onclick="AccommodationModule.addRoom('${evId}')">
          <div style="text-align:center;color:var(--text-subtle)"><div style="font-size:36px;margin-bottom:6px">🏨</div><div style="font-size:13px;font-weight:600">Add Room</div></div>
        </div>
      </div>

      <!-- Guest-Room Assignments Table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 20px;background:var(--bg-subtle);border-bottom:1px solid var(--border);font-size:14px;font-weight:700">📋 Room Assignment List</div>
        <table class="data-table">
          <thead><tr><th>Room</th><th>Type</th><th>Guest</th><th>Check-In</th><th>Check-Out</th><th>Rate</th><th>Status</th></tr></thead>
          <tbody>
            ${ROOMS.map(r=>`
              <tr>
                <td style="font-weight:700">${r.name}</td>
                <td><span class="badge badge-gray">${r.type}</span></td>
                <td>${r.guest||'<span style="color:var(--text-subtle)">—</span>'}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${r.checkIn||'—'}</td>
                <td style="font-family:var(--font-mono);font-size:12px">${r.checkOut||'—'}</td>
                <td style="font-family:var(--font-mono);font-weight:700">₹${r.rate.toLocaleString('en-IN')}</td>
                <td><span class="badge ${r.status==='Available'?'badge-green':r.status==='Occupied'?'badge-red':'badge-amber'}">${r.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  };

  const assignRoom = (roomId, evId) => {
    const guests = EventoraDB.getGuests(evId);
    Modal.open('Assign Guest to Room',
      `<div class="form-group"><label class="form-label">Select Guest *</label>
       <select class="input" id="assignGuest">
         <option value="">— Choose a guest —</option>
         ${guests.map(g=>`<option value="${g.id}">${g.name} (${g.role||'Guest'})</option>`).join('')}
       </select></div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Check-In Date</label><input class="input" id="assignIn" type="date"></div>
         <div class="form-group"><label class="form-label">Check-Out Date</label><input class="input" id="assignOut" type="date"></div>
       </div>
       <div class="form-group"><label class="form-label">Special Requests</label><textarea class="input" id="assignReq" rows="2" placeholder="e.g., Extra bed, quiet floor..."></textarea></div>`,
      () => Toast.show('success','Room Assigned',''), 'Assign Room');
  };

  const addRoom = (evId) => {
    Modal.open('Add Room',
      `<div class="form-group"><label class="form-label">Room Name / Number *</label><input class="input" id="rnName" placeholder="e.g., Deluxe Room 301"></div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Type</label><select class="input" id="rnType"><option>Standard</option><option>Deluxe</option><option>Suite</option><option>Presidential Suite</option></select></div>
         <div class="form-group"><label class="form-label">Floor</label><input class="input" id="rnFloor" placeholder="e.g., 3rd"></div>
       </div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Capacity (guests)</label><input class="input" id="rnCap" type="number" value="2"></div>
         <div class="form-group"><label class="form-label">Rate (₹/night)</label><input class="input" id="rnRate" type="number" placeholder="e.g., 8500"></div>
       </div>`,
      () => Toast.show('success','Room Added',''), 'Add Room');
  };

  return { render, assignRoom, addRoom };
})();
