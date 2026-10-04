/**
 * EVENTORA — Field Staff & Operations Portal Module
 * Zomato-Partner style execution app: Real-time task dispatch,
 * arrival tracking, on-site setup progression, checklists, and customer coordination.
 */
window.EmployeePortalModule = (() => {
  let _activeEmpId = 'emp-1'; // Default: Rahul Verma (Catering Operations Lead)

  const setEmployee = (empId) => {
    _activeEmpId = empId;
    renderPortal();
  };

  const renderPortal = (containerId = 'employeePortalContainer') => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const allEmps = (window.EventoraDB && EventoraDB.getPlatformAnalytics) ? [
      { id: 'emp-1', name: 'Rahul Verma', role: 'Catering & Food Setup Lead', phone: '+91 98765 11001', area: 'Hyderabad Central (Jubilee / Banjara Hills)', rating: 4.9 },
      { id: 'emp-2', name: 'Sneha Nair', role: 'Venue & Decor Quality Inspector', phone: '+91 98765 11002', area: 'Cyberabad (HITEC City / Gachibowli)', rating: 4.9 },
      { id: 'emp-3', name: 'Vikram Rao', role: 'Stage & AV Technical Supervisor', phone: '+91 98765 11003', area: 'Secunderabad & North Hyderabad', rating: 4.8 },
      { id: 'emp-4', name: 'Ananya Patel', role: 'VIP Guest & Transport Coordinator', phone: '+91 98765 11004', area: 'Shamshabad & Airport Corridor', rating: 5.0 }
    ] : [];

    const currentEmp = allEmps.find(e => e.id === _activeEmpId) || allEmps[0];
    const tasks = EventoraDB.getEmployeeTasks(_activeEmpId);

    const activeTasks = tasks.filter(t => t.status !== EventoraDB.TASK_STATUS.COMPLETED && t.status !== EventoraDB.TASK_STATUS.CANCELLED);
    const completedTasks = tasks.filter(t => t.status === EventoraDB.TASK_STATUS.COMPLETED);

    container.innerHTML = `
      <div class="employee-portal-wrap">
        <!-- Field Staff Top Banner -->
        <div class="card" style="background:var(--bg-white);border:1.5px solid var(--border);padding:24px;margin-bottom:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
            <div style="display:flex;align-items:center;gap:16px">
              <div style="width:52px;height:52px;border-radius:50%;background:var(--bg-subtle);display:flex;align-items:center;justify-content:center;font-size:26px">
                👷
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:10px">
                  <h1 style="font-family:var(--font-head);font-size:24px;font-weight:900;color:var(--text-primary);margin:0">${currentEmp.name}</h1>
                  <span class="badge badge-green">On Duty · Available</span>
                </div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px">
                  ${currentEmp.role} · 📍 ${currentEmp.area} · 📞 ${currentEmp.phone} · ⭐ <strong>${currentEmp.rating}</strong>
                </div>
              </div>
            </div>

            <!-- Field Staff Selector (for test flow) -->
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:12px;font-weight:700;color:var(--text-muted)">LOGGED IN AS:</span>
              <select class="input input-sm" style="font-weight:700" onchange="EmployeePortalModule.setEmployee(this.value)">
                ${allEmps.map(e => `
                  <option value="${e.id}" ${e.id === currentEmp.id ? 'selected' : ''}>${e.name} (${e.role.split(' ')[0]})</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="vendor-kpi-grid" style="margin-bottom:28px">
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Active Tasks Today</div>
            <div class="vendor-kpi-val" style="color:var(--accent)">${activeTasks.length}</div>
            <div class="vendor-kpi-sub">On-site coordination required</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Completed Jobs</div>
            <div class="vendor-kpi-val" style="color:var(--success)">${completedTasks.length}</div>
            <div class="vendor-kpi-sub">Verified & signed off</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Field Performance Rating</div>
            <div class="vendor-kpi-val" style="color:var(--brand)">${currentEmp.rating} / 5.0</div>
            <div class="vendor-kpi-sub">Top 5% Operations Coordinator</div>
          </div>
          <div class="vendor-kpi-card">
            <div class="vendor-kpi-hd">Shift Status</div>
            <div class="vendor-kpi-val" style="color:var(--info);font-size:20px">Active Shift</div>
            <div class="vendor-kpi-sub">Assigned Zone: Central Hub</div>
          </div>
        </div>

        <!-- Active Jobs Section -->
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">🚀 Current Operational Tasks</div>
            <span class="badge badge-amber">${activeTasks.length} Pending Execution</span>
          </div>

          ${activeTasks.length === 0 ? `
            <div class="empty-state-box card" style="padding:32px">
              <div style="font-size:36px;margin-bottom:8px">📋</div>
              <div style="font-weight:800;font-size:16px">No pending tasks for your shift</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">When customers book services or vendors confirm catering/decor, new operational tasks will appear here.</div>
            </div>
          ` : `
            <div style="display:grid;gap:20px;margin-top:16px">
              ${activeTasks.map(t => _renderTaskCard(t)).join('')}
            </div>
          `}
        </div>

        <!-- Completed Tasks Section -->
        ${completedTasks.length > 0 ? `
          <div class="workspace-section" style="margin-top:40px">
            <div class="section-row-nav">
              <div class="section-row-nav-title" style="font-size:18px">✅ Completed Jobs History</div>
              <span class="badge badge-green">${completedTasks.length} Completed</span>
            </div>
            <div class="card" style="padding:0;overflow:hidden;margin-top:16px">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Task Title</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${completedTasks.map(t => `
                    <tr>
                      <td><strong>${t.title}</strong></td>
                      <td>${t.eventName}</td>
                      <td>${t.date}</td>
                      <td><span class="badge badge-green">✓ ${t.status}</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };

  const _renderTaskCard = (task) => {
    const s = task.status;
    const isAssigned   = s === EventoraDB.TASK_STATUS.ASSIGNED;
    const isAccepted   = s === EventoraDB.TASK_STATUS.ACCEPTED;
    const isOnTheWay   = s === EventoraDB.TASK_STATUS.ON_THE_WAY;
    const isArrived    = s === EventoraDB.TASK_STATUS.ARRIVED;
    const isInProgress = s === EventoraDB.TASK_STATUS.IN_PROGRESS;

    return `
      <div class="card employee-task-card" style="border:1.5px solid var(--border);padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span class="badge badge-red" style="font-size:11px">High Priority</span>
              <span class="badge badge-gray">${task.taskType}</span>
            </div>
            <h2 style="font-size:20px;font-weight:800;color:var(--text-primary);margin:0">${task.title}</h2>
            <div style="font-size:14px;color:var(--text-muted);margin-top:4px">
              📍 Location: <strong>${task.location}</strong> · 📅 Date: <strong>${task.date}</strong> (${task.time || '15:00'})
            </div>
          </div>
          <div style="text-align:right">
            <span class="badge ${s === 'COMPLETED' ? 'badge-green' : 'badge-amber'}" style="font-size:12px;padding:4px 12px">
              ● ${s.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <!-- Instructions Box -->
        <div style="background:var(--bg-subtle);border-left:4px solid var(--brand);padding:14px 16px;border-radius:var(--r-sm);margin:18px 0;font-size:13.5px;line-height:1.5">
          <strong>Coordinator Directives:</strong> ${task.instructions}
        </div>

        <!-- Real-Time Progress Tracker Stepper -->
        <div class="emp-stepper-wrap">
          <div class="emp-stepper-step ${isAssigned || isAccepted || isOnTheWay || isArrived || isInProgress ? 'done' : ''}">
            <div class="emp-step-circle">1</div>
            <div class="emp-step-label">Assigned</div>
          </div>
          <div class="emp-stepper-line ${isAccepted || isOnTheWay || isArrived || isInProgress ? 'done' : ''}"></div>
          <div class="emp-stepper-step ${isAccepted || isOnTheWay || isArrived || isInProgress ? 'done' : ''}">
            <div class="emp-step-circle">2</div>
            <div class="emp-step-label">Accepted</div>
          </div>
          <div class="emp-stepper-line ${isOnTheWay || isArrived || isInProgress ? 'done' : ''}"></div>
          <div class="emp-stepper-step ${isOnTheWay || isArrived || isInProgress ? 'done' : ''}">
            <div class="emp-step-circle">3</div>
            <div class="emp-step-label">On The Way</div>
          </div>
          <div class="emp-stepper-line ${isArrived || isInProgress ? 'done' : ''}"></div>
          <div class="emp-stepper-step ${isArrived || isInProgress ? 'done' : ''}">
            <div class="emp-step-circle">4</div>
            <div class="emp-step-label">Arrived</div>
          </div>
          <div class="emp-stepper-line ${isInProgress ? 'done' : ''}"></div>
          <div class="emp-stepper-step ${isInProgress ? 'done' : ''}">
            <div class="emp-step-circle">5</div>
            <div class="emp-step-label">In Progress</div>
          </div>
        </div>

        <!-- Dynamic Action Step Button -->
        <div class="emp-actions-bar" style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px">
          ${isAssigned ? `
            <button class="btn btn-primary btn-md" onclick="EmployeePortalModule.advanceTask('${task.id}', '${EventoraDB.TASK_STATUS.ACCEPTED}')">
              ✓ Accept Task
            </button>
          ` : ''}

          ${isAccepted ? `
            <button class="btn btn-primary btn-md" onclick="EmployeePortalModule.advanceTask('${task.id}', '${EventoraDB.TASK_STATUS.ON_THE_WAY}')">
              🚗 Start Travel (ON THE WAY)
            </button>
          ` : ''}

          ${isOnTheWay ? `
            <button class="btn btn-primary btn-md" onclick="EmployeePortalModule.advanceTask('${task.id}', '${EventoraDB.TASK_STATUS.ARRIVED}')">
              📍 Arrived at Venue (ARRIVED)
            </button>
          ` : ''}

          ${isArrived ? `
            <button class="btn btn-primary btn-md" onclick="EmployeePortalModule.advanceTask('${task.id}', '${EventoraDB.TASK_STATUS.IN_PROGRESS}')">
              ⚙️ Begin Setup & Supervision (IN PROGRESS)
            </button>
          ` : ''}

          ${isInProgress ? `
            <button class="btn btn-primary btn-md" style="background:var(--success);border-color:var(--success)" onclick="EmployeePortalModule.advanceTask('${task.id}', '${EventoraDB.TASK_STATUS.COMPLETED}')">
              🎉 Complete Job & Verify Sign-off
            </button>
          ` : ''}
        </div>
      </div>
    `;
  };

  const advanceTask = (taskId, newStatus) => {
    const updated = EventoraDB.updateTaskStatus(taskId, newStatus);
    if (updated) {
      Toast.show('success', `Status: ${newStatus.replace(/_/g, ' ')}`, 'Customer and operations live feed updated.');
      renderPortal();

      // Refresh customer live view if active
      if (window.EventControlModule && typeof EventControlModule.render === 'function') {
        const evId = EventoraDB.getActiveEventId();
        if (evId) EventControlModule.render(evId);
      }
    }
  };

  return {
    setEmployee,
    renderPortal,
    advanceTask
  };
})();
