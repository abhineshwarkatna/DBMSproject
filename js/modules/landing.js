/**
 * EVENTORA 3.0 — Landing Page Module
 * Editorial homepage with discovery sections
 */
window.LandingModule = (() => {

  const CATEGORIES = [
    { id:'Wedding',     img:'wedding',    name:'Weddings',        desc:'From ceremony to reception' },
    { id:'Birthday',    img:'birthday',   name:'Birthdays',       desc:'Celebrate every milestone' },
    { id:'Corporate',   img:'corporate',  name:'Corporate',       desc:'Conferences & seminars' },
    { id:'Hackathon',   img:'hackathon',  name:'Hackathons',      desc:'Build, compete, innovate' },
    { id:'Concert',     img:'concert',    name:'Concerts',        desc:'Live music & performances' },
    { id:'Festival',    img:'festival',   name:'Festivals',       desc:'Culture & community events' },
    { id:'Exhibition',  img:'exhibition', name:'Exhibitions',     desc:'Showcases & trade shows' },
    { id:'Sports',      img:'sports',     name:'Sports',          desc:'Tournaments & competitions' },
    { id:'Charity',     img:'charity',    name:'Charity',         desc:'Fundraising & social events' },
    { id:'Engagement',  img:'engagement', name:'Engagements',     desc:'Proposals & celebrations' },
    { id:'Party',       img:'party',      name:'Private Parties', desc:'Intimate gatherings' },
    { id:'Virtual',     img:'virtual',    name:'Virtual Events',  desc:'Online & hybrid formats' },
    { id:'Custom',      img:'festival2',  name:'Custom',          desc:'Define your own event type' },
  ];

  const POPULAR_EVENTS = [
    { name:'Royal Heritage Wedding', cat:'Wedding', date:'Oct 24, 2026', loc:'Taj Falaknuma, Hyderabad', img:'wedding', price:'Private' },
    { name:'NextGen AI Summit', cat:'Corporate', date:'Nov 15, 2026', loc:'HICC, Hyderabad', img:'corporate', price:'₹2,500/seat' },
    { name:'Deccan Music Festival', cat:'Festival', date:'Dec 2, 2026', loc:'Necklace Road, Hyderabad', img:'festival', price:'₹800' },
    { name:'Startup Pitch Night', cat:'Corporate', date:'Oct 30, 2026', loc:'T-Hub, Hyderabad', img:'corporate2', price:'Free' },
    { name:'Photography Exhibition', cat:'Exhibition', date:'Nov 5, 2026', loc:'Salar Jung Museum', img:'exhibition', price:'₹100' },
  ];

  const UPCOMING_EVENTS = [
    { name:'Campus Hackathon 2026', cat:'Hackathon', date:'Oct 18, 2026', loc:'CBIT, Hyderabad', img:'hackathon', price:'Free' },
    { name:'Diwali Gala Night', cat:'Party', date:'Oct 20, 2026', loc:'Private Farmhouse', img:'party', price:'Private' },
    { name:'HYD Marathon 2026', cat:'Sports', date:'Nov 1, 2026', loc:'Parade Grounds', img:'sports', price:'₹500' },
    { name:'Design Thinking Workshop', cat:'Corporate', date:'Oct 25, 2026', loc:'Online', img:'virtual', price:'Free' },
    { name:'IIT Tech Fest', cat:'Hackathon', date:'Nov 8, 2026', loc:'IIT Hyderabad', img:'hackathon2', price:'Free' },
  ];

  const STUDENT_EVENTS = [
    { name:'Code Clash 24Hr Hackathon', cat:'Hackathon', date:'Oct 20, 2026', loc:'JNTUH Campus', img:'hackathon', price:'Free' },
    { name:'Drama & Arts Fest', cat:'Festival', date:'Oct 29, 2026', loc:'NIMS University', img:'festival2', price:'Free' },
    { name:'Robotics Tournament', cat:'Sports', date:'Nov 3, 2026', loc:'BITS Hyderabad', img:'sports', price:'₹200/team' },
    { name:'Model UN 2026', cat:'Corporate', date:'Nov 10, 2026', loc:'Hyderabad Public School', img:'corporate', price:'₹300' },
  ];

  const VENDORS = [
    { name:'Lumiere Cinematic Studios', cat:'Photography', rating:'4.9', price:'₹1,35,000', loc:'Hyderabad', img:'photography' },
    { name:'Royal Nizam Caterers', cat:'Catering', rating:'4.8', price:'₹850/plate', loc:'Hyderabad', img:'catering' },
    { name:'Elysian Floral & Decor', cat:'Decoration', rating:'4.7', price:'₹2,80,000', loc:'Hyderabad', img:'decor' },
    { name:'Bassline Beats DJ', cat:'Audio/DJ', rating:'4.8', price:'₹60,000', loc:'Hyderabad', img:'dj' },
    { name:'Golden Transport Co.', cat:'Transport', rating:'4.6', price:'₹8,000/vehicle', loc:'Hyderabad', img:'transport' },
  ];

  const renderEventCard = (ev) => `
    <div class="event-disc-card hover-lift" onclick="App.goWizard('${ev.cat}')">
      <div class="event-disc-img img-hover-zoom">
        <img src="${IMGS[ev.img]}?w=400&q=75&auto=format&fit=crop" alt="${ev.name}" loading="lazy"
             onerror="this.onerror=null;this.src='${IMGS.party}?w=400&q=75&auto=format&fit=crop'">
        <div style="position:absolute;top:10px;left:10px">
          <span class="badge badge-violet">${ev.cat}</span>
        </div>
      </div>
      <div class="event-disc-body">
        <div class="event-disc-name">${ev.name}</div>
        <div class="event-disc-meta">
          <span class="event-disc-date">📅 ${ev.date}</span>
          <span class="event-disc-loc">📍 ${ev.loc}</span>
        </div>
        <div class="event-disc-foot">
          <span class="event-disc-price">${ev.price}</span>
          <span class="event-disc-btn">Plan similar →</span>
        </div>
      </div>
    </div>`;

  const renderVendorCard = (v) => `
    <div class="event-disc-card hover-lift" style="width:260px" onclick="App.goDashboard()">
      <div class="event-disc-img img-hover-zoom" style="height:160px">
        <img src="${IMGS[v.img]}?w=400&q=75&auto=format&fit=crop" alt="${v.name}" loading="lazy"
             onerror="this.onerror=null;this.src='${IMGS.catering}?w=400&q=75&auto=format&fit=crop'">
      </div>
      <div class="event-disc-body">
        <div style="font-size:11px;font-weight:700;color:var(--brand);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">${v.cat}</div>
        <div class="event-disc-name" style="font-size:15px">${v.name}</div>
        <div class="event-disc-meta">
          <span style="color:var(--warning);font-weight:700">★ ${v.rating}</span>
          <span>· 📍 ${v.loc}</span>
        </div>
        <div class="event-disc-foot">
          <span style="font-family:var(--font-head);font-size:14px;font-weight:800;color:var(--brand)">from ${v.price}</span>
          <button class="btn btn-brand-outline btn-xs" onclick="event.stopPropagation();App.goDashboard()">Book</button>
        </div>
      </div>
    </div>`;

  const init = () => {
    // Categories
    const catRow = document.getElementById('categoriesRow');
    if (catRow) {
      catRow.innerHTML = CATEGORIES.map(c => `
        <div class="category-tile hover-lift" onclick="App.goWizard('${c.id}')">
          <div class="category-tile-img img-hover-zoom">
            <img src="${IMGS[c.img]}?w=300&q=75&auto=format&fit=crop" alt="${c.name}" loading="lazy"
                 onerror="this.onerror=null;this.src='${IMGS.party}?w=300&q=75&auto=format&fit=crop'">
          </div>
          <div class="category-tile-body">
            <div class="category-tile-name">${c.name}</div>
            <div class="category-tile-desc">${c.desc}</div>
          </div>
          <div class="category-tile-hover">Plan ${c.name} →</div>
        </div>`).join('');
    }
    // Popular Events
    const popRow = document.getElementById('popularEventsRow');
    if (popRow) popRow.innerHTML = POPULAR_EVENTS.map(renderEventCard).join('');
    // Upcoming
    const upRow = document.getElementById('upcomingEventsRow');
    if (upRow) upRow.innerHTML = UPCOMING_EVENTS.map(renderEventCard).join('');
    // Students
    const stuRow = document.getElementById('studentEventsRow');
    if (stuRow) stuRow.innerHTML = STUDENT_EVENTS.map(renderEventCard).join('');
    // Vendors
    const venRow = document.getElementById('vendorSpotlightRow');
    if (venRow) venRow.innerHTML = VENDORS.map(renderVendorCard).join('');

    // Animate counters
    document.querySelectorAll('.stat-counter').forEach(el => {
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      let current = 0;
      const step = Math.ceil(target / 50);
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current >= 1000 ? (current / 1000).toFixed(current >= 100000 ? 0 : 1) + (current >= 100000 ? 'L' : 'K') : current;
        el.textContent += suffix;
        if (current >= target) clearInterval(timer);
      }, 30);
    });

    // Scroll reveal
    setTimeout(() => {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
      }, { threshold: 0.1 });
      document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger').forEach(el => obs.observe(el));
    }, 100);

    // Search
    const searchInput = document.getElementById('homeSearchInput');
    if (searchInput) {
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          const q = searchInput.value.trim();
          Toast.show('info', 'Search', `Showing results for "${q}"`);
        }
      });
      searchInput.parentElement.addEventListener('click', () => searchInput.focus());
    }
  };

  return { init };
})();
