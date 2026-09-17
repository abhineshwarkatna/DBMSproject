/**
 * EVENTORA 3.0 — Vendor Marketplace Module
 */
window.VendorsModule = (() => {
  let filterCat = 'All', searchQ = '';

  const CATS = ['All','Catering','Photography & Media','Decor','Audio/Visual & DJ','Security','Transport','Stage & Production','Photo Booth'];

  const render = (evId) => {
    const c = document.getElementById('tab-vendors');
    if (!c) return;
    const bookings = EventoraDB.getBookings(evId);
    const catalog  = EventoraDB.getVendorCatalog();
    const bookedIds = bookings.map(b => b.vendorId);

    let filtered = catalog.filter(v => {
      if (filterCat !== 'All' && v.category !== filterCat) return false;
      if (searchQ && !v.name.toLowerCase().includes(searchQ.toLowerCase()) && !v.category.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });

    const totalCost = bookings.reduce((a, b) => a + (b.cost || 0), 0);

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">🤝 Vendor Marketplace</div>
          <div class="mod-subtitle">${bookings.length} booked · ${catalog.length} available · ${EventoraDB.formatCurrency(totalCost)} committed</div>
        </div>
        <div class="mod-actions">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input class="input input-sm" placeholder="Search vendors..." value="${searchQ}" oninput="VendorsModule.setSearch(this.value,'${evId}')">
          </div>
          <button class="btn btn-primary btn-sm" onclick="VendorsModule.addCustomVendor('${evId}')">+ Custom Vendor</button>
        </div>
      </div>

      <!-- Booked Vendors -->
      ${bookings.length > 0 ? `
      <div class="workspace-section">
        <div class="workspace-section-title">✅ Your Booked Vendors <span class="badge badge-green">${bookings.length}</span></div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="data-table">
            <thead><tr><th>Vendor</th><th>Service</th><th>Cost</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${bookings.map(b => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:36px;height:36px;border-radius:var(--r-sm);overflow:hidden;flex-shrink:0">
                        <img src="${IMGS[catalog.find(v=>v.id===b.vendorId)?.img||'photography']}?w=100&q=70" style="width:100%;height:100%;object-fit:cover" alt="">
                      </div>
                      <div>
                        <div style="font-size:14px;font-weight:700">${b.vendorName}</div>
                        <div style="font-size:12px;color:var(--text-muted)">${b.vendorId ? '✓ Verified' : 'Custom'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge badge-gray">${b.service}</span></td>
                  <td style="font-family:var(--font-mono);font-weight:700;color:var(--brand)">${EventoraDB.formatCurrency(b.cost)}</td>
                  <td>
                    <select style="border:1.5px solid var(--border);border-radius:var(--r-sm);padding:4px 8px;font-size:12px;font-weight:600;background:${b.status==='Confirmed'?'var(--success-bg)':'var(--warning-bg)'};color:${b.status==='Confirmed'?'var(--success)':'var(--warning)'}"
                      onchange="VendorsModule.updateStatus('${evId}','${b.id}',this.value)">
                      <option ${b.status==='Confirmed'?'selected':''}>Confirmed</option>
                      <option ${b.status==='Pending'?'selected':''}>Pending</option>
                      <option ${b.status==='Cancelled'?'selected':''}>Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <button class="btn btn-ghost btn-xs" onclick="VendorsModule.viewVendor('${evId}','${b.vendorId||''}')" style="margin-right:4px">👁️</button>
                    <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="VendorsModule.removeBooking('${evId}','${b.id}')">✕</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <!-- Find Vendors -->
      <div class="workspace-section">
        <div class="workspace-section-title">🔍 Find & Book Vendors</div>

        <!-- Category filter -->
        <div class="filter-bar" style="overflow-x:auto;flex-wrap:nowrap">
          ${CATS.map(cat => `<div class="filter-chip ${filterCat===cat?'active':''}" style="flex-shrink:0" onclick="VendorsModule.setFilter('${cat}','${evId}')">${cat}</div>`).join('')}
        </div>

        <!-- Vendor grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;margin-top:16px">
          ${filtered.map(v => {
            const isBooked = bookedIds.includes(v.id);
            return `
            <div class="vendor-marketplace-card">
              <div class="vendor-card-img img-hover-zoom">
                <img src="${IMGS[v.img]}?w=500&q=80&auto=format&fit=crop" alt="${v.name}" loading="lazy"
                     onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1555244162-803834f70033?w=500&q=80&auto=format&fit=crop'">
                ${v.verified ? `<div style="position:absolute;top:10px;right:10px;background:var(--success);color:#fff;border-radius:var(--r-full);padding:3px 10px;font-size:10px;font-weight:700">✓ Verified</div>` : ''}
              </div>
              <div class="vendor-card-body">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--brand);margin-bottom:4px">${v.category}</div>
                <div class="vendor-card-name">${v.name}</div>
                <div class="vendor-card-cat">${v.contact} · ${v.city}</div>
                <div style="font-size:13px;color:var(--text-muted);margin:6px 0 10px">${v.desc}</div>
                <div class="vendor-card-foot">
                  <div>
                    <div class="vendor-card-rating">★ ${v.rating}</div>
                    <div class="vendor-card-price">from ${EventoraDB.formatCurrency(v.price)}${v.priceUnit?'/'+v.priceUnit:''}</div>
                  </div>
                  ${isBooked ?
                    `<span class="badge badge-green">✓ Booked</span>` :
                    `<div style="display:flex;gap:6px">
                      <button class="btn btn-secondary btn-xs" onclick="VendorsModule.viewVendor('${evId}','${v.id}')">View</button>
                      <button class="btn btn-primary btn-xs" onclick="VendorsModule.bookVendor('${evId}','${v.id}')">Book</button>
                    </div>`}
                </div>
              </div>
            </div>`;
          }).join('') || '<div class="empty-state"><div class="empty-icon">🤝</div><div class="empty-title">No vendors found</div></div>'}
        </div>
      </div>`;
  };

  const setFilter = (cat, evId) => { filterCat = cat; render(evId); };
  const setSearch = (q, evId) => { searchQ = q; render(evId); };
  const updateStatus = (evId, bId, status) => { EventoraDB.updateBooking(evId, bId, { status }); render(evId); };
  const removeBooking = (evId, bId) => { EventoraDB.deleteBooking(evId, bId); Toast.show('info','Vendor Removed',''); render(evId); };

  const bookVendor = (evId, vendorId) => {
    const v = EventoraDB.getVendorCatalog().find(x => x.id === vendorId);
    if (!v) return;
    Modal.open(`Book ${v.name}`,
      `<div style="display:flex;gap:12px;margin-bottom:16px;padding:12px;background:var(--bg-subtle);border-radius:var(--r-md)">
        <img src="${IMGS[v.img]}?w=80&q=80" style="width:64px;height:64px;object-fit:cover;border-radius:var(--r-sm)" alt="">
        <div><div style="font-size:15px;font-weight:700">${v.name}</div><div style="font-size:12px;color:var(--text-muted)">${v.category} · ★ ${v.rating}</div>
          <div style="font-size:13px;color:var(--brand);font-weight:700">from ${EventoraDB.formatCurrency(v.price)}${v.priceUnit?'/'+v.priceUnit:''}</div></div>
      </div>
      <div class="form-group"><label class="form-label">Service Description</label><input class="input" id="bkService" value="${v.category}" placeholder="Describe the service"></div>
      <div class="form-group"><label class="form-label">Agreed Cost (₹)</label><div class="currency-input-wrap"><span class="currency-prefix">₹</span><input class="input" id="bkCost" type="number" value="${v.price}" style="padding-left:32px"></div></div>
      <div class="form-group"><label class="form-label">Status</label><select class="input" id="bkStatus"><option>Confirmed</option><option>Pending</option></select></div>
      <div class="form-group"><label class="form-label">Notes</label><textarea class="input" id="bkNotes" rows="2" placeholder="Any special requirements..."></textarea></div>`,
      () => {
        EventoraDB.addBooking(evId, {
          vendorId: v.id, vendorName: v.name,
          service: document.getElementById('bkService')?.value || v.category,
          cost: parseInt(document.getElementById('bkCost')?.value) || v.price,
          status: document.getElementById('bkStatus')?.value || 'Confirmed',
          notes: document.getElementById('bkNotes')?.value || '',
        });
        Toast.show('success','Vendor Booked!', `${v.name} added to your event.`);
        render(evId);
      }, 'Confirm Booking');
  };

  const viewVendor = (evId, vendorId) => {
    const v = EventoraDB.getVendorCatalog().find(x => x.id === vendorId);
    if (!v) return;
    Modal.open(v.name, `
      <img src="${IMGS[v.img]}?w=800&q=80&auto=format&fit=crop" style="width:100%;height:200px;object-fit:cover;border-radius:var(--r-md);margin-bottom:16px" alt="">
      <div class="badge badge-violet mb-3">${v.category}</div>
      <div style="font-size:14px;color:var(--text-secondary);margin-bottom:12px">${v.desc}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="padding:10px;background:var(--bg-subtle);border-radius:var(--r-sm)"><div style="font-size:11px;color:var(--text-muted)">Contact</div><div style="font-weight:700">${v.contact}</div></div>
        <div style="padding:10px;background:var(--bg-subtle);border-radius:var(--r-sm)"><div style="font-size:11px;color:var(--text-muted)">Location</div><div style="font-weight:700">${v.city}</div></div>
        <div style="padding:10px;background:var(--bg-subtle);border-radius:var(--r-sm)"><div style="font-size:11px;color:var(--text-muted)">Rating</div><div style="font-weight:700;color:var(--warning)">★ ${v.rating}</div></div>
        <div style="padding:10px;background:var(--bg-subtle);border-radius:var(--r-sm)"><div style="font-size:11px;color:var(--text-muted)">Starting Price</div><div style="font-weight:700;color:var(--brand)">${EventoraDB.formatCurrency(v.price)}</div></div>
      </div>
      <button class="btn btn-primary btn-full" onclick="Modal.close();VendorsModule.bookVendor('${evId}','${v.id}')">📅 Book This Vendor</button>`);
  };

  const addCustomVendor = (evId) => {
    Modal.open('Add Custom Vendor',
      `<div class="form-group"><label class="form-label">Vendor Name *</label><input class="input" id="cvName" placeholder="e.g., XYZ Decorators"></div>
       <div class="form-group"><label class="form-label">Contact Person</label><input class="input" id="cvContact" placeholder="Contact name & phone"></div>
       <div class="form-group"><label class="form-label">Category *</label><select class="input" id="cvCat"><option>Catering</option><option>Photography & Media</option><option>Decor</option><option>Audio/Visual & DJ</option><option>Transport</option><option>Security</option><option>Other</option></select></div>
       <div class="form-group"><label class="form-label">Cost (₹)</label><input class="input" id="cvCost" type="number" placeholder="0"></div>`,
      () => {
        const name = document.getElementById('cvName')?.value?.trim();
        if (!name) { Toast.show('warning','Name required',''); return; }
        EventoraDB.addBooking(evId, {
          vendorName: name, service: document.getElementById('cvCat')?.value || 'Other',
          cost: parseInt(document.getElementById('cvCost')?.value)||0, status:'Pending',
        });
        Toast.show('success','Vendor Added', name); render(evId);
      }, 'Add Vendor');
  };

  return { render, setFilter, setSearch, updateStatus, removeBooking, bookVendor, viewVendor, addCustomVendor };
})();
