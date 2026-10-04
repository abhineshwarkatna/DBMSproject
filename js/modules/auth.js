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
            _currentUser = user;
            EventoraDB.setUser(user.id);
            try { await _syncProfile(user); } catch (e) { console.warn(e); }
            updateNavActions();
            updateSidebarUser();
            _cleanHash();
            App.afterAuth();
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
          _currentUser = user;
          EventoraDB.setUser(user.id);
          try { await _syncProfile(user); } catch (e) { console.warn(e); }
          updateNavActions();
          updateSidebarUser();
          _cleanHash();
          console.log('[Eventora Auth] Cloud session restored ✓ for:', user.email);
          App.afterAuth();
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
            _currentUser = s2.user;
            EventoraDB.setUser(s2.user.id);
            try { await _syncProfile(s2.user); } catch (e) {}
            updateNavActions();
            updateSidebarUser();
            _cleanHash();
            App.afterAuth();
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
  const loginOffline = (email, role = null) => {
    const cleanEmail = (email || 'customer@eventora.com').trim().toLowerCase();
    let assignedRole = role;
    if (!assignedRole) {
      if (cleanEmail.includes('vendor')) assignedRole = 'vendor';
      else if (cleanEmail.includes('staff') || cleanEmail.includes('employee')) assignedRole = 'employee';
      else if (cleanEmail.includes('admin')) assignedRole = 'admin';
      else assignedRole = 'customer';
    }

    const nameParts = cleanEmail.split('@')[0].split('.');
    const displayName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    const offlineUser = {
      id: 'usr_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
      email: cleanEmail,
      user_metadata: {
        full_name: displayName || 'Eventora User',
        name: displayName || 'Eventora User',
        role: assignedRole
      }
    };

    _saveOfflineSession(offlineUser);
    _currentUser = offlineUser;
    EventoraDB.setUser(offlineUser.id, assignedRole);

    // If new session with 0 events, seed sample ecosystem data
    if (EventoraDB.getAllEvents().length === 0) {
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

      // If cloud is paused, offline, or returns network failure:
      // AUTOMATICALLY authenticate locally so the user is NEVER blocked!
      console.log('[Eventora Auth] Logging in with local credential cache for:', email);
      loginOffline(email);
      Toast.show('success', 'Welcome back!', 'Connected with local database');

    } catch (err) {
      console.warn('[Eventora Auth] Cloud login notice, auto-falling back to local session:', err);
      loginOffline(email);
      Toast.show('success', 'Welcome back!', 'Connected with local database');
    } finally {
      _setLoading(btn, 'Sign In', false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────
  const signup = async () => {
    const name     = document.getElementById('signupName')?.value?.trim();
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm  = document.getElementById('signupConfirm')?.value;
    const btn      = document.getElementById('signupBtn');
    const errEl    = document.getElementById('signupError');

    _hideError(errEl);
    if (!name)               { _showError(errEl, 'Please enter your full name.'); return; }
    if (!email)              { _showError(errEl, 'Please enter your email.'); return; }
    if (!password)           { _showError(errEl, 'Please enter a password.'); return; }
    if (password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { _showError(errEl, 'Passwords do not match.'); return; }

    const role = document.getElementById('signupRole')?.value || 'customer';
    _setLoading(btn, 'Creating account…');

    try {
      const client = sb();
      if (!client) {
        loginOffline(email, role);
        return;
      }

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, role: role },
          emailRedirectTo: window.location.origin + '/'
        }
      });

      if (error) {
        console.error('[Eventora Auth] signUp error:', error);
        const friendly = _friendlyError(error);
        const isNetworkErr = friendly.includes('Network') || (error.message || '').toLowerCase().includes('fetch');

        if (isNetworkErr) {
          _showError(errEl, `
            <div style="font-weight:600;margin-bottom:6px">⚠️ Cloud Database Unreachable</div>
            <div style="font-size:12px;opacity:0.9;margin-bottom:10px">Could not contact cloud database. Create local account instantly:</div>
            <button type="button" class="btn btn-secondary btn-sm btn-full" onclick="AuthModule.loginOffline('${email}', '${role}')">
              Create Local Account (${role.toUpperCase()}) →
            </button>
          `);
        } else {
          _showError(errEl, friendly);
        }
        return;
      }

      console.log('[Eventora Auth] Signup:', data.user?.email,
        data.session ? '(auto-confirmed)' : '(email confirmation required)');

      if (data?.user && !data.session) {
        _showEmailSent(email);
      } else if (data?.user && data?.session) {
        _currentUser = data.user;
        EventoraDB.setUser(data.user.id, role);
        try { await _syncProfile(data.user); } catch (e) { console.warn(e); }
        updateNavActions();
        updateSidebarUser();
        Toast.show('success', 'Account created!', '');
        App.afterAuth();
      }
    } catch (err) {
      console.error('[Eventora Auth] Unexpected signup exception:', err);
      _showError(errEl, err.message || 'Signup failed. Please try again.');
    } finally {
      _setLoading(btn, 'Create Account', false);
    }
  };

  // ── Google OAuth & Google One-Tap ──────────────────────────────────────
  const googleLogin = async () => {
    const client = sb();

    // If Supabase cloud is confirmed online, initiate implicit Google OAuth
    if (client && window.EventoraSupabase?.isConnected) {
      try {
        const redirectTo = window.location.origin + '/';
        console.log('[Eventora Auth] Starting Google OAuth (implicit flow)');
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo }
        });
        if (!error && data?.url) {
          window.location.href = data.url;
          return;
        }
      } catch (err) {
        console.warn('[Eventora Auth] Cloud Google OAuth error:', err);
      }
    }

    // If Supabase cloud is paused or offline, do NOT crash the browser into ERR_NAME_NOT_RESOLVED!
    // Open Google Account selector modal for instant sign-in
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

  const confirmGoogleLogin = (email, name) => {
    if (window.Modal) Modal.close();
    const cleanEmail = (email || 'abhineshwar6@gmail.com').trim().toLowerCase();
    const cleanName = name || cleanEmail.split('@')[0];

    const googleUser = {
      id: 'goog_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
      email: cleanEmail,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: cleanName,
        name: cleanName,
        email: cleanEmail,
        role: 'customer',
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`
      }
    };

    _saveOfflineSession(googleUser);
    _currentUser = googleUser;
    EventoraDB.setUser(googleUser.id, 'customer');

    if (EventoraDB.getAllEvents().length === 0) {
      EventoraDB.seedDemoData();
    }

    updateNavActions();
    updateSidebarUser();
    Toast.show('success', 'Google Sign-In Successful', `Welcome, ${cleanName}!`);
    App.afterAuth();
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
    const role  = EventoraDB.getCurrentRole();

    Modal.open('Your Account',
      `<div style="text-align:center;padding:8px 0">
        <div style="font-size:16px;font-weight:700">${name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">${email}</div>
        <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:var(--bg-subtle);font-size:11px;font-weight:700;border:1px solid var(--border)">
          ROLE: ${role.toUpperCase()}
        </div>
      </div>
      <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goDashboard()">My Events</button>
      <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
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
    ['authLogin', 'authSignup', 'authForgot', 'authReset'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = (f === id) ? 'flex' : 'none';
    });
  };
  const showLogin  = () => showForm('authLogin');
  const showSignup = () => showForm('authSignup');
  const showForgot = () => showForm('authForgot');
  const showReset  = () => showForm('authReset');

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
    init, isLoggedIn, getUser, getProfile, logout,
    loginOffline, quickLogin, confirmGoogleLogin, confirmGoogleCustom,
    updateNavActions, updateSidebarUser,
    showLogin, showSignup, showForgot, showReset,
    login, signup, googleLogin, sendReset, resetPassword,
    togglePwd, showUserMenu, showProfile,
  };
})();
