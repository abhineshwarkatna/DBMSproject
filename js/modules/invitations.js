/**
 * EVENTORA 3.0 — Invitations Module
 */
window.InvitationsModule = (() => {
  const TEMPLATES = [
    {id:'royal',    name:'Royal Elegance',    emoji:'👑', bg:'linear-gradient(135deg,#1a0a2e,#3b1f6e)',  text:'#F5D78E'},
    {id:'floral',   name:'Floral Garden',     emoji:'🌸', bg:'linear-gradient(135deg,#fff0f5,#ffe4e8)',   text:'#c2185b'},
    {id:'minimal',  name:'Clean Minimal',     emoji:'⚪', bg:'linear-gradient(135deg,#f8f8f8,#e8e8e8)',  text:'#111827'},
    {id:'tropical', name:'Tropical Vibes',    emoji:'🌴', bg:'linear-gradient(135deg,#004d40,#00695c)',   text:'#a5d6a7'},
    {id:'golden',   name:'Golden Hour',       emoji:'✨', bg:'linear-gradient(135deg,#3d2600,#7a4900)',   text:'#FFD54F'},
    {id:'modern',   name:'Modern Corporate',  emoji:'💼', bg:'linear-gradient(135deg,#1a237e,#283593)',   text:'#E8EAF6'},
    {id:'vintage',  name:'Vintage Charm',     emoji:'📜', bg:'linear-gradient(135deg,#efebe9,#d7ccc8)',   text:'#4e342e'},
    {id:'neon',     name:'Neon Glam',         emoji:'💜', bg:'linear-gradient(135deg,#0d0d0d,#1a0033)',   text:'#bb86fc'},
  ];

  let selectedTemplate = 'royal';

  const render = (evId) => {
    const c = document.getElementById('tab-invitations');
    if (!c) return;
    const ev = EventoraDB.getEvent(evId);
    const guests = EventoraDB.getGuests(evId);
    const sent   = guests.filter(g=>g.rsvp!=='Pending').length;

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">✉️ Invitations</div>
          <div class="mod-subtitle">${sent} sent · ${guests.filter(g=>g.rsvp==='Pending').length} pending</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="InvitationsModule.preview('${evId}')">👁️ Preview</button>
          <button class="btn btn-primary btn-sm" onclick="InvitationsModule.sendAll('${evId}')">✉️ Send to All</button>
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">
        ${[
          {icon:'📨',label:'Total Guests',val:guests.length},
          {icon:'✅',label:'Responded',val:sent},
          {icon:'⏳',label:'Pending',val:guests.filter(g=>g.rsvp==='Pending').length},
          {icon:'✓',label:'Attending',val:guests.filter(g=>g.rsvp==='Attending').length},
          {icon:'✕',label:'Declined',val:guests.filter(g=>g.rsvp==='Declined').length},
        ].map(s=>`
          <div class="card-sm card" style="padding:14px;text-align:center">
            <div style="font-size:22px">${s.icon}</div>
            <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--brand);margin:4px 0">${s.val}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Template Picker -->
      <div class="card" style="margin-bottom:20px">
        <div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:14px">🎨 Choose Invitation Design</div>
        <div class="invite-templates-grid">
          ${TEMPLATES.map(t=>`
            <div class="invite-template-card ${selectedTemplate===t.id?'selected':''}" onclick="InvitationsModule.selectTemplate('${t.id}','${evId}')">
              <div class="invite-template-preview" style="background:${t.bg}">
                <span style="font-size:40px">${t.emoji}</span>
              </div>
              <div class="invite-template-label">${t.name}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Invitation Builder -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Editor -->
        <div class="card">
          <div style="font-size:15px;font-weight:800;margin-bottom:16px">✏️ Customize Invitation</div>
          <div class="form-group"><label class="form-label">Event Title</label><input class="input" id="invTitle" value="${ev?.title||'Your Event'}"></div>
          <div class="form-group"><label class="form-label">Tagline</label><input class="input" id="invTagline" placeholder="e.g., Join us for a celebration!" value="Join us for an unforgettable celebration!"></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Date</label><input class="input" id="invDate" value="${ev?.eventDate||''}"></div>
            <div class="form-group"><label class="form-label">Time</label><input class="input" id="invTime" value="${ev?.startTime||'18:00'}"></div>
          </div>
          <div class="form-group"><label class="form-label">Venue</label><input class="input" id="invVenue" value="${ev?.venueName||''}"></div>
          <div class="form-group"><label class="form-label">RSVP By</label><input class="input" id="invRsvp" type="date"></div>
          <div class="form-group"><label class="form-label">Dress Code</label><input class="input" id="invDress" placeholder="e.g., Black Tie, Smart Casual"></div>
          <div class="form-group"><label class="form-label">Special Note</label><textarea class="input" id="invNote" rows="2" placeholder="e.g., Kindly bring this invitation card..."></textarea></div>
          <button class="btn btn-primary btn-full" onclick="InvitationsModule.preview('${evId}')">👁️ Preview Invitation</button>
        </div>

        <!-- Preview -->
        <div>
          <div style="font-size:15px;font-weight:800;margin-bottom:16px">👁️ Live Preview</div>
          ${renderPreview(ev, TEMPLATES.find(t=>t.id===selectedTemplate))}

          <div style="margin-top:16px;display:flex;gap:8px">
            <button class="btn btn-secondary btn-sm btn-full" onclick="InvitationsModule.copyLink('${evId}')">🔗 Copy Link</button>
            <button class="btn btn-primary btn-sm btn-full" onclick="InvitationsModule.sendAll('${evId}')">✉️ Send All</button>
          </div>
        </div>
      </div>`;
  };

  const renderPreview = (ev, template) => {
    if (!template) return '';
    return `
      <div style="border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow-lg)">
        <div style="background:${template.bg};padding:36px;text-align:center;color:${template.text}">
          <div style="font-size:44px;margin-bottom:12px">${template.emoji}</div>
          <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.7;margin-bottom:10px">You're Invited</div>
          <div style="font-family:var(--font-head);font-size:26px;font-weight:900;margin-bottom:8px;line-height:1.2">${ev?.title||'Event Name'}</div>
          <div style="font-size:14px;opacity:0.8;margin-bottom:24px">Join us for an unforgettable celebration!</div>
          <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;font-size:13px">
            ${ev?.eventDate?`<div><div style="opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.08em">Date</div><div style="font-weight:700">${new Date(ev.eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div></div>`:''}
            ${ev?.startTime?`<div><div style="opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.08em">Time</div><div style="font-weight:700">${ev.startTime}</div></div>`:''}
            ${ev?.venueName?`<div><div style="opacity:0.6;font-size:10px;text-transform:uppercase;letter-spacing:0.08em">Venue</div><div style="font-weight:700">${ev.venueName}</div></div>`:''}
          </div>
          <div style="margin-top:24px;display:flex;gap:10px;justify-content:center">
            <div style="padding:10px 24px;background:rgba(255,255,255,0.2);border:1.5px solid rgba(255,255,255,0.4);border-radius:var(--r-full);font-size:13px;font-weight:700;cursor:pointer">✓ Attending</div>
            <div style="padding:10px 24px;background:rgba(0,0,0,0.2);border:1.5px solid rgba(255,255,255,0.2);border-radius:var(--r-full);font-size:13px;cursor:pointer">Decline</div>
          </div>
        </div>
        <div style="background:var(--bg-white);padding:16px;text-align:center;font-size:12px;color:var(--text-muted)">
          Powered by <strong style="color:var(--brand)">EVENTORA</strong>
        </div>
      </div>`;
  };

  const selectTemplate = (id, evId) => { selectedTemplate = id; render(evId); };
  const preview = (evId) => {
    const ev = EventoraDB.getEvent(evId);
    const t = TEMPLATES.find(t=>t.id===selectedTemplate);
    Modal.open('Invitation Preview', renderPreview(ev, t));
  };
  const copyLink = (evId) => {
    navigator.clipboard?.writeText(`eventora://invite/${evId}`).catch(()=>{});
    Toast.show('success','Link Copied!','Invitation link copied to clipboard.');
  };
  const sendAll = (evId) => {
    const count = EventoraDB.getGuests(evId).filter(g=>g.rsvp==='Pending').length;
    Toast.show('success','Invitations Sent!', `${count} digital invitations sent to pending guests.`, 5000);
  };

  return { render, selectTemplate, preview, copyLink, sendAll };
})();
