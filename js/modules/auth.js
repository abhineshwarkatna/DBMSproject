/**
 * EVENTORA — Real Authentication Module
 * Uses Supabase Auth as single source of truth.
 *
 * ROOT CAUSE FIX (Google OAuth Login Loop):
 * Supabase JS v2 uses PKCE flow by default. After Google redirects back,
 * the URL contains ?code=... which MUST be exchanged for a session via
 * exchangeCodeForSession(). Without this, getSession() returns null and
 * the app incorrectly redirects to the login page — causing the loop.
 *
 * This module handles the full OAuth callback correctly.
 */
window.AuthModule = (() => {

  // ── Supabase client accessor ───────────────────────────────────────────
  const sb = () => window.EventoraSupabase?.client;

  // ── In-memory state ───────────────────────────────────────────────────
  let _currentUser = null;

  const getUser    = () => _currentUser;
  const isLoggedIn = () => !!_currentUser;

  // ── Human-readable error mapping ──────────────────────────────────────
  const _friendlyError = (err) => {
    if (!err) return 'Something went wrong. Please try again.';
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials'))
      return 'Incorrect email or password.';
    if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed'))
      return 'Please verify your email before signing in. Check your inbox.';
    if (msg.includes('user already registered') || msg.includes('already_registered'))
      return 'An account with this email already exists. Try signing in.';
    if (msg.includes('password should be at least') || msg.includes('should be at least 6'))
      return 'Password must be at least 6 characters.';
    if (msg.includes('unable to validate email'))
      return 'Please enter a valid email address.';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('network') || msg.includes('fetch'))
      return 'Network error. Check your connection and try again.';
    if (msg.includes('pkce') || msg.includes('code') || msg.includes('exchange'))
      return 'Google sign-in could not be completed. Please try again.';
    return 'Something went wrong. Please try again.';
  };

  // ── Auth State Listener ────────────────────────────────────────────────
  // Reacts to SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, PASSWORD_RECOVERY
  const _initStateListener = () => {
    const client = sb();
    if (!client) return;

    client.auth.onAuthStateChange(async (event, session) => {
      console.log('[Eventora Auth] State change:', event, session?.user?.email || 'no user');
      const user = session?.user ?? null;
      _currentUser = user;

      if (event === 'SIGNED_IN' && user) {
        EventoraDB.setUser(user.id);
        updateNavActions();
        updateSidebarUser();
        // Only seed if this is a brand new user with no events
        if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
        // Route to app (safe to call multiple times — it's idempotent)
        App.afterAuth();
      }

      if (event === 'SIGNED_OUT') {
        _currentUser = null;
        EventoraDB.setUser(null);
        updateNavActions();
        updateSidebarUser();
        App.goAuth('login');
      }

      if (event === 'PASSWORD_RECOVERY') {
        // Show password reset form when user clicks email link
        App.goAuth('login');
        setTimeout(() => showForm('authReset'), 100);
      }

      if (event === 'TOKEN_REFRESHED') {
        _currentUser = user;
      }
    });
  };

  // ── MAIN INIT — handles OAuth callback AND regular session restore ─────
  const init = async () => {
    const client = sb();
    if (!client) {
      console.warn('[Eventora Auth] Supabase client not available — showing login.');
      App.goAuth('login');
      return;
    }

    // Register the auth state listener FIRST, before any session check
    _initStateListener();

    // ── STEP 1: Handle OAuth callback (?code= or ?error= in URL) ─────────
    const urlParams = new URLSearchParams(window.location.search);
    const code      = urlParams.get('code');
    const errorParam = urlParams.get('error');
    const errorDesc  = urlParams.get('error_description');

    if (errorParam) {
      // OAuth returned an error (e.g., user denied access)
      console.error('[Eventora Auth] OAuth error:', errorParam, errorDesc);
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      App.goAuth('login');
      const errEl = document.getElementById('loginError');
      if (errEl) {
        errEl.textContent = errorParam === 'access_denied'
          ? 'Google sign-in was cancelled. Please try again.'
          : 'Google sign-in could not be completed. Please try again.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (code) {
      // ── PKCE: exchange the code for a real session ─────────────────────
      console.log('[Eventora Auth] OAuth code detected — exchanging for session…');
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[Eventora Auth] Code exchange failed:', error.message);
          // Clean the URL and show friendly error
          window.history.replaceState({}, document.title, window.location.pathname);
          App.goAuth('login');
          const errEl = document.getElementById('loginError');
          if (errEl) {
            errEl.textContent = 'Google sign-in could not be completed. Please try again.';
            errEl.style.display = 'block';
          }
          return;
        }

        // Code exchanged successfully — session is now active
        // onAuthStateChange (SIGNED_IN) fires automatically and routes to dashboard
        // Clean the ?code= from URL so refresh doesn't re-exchange
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('[Eventora Auth] Code exchanged — session active for:', data.user?.email);
        // Don't call getSession again — onAuthStateChange will handle routing
        return;

      } catch (err) {
        console.error('[Eventora Auth] exchangeCodeForSession threw:', err);
        window.history.replaceState({}, document.title, window.location.pathname);
        App.goAuth('login');
        return;
      }
    }

    // ── STEP 2: No OAuth code — regular session check (page reload, direct visit)
    const { data: { session }, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      console.error('[Eventora Auth] getSession error:', sessionError.message);
      App.goAuth('login');
      return;
    }

    if (session?.user) {
      _currentUser = session.user;
      EventoraDB.setUser(session.user.id);
      if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
      updateNavActions();
      updateSidebarUser();
      console.log('[Eventora Auth] Session restored for:', session.user.email);
      App.afterAuth();
    } else {
      _currentUser = null;
      console.log('[Eventora Auth] No session — showing login.');
      App.goAuth('login');
    }
  };

  // ── Email/Password Login ───────────────────────────────────────────────
  const login = async () => {
    const email    = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    if (!email)    { _showError(errEl, 'Please enter your email.'); return; }
    if (!password) { _showError(errEl, 'Please enter your password.'); return; }

    _setLoading(btn, 'Signing in…');

    const { data, error } = await sb().auth.signInWithPassword({ email, password });

    _setLoading(btn, 'Sign In', false);

    if (error) {
      _showError(errEl, _friendlyError(error));
      return;
    }

    // onAuthStateChange (SIGNED_IN) handles routing to dashboard
    Toast.show('success', 'Welcome back!', '');
  };

  // ── Sign Up ────────────────────────────────────────────────────────────
  const signup = async () => {
    const name     = document.getElementById('signupName')?.value?.trim();
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm  = document.getElementById('signupConfirm')?.value;
    const btn      = document.getElementById('signupBtn');
    const errEl    = document.getElementById('signupError');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

    if (!name)     { _showError(errEl, 'Please enter your full name.'); return; }
    if (!email)    { _showError(errEl, 'Please enter your email.'); return; }
    if (!password) { _showError(errEl, 'Please enter a password.'); return; }
    if (password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { _showError(errEl, 'Passwords do not match.'); return; }

    _setLoading(btn, 'Creating account…');

    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin + window.location.pathname
      }
    });

    _setLoading(btn, 'Create Account', false);

    if (error) {
      _showError(errEl, _friendlyError(error));
      return;
    }

    // If email confirmation required, show success screen
    // If auto-confirmed (disabled confirmation), onAuthStateChange routes to dashboard
    if (data?.user && !data.session) {
      _showEmailSent(email);
    }
  };

  // ── Google OAuth Login ────────────────────────────────────────────────
  // Uses PKCE flow — after Google auth, Supabase redirects back with ?code=
  // The init() function handles exchanging that code for a session.
  const googleLogin = async () => {
    const client = sb();
    if (!client) {
      Toast.show('error', 'Not connected', 'Please check your connection.');
      return;
    }

    // Determine correct redirect URL for current environment
    const redirectTo = window.location.origin + window.location.pathname;

    console.log('[Eventora Auth] Starting Google OAuth, redirectTo:', redirectTo);

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // Do NOT pass skipBrowserRedirect: true — we want the browser to redirect
      }
    });

    if (error) {
      console.error('[Eventora Auth] Google OAuth error:', error.message);
      Toast.show('error', 'Google sign-in failed', 'Please try again.');
    }
    // If no error: browser will redirect to Google, then back to this page
    // init() will handle the ?code= parameter on return
  };

  // ── Forgot Password ───────────────────────────────────────────────────
  const sendReset = async () => {
    const email = document.getElementById('forgotEmail')?.value?.trim();
    const btn   = document.getElementById('forgotBtn');
    const errEl = document.getElementById('forgotError');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (!email) { _showError(errEl, 'Please enter your email.'); return; }

    _setLoading(btn, 'Sending…');

    await sb().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?reset=1'
    });

    _setLoading(btn, 'Send Reset Link', false);

    // Always show success — never reveal if email exists
    const panel = document.getElementById('authForgot');
    if (panel) panel.innerHTML = `
      <div class="auth-success-state">
        <div class="auth-success-icon">📬</div>
        <div class="auth-success-title">Check your inbox</div>
        <p class="auth-success-msg">If an account exists for <strong>${email}</strong>, you'll receive a password reset link shortly.</p>
        <button class="btn btn-secondary btn-full mt-3" onclick="AuthModule.showLogin()">Back to Sign In</button>
      </div>`;
  };

  // ── Password Reset (after clicking the link in email) ─────────────────
  const resetPassword = async () => {
    const password = document.getElementById('resetPassword')?.value;
    const confirm  = document.getElementById('resetConfirm')?.value;
    const btn      = document.getElementById('resetBtn');
    const errEl    = document.getElementById('resetError');

    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if (!password || password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm)              { _showError(errEl, 'Passwords do not match.'); return; }

    _setLoading(btn, 'Updating…');

    const { error } = await sb().auth.updateUser({ password });

    _setLoading(btn, 'Update Password', false);

    if (error) { _showError(errEl, _friendlyError(error)); return; }

    Toast.show('success', 'Password updated!', 'You can now sign in with your new password.');
    await sb().auth.signOut();
    showLogin();
  };

  // ── Logout ────────────────────────────────────────────────────────────
  const logout = async () => {
    console.log('[Eventora Auth] Signing out…');
    await sb().auth.signOut();
    // onAuthStateChange (SIGNED_OUT) clears state and redirects to login
  };

  // ── Nav & Sidebar UI Updates ──────────────────────────────────────────
  const updateNavActions = () => {
    const el = document.getElementById('navActions');
    if (!el) return;
    if (_currentUser) {
      const name   = _currentUser.user_metadata?.full_name
                   || _currentUser.user_metadata?.name
                   || _currentUser.email?.split('@')[0]
                   || 'Account';
      const avatar = _currentUser.user_metadata?.avatar_url
                   || _currentUser.user_metadata?.picture;
      el.innerHTML = `
        <div class="nav-user-chip" onclick="AuthModule.showUserMenu()">
          ${avatar
            ? `<img src="${avatar}" class="nav-user-avatar-img" alt="${name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
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
      const name   = _currentUser.user_metadata?.full_name
                   || _currentUser.user_metadata?.name
                   || _currentUser.email?.split('@')[0]
                   || 'User';
      const email  = _currentUser.email || '';
      const avatar = _currentUser.user_metadata?.avatar_url
                   || _currentUser.user_metadata?.picture;
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

  // ── User Account Menu ─────────────────────────────────────────────────
  const showUserMenu = () => {
    const user = _currentUser;
    if (!user) return;
    const name  = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
    const email = user.email || '';
    Modal.open('Your Account',
      `<div style="text-align:center;padding:8px 0">
        <div style="font-size:15px;font-weight:700">${name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">${email}</div>
      </div>
      <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goDashboard()">My Events</button>
      <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
      <button class="btn btn-ghost btn-full" style="color:var(--danger)" onclick="Modal.close();AuthModule.logout()">Sign Out</button>`);
  };

  const showProfile = () => {
    const user = _currentUser;
    if (!user) return;
    const name  = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const email = user.email || '';
    Modal.open('Profile Settings',
      `<div class="form-group"><label class="form-label">Full Name</label><input class="input" id="profileName" value="${name}"></div>
       <div class="form-group"><label class="form-label">Email</label><input class="input" value="${email}" type="email" disabled style="opacity:0.6"></div>`,
      async () => {
        const newName = document.getElementById('profileName')?.value?.trim();
        if (newName) {
          const { error } = await sb().auth.updateUser({ data: { full_name: newName } });
          if (!error) {
            _currentUser = { ..._currentUser, user_metadata: { ..._currentUser.user_metadata, full_name: newName } };
            updateNavActions();
            updateSidebarUser();
            Toast.show('success', 'Profile saved', '');
          }
        }
      }, 'Save Changes');
  };

  // ── Form Visibility ───────────────────────────────────────────────────
  const showForm = (id) => {
    ['authLogin', 'authSignup', 'authForgot', 'authReset'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = (f === id) ? 'flex' : 'none';
    });
  };

  const showLogin  = () => showForm('authLogin');
  const showSignup = () => showForm('authSignup');
  const showForgot = () => showForm('authForgot');

  // ── Email Verification Sent Screen ───────────────────────────────────
  const _showEmailSent = (email) => {
    const panel = document.getElementById('authSignup');
    if (!panel) return;
    panel.innerHTML = `
      <div class="auth-success-state">
        <div class="auth-success-icon">✉️</div>
        <div class="auth-success-title">Check your email</div>
        <p class="auth-success-msg">We sent a verification link to<br><strong>${email}</strong></p>
        <p style="font-size:13px;color:var(--text-muted);margin-top:8px">Click the link to activate your account, then sign in.</p>
        <button class="btn btn-primary btn-full mt-3" onclick="AuthModule.showLogin()">Go to Sign In</button>
      </div>`;
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const _showError = (el, msg) => {
    if (!el) { Toast.show('warning', msg, ''); return; }
    el.textContent    = msg;
    el.style.display  = 'block';
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
    init, isLoggedIn, getUser, logout,
    updateNavActions, updateSidebarUser,
    showLogin, showSignup, showForgot,
    login, signup, googleLogin, sendReset, resetPassword,
    togglePwd, showUserMenu, showProfile,
  };
})();
