/**
 * EVENTORA 3.0 — Auth Module
 * Handles login, signup, OTP, forgot password, session management
 */
window.AuthModule = (() => {

  // ── Session Store ──────────────────────────────────────────────────
  const SESSION_KEY = 'eventora_session_v1';

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  };

  const setUser = (user) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    updateNavActions();
    updateSidebarUser();
  };

  const isLoggedIn = () => !!getUser();

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    updateNavActions();
    updateSidebarUser();
    App.goHome();
    Toast.show('info', 'Signed out', 'See you next time!');
  };

  // ── Nav Actions (top-right) ─────────────────────────────────────────
  const updateNavActions = () => {
    const el = document.getElementById('navActions');
    if (!el) return;
    const user = getUser();
    if (user) {
      el.innerHTML = `
        <div class="nav-user-chip" onclick="AuthModule.showUserMenu(this)">
          <div class="nav-user-avatar">${user.name?.charAt(0)?.toUpperCase() || '?'}</div>
          <span class="nav-user-name">${user.name?.split(' ')[0] || 'You'}</span>
          <span style="font-size:10px">▾</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.requireAuth('wizard')">+ Create Event</button>`;
    } else {
      el.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="App.goAuth('login')">Sign In</button>
        <button class="btn btn-primary btn-sm" onclick="App.goWizard()">+ Create Event</button>`;
    }
  };

  const updateSidebarUser = () => {
    const el = document.getElementById('sidebarUserRow');
    if (!el) return;
    const user = getUser();
    if (user) {
      el.innerHTML = `
        <div class="sidebar-user-info">
          <div class="sidebar-user-avatar">${user.name?.charAt(0)?.toUpperCase() || '?'}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${user.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${user.email}</div>
          </div>
          <button class="btn btn-ghost btn-xs" onclick="AuthModule.logout()" title="Sign out" style="margin-left:auto">⏻</button>
        </div>`;
    } else {
      el.innerHTML = `
        <button class="btn btn-secondary btn-sm btn-full" onclick="App.goAuth('login')">Sign In</button>`;
    }
  };

  const showUserMenu = (anchor) => {
    // Simple dropdown via Modal
    Modal.open('Your Account',
      `<div style="text-align:center;padding:8px 0">
        <div style="font-size:15px;font-weight:700">${getUser()?.name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">${getUser()?.email}</div>
      </div>
      <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();App.goDashboard()">My Events</button>
      <button class="btn btn-secondary btn-full mb-2" onclick="Modal.close();AuthModule.showProfile()">Profile Settings</button>
      <button class="btn btn-ghost btn-full" style="color:var(--danger)" onclick="Modal.close();AuthModule.logout()">Sign Out</button>`);
  };

  const showProfile = () => {
    const user = getUser();
    Modal.open('Profile',
      `<div style="text-align:center;margin-bottom:20px">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--brand-light);display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-size:28px;font-weight:900;color:var(--brand);margin:0 auto 12px">${user?.name?.charAt(0)?.toUpperCase()}</div>
      </div>
      <div class="form-group"><label class="form-label">Full Name</label><input class="input" id="profileName" value="${user?.name||''}"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="input" id="profileEmail" value="${user?.email||''}" type="email"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="input" id="profilePhone" value="${user?.phone||''}" type="tel" placeholder="Optional"></div>`,
      () => {
        const u = { ...getUser(), name: document.getElementById('profileName')?.value?.trim(), email: document.getElementById('profileEmail')?.value?.trim(), phone: document.getElementById('profilePhone')?.value?.trim() };
        setUser(u);
        Toast.show('success', 'Profile saved', '');
      }, 'Save Changes');
  };

  // ── Form Switching ─────────────────────────────────────────────────
  const showForm = (id) => {
    ['authLogin','authSignup','authPhone','authForgot'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.style.display = f === id ? 'flex' : 'none';
    });
  };

  const showLogin  = () => showForm('authLogin');
  const showSignup = () => showForm('authSignup');
  const showPhone  = () => showForm('authPhone');
  const showForgot = () => showForm('authForgot');

  // ── Actions ────────────────────────────────────────────────────────
  const login = () => {
    const email    = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) { Toast.show('warning', 'Fill in all fields', ''); return; }
    if (!email.includes('@')) { Toast.show('warning', 'Enter a valid email', ''); return; }
    if (password.length < 4)  { Toast.show('warning', 'Check your password', ''); return; }

    const btn = document.getElementById('loginBtn');
    if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

    // Simulate auth (localStorage-based for this offline demo)
    setTimeout(() => {
      const name = email.split('@')[0].replace(/[._]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
      setUser({ id: EventoraDB.uid(), name, email, loginMethod: 'email', loginAt: Date.now() });
      Toast.show('success', `Welcome back, ${name.split(' ')[0]}!`, '');
      if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
      App.afterAuth();
    }, 800);
  };

  const signup = () => {
    const name     = document.getElementById('signupName')?.value?.trim();
    const email    = document.getElementById('signupEmail')?.value?.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirm  = document.getElementById('signupConfirm')?.value;

    if (!name || !email || !password) { Toast.show('warning', 'Fill in all fields', ''); return; }
    if (!email.includes('@')) { Toast.show('warning', 'Enter a valid email', ''); return; }
    if (password.length < 6) { Toast.show('warning', 'Password must be at least 6 characters', ''); return; }
    if (password !== confirm) { Toast.show('warning', 'Passwords do not match', ''); return; }

    setTimeout(() => {
      setUser({ id: EventoraDB.uid(), name, email, loginMethod: 'email', loginAt: Date.now() });
      Toast.show('success', `Welcome, ${name.split(' ')[0]}! 🎉`, 'Account created.');
      App.afterAuth();
    }, 700);
  };

  const googleLogin = () => {
    // Demo mode — simulate Google login
    const mockNames = ['Aarav Kumar', 'Priya Sharma', 'Rohan Mehta', 'Ananya Reddy'];
    const name = mockNames[Math.floor(Math.random() * mockNames.length)];
    const email = name.toLowerCase().replace(' ', '.') + '@gmail.com';
    setTimeout(() => {
      setUser({ id: EventoraDB.uid(), name, email, loginMethod: 'google', loginAt: Date.now() });
      Toast.show('success', `Signed in as ${name.split(' ')[0]}`, '');
      App.afterAuth();
    }, 600);
  };

  const phoneLogin = () => showPhone();

  const sendOtp = () => {
    const phone = document.getElementById('phoneNumber')?.value?.trim();
    if (!phone || phone.length < 10) { Toast.show('warning', 'Enter a valid phone number', ''); return; }
    document.getElementById('phoneStep1').style.display = 'none';
    document.getElementById('phoneStep2').style.display = 'block';
    Toast.show('info', 'OTP Sent', `A code was sent to ${phone}`);
  };

  const verifyOtp = () => {
    const otp = document.getElementById('otpInput')?.value?.trim();
    if (!otp || otp.length < 4) { Toast.show('warning', 'Enter the OTP', ''); return; }
    const phone = document.getElementById('phoneNumber')?.value?.trim();
    setTimeout(() => {
      setUser({ id: EventoraDB.uid(), name: 'Guest User', email: '', phone, loginMethod: 'phone', loginAt: Date.now() });
      Toast.show('success', 'Phone verified!', '');
      App.afterAuth();
    }, 600);
  };

  const sendReset = () => {
    const email = document.getElementById('forgotEmail')?.value?.trim();
    if (!email || !email.includes('@')) { Toast.show('warning', 'Enter a valid email', ''); return; }
    Toast.show('success', 'Reset link sent', `Check your inbox at ${email}`);
    showLogin();
  };

  const togglePwd = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  };

  // ── Init ────────────────────────────────────────────────────────────
  const init = () => {
    updateNavActions();
    updateSidebarUser();
  };

  return { init, isLoggedIn, getUser, setUser, logout, updateNavActions, updateSidebarUser,
           showLogin, showSignup, showPhone, showForgot, login, signup, googleLogin, phoneLogin,
           sendOtp, verifyOtp, sendReset, togglePwd, showUserMenu, showProfile };
})();
