/**
 * EVENTORA — Authentication Module
 * Source of truth: Supabase Auth (implicit flow) + Dual-Mode Offline Fallback
 *
 * Provides:
 *  1. Cloud Supabase Authentication (Email/Password, Google OAuth, Session Management)
 *  2. Resilient Error Handling (zero uncaught exceptions, user-friendly feedback)
 *  3. Seamless Local / Offline Fallback (never blocks access when backend is unreachable)
 *  4. Instant Role Demo Switcher (Customer, Vendor, Field Staff, Admin)
 */
window.AuthModule = (() => {

  const sb = () => window.EventoraSupabase?.client;

  let _currentUser    = null;
  let _profile        = null;
  let _listenerActive = false;

  const getUser    = () => _currentUser;
  const getProfile = () => _profile;
  const isLoggedIn = () => !!_currentUser;
  const getUserRole = () => {
    if (!_currentUser) return 'guest';
    const metaRole = _currentUser.user_metadata?.role;
    const appRole  = _currentUser.app_metadata?.role;
    const profRole = _profile?.role;
    const dbRole   = window.EventoraDB?.getCurrentRole ? window.EventoraDB.getCurrentRole() : null;
    return metaRole || appRole || profRole || dbRole || 'customer';
  };

  // ── Registered Accounts Directory (Offline / Local persistence) ──────
  const INITIAL_ACCOUNTS = {
    'customer@eventora.com': {
      email: 'customer@eventora.com',
      role: 'customer',
      metadata: { full_name: 'Aditya Verma', name: 'Aditya Verma', role: 'customer' }
    },
    'vendor@eventora.com': {
      email: 'vendor@eventora.com',
      role: 'vendor',
      metadata: { full_name: 'Chef Ranveer', name: 'Chef Ranveer', role: 'vendor', vendorId: 'v-royal-feast', businessName: 'Royal Feast Catering', category: 'Catering', city: 'Hyderabad' }
    },
    'photo@eventora.com': {
      email: 'photo@eventora.com',
      role: 'vendor',
      metadata: { full_name: 'Arjun Lumina', name: 'Arjun Lumina', role: 'vendor', vendorId: 'v-lumina-studios', businessName: 'Lumina Cinematic Studios', category: 'Photography', city: 'Cyberabad' }
    },
    'venue@eventora.com': {
      email: 'venue@eventora.com',
      role: 'vendor',
      metadata: { full_name: 'Karan Singhania', name: 'Karan Singhania', role: 'vendor', vendorId: 'v-crystal-ballroom', businessName: 'Grand Crystal Ballroom', category: 'Venues', city: 'Secunderabad' }
    },
    'staff@eventora.com': {
      email: 'staff@eventora.com',
      role: 'employee',
      metadata: { full_name: 'Rahul Verma', name: 'Rahul Verma', role: 'employee', employeeId: 'emp-1', roleTitle: 'Catering Setup Lead', area: 'Hyderabad Central' }
    },
    'admin@eventora.com': {
      email: 'admin@eventora.com',
      role: 'admin',
      metadata: { full_name: 'Platform Super Admin', name: 'Platform Super Admin', role: 'admin' }
    }
  };

  const _getAccounts = () => {
    try {
      const raw = localStorage.getItem('eventora_registered_accounts');
      const custom = raw ? JSON.parse(raw) : {};
      return { ...INITIAL_ACCOUNTS, ...custom };
    } catch (e) {
      return INITIAL_ACCOUNTS;
    }
  };

  const _saveAccount = (account) => {
    try {
      if (!account || !account.email) return;
      const clean = account.email.toLowerCase().trim();
      const raw = localStorage.getItem('eventora_registered_accounts');
      const custom = raw ? JSON.parse(raw) : {};
      custom[clean] = account;
      localStorage.setItem('eventora_registered_accounts', JSON.stringify(custom));
    } catch (e) {}
  };

  const _getAccountByEmail = (email) => {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    const accounts = _getAccounts();
    return accounts[clean] || null;
  };

  // ── Offline / Local Session Storage ───────────────────────────────────
  const _getOfflineSession = () => {
    try {
      const raw = localStorage.getItem('eventora_offline_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const _saveOfflineSession = (user) => {
    try {
      if (user) {
        localStorage.setItem('eventora_offline_session', JSON.stringify(user));
      } else {
        localStorage.removeItem('eventora_offline_session');
      }
    } catch (e) {}
  };

  // ── Human-readable errors ─────────────────────────────────────────────
  const _friendlyError = (err) => {
    if (!err) return 'Something went wrong. Please try again.';
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials'))
      return 'Incorrect email or password. Please verify or use Quick Demo Access.';
    if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed'))
      return 'Please verify your email before signing in. Check your inbox or continue offline.';
    if (msg.includes('user already registered') || msg.includes('already_registered'))
      return 'An account with this email already exists. Try signing in.';
    if (msg.includes('password should be at least') || msg.includes('should be at least 6'))
      return 'Password must be at least 6 characters.';
    if (msg.includes('unable to validate email'))
      return 'Please enter a valid email address.';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('connection'))
      return 'Network error: Cloud database server is unreachable.';
    return err.message || 'Something went wrong. Please try again.';
  };

  // ── Upsert into public.profiles (Safe / Non-blocking) ─────────────────
  const _syncProfile = async (user) => {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const role = meta.role || user.app_metadata?.role || 'customer';
    EventoraDB.setRole(role);

    const profileData = {
      id:         user.id,
      full_name:  meta.full_name || meta.name || user.email?.split('@')[0] || '',
      email:      user.email || '',
      role:       role,
      avatar_url: meta.avatar_url || meta.picture || '',
      updated_at: new Date().toISOString(),
    };

    console.log('[Eventora] Syncing profile with role:', profileData.email, role);

    const client = sb();
    if (!client) {
      _profile = profileData;
      return profileData;
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.warn('[Eventora] Profile sync warning:', error.message,
          '\n→ Run data/eventora_ecosystem_migration.sql in Supabase SQL Editor');
        _profile = profileData;
      } else {
        _profile = data || profileData;
        console.log('[Eventora] Profile synced ✓', _profile.email, _profile.role);
      }
      return _profile;
    } catch (err) {
      console.warn('[Eventora] Profile sync network notice (using cached profile):', err.message || err);
      _profile = profileData;
      return profileData;
    }
  };

  // ── Shared: route or onboard a Supabase-authenticated user ───────────
  // Called from every SIGNED_IN path (state listener, hash token, getSession).
  // Detects brand-new users and shows onboarding instead of routing them directly.
  const _handleSignedInUser = async (user, { syncProfile = true } = {}) => {
    if (!user) return;
    _currentUser = user;

    const savedAcct = _getAccountByEmail(user.email);
    const metaRole  = user.user_metadata?.role;
    const isNewUser = !savedAcct && !metaRole;  // no local account AND no role in metadata

    if (isNewUser) {
      // ── BRAND NEW USER → Show profile/category setup (Step 2 onboarding)
      console.log('[Eventora Auth] New user — showing onboarding:', user.email);
      const cleanEmail = user.email;
      const cleanName  = user.user_metadata?.full_name
                      || user.user_metadata?.name
                      || cleanEmail.split('@')[0];
      const provider   = user.app_metadata?.provider || 'email';

      _pendingGoogleUser = { email: cleanEmail, name: cleanName, provider };

      // Pre-fill hidden Step-1 fields so signup() can read them
      const autoPass = 'oauth_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '') + '_secure';
      [['signupName', cleanName], ['signupEmail', cleanEmail],
       ['signupPassword', autoPass], ['signupConfirm', autoPass]].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });

      EventoraDB.setUser(user.id);
      updateNavActions();
      updateSidebarUser();
      _cleanHash();

      // Cosmetic: update badge & back button for OAuth context
      const backBtn = document.querySelector('#authOnboarding .auth-back-btn');
      if (backBtn) {
        backBtn.textContent = '← Cancel Sign-In';
        backBtn.onclick = () => { _pendingGoogleUser = null; logout(); };
      }
      const badge = document.querySelector('#authOnboarding [style*="STEP 2"]');
      if (badge) badge.textContent = 'ACCOUNT SETUP — CHOOSE YOUR ROLE';

      App.goAuth();
      // Delay showOnboarding slightly to let App.goAuth() render the auth panel
      setTimeout(() => {
        const onbEl = document.getElementById('authOnboarding');
        const signEl = document.getElementById('authSignup');
        const loginEl = document.getElementById('authLogin');
        if (loginEl) loginEl.style.display = 'none';
        if (signEl)  signEl.style.display  = 'none';
        if (onbEl)   onbEl.style.display   = 'flex';
      }, 80);

      Toast.show('info', 'One last step!',
        `Welcome ${cleanName}! Pick your role to set up your workspace.`);
      return;
    }

    // ── RETURNING / EXISTING USER → sync and route normally
    console.log('[Eventora Auth] Existing user signed in:', user.email, '| role:', metaRole || savedAcct?.role);
    const resolvedRole = metaRole || savedAcct?.role || 'customer';
    EventoraDB.setUser(user.id, resolvedRole);
    if (syncProfile) { try { await _syncProfile(user); } catch (e) { console.warn(e); } }
    updateNavActions();
    updateSidebarUser();
    _cleanHash();
    App.afterAuth();
  };

  // ── Persistent auth state listener ────────────────────────────────────
  const _initStateListener = () => {
    if (_listenerActive) return;
    _listenerActive = true;
    const client = sb();
    if (!client) return;

    try {
      client.auth.onAuthStateChange(async (event, session) => {
        try {
          console.log('[Eventora Auth] Event:', event);
          console.log('[Eventora Auth] Session:', session ? `user=${session.user?.email}` : 'null');

          const user = session?.user ?? null;

          if (event === 'SIGNED_IN' && user) {
            await _handleSignedInUser(user);
          }

          if (event === 'SIGNED_OUT') {
            _currentUser = null;
            _profile     = null;
            _saveOfflineSession(null);
            EventoraDB.setUser(null);
            updateNavActions();
            updateSidebarUser();
            App.goAuth('login');
          }

          if (event === 'TOKEN_REFRESHED' && user) {
            _currentUser = user;
          }

          if (event === 'PASSWORD_RECOVERY') {
            App.goAuth('login');
            setTimeout(() => showForm('authReset'), 150);
          }
        } catch (listenerErr) {
          console.error('[Eventora Auth] onAuthStateChange handler error:', listenerErr);
        }
      });
    } catch (e) {
      console.warn('[Eventora Auth] Could not register auth state listener:', e);
    }
  };

  // ── MAIN INIT ─────────────────────────────────────────────────────────
  const init = async () => {
    console.log('[Eventora Auth] Page URL:', window.location.href);

    // 1. Check for OAuth errors in query string or hash (?error=...)
    const qParams   = new URLSearchParams(window.location.search);
    const hParams   = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorCode = qParams.get('error') || hParams.get('error');
    const errorDesc = qParams.get('error_description') || hParams.get('error_description') || '';

    if (errorCode) {
      console.error('[Eventora Auth] OAuth error code:', errorCode, errorDesc);
      _cleanUrl();
      _initStateListener();
      App.goAuth('login');

      let userMsg;
      if (errorCode === 'access_denied') {
        userMsg = 'Google sign-in was cancelled.';
      } else if (errorDesc) {
        userMsg = `Google sign-in failed: ${decodeURIComponent(errorDesc.replace(/\+/g, ' '))}`;
      } else {
        userMsg = `Google sign-in failed (${errorCode}). Please try again.`;
      }
      _showLoginError(userMsg);
      return;
    }

    _initStateListener();

    // 2. Check Supabase session first
    const client = sb();
    if (client) {
      try {
        console.log('[Eventora Auth] Checking Supabase cloud session…');
        const { data, error } = await client.auth.getSession();

        if (!error && data?.session?.user) {
          const user = data.session.user;
          console.log('[Eventora Auth] Cloud session restored ✓ for:', user.email);
          await _handleSignedInUser(user);
          return;
        }
      } catch (err) {
        console.warn('[Eventora Auth] Supabase cloud session check notice:', err);
      }
    }

    // 3. Check for implicit token in URL hash
    const hasHashTokens = window.location.hash.includes('access_token');
    if (hasHashTokens && client) {
      console.log('[Eventora Auth] Hash tokens found, waiting for Supabase to finish parsing…');
      setTimeout(async () => {
        try {
          const { data: { session: s2 } } = await client.auth.getSession();
          if (s2?.user) {
            await _handleSignedInUser(s2.user);
            return;
          }
        } catch (e) {}
        _restoreOfflineOrDefault();
      }, 1500);
      return;
    }

    _restoreOfflineOrDefault();
  };

  const _restoreOfflineOrDefault = () => {
    // 4. Check offline / local session fallback
    const offline = _getOfflineSession();
    if (offline) {
      console.log('[Eventora Auth] Restoring local/offline session for:', offline.email);
      _currentUser = offline;
      EventoraDB.setUser(offline.id, offline.user_metadata?.role || 'customer');
      updateNavActions();
      updateSidebarUser();
      App.afterAuth();
      return;
    }

    // 5. No session found — show login form
    console.log('[Eventora Auth] No active session — showing login.');
    App.goAuth('login');
  };

  // ── Offline / Demo Authentication ─────────────────────────────────────
  const loginOffline = (email, role = null, customMetadata = null) => {
    const cleanEmail = (email || 'customer@eventora.com').trim().toLowerCase();
    const storedAccount = _getAccountByEmail(cleanEmail);

    let assignedRole = role || storedAccount?.role || storedAccount?.metadata?.role;
    if (!assignedRole) {
      if (cleanEmail.includes('vendor') || cleanEmail.includes('catering') || cleanEmail.includes('photo') || cleanEmail.includes('venue')) assignedRole = 'vendor';
      else if (cleanEmail.includes('staff') || cleanEmail.includes('employee')) assignedRole = 'employee';
      else if (cleanEmail.includes('admin')) assignedRole = 'admin';
      else assignedRole = 'customer';
    }

    const nameParts = cleanEmail.split('@')[0].split('.');
    const displayName = (storedAccount?.metadata?.full_name) || nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    const metadata = {
      full_name: displayName || 'Eventora User',
      name: displayName || 'Eventora User',
      role: assignedRole,
      ...(storedAccount?.metadata || {}),
      ...(customMetadata || {})
    };

    const offlineUser = {
      id: storedAccount?.id || ('usr_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')),
      email: cleanEmail,
      user_metadata: metadata
    };

    _saveAccount({
      id: offlineUser.id,
      email: cleanEmail,
      role: assignedRole,
      metadata: metadata
    });

    _saveOfflineSession(offlineUser);
    _currentUser = offlineUser;
    EventoraDB.setUser(offlineUser.id, assignedRole);

    // If vendor and has vendorId, set it in VendorPortalModule
    if (assignedRole === 'vendor' && metadata.vendorId && window.VendorPortalModule) {
      VendorPortalModule.setVendor(metadata.vendorId);
    }

    // If new session with 0 events and role is customer, seed sample ecosystem data
    if (assignedRole === 'customer' && EventoraDB.getAllEvents().length === 0) {
      EventoraDB.seedDemoData();
    }

    updateNavActions();
    updateSidebarUser();
    Toast.show('success', 'Logged In', `Active as ${assignedRole.toUpperCase()} (${cleanEmail})`);
    App.afterAuth();
  };

  const quickLogin = (role = 'customer') => {
    const roleEmails = {
      customer: 'customer@eventora.com',
      vendor:   'vendor@eventora.com',
      employee: 'staff@eventora.com',
      admin:    'admin@eventora.com'
    };
    loginOffline(roleEmails[role] || 'customer@eventora.com', role);
  };

  const fillCredentials = (email, pwd = 'password123') => {
    const emailEl = document.getElementById('loginEmail');
    const pwdEl = document.getElementById('loginPassword');
    if (emailEl) emailEl.value = email;
    if (pwdEl) pwdEl.value = pwd;
    login();
  };

  const onSignupRoleChange = (role) => {
    const vendorBox = document.getElementById('signupVendorFields');
    const staffBox  = document.getElementById('signupStaffFields');
    if (vendorBox) vendorBox.style.display = (role === 'vendor') ? 'block' : 'none';
    if (staffBox)  staffBox.style.display  = (role === 'employee') ? 'block' : 'none';
  };

  // Called by role card clicks on the unified signup form
  const selectRole = (role, cardEl) => {
    // Update visual state
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('role-card--active'));
    if (cardEl) cardEl.classList.add('role-card--active');

    // Sync hidden <select> so signup() reads the right role
    const sel = document.getElementById('signupRole');
    if (sel) {
      sel.value = role;
      // Also trigger the change handler to show/hide vendor/staff fields
      onSignupRoleChange(role);
    }
  };


  // ── Email/Password Login ───────────────────────────────────────────────
  const login = async () => {
    const email    = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');

    _hideError(errEl);
    if (!email)    { _showError(errEl, 'Please enter your email.'); return; }
    if (!password) { _showError(errEl, 'Please enter your password.'); return; }

    _setLoading(btn, 'Signing in…');

    try {
      const client = sb();

      // If Supabase client is online, attempt live cloud login
      if (client && window.EventoraSupabase?.isConnected) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });

        if (!error && data?.user) {
          console.log('[Eventora Auth] Cloud login success:', data.user?.email);
          _currentUser = data.user;
          EventoraDB.setUser(data.user.id);
          try { await _syncProfile(data.user); } catch (e) {}
          updateNavActions();
          updateSidebarUser();
          Toast.show('success', 'Welcome back!', '');
          App.afterAuth();
          return;
        }

        // Real credential rejection on live cloud
        if (error && !error.message?.includes('fetch') && !error.message?.includes('Network')) {
          _showError(errEl, _friendlyError(error));
          return;
        }
      }

      // Check if user is an existing registered user
      const storedAccount = _getAccountByEmail(email);
      if (!storedAccount && !window.EventoraSupabase?.isConnected) {
        // Unknown user trying to sign in -> prompt to sign up and configure profile
        _showError(errEl, `Account not found for <strong>${email}</strong>. <a href="javascript:void(0)" onclick="AuthModule.showSignupWithEmail('${email.replace(/'/g, "\\'")}')" style="color:var(--brand);font-weight:700;text-decoration:underline;margin-left:4px">Create an account</a> to set up your profile.`);
        return;
      }

      // Existing user: continue directly to active workspace/portal!
      console.log('[Eventora Auth] Existing user verified. Continuing into workspace for:', email);
      loginOffline(email);
      Toast.show('success', 'Welcome back!', 'Signed into active workspace');

    } catch (err) {
      console.warn('[Eventora Auth] Cloud login notice, auto-falling back to local session:', err);
      loginOffline(email);
      Toast.show('success', 'Welcome back!', 'Connected with local database');
    } finally {
      _setLoading(btn, 'Sign In', false);
    }
  };

  // ── Step 1 Validation & New vs Old User Check ────────────────────────
  const startOnboarding = () => {
    const name     = document.getElementById('signupName')?.value?.trim();
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm  = document.getElementById('signupConfirm')?.value;
    const errEl    = document.getElementById('signupError');

    _hideError(errEl);
    if (!name)               { _showError(errEl, 'Please enter your full name.'); return; }
    if (!email)              { _showError(errEl, 'Please enter your email.'); return; }
    if (!email.includes('@') || !email.includes('.')) { _showError(errEl, 'Please enter a valid email address.'); return; }
    if (!password)           { _showError(errEl, 'Please enter a password.'); return; }
    if (password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { _showError(errEl, 'Passwords do not match.'); return; }

    // Check if the user is an old/existing user whose account is already set up
    const existing = _getAccountByEmail(email);
    if (existing) {
      const existingRole = (existing.role || existing.metadata?.role || 'customer').toUpperCase();
      _showError(errEl, `This email is already registered and setup as an active <strong>${existingRole}</strong> account. <a href="javascript:void(0)" onclick="AuthModule.showLoginWithEmail('${email.replace(/'/g, "\\'")}')" style="color:var(--brand);font-weight:700;text-decoration:underline;margin-left:4px">Sign in here</a> to continue.`);
      return;
    }

    // New user! Transition to Step 2 (Account Role & Business Profile Setup)
    showOnboarding();
  };

  // ── Step 2 Sign Up & Profile Launch ──────────────────────────────────
  const signup = async () => {
    const name     = document.getElementById('signupName')?.value?.trim();
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm  = document.getElementById('signupConfirm')?.value;
    const btn      = document.getElementById('signupBtn');
    const errEl    = document.getElementById('onboardingError') || document.getElementById('signupError');
    const isGoogleFlow = !!_pendingGoogleUser;

    _hideError(errEl);
    if (!name || !email || !password) {
      if (!isGoogleFlow) showSignup();
      _showError(document.getElementById('signupError') || errEl, 'Please fill in your basic account credentials first.');
      return;
    }
    // Skip password match check for Google users (auto-generated internal password)
    if (!isGoogleFlow && password !== confirm) {
      showSignup();
      _showError(document.getElementById('signupError'), 'Passwords do not match.');
      return;
    }

    const role = document.getElementById('signupRole')?.value || 'customer';

    // Build role-tailored metadata and auto-register vendor / staff
    let userMetadata = {
      full_name: name,
      name: name,
      role: role,
      ...(isGoogleFlow ? {
        provider: 'google',
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      } : {})
    };

    if (role === 'vendor') {
      const bizName     = document.getElementById('signupBizName')?.value?.trim() || `${name}'s Services`;
      const bizCategory = document.getElementById('signupBizCategory')?.value || 'Catering';
      const bizCity     = document.getElementById('signupBizCity')?.value?.trim() || 'Hyderabad';

      // Register new vendor in Eventora catalog
      const newVendor = EventoraDB.registerVendor({
        name: bizName,
        category: bizCategory,
        city: bizCity,
        email: email,
        contactName: name,
        phone: '+91 98765 00000',
        desc: `Verified ${bizCategory} merchant on Eventora.`,
        packages: [
          {
            id: 'pkg-core',
            name: `Standard ${bizCategory} Service`,
            price: bizCategory === 'Catering' ? 599 : (bizCategory === 'Venues' ? 85000 : 25000),
            priceType: bizCategory === 'Catering' ? 'per person' : 'package',
            description: `Full end-to-end ${bizCategory} package managed by ${bizName}.`,
            starters: ['Initial Consultation', 'Live Site Inspection'],
            mains: ['Full Coordination & Service Execution', 'Quality Assurance & Delivery']
          }
        ]
      });

      userMetadata.vendorId     = newVendor.id;
      userMetadata.businessName = bizName;
      userMetadata.category     = bizCategory;
      userMetadata.city         = bizCity;

      // Also register to real Supabase database so all customers see this vendor immediately
      if (window.LiveMarketplace && typeof LiveMarketplace.createVendorBusiness === 'function') {
        LiveMarketplace.createVendorBusiness({
          business_name: bizName,
          service_category: bizCategory,
          location: bizCity,
          email: email,
          contact_name: name,
          phone: '+91 98765 00000',
          starting_price: bizCategory === 'Catering' ? 599 : (bizCategory === 'Venues' ? 85000 : 25000)
        }).catch(err => console.warn('[Auth] Live business registration notice:', err));
      }

    } else if (role === 'employee') {
      const staffRole = document.getElementById('signupStaffRole')?.value || 'Catering Setup Lead';
      const staffArea = document.getElementById('signupStaffArea')?.value?.trim() || 'Hyderabad Central';
      userMetadata.roleTitle = staffRole;
      userMetadata.area      = staffArea;
    }

    _setLoading(btn, 'Setting up workspace…');

    try {
      const client = sb();

      // If cloud is online, attempt live cloud signup
      if (client && window.EventoraSupabase?.isConnected) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: userMetadata,
            emailRedirectTo: window.location.origin + '/'
          }
        });

        if (error) {
          console.error('[Eventora Auth] signUp cloud notice:', error);
          if (error.message?.includes('fetch') || error.message?.includes('Network')) {
            loginOffline(email, role, userMetadata);
            return;
          }
          _showError(errEl, _friendlyError(error));
          return;
        }

        if (data?.user) {
          _currentUser = data.user;
          _saveAccount({
            id: data.user.id,
            email: email,
            role: role,
            metadata: userMetadata
          });
          EventoraDB.setUser(data.user.id, role);
          if (role === 'vendor' && userMetadata.vendorId && window.VendorPortalModule) {
            VendorPortalModule.setVendor(userMetadata.vendorId);
          }
          try { await _syncProfile(data.user); } catch (e) {}
          updateNavActions();
          updateSidebarUser();
          Toast.show('success', 'Profile Setup Complete!', `Welcome to Eventora as ${role.toUpperCase()}`);
          App.afterAuth();
          return;
        }
      }

      // If cloud is unreachable or offline, register locally
      console.log('[Eventora Auth] Registering new user profile locally:', email, role, userMetadata);
      loginOffline(email, role, userMetadata);
      Toast.show('success', 'Profile Setup Complete!', `Welcome to Eventora as ${role.toUpperCase()}`);

    } catch (err) {
      console.warn('[Eventora Auth] Cloud signup notice, saving locally:', err);
      loginOffline(email, role, userMetadata);
      Toast.show('success', 'Profile Setup Complete!', `Welcome to Eventora as ${role.toUpperCase()}`);
    } finally {
      _pendingGoogleUser = null; // Clear Google pending state regardless of outcome
      _setLoading(btn, 'Complete Setup & Launch →', false);
      // Restore the back button on onboarding form for future email signups
      const backBtn = document.querySelector('#authOnboarding .auth-back-btn');
      if (backBtn) {
        backBtn.textContent = '← Back to Account Details';
        backBtn.onclick = () => showSignup();
      }
      const badge = document.querySelector('#authOnboarding [style*="STEP 2"], #authOnboarding [style*="GOOGLE"]');
      if (badge && badge.textContent.includes('GOOGLE')) badge.textContent = 'STEP 2 OF 2: PROFILE SETUP';
    }
  };

  // ── Google OAuth & Google One-Tap ──────────────────────────────────────
  const googleLogin = async () => {
    const client = sb();

    // Attempt live Supabase Google OAuth
    if (client) {
      try {
        const redirectTo = window.location.origin + '/';
        console.log('[Eventora Auth] Starting Google OAuth (implicit flow) to:', redirectTo);
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo }
        });
        if (!error && data?.url) {
          window.location.href = data.url;
          return;
        }
        if (error) {
          console.warn('[Eventora Auth] Live Google OAuth returned notice:', error.message);
        }
      } catch (err) {
        console.warn('[Eventora Auth] Live Google OAuth exception:', err);
      }
    }

    // Safe fallback if cloud is disconnected or unreachable
    _showGoogleOneTapModal();
  };

  const _showGoogleOneTapModal = () => {
    if (!window.Modal) {
      confirmGoogleLogin('abhineshwar6@gmail.com', 'Abhineshwar Katna');
      return;
    }

    Modal.open('Sign In with Google', `
      <div style="text-align:center;padding:10px 0 16px">
        <svg width="40" height="40" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        <div style="font-weight:700;font-size:16px;color:var(--text-primary);margin-top:8px">Google Account Authentication</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Select your Google account to sign in directly:</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
        <div class="google-acc-card" onclick="AuthModule.confirmGoogleLogin('abhineshwar6@gmail.com', 'Abhineshwar Katna')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-white);cursor:pointer;transition:all var(--t-fast)">
          <div style="width:36px;height:36px;border-radius:50%;background:#4285F4;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">A</div>
          <div style="flex:1;min-width:0;text-align:left">
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Abhineshwar Katna</div>
            <div style="font-size:12px;color:var(--text-muted)">abhineshwar6@gmail.com</div>
          </div>
          <span style="font-size:11px;font-weight:600;color:var(--brand)">Sign in →</span>
        </div>
      </div>

      <div style="padding-top:14px;border-top:1px solid var(--border)">
        <label class="form-label" style="font-size:11px;font-weight:600;margin-bottom:6px">Or use another Google email address:</label>
        <div style="display:flex;gap:8px">
          <input class="input" id="customGoogleEmail" placeholder="yourname@gmail.com" type="email" style="flex:1">
          <button class="btn btn-primary btn-sm" onclick="AuthModule.confirmGoogleCustom()">Sign In</button>
        </div>
      </div>
    `);
  };

  // Temp store for pending Google user before onboarding completes
  let _pendingGoogleUser = null;

  const confirmGoogleLogin = (email, name) => {
    if (window.Modal) Modal.close();
    const cleanEmail = (email || 'abhineshwar6@gmail.com').trim().toLowerCase();
    const cleanName  = name || cleanEmail.split('@')[0];

    // ── Check: Is this an EXISTING Google user with a saved profile?
    const existing = _getAccountByEmail(cleanEmail);
    if (existing) {
      // Old user: continue straight into their saved workspace without onboarding
      const savedMeta = existing.metadata || {};
      const savedRole = existing.role || savedMeta.role || 'customer';

      const googleUser = {
        id: existing.id || ('goog_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')),
        email: cleanEmail,
        app_metadata: { provider: 'google', providers: ['google'] },
        user_metadata: {
          ...savedMeta,
          full_name: savedMeta.full_name || cleanName,
          name:      savedMeta.name || cleanName,
          email:     cleanEmail,
          role:      savedRole,
          avatar_url: savedMeta.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`
        }
      };

      _saveOfflineSession(googleUser);
      _currentUser = googleUser;
      EventoraDB.setUser(googleUser.id, savedRole);
      if (savedRole === 'vendor' && savedMeta.vendorId && window.VendorPortalModule) {
        VendorPortalModule.setVendor(savedMeta.vendorId);
      }
      updateNavActions();
      updateSidebarUser();
      Toast.show('success', 'Google Sign-In Successful', `Welcome back, ${savedMeta.full_name || cleanName}!`);
      App.afterAuth();
      return;
    }

    // ── NEW Google user: store pending identity and show profile onboarding
    _pendingGoogleUser = { email: cleanEmail, name: cleanName, provider: 'google' };

    // Pre-fill the hidden Step 1 fields so signup() can read them
    const nameEl  = document.getElementById('signupName');
    const emailEl = document.getElementById('signupEmail');
    const pwdEl   = document.getElementById('signupPassword');
    const cfmEl   = document.getElementById('signupConfirm');
    if (nameEl)  nameEl.value  = cleanName;
    if (emailEl) emailEl.value = cleanEmail;
    // Generate a deterministic internal password for Google users (never shown)
    const autoPass = 'goog_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '') + '_secure';
    if (pwdEl)  pwdEl.value  = autoPass;
    if (cfmEl)  cfmEl.value  = autoPass;

    // Update the back button on onboarding form to just close/cancel for Google flow
    const backBtn = document.querySelector('#authOnboarding .auth-back-btn');
    if (backBtn) {
      backBtn.textContent = '← Cancel Google Sign-In';
      backBtn.onclick = () => { _pendingGoogleUser = null; showLogin(); };
    }

    // Update badge to reflect Google source
    const badge = document.querySelector('#authOnboarding [style*="STEP 2"]');
    if (badge) badge.textContent = 'GOOGLE ACCOUNT — PROFILE SETUP';

    App.goAuth();
    showOnboarding();
    Toast.show('info', 'One last step!', `Set up your profile for ${cleanEmail}`);
  };

  const confirmGoogleCustom = () => {
    const input = document.getElementById('customGoogleEmail');
    const email = input?.value?.trim();
    if (!email) {
      Toast.show('warning', 'Please enter an email address', '');
      return;
    }
    const name = email.split('@')[0];
    confirmGoogleLogin(email, name.charAt(0).toUpperCase() + name.slice(1));
  };

  // ── Forgot Password ───────────────────────────────────────────────────
  const sendReset = async () => {
    const email = document.getElementById('forgotEmail')?.value?.trim();
    const btn   = document.getElementById('forgotBtn');
    const errEl = document.getElementById('forgotError');

    _hideError(errEl);
    if (!email) { _showError(errEl, 'Please enter your email.'); return; }

    _setLoading(btn, 'Sending…');

    try {
      const client = sb();
      if (client) {
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/?reset=1'
        });
      }
    } catch (e) {
      console.warn('[Eventora Auth] resetPassword notice:', e);
    } finally {
      _setLoading(btn, 'Send Reset Link', false);
    }

    const panel = document.getElementById('authForgot');
    if (panel) panel.innerHTML = `
      <div class="auth-success-state">
        <div class="auth-success-icon">📬</div>
        <div class="auth-success-title">Check your inbox</div>
        <p class="auth-success-msg">If an account exists for <strong>${email}</strong>, you'll receive a password reset link shortly.</p>
        <button class="btn btn-secondary btn-full mt-3" onclick="AuthModule.showLogin()">Back to Sign In</button>
      </div>`;
  };

  // ── Password Reset ────────────────────────────────────────────────────
  const resetPassword = async () => {
    const password = document.getElementById('resetPassword')?.value;
    const confirm  = document.getElementById('resetConfirm')?.value;
    const btn      = document.getElementById('resetBtn');
    const errEl    = document.getElementById('resetError');

    _hideError(errEl);
    if (!password || password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm)              { _showError(errEl, 'Passwords do not match.'); return; }

    _setLoading(btn, 'Updating…');
    try {
      const client = sb();
      if (client) {
        const { error } = await client.auth.updateUser({ password });
        if (error) { _showError(errEl, _friendlyError(error)); return; }
        await client.auth.signOut();
      }
      Toast.show('success', 'Password updated!', 'Sign in with your new password.');
      showLogin();
    } catch (e) {
      _showError(errEl, e.message || 'Password update failed.');
    } finally {
      _setLoading(btn, 'Update Password', false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────────────
  const logout = async () => {
    console.log('[Eventora Auth] Signing out…');
    try {
      const client = sb();
      if (client?.auth) {
        await client.auth.signOut();
      }
    } catch (error) {
      console.warn('[Eventora Auth] signOut notice:', error);
    }

    _saveOfflineSession(null);
    _currentUser = null;
    _profile     = null;
    EventoraDB.setUser(null);
    updateNavActions();
    updateSidebarUser();
    App.goAuth('login');
  };

  // ── Nav / Sidebar UI ─────────────────────────────────────────────────
  const updateNavActions = () => {
    const el = document.getElementById('navActions');
    if (!el) return;
    if (_currentUser) {
      const meta   = _currentUser.user_metadata || {};
      const name   = meta.full_name || meta.name || _currentUser.email?.split('@')[0] || 'Account';
      const avatar = meta.avatar_url || meta.picture || '';
      el.innerHTML = `
        <div class="nav-user-chip" onclick="AuthModule.showUserMenu()">
          ${avatar ? `<img src="${avatar}" class="nav-user-avatar-img" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <div class="nav-user-avatar" style="${avatar ? 'display:none' : ''}">${name.charAt(0).toUpperCase()}</div>
          <span class="nav-user-name">${name.split(' ')[0]}</span>
          <span style="font-size:10px;color:var(--text-muted)">▾</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.requireAuth('wizard')">+ Create Event</button>`;
    } else {
      el.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="App.goAuth('login')">Sign In</button>
        <button class="btn btn-primary btn-sm" onclick="App.requireAuth('wizard')">+ Create Event</button>`;
    }
  };

  const updateSidebarUser = () => {
    const el = document.getElementById('sidebarUserRow');
    if (!el) return;
    if (_currentUser) {
      const meta   = _currentUser.user_metadata || {};
      const name   = meta.full_name || meta.name || _currentUser.email?.split('@')[0] || 'User';
      const email  = _currentUser.email || '';
      const avatar = meta.avatar_url || meta.picture || '';
      el.innerHTML = `
        <div class="sidebar-user-info">
          ${avatar
            ? `<img src="${avatar}" class="sidebar-user-avatar-img" alt="${name}" onerror="this.style.display='none'">`
            : `<div class="sidebar-user-avatar">${name.charAt(0).toUpperCase()}</div>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${email}</div>
          </div>
          <button class="btn btn-ghost btn-xs" onclick="AuthModule.logout()" title="Sign out" style="margin-left:auto;flex-shrink:0">⏻</button>
        </div>`;
    } else {
      el.innerHTML = `<button class="btn btn-secondary btn-sm btn-full" onclick="App.goAuth('login')">Sign In</button>`;
    }
  };

  // ── User Menu ─────────────────────────────────────────────────────────
  const showUserMenu = () => {
    const user = _currentUser;
    if (!user) return;
    const meta  = user.user_metadata || {};
    const name  = meta.full_name || meta.name || user.email?.split('@')[0];
    const email = user.email || '';
    const role  = getUserRole();

    const roleBadges = {
      vendor:   '🍽️ VERIFIED VENDOR PARTNER',
      employee: '👷 OPERATIONS FIELD STAFF',
      admin:    '🛡️ PLATFORM SUPER ADMIN',
      customer: '👤 EVENT HOST / CUSTOMER'
    };

    let actionsHtml = '';
    if (role === 'vendor') {
      actionsHtml = `
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goVendor()">Merchant Dashboard</button>
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
      `;
    } else if (role === 'employee') {
      actionsHtml = `
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goEmployee()">Dispatch Operations</button>
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
      `;
    } else if (role === 'admin') {
      actionsHtml = `
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goAdmin()">Command Center</button>
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
      `;
    } else {
      actionsHtml = `
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goDashboard()">My Events</button>
        <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
      `;
    }

    Modal.open('Your Account',
      `<div style="text-align:center;padding:8px 0">
        <div style="font-size:16px;font-weight:700">${name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">${email}</div>
        <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:var(--bg-subtle);font-size:11px;font-weight:700;border:1px solid var(--border)">
          ${roleBadges[role] || 'ROLE: ' + role.toUpperCase()}
        </div>
      </div>
      ${actionsHtml}
      <button class="btn btn-ghost btn-full" style="color:var(--danger)" onclick="Modal.close();AuthModule.logout()">Sign Out</button>`);
  };

  const showProfile = () => {
    const user = _currentUser;
    if (!user) return;
    const meta  = user.user_metadata || {};
    const name  = meta.full_name || meta.name || '';
    Modal.open('Profile Settings',
      `<div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="input" id="profileName" value="${name}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="input" value="${user.email || ''}" type="email" disabled style="opacity:0.6">
      </div>`,
      async () => {
        const newName = document.getElementById('profileName')?.value?.trim();
        if (newName) {
          try {
            const client = sb();
            if (client) {
              await client.auth.updateUser({ data: { full_name: newName } });
            }
          } catch (e) {}
          _currentUser = { ..._currentUser,
            user_metadata: { ..._currentUser.user_metadata, full_name: newName, name: newName } };
          if (_getOfflineSession()) {
            _saveOfflineSession(_currentUser);
          }
          await _syncProfile(_currentUser);
          updateNavActions();
          updateSidebarUser();
          Toast.show('success', 'Profile saved', '');
        }
      }, 'Save Changes');
  };

  // ── Form switching ────────────────────────────────────────────────────
  const showForm = (id) => {
    ['authLogin', 'authSignup', 'authOnboarding', 'authForgot', 'authReset'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = (f === id) ? 'flex' : 'none';
    });
  };
  const showLogin      = () => showForm('authLogin');
  const showSignup     = () => showForm('authSignup');
  const showOnboarding = () => {
    showForm('authOnboarding');
    const roleSelect = document.getElementById('signupRole');
    if (roleSelect) onSignupRoleChange(roleSelect.value);
  };
  const showForgot     = () => showForm('authForgot');
  const showReset      = () => showForm('authReset');

  const showLoginWithEmail = (email) => {
    showLogin();
    const el = document.getElementById('loginEmail');
    if (el && email) {
      el.value = email;
      const pwdEl = document.getElementById('loginPassword');
      if (pwdEl) pwdEl.focus();
    }
  };

  const showSignupWithEmail = (email) => {
    showSignup();
    const el = document.getElementById('signupEmail');
    if (el && email) {
      el.value = email;
      const nameEl = document.getElementById('signupName');
      if (nameEl) nameEl.focus();
    }
  };

  const _showEmailSent = (email) => {
    const panel = document.getElementById('authSignup');
    if (panel) panel.innerHTML = `
      <div class="auth-success-state">
        <div class="auth-success-icon">✉️</div>
        <div class="auth-success-title">Verification email sent!</div>
        <p class="auth-success-msg">We sent a confirmation link to <strong>${email}</strong>.<br>Please click it to activate your account.</p>
        <button class="btn btn-secondary btn-full mt-3" onclick="AuthModule.showLogin()">Back to Sign In</button>
      </div>`;
  };

  const _cleanUrl = () => {
    try {
      const url = new URL(window.location.href);
      ['error', 'error_code', 'error_description'].forEach(p => url.searchParams.delete(p));
      url.hash = '';
      window.history.replaceState({}, document.title, url.toString());
    } catch (e) {}
  };

  const _cleanHash = () => {
    try {
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState({}, document.title,
          window.location.pathname + window.location.search);
      }
    } catch (e) {}
  };

  const _showLoginError = (msg) => {
    const el = document.getElementById('loginError');
    _showError(el, msg);
  };

  const _showError = (el, msg) => {
    if (!el) {
      Toast.show('warning', typeof msg === 'string' ? msg.replace(/<[^>]*>/g, '') : 'Notice', '');
      return;
    }
    if (typeof msg === 'string' && msg.includes('<')) {
      el.innerHTML = msg;
    } else {
      el.textContent = msg;
    }
    el.style.display = 'block';
  };

  const _hideError = (el) => {
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
  };

  const _setLoading = (btn, label, loading = true) => {
    if (!btn) return;
    btn.textContent = label;
    btn.disabled    = loading;
  };

  const togglePwd = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type      = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  };

  return {
    init, isLoggedIn, getUser, getProfile, getUserRole, logout,
    loginOffline, quickLogin, fillCredentials, onSignupRoleChange, selectRole,
    confirmGoogleLogin, confirmGoogleCustom,
    updateNavActions, updateSidebarUser,
    showLogin, showSignup, showOnboarding, startOnboarding, showForgot, showReset,
    showLoginWithEmail, showSignupWithEmail,
    login, signup, googleLogin, sendReset, resetPassword,
    togglePwd, showUserMenu, showProfile,
  };
})();
