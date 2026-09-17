/**
 * EVENTORA 3.0 — Schedule Module (with visual timeline)
 */
window.ScheduleModule = (() => {
  let view = 'timeline';

  const TYPE_STYLES = {
    keynote: { bg:'#EDE9FE', color:'#7C3AED', dot:'#7C3AED' },
    session: { bg:'#DBEAFE', color:'#3B82F6', dot:'#3B82F6' },
    break:   { bg:'#D1FAE5', color:'#10B981', dot:'#10B981' },
    meal:    { bg:'#FEF3C7', color:'#F59E0B', dot:'#F59E0B' },
    setup:   { bg:'#F3F4F6', color:'#6B7280', dot:'#9CA3AF' },
    custom:  { bg:'#FCE7F3', color:'#EC4899', dot:'#EC4899' },
  };

  const render = (evId) => {
    const c = document.getElementById('tab-schedule');
    if (!c) return;
    const ev       = EventoraDB.getEvent(evId);
    const schedule = EventoraDB.getSchedule(evId);

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">📅 Event Schedule</div>
          <div class="mod-subtitle">${schedule.length} items · ${ev?.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : 'Date TBD'}</div>
        </div>
        <div class="mod-actions">
          <div class="tab-pills">
            <div class="tab-pill ${view==='timeline'?'active':''}" onclick="ScheduleModule.setView('timeline','${evId}')">📅 Timeline</div>
            <div class="tab-pill ${view==='list'?'active':''}" onclick="ScheduleModule.setView('list','${evId}')">☰ List</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="ScheduleModule.openAddItem('${evId}')">+ Add Item</button>
        </div>
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        ${Object.entries(TYPE_STYLES).map(([type, s]) =>
          `<div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${s.color};background:${s.bg};padding:4px 12px;border-radius:var(--r-full)">
            <span style="width:8px;height:8px;border-radius:50%;background:${s.dot};display:inline-block"></span>
            ${type.charAt(0).toUpperCase()+type.slice(1)}
          </div>`).join('')}
      </div>

      <!-- Export row -->
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-secondary btn-sm" onclick="ScheduleModule.exportPDF('${evId}')">📄 Export PDF</button>
        <button class="btn btn-secondary btn-sm" onclick="ScheduleModule.printSchedule('${evId}')">🖨️ Print</button>
      </div>

      ${schedule.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">No schedule items yet</div>
          <div class="empty-sub">Build your event timeline — from setup to celebrations.</div>
          <button class="btn btn-primary" onclick="ScheduleModule.openAddItem('${evId}')">+ Add First Item</button>
        </div>` :
        view === 'timeline' ? renderTimeline(evId, schedule) : renderList(evId, schedule)}`;
  };

  const renderTimeline = (evId, schedule) => `
    <div class="schedule-timeline" style="max-width:700px">
      ${schedule.map((s, idx) => {
        const st = TYPE_STYLES[s.type] || TYPE_STYLES.custom;
        return `
        <div class="sch-item">
          <div class="sch-time">
            <div class="sch-time-val">${s.startTime||''}</div>
            <div class="sch-time-end">${s.endTime||''}</div>
          </div>
          <div class="sch-dot-area">
            <div class="sch-dot" style="background:${st.dot};box-shadow:0 0 0 3px ${st.bg}"></div>
          </div>
          <div class="sch-card hover-lift-sm">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
              <div>
                <div class="sch-card-title">${s.title}</div>
                <div class="sch-card-meta">
                  ${s.location ? `<span>📍 ${s.location}</span>` : ''}
                  ${s.speaker ? `<span>🎤 ${s.speaker}</span>` : ''}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <span class="sch-type-pill" style="background:${st.bg};color:${st.color}">${s.type||'session'}</span>
                <button class="btn btn-ghost btn-xs" onclick="ScheduleModule.editItem('${evId}','${s.id}')">✏️</button>
                <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="ScheduleModule.deleteItem('${evId}','${s.id}')">🗑️</button>
              </div>
            </div>
            ${s.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${s.notes}</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const renderList = (evId, schedule) => `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="data-table">
        <thead><tr><th>Time</th><th>Activity</th><th>Location</th><th>Speaker/Host</th><th>Type</th><th>Actions</th></tr></thead>
        <tbody>
          ${schedule.map(s => {
            const st = TYPE_STYLES[s.type] || TYPE_STYLES.custom;
            return `<tr>
              <td style="font-family:var(--font-mono);white-space:nowrap">${s.startTime||''}${s.endTime?' – '+s.endTime:''}</td>
              <td style="font-weight:600">${s.title}</td>
              <td>${s.location||'—'}</td>
              <td>${s.speaker||'—'}</td>
              <td><span style="background:${st.bg};color:${st.color};padding:2px 8px;border-radius:var(--r-full);font-size:11px;font-weight:700">${s.type||'session'}</span></td>
              <td><div style="display:flex;gap:4px">
                <button class="btn btn-ghost btn-xs" onclick="ScheduleModule.editItem('${evId}','${s.id}')">✏️</button>
                <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="ScheduleModule.deleteItem('${evId}','${s.id}')">🗑️</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  const setView = (v, evId) => { view = v; render(evId); };

  const openAddItem = (evId, sId) => {
    const existing = sId ? EventoraDB.getSchedule(evId).find(s => s.id === sId) : null;
    const s = existing || {};
    Modal.open(existing ? 'Edit Schedule Item' : 'Add Schedule Item',
      `<div class="form-group"><label class="form-label">Activity / Title *</label><input class="input" id="sfTitle" value="${s.title||''}" placeholder="e.g., Welcome Keynote"></div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Start Time *</label><input class="input" id="sfStart" type="time" value="${s.startTime||''}"></div>
         <div class="form-group"><label class="form-label">End Time</label><input class="input" id="sfEnd" type="time" value="${s.endTime||''}"></div>
       </div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Location</label><input class="input" id="sfLoc" value="${s.location||''}" placeholder="e.g., Main Hall"></div>
         <div class="form-group"><label class="form-label">Speaker / Host</label><input class="input" id="sfSpeaker" value="${s.speaker||''}" placeholder="Name or team"></div>
       </div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Type</label><select class="input" id="sfType">
           <option ${s.type==='keynote'?'selected':''} value="keynote">Keynote</option>
           <option ${s.type==='session'||!s.type?'selected':''} value="session">Session</option>
           <option ${s.type==='break'?'selected':''} value="break">Break</option>
           <option ${s.type==='meal'?'selected':''} value="meal">Meal</option>
           <option ${s.type==='setup'?'selected':''} value="setup">Setup</option>
           <option ${s.type==='custom'?'selected':''} value="custom">Custom</option>
         </select></div>
         <div class="form-group"><label class="form-label">Notes</label><input class="input" id="sfNotes" value="${s.notes||''}" placeholder="Optional notes"></div>
       </div>`,
      () => {
        const title = document.getElementById('sfTitle')?.value?.trim();
        const start = document.getElementById('sfStart')?.value;
        if (!title || !start) { Toast.show('warning','Title & time required',''); return; }
        const data = { title, startTime:start, endTime:document.getElementById('sfEnd')?.value||'', location:document.getElementById('sfLoc')?.value||'', speaker:document.getElementById('sfSpeaker')?.value||'', type:document.getElementById('sfType')?.value||'session', notes:document.getElementById('sfNotes')?.value||'' };
        if (existing) { EventoraDB.updateScheduleItem(evId, sId, data); Toast.show('success','Item Updated',''); }
        else { EventoraDB.addScheduleItem(evId, data); Toast.show('success','Item Added', title); }
        render(evId);
      }, existing ? 'Save' : 'Add Item');
  };

  const editItem   = (evId, sId) => openAddItem(evId, sId);
  const deleteItem = (evId, sId) => {
    EventoraDB.deleteScheduleItem(evId, sId);
    Toast.show('info','Item Removed','');
    render(evId);
  };

  const exportPDF = (evId) => { Toast.show('info','Export','PDF export uses the browser print dialog. Press Ctrl+P.'); printSchedule(evId); };
  const printSchedule = (evId) => { window.print(); };

  return { render, setView, openAddItem, editItem, deleteItem, exportPDF, printSchedule };
})();
