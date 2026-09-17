/**
 * EVENTORA — Authentication Module
 * Source of truth: Supabase Auth (implicit flow)
 *
 * WHY IMPLICIT FLOW?
 *  PKCE flow requires Supabase to exchange an authorization code with Google's
 *  API server-side. This was failing with "Unable to exchange external code"
 *  (a Supabase server error returned as ?error=server_error in the URL).
 *
 *  Implicit flow returns tokens directly in the URL hash (#access_token=...),
 *  bypassing the server-side code exchange entirely. Supabase's detectSessionInUrl:true
 *  reads the hash and creates the session automatically — no manual exchange needed.
 *
 * FLOW:
 *  signInWithOAuth({ provider:'google', redirectTo: origin+'/' })
 *    → browser goes to Google → user authenticates
 *    → Google → Supabase callback → redirects to:
 *       https://eventorasite.netlify.app/#access_token=XXX&refresh_token=YYY
 *    → Supabase client (detectSessionInUrl:true) reads hash, sets session
 *    → onAuthStateChange(SIGNED_IN) fires → App.afterAuth()
 *    → User is in the dashboard
 */
window.AuthModule = (() => {

  const sb = () => window.EventoraSupabase?.client;

  let _currentUser    = null;
  let _profile        = null;
  let _listenerActive = false;

  const getUser    = () => _currentUser;
  const getProfile = () => _profile;
  const isLoggedIn = () => !!_currentUser;

  // ── Human-readable errors ─────────────────────────────────────────────
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
    return err.message || 'Something went wrong. Please try again.';
  };

  // ── Upsert into public.profiles ───────────────────────────────────────
  const _syncProfile = async (user) => {
    if (!user) return null;
    const client = sb();
    if (!client) return null;

    const meta = user.user_metadata || {};
    const profileData = {
      id:         user.id,
      full_name:  meta.full_name || meta.name || user.email?.split('@')[0] || '',
      email:      user.email || '',
      avatar_url: meta.avatar_url || meta.picture || '',
      updated_at: new Date().toISOString(),
    };

    console.log('[Eventora] Syncing profile:', profileData.email);

    const { data, error } = await client
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.warn('[Eventora] Profile sync warning:', error.message,
        '\n→ Run data/rls_migration.sql in Supabase SQL Editor to create profiles table');
    } else {
      _profile = data;
      console.log('[Eventora] Profile synced ✓', data.email);
    }
    return data || null;
  };

  // ── Persistent auth state listener ────────────────────────────────────
  const _initStateListener = () => {
    if (_listenerActive) return;
    _listenerActive = true;
    const client = sb();
    if (!client) return;

    client.auth.onAuthStateChange(async (event, session) => {
      // Log everything for debugging
      console.log('[Eventora Auth] Event:', event);
      console.log('[Eventora Auth] Session:', session ? `user=${session.user?.email}` : 'null');

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
  // With implicit flow + detectSessionInUrl:true, Supabase client already
  // processed #access_token= from URL by the time init() runs.
  // We just need to: handle URL errors, register listener, check session.
  const init = async () => {
    const client = sb();
    if (!client) {
      console.error('[Eventora Auth] Supabase client not available!');
      App.goAuth('login');
      return;
    }

    // Log the URL for debugging
    console.log('[Eventora Auth] Page URL:', window.location.href);

    // ── Check for OAuth errors in query string (?error=...) ───────────────
    const qParams   = new URLSearchParams(window.location.search);
    const hParams   = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorCode = qParams.get('error') || hParams.get('error');
    const errorDesc = qParams.get('error_description') || hParams.get('error_description') || '';

    if (errorCode) {
      // Show the REAL error from Supabase/Google for diagnosis
      console.error('[Eventora Auth] OAuth error code:', errorCode);
      console.error('[Eventora Auth] OAuth error description:', errorDesc);
      console.error('[Eventora Auth] Full URL:', window.location.href);

      _cleanUrl();
      _initStateListener();
      App.goAuth('login');

      // Show actual error description to help debugging
      let userMsg;
      if (errorCode === 'access_denied') {
        userMsg = 'Google sign-in was cancelled.';
      } else if (errorDesc) {
        // Show actual error so user can diagnose or report it
        userMsg = `Google sign-in failed: ${decodeURIComponent(errorDesc.replace(/\+/g, ' '))}`;
      } else {
        userMsg = `Google sign-in failed (${errorCode}). Please try again.`;
      }

      _showLoginError(userMsg);
      return;
    }

    // ── Register the auth state listener ──────────────────────────────────
    // With implicit flow, detectSessionInUrl:true already processed the URL hash.
    // onAuthStateChange will fire with INITIAL_SESSION or SIGNED_IN.
    _initStateListener();

    // ── Check current session (restored or just set from URL hash) ────────
    console.log('[Eventora Auth] Checking session…');
    const { data: { session }, error } = await client.auth.getSession();

    if (error) {
      console.error('[Eventora Auth] getSession() error:', error);
      App.goAuth('login');
      return;
    }

    console.log('[Eventora Auth] Session:', session ? `user=${session.user?.email}` : 'null');

    if (session?.user) {
      const user = session.user;
      _currentUser = user;
      EventoraDB.setUser(user.id);
      await _syncProfile(user);
      updateNavActions();
      updateSidebarUser();
      if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
      console.log('[Eventora Auth] Session restored ✓ for:', user.email);
      App.afterAuth();
    } else {
      // No session — check if URL hash had tokens (detectSessionInUrl might still be processing)
      // Give it a brief moment and check again
      const hasHashTokens = window.location.hash.includes('access_token');
      if (hasHashTokens) {
        console.log('[Eventora Auth] Hash tokens found, waiting for Supabase to process…');
        // onAuthStateChange(SIGNED_IN) will handle routing once tokens are processed
        // Don't call goAuth('login') here — that would be premature
        setTimeout(async () => {
          const { data: { session: s2 } } = await client.auth.getSession();
          if (!s2) {
            console.log('[Eventora Auth] Still no session after wait — showing login');
            App.goAuth('login');
          }
        }, 2000);
      } else {
        console.log('[Eventora Auth] No session — showing login.');
        App.goAuth('login');
      }
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
      console.error('[Eventora Auth] signInWithPassword error:', error);
      _showError(errEl, _friendlyError(error));
      return;
    }

    console.log('[Eventora Auth] Email login success:', data.user?.email);
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
    if (!name)               { _showError(errEl, 'Please enter your full name.'); return; }
    if (!email)              { _showError(errEl, 'Please enter your email.'); return; }
    if (!password)           { _showError(errEl, 'Please enter a password.'); return; }
    if (password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { _showError(errEl, 'Passwords do not match.'); return; }

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

    if (error) {
      console.error('[Eventora Auth] signUp error:', error);
      _showError(errEl, _friendlyError(error));
      return;
    }

    console.log('[Eventora Auth] Signup:', data.user?.email,
      data.session ? '(auto-confirmed)' : '(email confirmation required)');

    if (data?.user && !data.session) {
      _showEmailSent(email);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────
  // Implicit flow: Google → Supabase → redirects to origin/#access_token=...
  // Supabase reads the hash and fires onAuthStateChange(SIGNED_IN)
  const googleLogin = async () => {
    const client = sb();
    if (!client) {
      Toast.show('error', 'Not connected', 'Please check your connection.');
      return;
    }

    const redirectTo = window.location.origin + '/';
    console.log('[Eventora Auth] Starting Google OAuth (implicit flow)');
    console.log('[Eventora Auth] redirectTo:', redirectTo);

    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });

    if (error) {
      console.error('[Eventora Auth] signInWithOAuth error:', error);
      Toast.show('error', 'Google sign-in failed', error.message || 'Please try again.');
    }
    // On success: browser navigates to Google login page (no return here)
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
    const { error } = await sb().auth.signOut();
    if (error) console.error('[Eventora Auth] signOut error:', error);
    // onAuthStateChange(SIGNED_OUT) handles UI + redirect
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
          const { error } = await sb().auth.updateUser({ data: { full_name: newName } });
          if (!error) {
            _currentUser = { ..._currentUser,
              user_metadata: { ..._currentUser.user_metadata, full_name: newName } };
            await _syncProfile(_currentUser);
            updateNavActions();
            updateSidebarUser();
            Toast.show('success', 'Profile saved', '');
          }
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

  // ── Email verification sent ───────────────────────────────────────────
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
    const el = document.getElementById('loginError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
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
