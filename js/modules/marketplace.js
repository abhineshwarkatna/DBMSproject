/**
 * EVENTORA — Customer Services & Catering Marketplace Module
 * Concept: Consumer Discovery, Multi-Category Filters, Interactive Catering Calculator,
 * Transparent Pricing & Direct Booking Integration.
 */
window.MarketplaceModule = (() => {
  let _activeCategory = 'All';
  let _searchQuery = '';
  let _activeVendor = null;
  let _selectedPackage = null;
  let _selectedGuestCount = 100;
  let _selectedAddons = [];

  const CATEGORIES = [
    { id: 'All', label: 'All Services', icon: '✨' },
    { id: 'Catering', label: 'Food & Catering', icon: '🍽️' },
    { id: 'Photography & Media', label: 'Photography', icon: '📸' },
    { id: 'Decor', label: 'Floral & Decor', icon: '🌸' },
    { id: 'Audio/Visual & DJ', label: 'DJ & Sound FX', icon: '🎵' },
    { id: 'Transport', label: 'Coaches & Cars', icon: '🚌' },
    { id: 'Security', label: 'Security & Escort', icon: '🛡️' }
  ];

  const setCategory = (cat) => {
    _activeCategory = cat;
    renderMarketplace();
  };

  const setSearch = (query) => {
    _searchQuery = (query || '').toLowerCase().trim();
    renderMarketplace();
  };

  const renderMarketplace = (targetElId = 'marketplaceContainer') => {
    const container = document.getElementById(targetElId);
    if (!container) return;

    const catalog = EventoraDB.getVendorCatalog();
    const activeEventId = EventoraDB.getActiveEventId();
    const activeEvent = EventoraDB.getEvent(activeEventId);

    const filtered = catalog.filter(v => {
      if (_activeCategory !== 'All' && v.category !== _activeCategory) return false;
      if (_searchQuery) {
        const matchName = (v.name || '').toLowerCase().includes(_searchQuery);
        const matchCat = (v.category || '').toLowerCase().includes(_searchQuery);
        const matchCity = (v.city || '').toLowerCase().includes(_searchQuery);
        const matchDesc = (v.desc || '').toLowerCase().includes(_searchQuery);
        if (!matchName && !matchCat && !matchCity && !matchDesc) return false;
      }
      return true;
    });

    container.innerHTML = `
      <div class="marketplace-wrap">
        <!-- Editorial Header -->
        <div class="marketplace-hero-hd">
          <div class="tag-pill">Curated Eventora Network</div>
          <h2 class="marketplace-title">Discover Verified Event Services</h2>
          <p class="marketplace-sub">
            From royal catering banquets to cinematic photography and luxury transport. Book verified partners coordinated directly by Eventora operations.
          </p>
        </div>

        <!-- Filter Bar -->
        <div class="mkt-filter-row">
          <div class="mkt-categories-scroll">
            ${CATEGORIES.map(c => `
              <button class="mkt-cat-btn ${c.id === _activeCategory ? 'active' : ''}" onclick="MarketplaceModule.setCategory('${c.id}')">
                <span>${c.icon}</span> ${c.label}
              </button>
            `).join('')}
          </div>
          <div class="mkt-search-wrap">
            <span style="font-size:14px;opacity:0.6">🔍</span>
            <input class="mkt-search-input" placeholder="Search by cuisine, vendor, or city..." value="${_searchQuery}" oninput="MarketplaceModule.setSearch(this.value)">
          </div>
        </div>

        <!-- Active Event Banner -->
        ${activeEvent ? `
          <div class="mkt-event-context-pill">
            <span>Planning for: <strong>${activeEvent.title}</strong> (${activeEvent.eventDate || 'Date TBD'})</span>
            <span class="mkt-context-tag">Target: ${activeEvent.guestCapacity || 100} Guests</span>
          </div>
        ` : ''}

        <!-- Vendor Cards Grid -->
        <div class="mkt-cards-grid">
          ${filtered.map(v => {
            const reviews = EventoraDB.getReviewsForVendor(v.id);
            const reviewCount = v.reviewCount + reviews.length;
            const avgRating = reviews.length > 0
              ? (v.rating * v.reviewCount + reviews.reduce((a,b)=>a+b.rating,0)) / (v.reviewCount + reviews.length)
              : v.rating;
            
            const isCatering = v.category === 'Catering';

            return `
              <div class="mkt-card hover-lift-sm">
                <div class="mkt-card-media">
                  <img src="${(window.IMGS && window.IMGS[v.img]) ? window.IMGS[v.img] : 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80'}" alt="${v.name}" loading="lazy">
                  ${v.verified ? `<div class="mkt-verified-badge">✓ Verified Partner</div>` : ''}
                  <div class="mkt-category-chip">${v.category}</div>
                </div>
                <div class="mkt-card-body">
                  <div class="mkt-card-top">
                    <div>
                      <h3 class="mkt-vendor-name">${v.name}</h3>
                      <div class="mkt-vendor-location">📍 ${v.city} · ${v.serviceArea || 'Citywide'}</div>
                    </div>
                    <div class="mkt-rating-box">
                      <span class="mkt-star">★</span>
                      <strong>${avgRating.toFixed(1)}</strong>
                      <span class="mkt-rev-cnt">(${reviewCount})</span>
                    </div>
                  </div>

                  <p class="mkt-vendor-desc">${v.desc}</p>

                  <div class="mkt-perks-row">
                    <span class="mkt-perk">⚡ ${v.responseTime || '< 30m'}</span>
                    <span class="mkt-perk">🛡️ Operations Protected</span>
                  </div>

                  <div class="mkt-card-footer">
                    <div>
                      <div class="mkt-price-label">Starting from</div>
                      <div class="mkt-price-val">${EventoraDB.formatCurrency(v.price)} <small style="font-size:12px;font-weight:400;color:var(--text-muted)">${v.priceUnit || ''}</small></div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="MarketplaceModule.openVendorDetails('${v.id}')">
                      ${isCatering ? 'View Menu & Book' : 'Book Service'}
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Detailed Food & Catering Experience or Service Booking Drawer
   */
  const openVendorDetails = (vendorId) => {
    const v = EventoraDB.getVendorById(vendorId);
    if (!v) return;
    _activeVendor = v;
    _selectedPackage = (v.packages && v.packages.length > 0) ? v.packages[0] : null;
    _selectedAddons = [];

    const activeEvent = EventoraDB.getEvent(EventoraDB.getActiveEventId());
    _selectedGuestCount = activeEvent ? (Number(activeEvent.guestCapacity) || 100) : 100;

    renderBookingModal();
  };

  const selectPackage = (pkgId) => {
    if (!_activeVendor?.packages) return;
    _selectedPackage = _activeVendor.packages.find(p => p.id === pkgId) || _activeVendor.packages[0];
    renderBookingModal();
  };

  const toggleAddon = (addonName, addonCost) => {
    const idx = _selectedAddons.findIndex(a => a.name === addonName);
    if (idx !== -1) {
      _selectedAddons.splice(idx, 1);
    } else {
      _selectedAddons.push({ name: addonName, cost: addonCost });
    }
    renderBookingModal();
  };

  const setGuestCount = (cnt) => {
    _selectedGuestCount = Math.max(10, Math.min(5000, Number(cnt) || 10));
    updatePricingBreakdown();
  };

  const updatePricingBreakdown = () => {
    const subtotalEl = document.getElementById('mktSubtotal');
    const taxEl = document.getElementById('mktTax');
    const feeEl = document.getElementById('mktFee');
    const totalEl = document.getElementById('mktTotal');
    if (!subtotalEl) return;

    const basePkgPrice = _selectedPackage ? Number(_selectedPackage.price) : Number(_activeVendor.price);
    const isPerPerson = _selectedPackage ? (_selectedPackage.priceType === 'per person') : (_activeVendor.priceUnit === 'per person');

    let subtotal = 0;
    if (isPerPerson) {
      const addonsPerPerson = _selectedAddons.reduce((sum, a) => sum + a.cost, 0);
      subtotal = (basePkgPrice + addonsPerPerson) * _selectedGuestCount;
    } else {
      const addonsFixed = _selectedAddons.reduce((sum, a) => sum + a.cost, 0);
      subtotal = basePkgPrice + addonsFixed;
    }

    const tax = Math.round(subtotal * 0.05); // 5% GST
    const fee = Math.round(subtotal * 0.02); // 2% coordination fee
    const total = subtotal + tax + fee;

    subtotalEl.textContent = EventoraDB.formatCurrency(subtotal);
    taxEl.textContent = EventoraDB.formatCurrency(tax);
    feeEl.textContent = EventoraDB.formatCurrency(fee);
    totalEl.textContent = EventoraDB.formatCurrency(total);
  };

  const renderBookingModal = () => {
    const v = _activeVendor;
    if (!v) return;

    const activeEvent = EventoraDB.getEvent(EventoraDB.getActiveEventId());
    const isCatering = v.category === 'Catering';

    const basePkgPrice = _selectedPackage ? Number(_selectedPackage.price) : Number(v.price);
    const isPerPerson = _selectedPackage ? (_selectedPackage.priceType === 'per person') : (v.priceUnit === 'per person');

    let subtotal = isPerPerson ? basePkgPrice * _selectedGuestCount : basePkgPrice;
    const tax = Math.round(subtotal * 0.05);
    const fee = Math.round(subtotal * 0.02);
    const total = subtotal + tax + fee;

    const html = `
      <div class="mkt-detail-layout">
        <!-- Vendor Profile Header -->
        <div class="mkt-detail-header">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <h2 style="font-family:var(--font-head);font-size:24px;font-weight:900;color:var(--text-primary);margin:0">${v.name}</h2>
              <span class="badge badge-green" style="font-size:11px">✓ Verified</span>
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
              📍 ${v.address || v.city} · 📞 ${v.phone} · ⭐ <strong>${v.rating}</strong> (${v.reviewCount} Reviews)
            </div>
          </div>
          <div style="text-align:right">
            <span class="mkt-category-chip">${v.category}</span>
          </div>
        </div>

        ${isCatering && v.packages && v.packages.length > 0 ? `
          <!-- Catering Packages Selector -->
          <div style="margin-top:20px">
            <label class="form-label" style="font-size:14px;font-weight:700">1. Select Catering Package</label>
            <div class="mkt-package-grid">
              ${v.packages.map(p => `
                <div class="mkt-package-card ${(_selectedPackage && _selectedPackage.id === p.id) ? 'selected' : ''}" onclick="MarketplaceModule.selectPackage('${p.id}')">
                  ${p.isPopular ? `<div class="mkt-popular-tag">MOST POPULAR</div>` : ''}
                  <div style="font-weight:800;font-size:15px;margin-bottom:4px">${p.name}</div>
                  <div style="font-family:var(--font-head);font-size:20px;font-weight:900;color:var(--brand);margin-bottom:8px">
                    ₹${p.price} <small style="font-size:12px;font-weight:400;color:var(--text-muted)">/ person</small>
                  </div>
                  <p style="font-size:12px;color:var(--text-muted);line-height:1.4;margin-bottom:12px">${p.description}</p>
                  <div style="font-size:11px;font-weight:700;color:var(--text-secondary)">
                    Includes: ${p.starters ? `${p.starters.length} Starters · ` : ''} ${p.mains ? `${p.mains.length} Mains · ` : ''} ${p.desserts ? `${p.desserts.length} Desserts` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Active Package Menu Breakdown -->
          ${_selectedPackage ? `
            <div class="mkt-menu-breakdown card" style="margin-top:20px;background:var(--bg-subtle)">
              <div style="font-size:14px;font-weight:800;color:var(--text-primary);margin-bottom:12px">
                🍴 Menu Inclusions: ${_selectedPackage.name}
              </div>
              <div class="mkt-menu-columns">
                ${_selectedPackage.starters ? `
                  <div class="mkt-menu-col">
                    <div class="mkt-menu-col-hd">🥗 Starters & Appetizers</div>
                    <ul class="mkt-menu-list">
                      ${_selectedPackage.starters.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${_selectedPackage.mains ? `
                  <div class="mkt-menu-col">
                    <div class="mkt-menu-col-hd">🍛 Main Courses</div>
                    <ul class="mkt-menu-list">
                      ${_selectedPackage.mains.map(m => `<li>${m}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${_selectedPackage.rice ? `
                  <div class="mkt-menu-col">
                    <div class="mkt-menu-col-hd">🍚 Rice & Breads</div>
                    <ul class="mkt-menu-list">
                      ${_selectedPackage.rice.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${_selectedPackage.desserts ? `
                  <div class="mkt-menu-col">
                    <div class="mkt-menu-col-hd">🍮 Desserts & Drinks</div>
                    <ul class="mkt-menu-list">
                      ${_selectedPackage.desserts.map(d => `<li>${d}</li>`).join('')}
                      ${(_selectedPackage.drinks || []).map(dr => `<li>🥤 ${dr}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Live Add-ons -->
          <div style="margin-top:20px">
            <label class="form-label" style="font-size:14px;font-weight:700">2. Enhance with Live Counters (Optional)</label>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              ${[
                { name: 'Live Chaat & Pani Puri Counter', cost: 100 },
                { name: 'Artisanal Dessert & Belgian Waffle Lounge', cost: 80 },
                { name: 'Gourmet Mocktail & Barista Station', cost: 50 }
              ].map(addon => {
                const isSelected = _selectedAddons.some(a => a.name === addon.name);
                return `
                  <div class="mkt-addon-pill ${isSelected ? 'selected' : ''}" onclick="MarketplaceModule.toggleAddon('${addon.name}', ${addon.cost})">
                    <span>${isSelected ? '✓' : '+'}</span>
                    <span>${addon.name}</span>
                    <strong style="color:var(--brand)">+₹${addon.cost}/p</strong>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Guest & Date Settings -->
        <div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <label class="form-label" style="font-weight:700">Expected Guests</label>
            <input class="input" type="number" min="10" max="5000" value="${_selectedGuestCount}" oninput="MarketplaceModule.setGuestCount(this.value)">
          </div>
          <div>
            <label class="form-label" style="font-weight:700">Target Event</label>
            <input class="input" disabled value="${activeEvent ? `${activeEvent.title} (${activeEvent.eventDate || 'Scheduled'})` : 'Create an Event First'}" style="background:var(--bg-subtle)">
          </div>
        </div>

        <!-- Transparent Cost Breakdown -->
        <div class="mkt-cost-box card" style="margin-top:24px;border:1.5px solid var(--border)">
          <div style="font-weight:800;font-size:15px;color:var(--text-primary);margin-bottom:12px">💰 Transparent Price Calculation</div>
          <div class="mkt-cost-row">
            <span>Package Subtotal (${isPerPerson ? `${_selectedGuestCount} guests × ₹${basePkgPrice + _selectedAddons.reduce((a,b)=>a+b.cost,0)}` : 'Fixed Package'})</span>
            <strong id="mktSubtotal">${EventoraDB.formatCurrency(subtotal)}</strong>
          </div>
          <div class="mkt-cost-row">
            <span>Taxes (5% GST)</span>
            <span id="mktTax" style="color:var(--text-muted)">${EventoraDB.formatCurrency(tax)}</span>
          </div>
          <div class="mkt-cost-row">
            <span>Eventora Operations & Field Staff Assignment Fee (2%)</span>
            <span id="mktFee" style="color:var(--text-muted)">${EventoraDB.formatCurrency(fee)}</span>
          </div>
          <div class="mkt-cost-row total" style="border-top:1px solid var(--border);padding-top:10px;margin-top:8px">
            <span style="font-size:16px;font-weight:800">Total Booking Estimate</span>
            <span id="mktTotal" style="font-family:var(--font-head);font-size:22px;font-weight:900;color:var(--brand)">${EventoraDB.formatCurrency(total)}</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px">
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary btn-lg" onclick="MarketplaceModule.submitBookingRequest()">
            ⚡ Request Booking
          </button>
        </div>
      </div>
    `;

    Modal.open(`Book ${v.name}`, html);
  };

  const submitBookingRequest = () => {
    const v = _activeVendor;
    if (!v) return;

    const activeEventId = EventoraDB.getActiveEventId();
    if (!activeEventId) {
      Toast.show('warning', 'Create an Event First', 'Please create or choose an event before booking vendors.');
      Modal.close();
      App.goWizard();
      return;
    }

    const activeEvent = EventoraDB.getEvent(activeEventId);
    const basePkgPrice = _selectedPackage ? Number(_selectedPackage.price) : Number(v.price);
    const isPerPerson = _selectedPackage ? (_selectedPackage.priceType === 'per person') : (v.priceUnit === 'per person');

    let subtotal = 0;
    if (isPerPerson) {
      const addonsPerPerson = _selectedAddons.reduce((sum, a) => sum + a.cost, 0);
      subtotal = (basePkgPrice + addonsPerPerson) * _selectedGuestCount;
    } else {
      const addonsFixed = _selectedAddons.reduce((sum, a) => sum + a.cost, 0);
      subtotal = basePkgPrice + addonsFixed;
    }

    const booking = EventoraDB.requestBooking({
      eventId: activeEventId,
      eventName: activeEvent.title,
      eventDate: activeEvent.eventDate,
      vendorId: v.id,
      vendorName: v.name,
      service: v.category,
      packageId: _selectedPackage ? _selectedPackage.id : null,
      packageName: _selectedPackage ? _selectedPackage.name : 'Standard Booking',
      guestCount: _selectedGuestCount,
      cost: subtotal,
      notes: _selectedAddons.length > 0 ? `Addons: ${_selectedAddons.map(a=>a.name).join(', ')}` : ''
    });

    Modal.close();
    Toast.show('success', 'Booking Requested! 🚀', `Your request has been forwarded to ${v.name}. Eventora operations is monitoring confirmation.`);

    // Refresh vendor and dashboard tabs if open
    if (window.VendorsModule && typeof VendorsModule.render === 'function') {
      VendorsModule.render(activeEventId);
    }
    if (window.EventControlModule && typeof EventControlModule.render === 'function') {
      EventControlModule.render(activeEventId);
    }
  };

  return {
    setCategory,
    setSearch,
    renderMarketplace,
    openVendorDetails,
    selectPackage,
    toggleAddon,
    setGuestCount,
    submitBookingRequest
  };
})();
