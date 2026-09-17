/**
 * EVENTORA — Real Authentication Module
 * Uses Supabase Auth as single source of truth.
 * No fake credentials, no localStorage auth flags.
 */
window.AuthModule = (() => {

  // ── Supabase client (from supabaseClient.js) ──────────────────────────
  const sb = () => window.EventoraSupabase?.client;

  // ── Current authenticated user (set by auth state listener) ──────────
  let _currentUser = null;
  let _authReady    = false; // true once getSession() has resolved

  const getUser    = () => _currentUser;
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
    if (msg.includes('password should be at least'))
      return 'Password must be at least 6 characters.';
    if (msg.includes('unable to validate email address'))
      return 'Please enter a valid email address.';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('network') || msg.includes('fetch'))
      return 'Network error. Check your connection and try again.';
    return 'Something went wrong. Please try again.';
  };

  // ── Auth State Listener ────────────────────────────────────────────────
  const _initStateListener = () => {
    const client = sb();
    if (!client) return;

    client.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      _currentUser = user;

      if (event === 'SIGNED_IN' && user) {
        EventoraDB.setUser(user.id);
        updateNavActions();
        updateSidebarUser();
        // Seed demo data for brand new users
        if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
      }

      if (event === 'SIGNED_OUT') {
        _currentUser = null;
        EventoraDB.setUser(null);
        updateNavActions();
        updateSidebarUser();
        App.goAuth('login');
      }

      if (event === 'PASSWORD_RECOVERY') {
        // Show password reset form
        _showResetPasswordForm(session);
      }

      if (event === 'TOKEN_REFRESHED') {
        _currentUser = user;
      }
    });
  };

  // ── Session Restore on Page Load ───────────────────────────────────────
  const init = async () => {
    const client = sb();
    if (!client) {
      console.warn('Supabase client not ready — falling back to offline mode');
      _authReady = true;
      App.goAuth('login');
      return;
    }

    _initStateListener();

    const { data: { session } } = await client.auth.getSession();
    _authReady = true;

    if (session?.user) {
      _currentUser = session.user;
      EventoraDB.setUser(session.user.id);
      if (EventoraDB.getAllEvents().length === 0) EventoraDB.seedDemoData();
      updateNavActions();
      updateSidebarUser();
      App.goDashboard();
    } else {
      _currentUser = null;
      App.goAuth('login');
    }
  };

  // ── Login ──────────────────────────────────────────────────────────────
  const login = async () => {
    const email    = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');

    if (errEl) errEl.textContent = '';

    if (!email) { _showError(errEl, 'Please enter your email.'); return; }
    if (!password) { _showError(errEl, 'Please enter your password.'); return; }

    _setLoading(btn, 'Signing in…');

    const { data, error } = await sb().auth.signInWithPassword({ email, password });

    _setLoading(btn, 'Sign In', false);

    if (error) {
      _showError(errEl, _friendlyError(error));
      return;
    }

    // onAuthStateChange handles the rest (SIGNED_IN event)
    Toast.show('success', `Welcome back!`, '');
    App.afterAuth();
  };

  // ── Sign Up ────────────────────────────────────────────────────────────
  const signup = async () => {
    const name     = document.getElementById('signupName')?.value?.trim();
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm  = document.getElementById('signupConfirm')?.value;
    const btn      = document.getElementById('signupBtn');
    const errEl    = document.getElementById('signupError');

    if (errEl) errEl.textContent = '';

    if (!name)     { _showError(errEl, 'Please enter your full name.'); return; }
    if (!email)    { _showError(errEl, 'Please enter your email.'); return; }
    if (!password) { _showError(errEl, 'Please enter a password.'); return; }
    if (password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { _showError(errEl, 'Passwords do not match.'); return; }

    _setLoading(btn, 'Creating account…');

    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    _setLoading(btn, 'Create Account', false);

    if (error) {
      _showError(errEl, _friendlyError(error));
      return;
    }

    // Show email-confirmation screen
    _showEmailSent(email);
  };

  // ── Google OAuth Login ────────────────────────────────────────────────
  const googleLogin = async () => {
    const { error } = await sb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    });
    if (error) Toast.show('error', 'Google sign-in failed', _friendlyError(error));
  };

  // ── Forgot Password ───────────────────────────────────────────────────
  const sendReset = async () => {
    const email = document.getElementById('forgotEmail')?.value?.trim();
    const btn   = document.getElementById('forgotBtn');
    const errEl = document.getElementById('forgotError');

    if (errEl) errEl.textContent = '';
    if (!email) { _showError(errEl, 'Please enter your email.'); return; }

    _setLoading(btn, 'Sending…');

    // Always show success — never reveal if email exists
    await sb().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?reset=1'
    });

    _setLoading(btn, 'Send Reset Link', false);

    // Always show this regardless of whether email exists
    const panel = document.getElementById('authForgot');
    if (panel) panel.innerHTML = `
      <div class="auth-success-state">
        <div class="auth-success-icon">📬</div>
        <div class="auth-success-title">Check your inbox</div>
        <p class="auth-success-msg">If an account exists for <strong>${email}</strong>, you'll receive a password reset link shortly.</p>
        <button class="btn btn-secondary btn-full mt-3" onclick="AuthModule.showLogin()">Back to Sign In</button>
      </div>`;
  };

  // ── Password Reset (called after user clicks link in email) ───────────
  const _showResetPasswordForm = (session) => {
    showForm('authReset');
  };

  const resetPassword = async () => {
    const password = document.getElementById('resetPassword')?.value;
    const confirm  = document.getElementById('resetConfirm')?.value;
    const btn      = document.getElementById('resetBtn');
    const errEl    = document.getElementById('resetError');

    if (errEl) errEl.textContent = '';
    if (!password || password.length < 6) { _showError(errEl, 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { _showError(errEl, 'Passwords do not match.'); return; }

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
    await sb().auth.signOut();
    // onAuthStateChange (SIGNED_OUT) handles redirect + cleanup
  };

  // ── Nav Actions ───────────────────────────────────────────────────────
  const updateNavActions = () => {
    const el = document.getElementById('navActions');
    if (!el) return;
    if (_currentUser) {
      const name   = _currentUser.user_metadata?.full_name || _currentUser.user_metadata?.name || _currentUser.email?.split('@')[0] || 'You';
      const avatar = _currentUser.user_metadata?.avatar_url;
      el.innerHTML = `
        <div class="nav-user-chip" onclick="AuthModule.showUserMenu(this)">
          ${avatar
            ? `<img src="${avatar}" class="nav-user-avatar-img" alt="${name}">`
            : `<div class="nav-user-avatar">${name.charAt(0).toUpperCase()}</div>`}
          <span class="nav-user-name">${name.split(' ')[0]}</span>
          <span style="font-size:10px">▾</span>
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
      const name   = _currentUser.user_metadata?.full_name || _currentUser.user_metadata?.name || _currentUser.email?.split('@')[0] || 'User';
      const email  = _currentUser.email || '';
      const avatar = _currentUser.user_metadata?.avatar_url;
      el.innerHTML = `
        <div class="sidebar-user-info">
          ${avatar
            ? `<img src="${avatar}" class="sidebar-user-avatar-img" alt="${name}">`
            : `<div class="sidebar-user-avatar">${name.charAt(0).toUpperCase()}</div>`}
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${email}</div>
          </div>
          <button class="btn btn-ghost btn-xs" onclick="AuthModule.logout()" title="Sign out" style="margin-left:auto">⏻</button>
        </div>`;
    } else {
      el.innerHTML = `<button class="btn btn-secondary btn-sm btn-full" onclick="App.goAuth('login')">Sign In</button>`;
    }
  };

  // ── User Menu ─────────────────────────────────────────────────────────
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
       <div class="form-group"><label class="form-label">Email</label><input class="input" id="profileEmail" value="${email}" type="email" disabled style="opacity:0.6"></div>
       <div class="form-group"><label class="form-label">Phone (optional)</label><input class="input" id="profilePhone" type="tel" placeholder="+91 00000 00000"></div>`,
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

  // ── Form Switching ────────────────────────────────────────────────────
  const showForm = (id) => {
    ['authLogin','authSignup','authForgot','authReset'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = f === id ? 'flex' : 'none';
    });
  };

  const showLogin  = () => showForm('authLogin');
  const showSignup = () => showForm('authSignup');
  const showForgot = () => showForm('authForgot');

  // ── Email Sent screen (after signup) ──────────────────────────────────
  const _showEmailSent = (email) => {
    const panel = document.getElementById('authSignup');
    if (!panel) return;
    panel.innerHTML = `
      <div class="auth-success-state">
        <div class="auth-success-icon">✉️</div>
        <div class="auth-success-title">Check your email</div>
        <p class="auth-success-msg">We sent a verification link to<br><strong>${email}</strong></p>
        <p style="font-size:13px;color:var(--text-muted);margin-top:8px">Click the link in the email to activate your account, then sign in here.</p>
        <button class="btn btn-primary btn-full mt-3" onclick="AuthModule.showLogin();location.reload()">Go to Sign In</button>
      </div>`;
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const _showError = (el, msg) => {
    if (!el) { Toast.show('warning', msg, ''); return; }
    el.textContent = msg;
    el.style.display = 'block';
  };

  const _setLoading = (btn, label, loading = true) => {
    if (!btn) return;
    btn.textContent = label;
    btn.disabled    = loading;
  };

  const togglePwd = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type   = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  };

  return {
    init, isLoggedIn, getUser, logout, updateNavActions, updateSidebarUser,
    showLogin, showSignup, showForgot,
    login, signup, googleLogin, sendReset, resetPassword, togglePwd,
    showUserMenu, showProfile,
  };
})();
