/**
 * EVENTORA 3.0 — App Orchestrator
 * Routes views, manages tabs, modals, toast, and global state
 */

// ── Unsplash image library ────────────────────────────────────────────
window.IMGS = {
  wedding:     'https://images.unsplash.com/photo-1519225421-2c890c5c2d59?w=800&q=80&auto=format&fit=crop',
  wedding2:    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80&auto=format&fit=crop',
  birthday:    'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80&auto=format&fit=crop',
  birthday2:   'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=800&q=80&auto=format&fit=crop',
  corporate:   'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80&auto=format&fit=crop',
  corporate2:  'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=800&q=80&auto=format&fit=crop',
  concert:     'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80&auto=format&fit=crop',
  concert2:    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80&auto=format&fit=crop',
  hackathon:   'https://images.unsplash.com/photo-1504384308090-c5f6f3d5abe3?w=800&q=80&auto=format&fit=crop',
  hackathon2:  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&auto=format&fit=crop',
  festival:    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80&auto=format&fit=crop',
  festival2:   'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80&auto=format&fit=crop',
  exhibition:  'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=800&q=80&auto=format&fit=crop',
  sports:      'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80&auto=format&fit=crop',
  charity:     'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80&auto=format&fit=crop',
  virtual:     'https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=800&q=80&auto=format&fit=crop',
  party:       'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80&auto=format&fit=crop',
  engagement:  'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=800&q=80&auto=format&fit=crop',
  custom:      'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&q=80&auto=format&fit=crop',
  // Venues
  hotel:       'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80&auto=format&fit=crop',
  home:        'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=800&q=80&auto=format&fit=crop',
  outdoor:     'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80&auto=format&fit=crop',
  office:      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80&auto=format&fit=crop',
  college:     'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80&auto=format&fit=crop',
  restaurant:  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80&auto=format&fit=crop',
  banquet:     'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&q=80&auto=format&fit=crop',
  // Vendors
  catering:    'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&q=80&auto=format&fit=crop',
  photography: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&q=80&auto=format&fit=crop',
  decor:       'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80&auto=format&fit=crop',
  dj:          'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=800&q=80&auto=format&fit=crop',
  transport:   'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80&auto=format&fit=crop',
  security:    'https://images.unsplash.com/photo-1521791055366-0d553872952f?w=800&q=80&auto=format&fit=crop',
  lighting:    'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800&q=80&auto=format&fit=crop',
  // Food
  food1:       'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&auto=format&fit=crop',
  food2:       'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80&auto=format&fit=crop',
  // Transport
  bus:         'https://images.unsplash.com/photo-1570125909517-53cb21c89ff2?w=800&q=80&auto=format&fit=crop',
  car:         'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80&auto=format&fit=crop',
  // Accommodation
  room1:       'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80&auto=format&fit=crop',
  room2:       'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80&auto=format&fit=crop',
};



