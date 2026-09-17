/**
 * EVENTORA — Authentication Module
 * Source of truth: Supabase Auth
 *
 * ARCHITECTURE:
 *  supabaseClient.js  → createClient with flowType:'pkce', detectSessionInUrl:false
 *  auth.js init()     → manually checks ?code= ONCE → exchangeCodeForSession → getSession
 *  onAuthStateChange  → keeps UI in sync after login/logout/token refresh
 *
 * WHY detectSessionInUrl:false?
 *  With detectSessionInUrl:true, the Supabase client starts an async exchange in <head>.
 *  auth.js (bottom of <body>) then also calls exchangeCodeForSession on DOMContentLoaded.
 *  The second exchange fails (code already consumed) → error handler → goAuth('login') → loop.
 *  Solution: turn off automatic detection and handle it exactly once, here.
 */
window.AuthModule = (() => {

  // ── Supabase client accessor ──────────────────────────────────────────
  const sb = () => window.EventoraSupabase?.client;

  // ── In-memory auth state ──────────────────────────────────────────────
  let _currentUser    = null;
  let _profile        = null;   // public.profiles row
  let _listenerActive = false;  // guard against double-listener registration

  const getUser    = () => _currentUser;
  const getProfile = () => _profile;
  const isLoggedIn = () => !!_currentUser;

  // ── Human-readable error messages ─────────────────────────────────────
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
    return 'Something went wrong. Please try again.';
  };

  // ── Profile sync — upsert authenticated user into public.profiles ─────
  // Called after every sign-in so Google users get their profile stored.
  const _syncProfile = async (user) => {
    if (!user) return null;
    const client = sb();
    if (!client) return null;

    const profileData = {
      id:         user.id,
      full_name:  user.user_metadata?.full_name
                  || user.user_metadata?.name
                  || user.email?.split('@')[0]
                  || '',
      email:      user.email || '',
      avatar_url: user.user_metadata?.avatar_url
                  || user.user_metadata?.picture
                  || '',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      // Table may not exist yet — log but don't block the user
      console.warn('[Eventora] Profile sync failed:', error.message,
        '— Run data/rls_migration.sql in Supabase SQL Editor to create the profiles table.');
    } else {
      _profile = data;
      console.log('[Eventora] Profile synced:', data.email);
    }

    return data || null;
  };

  // ── Persistent auth state listener ────────────────────────────────────
  // Handles state changes AFTER initial load (token refresh, logout, etc.)
  const _initStateListener = () => {
    if (_listenerActive) return;
    _listenerActive = true;
    const client = sb();
    if (!client) return;

    client.auth.onAuthStateChange(async (event, session) => {
      console.log('[Eventora Auth] →', event, session?.user?.email || '(no user)');
      const user = session?.user ?? null;

      if (event === 'SIGNED_IN' && user) {
        _currentUser = user;
        EventoraDB.setUser(user.id);
        await _syncProfile(user);
        updateNavActions();
        updateSidebarUser();
        if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
        App.afterAuth();
      }

      if (event === 'SIGNED_OUT') {
        _currentUser = null;
        _profile     = null;
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
    });
  };

  // ── MAIN INIT ─────────────────────────────────────────────────────────
  // Called once from app.js DOMContentLoaded.
  // Handles:  ?error= (OAuth failure)
  //           ?code=  (PKCE exchange — exactly once)
  //           normal page load / refresh (session restore)
  const init = async () => {
    const client = sb();
    if (!client) {
      console.warn('[Eventora Auth] Supabase client not ready — showing login.');
      App.goAuth('login');
      return;
    }

    const params = new URLSearchParams(window.location.search);

    // ── Case 1: OAuth returned an error ───────────────────────────────────
    if (params.get('error')) {
      const code = params.get('error');
      const desc = params.get('error_description') || '';
      console.error('[Eventora Auth] OAuth error:', code, desc);
      _cleanUrl();
      _initStateListener();
      App.goAuth('login');
      _showLoginError(
        code === 'access_denied'
          ? 'Google sign-in was cancelled. Please try again.'
          : 'Google sign-in could not be completed. Please try again.'
      );
      return;
    }

    // ── Case 2: PKCE callback — ?code= present → exchange exactly once ───
    const oauthCode = params.get('code');
    if (oauthCode) {
      console.log('[Eventora Auth] PKCE code detected — exchanging for session…');
      _cleanUrl(); // remove ?code= immediately so refresh doesn't re-exchange

      try {
        const { data, error } = await client.auth.exchangeCodeForSession(oauthCode);

        if (error) {
          console.error('[Eventora Auth] Code exchange failed:', error.message);
          _initStateListener();
          App.goAuth('login');
          _showLoginError('Google sign-in could not be completed. Please try again.');
          return;
        }

        // Exchange succeeded — session is now active in the Supabase client
        const user = data.session?.user;
        console.log('[Eventora Auth] Code exchanged ✓ User:', user?.email);

        if (user) {
          _currentUser = user;
          EventoraDB.setUser(user.id);
          await _syncProfile(user);   // upsert into public.profiles
          updateNavActions();
          updateSidebarUser();
          if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
          _initStateListener();
          App.afterAuth();            // routes to dashboard (or pending action)
        } else {
          _initStateListener();
          App.goAuth('login');
        }

      } catch (err) {
        console.error('[Eventora Auth] exchangeCodeForSession threw:', err);
        _initStateListener();
        App.goAuth('login');
        _showLoginError('Google sign-in could not be completed. Please try again.');
      }
      return;
    }

    // ── Case 3: Normal page load / refresh — restore existing session ─────
    _initStateListener(); // register listener before getSession so no events are missed

    const { data: { session }, error } = await client.auth.getSession();

    if (error) {
      console.error('[Eventora Auth] getSession error:', error.message);
      App.goAuth('login');
      return;
    }

    if (session?.user) {
      const user = session.user;
      _currentUser = user;
      EventoraDB.setUser(user.id);
      await _syncProfile(user);
      updateNavActions();
      updateSidebarUser();
      if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
      console.log('[Eventora Auth] Session restored for:', user.email);
      App.afterAuth();
    } else {
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

    _hideError(errEl);
    if (!email)    { _showError(errEl, 'Please enter your email.'); return; }
    if (!password) { _showError(errEl, 'Please enter your password.'); return; }

    _setLoading(btn, 'Signing in…');

    const { data, error } = await sb().auth.signInWithPassword({ email, password });

    _setLoading(btn, 'Sign In', false);

    if (error) {
      _showError(errEl, _friendlyError(error));
      return;
    }

    // onAuthStateChange(SIGNED_IN) handles profile sync + routing
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

    _hideError(errEl);
    if (!name)              { _showError(errEl, 'Please enter your full name.'); return; }
    if (!email)             { _showError(errEl, 'Please enter your email.'); return; }
    if (!password)          { _showError(errEl, 'Please enter a password.'); return; }
    if (password.length < 6){ _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm){ _showError(errEl, 'Passwords do not match.'); return; }

    _setLoading(btn, 'Creating account…');

    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin + '/'
      }
    });

    _setLoading(btn, 'Create Account', false);

    if (error) { _showError(errEl, _friendlyError(error)); return; }

    if (data?.user && !data.session) {
      // Email confirmation required
      _showEmailSent(email);
    }
    // If email confirmation disabled, onAuthStateChange(SIGNED_IN) routes to app
  };

  // ── Google OAuth ──────────────────────────────────────────────────────
  // Uses PKCE: Google → Supabase → redirects back with ?code= → init() exchanges it
  const googleLogin = async () => {
    const client = sb();
    if (!client) { Toast.show('error', 'Not connected', 'Please check your connection.'); return; }

    // Use origin only — cleaner redirect URL, works for both prod and local
    const redirectTo = window.location.origin + '/';
    console.log('[Eventora Auth] Starting Google OAuth → redirectTo:', redirectTo);

    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });

    if (error) {
      console.error('[Eventora Auth] signInWithOAuth error:', error.message);
      Toast.show('error', 'Google sign-in failed', 'Please try again.');
    }
    // On success: browser navigates to Google, then back to redirectTo?code=...
  };

  // ── Forgot Password ───────────────────────────────────────────────────
  const sendReset = async () => {
    const email = document.getElementById('forgotEmail')?.value?.trim();
    const btn   = document.getElementById('forgotBtn');
    const errEl = document.getElementById('forgotError');

    _hideError(errEl);
    if (!email) { _showError(errEl, 'Please enter your email.'); return; }

    _setLoading(btn, 'Sending…');

    await sb().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/?reset=1'
    });

    _setLoading(btn, 'Send Reset Link', false);

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

    const { error } = await sb().auth.updateUser({ password });

    _setLoading(btn, 'Update Password', false);

    if (error) { _showError(errEl, _friendlyError(error)); return; }

    Toast.show('success', 'Password updated!', 'Sign in with your new password.');
    await sb().auth.signOut();
    showLogin();
  };

  // ── Logout ────────────────────────────────────────────────────────────
  const logout = async () => {
    console.log('[Eventora Auth] Signing out…');
    await sb().auth.signOut();
    // onAuthStateChange(SIGNED_OUT) clears state and redirects to login
  };

  // ── Nav & Sidebar ─────────────────────────────────────────────────────
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
    const meta  = user.user_metadata || {};
    const name  = meta.full_name || meta.name || '';
    const email = user.email || '';
    Modal.open('Profile Settings',
      `<div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="input" id="profileName" value="${name}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="input" value="${email}" type="email" disabled style="opacity:0.6">
      </div>`,
      async () => {
        const newName = document.getElementById('profileName')?.value?.trim();
        if (newName) {
          const { error } = await sb().auth.updateUser({ data: { full_name: newName } });
          if (!error) {
            _currentUser = {
              ..._currentUser,
              user_metadata: { ..._currentUser.user_metadata, full_name: newName }
            };
            // Sync updated name to profiles table
            await _syncProfile(_currentUser);
            updateNavActions();
            updateSidebarUser();
            Toast.show('success', 'Profile saved', '');
          }
        }
      }, 'Save Changes');
  };

  // ── Form Switching ────────────────────────────────────────────────────
  const showForm = (id) => {
    ['authLogin', 'authSignup', 'authForgot', 'authReset'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = (f === id) ? 'flex' : 'none';
    });
  };

  const showLogin  = () => showForm('authLogin');
  const showSignup = () => showForm('authSignup');
  const showForgot = () => showForm('authForgot');

  // ── Email Verification Sent Screen ────────────────────────────────────
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
  const _cleanUrl = () =>
    window.history.replaceState({}, document.title, window.location.pathname);

  const _showLoginError = (msg) => {
    const errEl = document.getElementById('loginError');
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  };

  const _showError = (el, msg) => {
    if (!el) { Toast.show('warning', msg, ''); return; }
    el.textContent = msg; el.style.display = 'block';
  };

  const _hideError = (el) => {
    if (el) { el.textContent = ''; el.style.display = 'none'; }
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
    updateNavActions, updateSidebarUser,
    showLogin, showSignup, showForgot,
    login, signup, googleLogin, sendReset, resetPassword,
    togglePwd, showUserMenu, showProfile,
  };
})();
