/**
 * EVENTORA 3.0 — Tasks & Checklist Module
 */
window.TasksModule = (() => {
  let filter = 'All';

  const render = (evId) => {
    const c = document.getElementById('tab-tasks');
    if (!c) return;
    const tasks = EventoraDB.getTasks(evId);
    const total = tasks.length, done = tasks.filter(t => t.status === 'Done').length;
    const pct = total ? Math.round(done/total*100) : 0;

    let filtered = tasks.filter(t => {
      if (filter === 'All') return true;
      if (filter === 'Pending') return t.status !== 'Done';
      if (filter === 'Done') return t.status === 'Done';
      return t.priority === filter;
    });

    // Group by category
    const groups = {};
    filtered.forEach(t => {
      const cat = t.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    });

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">✅ Tasks & Checklist</div>
          <div class="mod-subtitle">${done} of ${total} completed · ${pct}% done</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="TasksModule.openAddTask('${evId}')">+ Add Task</button>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600">Overall Progress</span>
          <span style="font-size:13px;font-weight:800;color:${pct===100?'var(--success)':'var(--brand)'}">${pct}%</span>
        </div>
        <div class="prog-track" style="height:10px">
          <div class="prog-fill success" style="width:${pct}%"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;text-align:center">
          ${[
            {label:'High Priority',val:tasks.filter(t=>t.priority==='High'&&t.status!=='Done').length,col:'var(--danger)',bg:'var(--danger-bg)'},
            {label:'In Progress',  val:tasks.filter(t=>t.status==='In Progress').length,col:'var(--info)',  bg:'var(--info-bg)'},
            {label:'Completed',    val:done,col:'var(--success)',bg:'var(--success-bg)'},
          ].map(s => `<div style="background:${s.bg};border-radius:var(--r-md);padding:10px">
            <div style="font-size:20px;font-weight:800;color:${s.col}">${s.val}</div>
            <div style="font-size:11px;color:var(--text-muted)">${s.label}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Filter -->
      <div class="filter-bar" style="margin-bottom:16px">
        ${['All','Pending','Done','High','Medium','Low'].map(f =>
          `<div class="filter-chip ${filter===f?'active':''}" onclick="TasksModule.setFilter('${f}','${evId}')">${f}</div>`).join('')}
      </div>

      <!-- Tasks grouped by category -->
      ${Object.keys(groups).length === 0 ?
        `<div class="empty-state">
          <div class="empty-icon">✅</div>
          <div class="empty-title">No tasks yet</div>
          <div class="empty-sub">Add your first task to start planning.</div>
          <button class="btn btn-primary" onclick="TasksModule.openAddTask('${evId}')">+ Add First Task</button>
        </div>` :
        Object.entries(groups).map(([cat, catTasks]) => `
          <div class="card" style="margin-bottom:16px;padding:20px">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--brand);margin-bottom:14px">${cat}</div>
            ${catTasks.map(t => `
              <div class="task-item ${t.status==='Done'?'done':''}" id="task-${t.id}">
                <div class="task-check" onclick="TasksModule.toggleStatus('${evId}','${t.id}')">
                  ${t.status==='Done'?'✓':''}
                </div>
                <div class="task-content">
                  <div class="task-name">${t.name}</div>
                  <div class="task-meta-row">
                    ${t.priority ? `<span class="priority-${t.priority.toLowerCase()}">${t.priority}</span>` : ''}
                    ${t.deadline ? `<span class="task-deadline ${new Date(t.deadline)<new Date()&&t.status!=='Done'?'overdue':''}">${t.deadline}</span>` : ''}
                    ${t.assignee ? `<span class="task-assignee">👤 ${t.assignee}</span>` : ''}
                    ${t.status !== 'Done' ? `<span class="badge ${t.status==='In Progress'?'badge-blue':'badge-gray'}">${t.status}</span>` : ''}
                  </div>
                </div>
                <div class="task-actions">
                  <button class="btn btn-ghost btn-xs" onclick="TasksModule.editTask('${evId}','${t.id}')">✏️</button>
                  <button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="TasksModule.deleteTask('${evId}','${t.id}')">🗑️</button>
                </div>
              </div>`).join('')}
          </div>`).join('')}`;
  };

  const setFilter = (f, evId) => { filter = f; render(evId); };

  const toggleStatus = (evId, tId) => {
    const task = EventoraDB.getTasks(evId).find(t => t.id === tId);
    if (!task) return;
    const newStatus = task.status === 'Done' ? 'Todo' : 'Done';
    EventoraDB.updateTask(evId, tId, { status: newStatus });
    if (newStatus === 'Done') Toast.show('success','Task Done!', task.name);
    App.refreshSidebar();
    render(evId);
  };

  const openAddTask = (evId, tId) => {
    const existing = tId ? EventoraDB.getTasks(evId).find(t => t.id === tId) : null;
    const t = existing || {};
    Modal.open(existing ? 'Edit Task' : 'Add Task',
      `<div class="form-group"><label class="form-label">Task Name *</label><input class="input" id="tfName" value="${t.name||''}" placeholder="e.g., Book venue"></div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Category</label><input class="input" id="tfCat" value="${t.category||''}" placeholder="e.g., Venue, Catering"></div>
         <div class="form-group"><label class="form-label">Priority</label><select class="input" id="tfPriority"><option ${t.priority==='High'?'selected':''}>High</option><option ${t.priority==='Medium'||!t.priority?'selected':''}>Medium</option><option ${t.priority==='Low'?'selected':''}>Low</option></select></div>
       </div>
       <div class="form-row">
         <div class="form-group"><label class="form-label">Deadline</label><input class="input" id="tfDeadline" type="date" value="${t.deadline||''}"></div>
         <div class="form-group"><label class="form-label">Assigned To</label><input class="input" id="tfAssignee" value="${t.assignee||''}" placeholder="Name or team"></div>
       </div>
       <div class="form-group"><label class="form-label">Status</label><select class="input" id="tfStatus"><option ${t.status==='Todo'||!t.status?'selected':''}>Todo</option><option ${t.status==='In Progress'?'selected':''}>In Progress</option><option ${t.status==='Done'?'selected':''}>Done</option></select></div>
       <div class="form-group"><label class="form-label">Notes</label><textarea class="input" id="tfNotes" rows="2">${t.notes||''}</textarea></div>`,
      () => {
        const name = document.getElementById('tfName')?.value?.trim();
        if (!name) { Toast.show('warning','Task name required',''); return; }
        const data = {
          name, category: document.getElementById('tfCat')?.value || 'General',
          priority: document.getElementById('tfPriority')?.value || 'Medium',
          deadline: document.getElementById('tfDeadline')?.value || '',
          assignee: document.getElementById('tfAssignee')?.value || '',
          status: document.getElementById('tfStatus')?.value || 'Todo',
          notes: document.getElementById('tfNotes')?.value || '',
        };
        if (existing) { EventoraDB.updateTask(evId, tId, data); Toast.show('success','Task Updated', name); }
        else { EventoraDB.addTask(evId, data); Toast.show('success','Task Added', name); }
        App.refreshSidebar(); render(evId);
      }, existing ? 'Save' : 'Add Task');
  };

  const editTask   = (evId, tId) => openAddTask(evId, tId);
  const deleteTask = (evId, tId) => {
    const t = EventoraDB.getTasks(evId).find(x => x.id === tId);
    Modal.open('Delete Task', `<p>Delete task <strong>"${t?.name}"</strong>?</p>`,
      () => { EventoraDB.deleteTask(evId, tId); App.refreshSidebar(); render(evId); Toast.show('info','Task Removed',''); }, 'Delete');
  };

  return { render, setFilter, toggleStatus, openAddTask, editTask, deleteTask };
})();