// ── Toast ─────────────────────────────────────────────────────────────
window.Toast = (() => {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const show = (type, title, msg, duration = 3500) => {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
      <div class="toast-icon">${icons[type]||'ℹ️'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <div class="toast-dismiss" onclick="this.parentElement.remove()">✕</div>`;
    c.appendChild(t);
    setTimeout(() => t.style.opacity = '0', duration);
    setTimeout(() => t.remove(), duration + 300);
  };
  return { show };
})();

// ── Modal ─────────────────────────────────────────────────────────────
window.Modal = (() => {
  const open = (title, html, onConfirm, confirmLabel = 'Confirm') => {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html +
      (onConfirm ? `<div class="modal-footer">
        <button class="btn btn-secondary btn-sm" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary btn-sm" id="modalConfirmBtn">${confirmLabel}</button>
      </div>` : '');
    document.getElementById('modalBackdrop').classList.add('open');
    const cb = document.getElementById('modalClose');
    if (cb) cb.onclick = Modal.close;
    const cfm = document.getElementById('modalConfirmBtn');
    if (cfm && onConfirm) cfm.onclick = () => { onConfirm(); Modal.close(); };
    document.getElementById('modalBackdrop').onclick = e => { if (e.target.id === 'modalBackdrop') Modal.close(); };
  };
  const close = () => document.getElementById('modalBackdrop').classList.remove('open');
  const setBody = html => { document.getElementById('modalBody').innerHTML = html; };
  return { open, close, setBody };
})();

// ── App Router ────────────────────────────────────────────────────────
window.App = (() => {
  const views = ['auth', 'home', 'wizard', 'dashboard'];
  let currentTab = 'overview';
  let _pendingAction = null; // action to perform after auth

  const showView = (id) => {
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.toggle('active', v === id);
    });
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    // If not logged in, home = login page
    if (!AuthModule.isLoggedIn()) { goAuth('login'); return; }
    showView('home');
    setTimeout(() => LandingModule.init(), 50);
    setTimeout(() => AuthModule.updateNavActions(), 100);
  };

  const goAuth = (mode = 'login') => {
    showView('auth');
    if (mode === 'signup') AuthModule.showSignup();
    else AuthModule.showLogin();
  };

  // Redirect to auth if not logged in; store the intended action
  const requireAuth = (action) => {
    if (AuthModule.isLoggedIn()) {
      if (action === 'wizard') goWizard();
      else if (action === 'dashboard') goDashboard();
    } else {
      _pendingAction = action;
      goAuth('login');
    }
  };

  // Called after successful login/signup
  const afterAuth = () => {
    const action = _pendingAction || 'dashboard';
    _pendingAction = null;
    if (action === 'wizard') goWizard();
    else goDashboard();
  };

  const goWizard = (categoryPreset) => {
    showView('wizard');
    WizardModule.reset();
    if (categoryPreset) WizardModule.preselectCategory(categoryPreset);
  };

  const goDashboard = () => {
    showView('dashboard');
    const evId = EventoraDB.getActiveEventId();
    if (!evId) {
      const events = EventoraDB.getAllEvents();
      if (events.length > 0) EventoraDB.setActiveEvent(events[0].id);
    }
    refreshSidebarEvent();
    switchTab('overview');
  };

  const refreshSidebarEvent = () => {
    const evId = EventoraDB.getActiveEventId();
    const ev = EventoraDB.getEvent(evId);
    if (!ev) return;
    const nameEl = document.getElementById('sidebarEventName');
    const dateEl = document.getElementById('sidebarEventDate');
    const imgEl  = document.getElementById('sidebarEventImg');
    const statusEl = document.getElementById('dashEventStatus');
    if (nameEl) nameEl.textContent = ev.title || 'Untitled Event';
    if (dateEl) dateEl.textContent = ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Date TBD';
    if (imgEl) {
      imgEl.src = IMGS[ev.coverImage] || IMGS.wedding;
      imgEl.onerror = () => { imgEl.src = IMGS.wedding; };
    }
    if (statusEl) {
      const s = ev.status || 'Planning';
      const map = { Planning: 'badge-amber', Active: 'badge-red', Completed: 'badge-green' };
      statusEl.className = `badge ${map[s] || 'badge-amber'}`;
      statusEl.textContent = s === 'Active' ? '🔴 Live' : s === 'Completed' ? '✓ Done' : '⏳ Planning';
    }
    // Update nav badges
    const guests = EventoraDB.getGuests(evId);
    const tasks  = EventoraDB.getTasks(evId).filter(t => t.status !== 'Done');
    const gb = document.getElementById('navGuestBadge');
    const tb = document.getElementById('navTaskBadge');
    if (gb) gb.textContent = guests.length;
    if (tb) tb.textContent = tasks.length;
  };

  const switchTab = (tabId) => {
    currentTab = tabId;
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabId);
    });
    // Show/hide tab views
    document.querySelectorAll('.tab-view').forEach(el => {
      el.classList.toggle('active', el.id === `tab-${tabId}`);
    });
    // Update topbar
    const titles = {
      overview:'Overview', guests:'Guests', budget:'Budget',
      vendors:'Vendors', tasks:'Tasks', venue:'Venue',
      schedule:'Schedule', catering:'Catering', transport:'Transport',
      accommodation:'Accommodation', invitations:'Invitations', media:'Media',
      live:'🔴 Live', analytics:'Analytics'
    };
    const subs = {
      overview:'Your event at a glance', guests:'Manage all guests',
      budget:'Track spending', vendors:'Book service providers',
      tasks:'What needs to get done', venue:'Design your space',
      schedule:'Event timeline', catering:'Food & beverages',
      transport:'Fleet & routes', accommodation:'Room assignments',
      invitations:'Design & send invites', media:'Photos & documents',
      live:'Real-time event management', analytics:'Performance'
    };
    const t = document.getElementById('topbarTitle');
    const s = document.getElementById('topbarSub');
    if (t) t.textContent = titles[tabId] || tabId;
    if (s) s.textContent = subs[tabId] || '';
    // Render the active module
    const evId = EventoraDB.getActiveEventId();
    const moduleMap = {
      overview:   () => DashboardModule.render(evId),
      guests:     () => GuestsModule.render(evId),
      budget:     () => BudgetModule.render(evId),
      vendors:    () => VendorsModule.render(evId),
      tasks:      () => TasksModule.render(evId),
      venue:      () => VenueModule.render(evId),
      schedule:   () => ScheduleModule.render(evId),
      catering:   () => CateringModule.render(evId),
      transport:  () => TransportModule.render(evId),
      accommodation: () => AccommodationModule.render(evId),
      invitations:() => InvitationsModule.render(evId),
      media:      () => MediaModule.render(evId),
      live:       () => LiveModule.render(evId),
      analytics:  () => AnalyticsModule.render(evId),
    };
    if (moduleMap[tabId]) moduleMap[tabId]();
  };

  const toggleSidebar = () => {
    const sb = document.getElementById('dashSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const main = document.getElementById('dashMain');
    if (!sb) return;
    sb.classList.toggle('hidden');
    if (window.innerWidth <= 900) {
      sb.classList.toggle('open');
      if (overlay) overlay.style.display = sb.classList.contains('open') ? 'block' : 'none';
    } else {
      const isHidden = sb.classList.contains('hidden');
      if (main) main.style.marginLeft = isHidden ? '0' : 'var(--sidebar-w)';
    }
  };

  const closeSidebar = () => {
    const sb = document.getElementById('dashSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  };

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openEventSwitcher = () => {
    const events = EventoraDB.getAllEvents();
    if (events.length === 0) {
      Modal.open('My Events',
        '<div class="empty-state" style="padding:20px"><div class="empty-icon">📅</div><div class="empty-title">No events yet</div></div>',
        () => { Modal.close(); goWizard(); }, 'Create Event');
      return;
    }
    const html = `
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        ${events.map(ev => `
          <div onclick="App.setActiveEvent('${ev.id}')" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--r-md);border:1.5px solid ${ev.id === EventoraDB.getActiveEventId() ? 'var(--brand)' : 'var(--border)'};background:${ev.id === EventoraDB.getActiveEventId() ? 'var(--brand-light)' : 'var(--bg-white)'};cursor:pointer;transition:all 0.15s">
            <img src="${IMGS[ev.coverImage]||IMGS.wedding}" style="width:48px;height:48px;object-fit:cover;border-radius:var(--r-sm);flex-shrink:0" alt="${ev.title}" onerror="this.src='${IMGS.wedding}'">
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ev.title}</div>
              <div style="font-size:12px;color:var(--text-muted)">${ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'Date TBD'} · ${ev.category||'Event'}</div>
            </div>
            ${ev.id === EventoraDB.getActiveEventId() ? '<span class="badge badge-violet" style="flex-shrink:0">Active</span>' : ''}
          </div>`).join('')}
      </div>
      <button class="btn btn-primary btn-full" onclick="Modal.close();App.goWizard()">+ Create New Event</button>`;
    Modal.open('My Events', html);
  };

  const setActiveEvent = (evId) => {
    EventoraDB.setActiveEvent(evId);
    Modal.close();
    refreshSidebarEvent();
    switchTab('overview');
    Toast.show('success', 'Event Switched', 'Active event updated.');
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') Modal.close();
    if ((e.ctrlKey || e.metaKey) && e.key === 'b' && document.getElementById('view-dashboard')?.classList.contains('active')) {
      e.preventDefault(); toggleSidebar();
    }
    if (e.altKey && !isNaN(e.key)) {
      const tabs = ['overview','guests','budget','vendors','tasks'];
      const idx = parseInt(e.key) - 1;
      if (tabs[idx] && document.getElementById('view-dashboard')?.classList.contains('active')) {
        e.preventDefault(); switchTab(tabs[idx]);
      }
    }
  });

  // Scroll reveal
  const initScrollReveal = () => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .stagger').forEach(el => obs.observe(el));
  };

  // Nav scroll effect
  const initNavScroll = () => {
    window.addEventListener('scroll', () => {
      const nav = document.getElementById('homeNav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  };

  // Nav click for sidebar nav items
  document.addEventListener('click', e => {
    const navItem = e.target.closest('.nav-item[data-tab]');
    if (navItem) { switchTab(navItem.dataset.tab); }
  });

  // Init — async so we can await Supabase session before routing
  document.addEventListener('DOMContentLoaded', async () => {
    // Show loading splash while Supabase checks the session
    const loadingEl = document.getElementById('view-loading');
    if (loadingEl) loadingEl.classList.add('active');

    EventoraDB.init();
    initNavScroll();

    // AuthModule.init() calls supabase.auth.getSession() and routes accordingly
    // It handles SIGNED_IN / SIGNED_OUT via onAuthStateChange
    await AuthModule.init();

    // Hide loading splash (AuthModule.init already called goAuth or goDashboard)
    if (loadingEl) loadingEl.classList.remove('active');

    setTimeout(initScrollReveal, 300);
  });

  return {
    goHome, goWizard, goDashboard, goAuth, requireAuth, afterAuth,
    switchTab, toggleSidebar, closeSidebar,
    scrollTo, openEventSwitcher, setActiveEvent, refreshSidebarEvent,
    refreshSidebar: refreshSidebarEvent,
  };
})();

// ── Global Image Fallback ──────────────────────────────────────────────
// Catches any img that fails to load across the whole app
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName !== 'IMG' || el._fallbackApplied) return;
  el._fallbackApplied = true;
  const fallback = IMGS?.wedding + '?w=400&q=75&auto=format&fit=crop';
  if (el.src !== fallback) {
    el.src = fallback;
  } else {
    el.style.opacity = '0';
    if (el.parentElement) el.parentElement.style.background = 'linear-gradient(135deg,#f3e8ff,#e0e7ff)';
  }
}, true);

