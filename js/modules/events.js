/**
 * EVENTORA 3.0 — Event Creation Wizard (Premium Visual)
 */
window.WizardModule = (() => {
  let step = 1;
  const totalSteps = 6;
  let data = {};

  const CATEGORIES = {
    'Wedding':     { icon:'💍', img:'wedding',   subs:['Hindu Wedding','Christian Wedding','Muslim Wedding','Destination Wedding','Reception','Engagement','Custom'] },
    'Birthday':    { icon:'🎂', img:'birthday',  subs:['Kids Birthday','18th Birthday','25th Birthday','50th Milestone','Surprise Party','Custom'] },
    'Corporate':   { icon:'💼', img:'corporate', subs:['Conference','Seminar','Product Launch','Annual Meet','Team Outing','Award Night','AGM','Custom'] },
    'Hackathon':   { icon:'💻', img:'hackathon', subs:['24Hr Hackathon','48Hr Hackathon','Design Sprint','Ideathon','Coding Competition','Custom'] },
    'Concert':     { icon:'🎵', img:'concert',   subs:['Live Band','DJ Night','Classical','Folk','Comedy Night','Open Mic','Custom'] },
    'Festival':    { icon:'🎉', img:'festival',  subs:['Cultural Festival','Food Festival','Art Festival','Music Festival','Film Festival','Custom'] },
    'Exhibition':  { icon:'🖼️', img:'exhibition',subs:['Art Exhibition','Trade Show','Product Showcase','Job Fair','Custom'] },
    'Sports':      { icon:'🏆', img:'sports',    subs:['Cricket Tournament','Football','Marathon','Chess','Badminton','Athletics','Custom'] },
    'Charity':     { icon:'❤️', img:'charity',   subs:['Fundraiser','Awareness Drive','Community Service','Blood Donation','Custom'] },
    'Engagement':  { icon:'💌', img:'engagement',subs:['Ring Ceremony','Mehendi','Sangeet','Engagement Party','Custom'] },
    'Party':       { icon:'🎊', img:'party',     subs:['House Party','Pool Party','Theme Party','Farewell','Baby Shower','Custom'] },
    'Virtual':     { icon:'💻', img:'virtual',   subs:['Webinar','Virtual Conference','Online Workshop','Hybrid Event','Custom'] },
    'Custom':      { icon:'✨', img:'custom',  subs:['I will define it myself'] },
  };

  const VENUES = [
    { id:'hotel',       icon:'🏨', img:'hotel',      name:'Hotel / Banquet', desc:'Premium halls & ballrooms' },
    { id:'outdoor',     icon:'🌳', img:'outdoor',     name:'Open Ground',     desc:'Parks, lawns, beaches' },
    { id:'office',      icon:'🏢', img:'office',      name:'My Office',       desc:'Corporate campus' },
    { id:'college',     icon:'🎓', img:'college',     name:'My College',      desc:'Campus venues' },
    { id:'restaurant',  icon:'🍽️', img:'restaurant',  name:'Restaurant',      desc:'Dining & celebration' },
    { id:'banquet',     icon:'🎪', img:'banquet',     name:'Community Hall',  desc:'Local event halls' },
    { id:'rented',      icon:'📍', img:'hotel',       name:'Rented Venue',    desc:'Book any venue' },
    { id:'online',      icon:'💻', img:'virtual',     name:'Online',          desc:'Virtual event space' },
  ];

  const MODULES = [
    { id:'Guests',    icon:'👥', name:'Guest Management', desc:'RSVP tracking, check-in, dietary preferences', default:true },
    { id:'Budget',    icon:'💰', name:'Budget & Payments', desc:'Track expenses and vendor payments', default:true },
    { id:'Vendors',   icon:'🤝', name:'Vendor Marketplace', desc:'Book photographers, caterers, DJs, decorators', default:true },
    { id:'Tasks',     icon:'✅', name:'Tasks & Checklist', desc:'Track all planning tasks and milestones', default:true },
    { id:'Venue',     icon:'🏠', name:'Venue & Floor Plan', desc:'Interactive drag-and-drop space designer', default:true },
    { id:'Schedule',  icon:'📅', name:'Event Schedule', desc:'Build a detailed timeline for your event', default:true },
    { id:'Catering',  icon:'🍽️', name:'Catering & Menu', desc:'Plan menus, dietary requirements, counters', default:false },
    { id:'Transport', icon:'🚌', name:'Transportation', desc:'Vehicle fleet, routes, driver management', default:false },
    { id:'Accommodation', icon:'🏨', name:'Accommodation', desc:'Room assignments for guests and speakers', default:false },
    { id:'Invitations', icon:'✉️', name:'Invitations', desc:'Design and send beautiful digital invitations', default:false },
    { id:'Media',     icon:'📷', name:'Media Gallery', desc:'Photos, videos, documents for your event', default:false },
    { id:'Live',      icon:'🔴', name:'Live Control Center', desc:'Real-time event day management', default:true },
  ];

  const reset = () => {
    step = 1;
    data = { modules: MODULES.filter(m => m.default).map(m => m.id) };
    // Set default date (30 days from now)
    const d = new Date(); d.setDate(d.getDate() + 30);
    const dateInput = document.getElementById('wz3-date');
    if (dateInput) dateInput.valueAsDate = d;
    renderStep();
    updateProgress();
  };

  const preselectCategory = (cat) => {
    if (CATEGORIES[cat]) { data.category = cat; renderStep(); }
  };

  const renderStep = () => {
    // Step indicators
    document.querySelectorAll('.wz-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === step);
      el.classList.toggle('done', i + 1 < step);
      const dot = el.querySelector('.wz-dot');
      if (dot) dot.textContent = i + 1 < step ? '✓' : i + 1;
    });
    // Connectors
    document.querySelectorAll('.wz-connector').forEach((el, i) => {
      el.style.background = i < step - 1 ? 'var(--success)' : 'var(--border)';
    });
    // Panels
    document.querySelectorAll('.wizard-panel').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === step);
    });
    // Footer buttons
    const prev = document.getElementById('wizPrev');
    const next = document.getElementById('wizNext');
    const create = document.getElementById('wizCreate');
    const lbl = document.getElementById('wizStepLabel');
    if (prev) prev.style.display = step > 1 ? 'flex' : 'none';
    if (next) next.style.display = step < totalSteps ? 'flex' : 'none';
    if (create) create.style.display = step === totalSteps ? 'flex' : 'none';
    if (lbl) lbl.textContent = `Step ${step} of ${totalSteps}`;
    // Render content for this step
    if (step === 1) renderStep1();
    if (step === 2) renderStep2();
    if (step === 4) renderStep4();
    if (step === 5) renderStep5();
    if (step === 6) renderStep6();
  };

  const renderStep1 = () => {
    const grid = document.getElementById('wz1CatGrid');
    if (!grid) return;
    grid.innerHTML = Object.entries(CATEGORIES).map(([id, cat]) => `
      <div class="wz-cat-card ${data.category === id ? 'selected' : ''}" onclick="WizardModule.selectCategory('${id}')">
        <div class="wz-cat-sel-check">✓</div>
        <div class="wz-cat-img">
          <img src="${IMGS[cat.img]}?w=280&q=75&auto=format&fit=crop" alt="${id}" loading="lazy"
               onerror="this.onerror=null;this.src='${IMGS.party}?w=280&q=75&auto=format&fit=crop'">
        </div>
        <div class="wz-cat-label">
          <div class="wz-cat-name">${cat.icon} ${id}</div>
        </div>
      </div>`).join('');
    renderSubcats();
  };

  const renderSubcats = () => {
    const area = document.getElementById('wz1SubcatArea');
    if (!area) return;
    if (!data.category) { area.innerHTML = ''; return; }
    const cat = CATEGORIES[data.category];
    area.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:10px">Choose a specific type:</div>
      <div class="subcat-pills">
        ${cat.subs.map(s => `
          <div class="subcat-pill ${data.subcat === s ? 'selected' : ''}" onclick="WizardModule.selectSubcat('${s}')">${s}</div>
        `).join('')}
      </div>`;
  };

  const selectCategory = (cat) => {
    data.category = cat; data.subcat = null;
    document.querySelectorAll('.wz-cat-card').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    // Auto set title placeholder
    const titleInput = document.getElementById('wz3-title');
    if (titleInput && !titleInput.value) {
      const suggestions = {
        Wedding: "Your Dream Wedding", Birthday: "Birthday Celebration",
        Corporate: "Company Event", Hackathon: "Hackathon 2026",
        Concert: "Live Concert", Festival: "Festival Event",
      };
      titleInput.placeholder = suggestions[cat] || `${cat} Event`;
    }
    renderSubcats();
  };

  const selectSubcat = (s) => {
    data.subcat = s;
    document.querySelectorAll('.subcat-pill').forEach(el => el.classList.toggle('selected', el.textContent.trim() === s));
  };

  const renderStep2 = () => {
    const grid = document.getElementById('wz2VenueGrid');
    if (!grid) return;
    // Reset "My Own Place" style
    const ownPlace = document.getElementById('wz2OwnPlace');
    if (ownPlace) ownPlace.classList.toggle('selected', data.venueType === 'home');
    grid.innerHTML = VENUES.filter(v => v.id !== 'home').map(v => `
      <div class="wz-venue-card ${data.venueType === v.id ? 'selected' : ''}" onclick="WizardModule.selectVenue('${v.id}')">
        <div class="wz-venue-img">
          <img src="${IMGS[v.img]}?w=300&q=75&auto=format&fit=crop" alt="${v.name}" loading="lazy"
               onerror="this.onerror=null;this.src='${IMGS.hotel}?w=300&q=75&auto=format&fit=crop'">
        </div>
        <div class="wz-venue-label">
          <div class="wz-venue-name">${v.icon} ${v.name}</div>
          <div class="wz-venue-desc">${v.desc}</div>
        </div>
      </div>`).join('');
    renderVenueDetail();
  };

  const selectVenue = (id) => {
    data.venueType = id;
    // Update UI
    const ownPlace = document.getElementById('wz2OwnPlace');
    if (ownPlace) ownPlace.classList.toggle('selected', id === 'home');
    document.querySelectorAll('.wz-venue-card').forEach(el => el.classList.remove('selected'));
    if (id !== 'home') {
      const card = document.querySelector(`.wz-venue-card[onclick*="'${id}'"]`);
      if (card) card.classList.add('selected');
    }
    renderVenueDetail();
  };

  const renderVenueDetail = () => {
    const area = document.getElementById('wz2VenueDetail');
    if (!area) return;
    if (!data.venueType) { area.innerHTML = ''; return; }
    if (data.venueType === 'home') {
      area.innerHTML = `
        <div class="card" style="border-color:var(--brand);background:var(--brand-light)">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
            <span style="font-size:24px">🏠</span>
            <span style="font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--brand)">Set up your own place</span>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Property Name</label>
              <input class="input" id="wz2VenueName" placeholder="e.g., My Home, Sharma Residence" value="${data.venueName||''}">
            </div>
            <div class="form-group">
              <label class="form-label">City / Area</label>
              <input class="input" id="wz2VenueCity" placeholder="e.g., Banjara Hills, Hyderabad" value="${data.venueCity||''}">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Full Address</label>
            <input class="input" id="wz2VenueAddr" placeholder="Street address" value="${data.venueAddr||''}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Capacity (max people)</label>
              <input class="input" id="wz2Capacity" type="number" placeholder="e.g., 200" value="${data.venueCapacity||''}">
            </div>
            <div class="form-group">
              <label class="form-label">Available Facilities</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
                ${['Parking','Generator','Catering Kitchen','AV Setup','Air Conditioning','WiFi','Restrooms','Security'].map(f => `
                  <span class="subcat-pill ${(data.venueFacilities||[]).includes(f)?'selected':''}"
                        onclick="WizardModule.toggleFacility('${f}')" style="font-size:11px">${f}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>`;
    } else {
      const v = VENUES.find(v => v.id === data.venueType);
      area.innerHTML = `
        <div class="form-group">
          <label class="form-label">Venue Name / Address</label>
          <input class="input" id="wz2VenueName" placeholder="Enter venue name or address" value="${data.venueName||''}">
        </div>`;
    }
    // Bind inputs
    setTimeout(() => {
      ['wz2VenueName','wz2VenueCity','wz2VenueAddr','wz2Capacity'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = saveVenueData;
      });
    }, 50);
  };

  const toggleFacility = (f) => {
    if (!data.venueFacilities) data.venueFacilities = [];
    const idx = data.venueFacilities.indexOf(f);
    if (idx >= 0) data.venueFacilities.splice(idx, 1);
    else data.venueFacilities.push(f);
    document.querySelectorAll(`.subcat-pill`).forEach(el => {
      if (el.textContent.trim() === f) el.classList.toggle('selected', data.venueFacilities.includes(f));
    });
  };

  const saveVenueData = () => {
    data.venueName = document.getElementById('wz2VenueName')?.value || '';
    data.venueCity = document.getElementById('wz2VenueCity')?.value || '';
    data.venueAddr = document.getElementById('wz2VenueAddr')?.value || '';
    data.venueCapacity = document.getElementById('wz2Capacity')?.value || '';
  };

  const renderStep4 = () => {
    const presets = document.getElementById('wz4Presets');
    if (presets) {
      presets.innerHTML = [25000,50000,100000,250000,500000,1000000,2500000].map(v => {
        const label = v >= 100000 ? `₹${v/100000}L` : `₹${v/1000}K`;
        return `<div class="budget-preset" onclick="document.getElementById('wz4-budget').value=${v};WizardModule.updateBudgetBreakdown()">${label}</div>`;
      }).join('');
    }
    updateBudgetBreakdown();
  };

  const updateBudgetBreakdown = () => {
    const budget = parseInt(document.getElementById('wz4-budget')?.value) || 0;
    const breakdown = document.getElementById('wz4Breakdown');
    if (!breakdown) return;
    if (!budget) { breakdown.innerHTML = ''; return; }
    const allocations = [
      { label:'Catering & Food', pct:35, icon:'🍽️', color:'var(--brand)' },
      { label:'Venue & Decor', pct:20, icon:'🏠', color:'#8B5CF6' },
      { label:'Photography', pct:12, icon:'📸', color:'#06B6D4' },
      { label:'Entertainment & DJ', pct:8, icon:'🎵', color:'#F59E0B' },
      { label:'Transport', pct:5, icon:'🚌', color:'#10B981' },
      { label:'Invitations', pct:3, icon:'✉️', color:'#EC4899' },
      { label:'Contingency', pct:7, icon:'🛡️', color:'#6B7280' },
    ];
    breakdown.innerHTML = `
      <div class="card" style="margin-top:20px">
        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:16px">💡 Smart Budget Allocation</div>
        ${allocations.map(a => {
          const amt = Math.round(budget * a.pct / 100);
          return `
            <div class="budget-bar-row">
              <div class="budget-bar-header">
                <span style="font-size:13px;color:var(--text-secondary)">${a.icon} ${a.label}</span>
                <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${EventoraDB.formatCurrency(amt)} <span style="color:var(--text-subtle);font-weight:400">(${a.pct}%)</span></span>
              </div>
              <div class="prog-track"><div class="prog-fill gradient" style="width:${a.pct}%;background:${a.color};opacity:0.8"></div></div>
            </div>`;
        }).join('')}
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;display:flex;justify-content:space-between">
          <span style="font-size:14px;font-weight:600;color:var(--text-muted)">Total Budget</span>
          <span style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--brand)">${EventoraDB.formatCurrency(budget)}</span>
        </div>
      </div>`;
  };

  const renderStep5 = () => {
    const list = document.getElementById('wz5ModulesList');
    if (!list) return;
    list.innerHTML = MODULES.map(m => `
      <div class="module-toggle ${(data.modules||[]).includes(m.id) ? 'on' : ''}" onclick="WizardModule.toggleModule('${m.id}')">
        <div class="module-toggle-icon">${m.icon}</div>
        <div class="module-toggle-info">
          <div class="module-toggle-name">${m.name}</div>
          <div class="module-toggle-desc">${m.desc}</div>
        </div>
        <div class="module-toggle-chk">${(data.modules||[]).includes(m.id) ? '✓' : ''}</div>
      </div>`).join('');
  };

  const toggleModule = (id) => {
    if (!data.modules) data.modules = [];
    const idx = data.modules.indexOf(id);
    if (idx >= 0) data.modules.splice(idx, 1);
    else data.modules.push(id);
    renderStep5();
  };

  const renderStep6 = () => {
    const panel = document.getElementById('wz-step-6');
    if (!panel) return;
    saveVenueData();
    const cat = CATEGORIES[data.category] || {};
    const catImg = IMGS[cat.img] || IMGS.wedding;
    panel.innerHTML = `
      <div class="wizard-section-title">Everything looks great!</div>
      <div class="wizard-section-sub">Review your event details before creating.</div>
      <div class="review-event-card" style="margin-bottom:20px">
        <div class="review-event-hero">
          <img src="${catImg}?w=800&q=80&auto=format&fit=crop" alt="Event cover">
          <div class="review-event-hero-overlay"></div>
          <div class="review-event-hero-info">
            <div class="review-event-name">${document.getElementById('wz3-title')?.value || `${data.category||'Your'} Event`}</div>
            <div class="review-event-type">${data.category||'Event'} ${data.subcat ? '· ' + data.subcat : ''}</div>
          </div>
        </div>
        <div class="review-event-body">
          <div class="review-row"><div class="review-row-icon">📅</div><div class="review-row-label">Date</div><div class="review-row-val">${document.getElementById('wz3-date')?.value || 'TBD'}</div></div>
          <div class="review-row"><div class="review-row-icon">⏰</div><div class="review-row-label">Time</div><div class="review-row-val">${document.getElementById('wz3-time')?.value || '18:00'}</div></div>
          <div class="review-row"><div class="review-row-icon">👥</div><div class="review-row-label">Expected Guests</div><div class="review-row-val">${document.getElementById('wz3-guests')?.value || '100'}</div></div>
          <div class="review-row"><div class="review-row-icon">📺</div><div class="review-row-label">Format</div><div class="review-row-val">${document.getElementById('wz3-format')?.value || 'Physical'}</div></div>
          <div class="review-row"><div class="review-row-icon">🏠</div><div class="review-row-label">Venue</div><div class="review-row-val">${data.venueName || (VENUES.find(v=>v.id===data.venueType)?.name) || 'TBD'}</div></div>
          <div class="review-row"><div class="review-row-icon">💰</div><div class="review-row-label">Budget</div><div class="review-row-val">${document.getElementById('wz4-budget')?.value ? EventoraDB.formatCurrency(parseInt(document.getElementById('wz4-budget').value)) : 'Not set'}</div></div>
          <div class="review-row" style="border-bottom:none"><div class="review-row-icon">⚙️</div><div class="review-row-label">Features</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-left:auto">${(data.modules||[]).map(m => `<span class="badge badge-violet" style="font-size:10px">${m}</span>`).join('')}</div></div>
        </div>
      </div>
      <div class="card" style="background:var(--success-bg);border-color:var(--success)">
        <div style="font-size:13px;font-weight:700;color:var(--success);margin-bottom:8px">✨ Smart Setup Includes</div>
        <div style="font-size:13px;color:#065F46;line-height:1.7">
          ✓ Personalized dashboard for ${data.category||'your'} event<br>
          ✓ ${(data.modules||[]).length} management modules activated<br>
          ✓ Budget allocation template<br>
          ✓ Sample schedule and task list<br>
          ✓ Vendor recommendations
        </div>
      </div>`;
  };

  const next = () => {
    if (step === 1 && !data.category) { Toast.show('warning','Choose a type','Please select an event category to continue.'); return; }
    if (step === 3) {
      const title = document.getElementById('wz3-title')?.value;
      if (!title?.trim()) { Toast.show('warning','Event name needed','Please enter a name for your event.'); return; }
    }
    if (step < totalSteps) { step++; renderStep(); updateProgress(); window.scrollTo(0,0); }
  };

  const prev = () => {
    if (step > 1) { step--; renderStep(); updateProgress(); window.scrollTo(0,0); }
  };

  const updateProgress = () => {
    const fill = document.getElementById('wizardProgressFill');
    if (fill) fill.style.width = `${((step - 1) / totalSteps) * 100}%`;
  };

  const createEvent = () => {
    saveVenueData();
    const title = document.getElementById('wz3-title')?.value?.trim() || `${data.category || 'My'} Event`;
    const budget = parseInt(document.getElementById('wz4-budget')?.value) || 0;
    const guests = parseInt(document.getElementById('wz3-guests')?.value) || 100;
    const date   = document.getElementById('wz3-date')?.value || '';
    const format = document.getElementById('wz3-format')?.value || 'Physical';
    const desc   = document.getElementById('wz3-desc')?.value || '';
    const cat    = CATEGORIES[data.category];
    const ev = EventoraDB.createEvent({
      title, category: data.category || 'Custom', subtype: data.subcat || '',
      eventDate: date, startTime: document.getElementById('wz3-time')?.value || '18:00',
      guestCapacity: guests, format, description: desc,
      budget, venueType: data.venueType || 'rented',
      venueName: data.venueName || '', venueCity: data.venueCity || '',
      venueAddr: data.venueAddr || '', venueCapacity: data.venueCapacity || '',
      venueFacilities: data.venueFacilities || [],
      modules: data.modules || [], status: 'Planning',
      coverImage: cat?.img || 'wedding',
    });
    EventoraDB.setActiveEvent(ev.id);
    Toast.show('success', '🎉 Event Created!', `"${title}" is ready. Your workspace is set up.`, 5000);
    setTimeout(() => App.goDashboard(), 800);
  };

  return { reset, preselectCategory, next, prev, renderStep, updateProgress, createEvent, selectCategory, selectSubcat, selectVenue, toggleModule, toggleFacility, updateBudgetBreakdown };
})();
