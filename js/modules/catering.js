/**
 * EVENTORA 3.0 — Catering & Menu Module
 */
window.CateringModule = (() => {
  const MENUS = {
    starters:[
      {name:'Paneer Tikka',price:180,type:'Veg',img:'food1'},
      {name:'Chicken Malai Tikka',price:280,type:'Non-Veg',img:'food2'},
      {name:'Veg Spring Rolls',price:150,type:'Veg',img:'food1'},
      {name:'Seekh Kebab',price:260,type:'Non-Veg',img:'food2'},
      {name:'Stuffed Mushrooms',price:200,type:'Veg',img:'food1'},
    ],
    mains:[
      {name:'Dal Makhani',price:220,type:'Veg',img:'food2'},
      {name:'Butter Chicken',price:340,type:'Non-Veg',img:'food2'},
      {name:'Paneer Butter Masala',price:260,type:'Veg',img:'food1'},
      {name:'Biryani (Chicken)',price:380,type:'Non-Veg',img:'food2'},
      {name:'Veg Biryani',price:280,type:'Veg',img:'food1'},
      {name:'Naan / Roti',price:40,type:'Veg',img:'food1'},
    ],
    desserts:[
      {name:'Gulab Jamun',price:120,type:'Veg',img:'food1'},
      {name:'Rasmalai',price:180,type:'Veg',img:'food1'},
      {name:'Ice Cream Station',price:250,type:'Veg',img:'food1'},
      {name:'Kheer',price:140,type:'Veg',img:'food1'},
    ],
    beverages:[
      {name:'Welcome Sharbat',price:60,type:'Veg',img:'food1'},
      {name:'Soft Drinks',price:50,type:'Veg',img:'food1'},
      {name:'Masala Chai',price:40,type:'Veg',img:'food1'},
      {name:'Fresh Juice Counter',price:120,type:'Veg',img:'food1'},
    ]
  };

  const render = (evId) => {
    const c = document.getElementById('tab-catering');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);
    const guests = EventoraDB.getGuests(evId).length || 0;

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">🍽️ Catering & Menu</div>
          <div class="mod-subtitle">Plan food and beverage offerings for ${guests} guests</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-primary btn-sm" onclick="CateringModule.openCounterSetup('${evId}')">⚙️ Counter Setup</button>
        </div>
      </div>

      <!-- Stats bar -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
        ${[
          {icon:'🍽️',label:'Food Counters',val:'4 Planned'},
          {icon:'🥗',label:'Veg Items',val:Object.values(MENUS).flat().filter(i=>i.type==='Veg').length},
          {icon:'🍗',label:'Non-Veg Items',val:Object.values(MENUS).flat().filter(i=>i.type==='Non-Veg').length},
          {icon:'💰',label:'Cost/Plate (Est.)',val:'₹850'},
          {icon:'👥',label:'Total Plates',val:guests||'—'},
        ].map(s=>`
          <div class="card-sm card" style="padding:16px;text-align:center">
            <div style="font-size:22px;margin-bottom:6px">${s.icon}</div>
            <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--brand)">${s.val}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Dietary requirement bar -->
      <div class="card" style="margin-bottom:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:12px">🥗 Dietary Requirements from Guest List</div>
        ${(() => {
          const guests_list = EventoraDB.getGuests(evId);
          const diets = {};
          guests_list.forEach(g => { const d = g.dietary||'No restriction'; diets[d]=(diets[d]||0)+1; });
          const total = guests_list.length || 1;
          return Object.entries(diets).map(([diet,count]) => `
            <div class="budget-bar-row">
              <div class="budget-bar-header"><span class="budget-bar-label">${diet}</span><span class="budget-bar-vals">${count} guests (${Math.round(count/total*100)}%)</span></div>
              <div class="prog-track"><div class="prog-fill brand" style="width:${Math.round(count/total*100)}%"></div></div>
            </div>`).join('') || '<div style="color:var(--text-muted);font-size:13px">Add guests with dietary preferences to see breakdown.</div>';
        })()}
      </div>

      <!-- Menu sections -->
      ${Object.entries(MENUS).map(([section, items]) => `
        <div class="menu-section">
          <div class="menu-section-title">${{starters:'🥗 Starters & Appetizers',mains:'🍛 Main Course',desserts:'🍮 Desserts',beverages:'🥤 Beverages'}[section]||section}</div>
          <div class="menu-items-grid">
            ${items.map(item => `
              <div class="menu-item-card hover-lift-sm">
                <div class="menu-item-img img-hover-zoom">
                  <img src="${IMGS[item.img]}?w=300&q=70&auto=format&fit=crop" alt="${item.name}" loading="lazy">
                  <div style="position:absolute;top:8px;right:8px">
                    <span class="badge ${item.type==='Veg'?'badge-green':'badge-red'}" style="font-size:10px">${item.type==='Veg'?'🟢 Veg':'🔴 Non-Veg'}</span>
                  </div>
                </div>
                <div class="menu-item-body">
                  <div class="menu-item-name">${item.name}</div>
                  <div class="menu-item-price">₹${item.price}/plate</div>
                </div>
              </div>`).join('')}
            <div class="menu-item-card" style="border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;min-height:160px" onclick="Toast.show('info','Add Item','Custom menu item builder coming soon!')">
              <div style="text-align:center;color:var(--text-subtle)">
                <div style="font-size:32px;margin-bottom:6px">+</div>
                <div style="font-size:13px;font-weight:600">Add Custom Item</div>
              </div>
            </div>
          </div>
        </div>`).join('')}

      <!-- Summary -->
      <div class="card" style="background:linear-gradient(135deg,var(--brand-light),var(--accent-light));border-color:var(--brand-mid)">
        <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:12px">🧾 Estimated Catering Cost</div>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:13px;color:var(--text-muted)">₹850/plate × ${guests} guests</div>
            <div style="font-family:var(--font-head);font-size:28px;font-weight:900;color:var(--brand)">₹${(850*guests).toLocaleString('en-IN')}</div>
          </div>
          <button class="btn btn-primary" onclick="App.switchTab('budget')">Add to Budget →</button>
        </div>
      </div>`;
  };

  const openCounterSetup = (evId) => {
    Modal.open('Food Counter Setup',
      `<div class="form-group"><label class="form-label">Number of Counters</label>
       <select class="input" id="counterCount"><option>2</option><option selected>4</option><option>6</option><option>8</option></select></div>
       <div class="form-group"><label class="form-label">Counter Style</label>
       <select class="input" id="counterStyle"><option>Buffet</option><option>Live Cooking</option><option>Tray Service</option></select></div>
       <div class="form-group"><label class="form-label">Serving Time</label>
       <input class="input" id="counterTime" placeholder="e.g., 13:00 – 15:00"></div>
       <div class="form-group"><label class="form-label">Special Requirements</label>
       <textarea class="input" id="counterNotes" rows="2" placeholder="e.g., Jain food section, allergy-free counter..."></textarea></div>`,
      () => Toast.show('success','Counter Setup Saved',''), 'Save Setup');
  };

  return { render, openCounterSetup };
})();
