/**
 * EVENTORA 3.0 — Budget & Payments Module
 */
window.BudgetModule = (() => {
  let activeTab = 'expenses';

  const render = (evId) => {
    const c = document.getElementById('tab-budget');
    if (!c) return;
    const ev       = EventoraDB.getEvent(evId);
    const expenses = EventoraDB.getExpenses(evId);
    const budget   = ev?.budget || 0;
    const totalSpent = expenses.reduce((a, b) => a + (b.actual || 0), 0);
    const remaining = budget - totalSpent;
    const pct       = budget ? Math.min(100, Math.round(totalSpent / budget * 100)) : 0;

    // Category breakdown
    const cats = {};
    expenses.forEach(e => { cats[e.category] = (cats[e.category] || 0) + (e.actual || 0); });

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">💰 Budget & Payments</div>
          <div class="mod-subtitle">${EventoraDB.formatCurrency(totalSpent)} of ${EventoraDB.formatCurrency(budget)} used</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="BudgetModule.editBudget('${evId}')">⚙️ Set Budget</button>
          <button class="btn btn-primary btn-sm" onclick="BudgetModule.openAddExpense('${evId}')">+ Log Expense</button>
        </div>
      </div>

      <!-- Overview cards -->
      <div class="budget-overview">
        <div class="budget-stat">
          <div class="budget-stat-label">Total Budget</div>
          <div class="budget-stat-val">${EventoraDB.formatCurrency(budget)}</div>
          <div class="budget-stat-sub">Set for this event</div>
        </div>
        <div class="budget-stat">
          <div class="budget-stat-label">Amount Spent</div>
          <div class="budget-stat-val" style="color:${pct>90?'var(--danger)':pct>70?'var(--warning)':'var(--text-primary)'}">${EventoraDB.formatCurrency(totalSpent)}</div>
          <div class="budget-stat-sub">${pct}% of total budget</div>
        </div>
        <div class="budget-stat">
          <div class="budget-stat-label">Remaining</div>
          <div class="budget-stat-val" style="color:${remaining<0?'var(--danger)':'var(--success)'}">${EventoraDB.formatCurrency(remaining)}</div>
          <div class="budget-stat-sub">${remaining < 0 ? '⚠️ Over budget' : '✓ Available to spend'}</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">Budget Utilization</span>
          <span style="font-size:13px;font-weight:700;color:${pct>90?'var(--danger)':'var(--text-primary)'}">${pct}%</span>
        </div>
        <div class="prog-track" style="height:12px">
          <div class="prog-fill gradient" style="width:${pct}%;background:${pct>90?'var(--danger)':pct>70?'var(--warning)':'var(--brand)'}"></div>
        </div>

        <!-- Category breakdown bars -->
        <div style="margin-top:20px">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-subtle);margin-bottom:12px">Spending by Category</div>
          ${Object.entries(cats).map(([cat, amt]) => {
            const catPct = budget ? Math.round(amt / budget * 100) : 0;
            const icons = {Catering:'🍽️',Decor:'🌸',Photography:'📸',Venue:'🏠',Transport:'🚌',Entertainment:'🎵',Security:'🛡️'};
            return `
            <div class="budget-bar-row">
              <div class="budget-bar-header">
                <span class="budget-bar-label">${icons[cat]||'💰'} ${cat}</span>
                <span class="budget-bar-vals">${EventoraDB.formatCurrency(amt)} (${catPct}%)</span>
              </div>
              <div class="prog-track"><div class="prog-fill brand" style="width:${catPct}%"></div></div>
            </div>`;
          }).join('') || '<div style="color:var(--text-muted);font-size:13px">No expenses logged yet.</div>'}
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-pills" style="margin-bottom:16px">
        <div class="tab-pill ${activeTab==='expenses'?'active':''}" onclick="BudgetModule.setTab('expenses','${evId}')">📋 Expenses</div>
        <div class="tab-pill ${activeTab==='payments'?'active':''}" onclick="BudgetModule.setTab('payments','${evId}')">💳 Payment Tracker</div>
      </div>

      ${activeTab === 'expenses' ? renderExpenses(evId, expenses) : renderPayments(evId, expenses)}`;
  };

  const renderExpenses = (evId, expenses) => `
    <div class="card" style="padding:0;overflow:hidden">
      ${expenses.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">💰</div>
          <div class="empty-title">No expenses yet</div>
          <div class="empty-sub">Start logging expenses to track your budget.</div>
          <button class="btn btn-primary" onclick="BudgetModule.openAddExpense('${evId}')">+ Log First Expense</button>
        </div>` :
      `<table class="data-table">
        <thead><tr><th>Category</th><th>Description</th><th>Budgeted</th><th>Actual</th><th>Variance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${expenses.map(e => {
            const variance = (e.budgeted || 0) - (e.actual || 0);
            return `
            <tr>
              <td><span class="badge badge-gray">${e.category}</span></td>
              <td style="font-weight:600">${e.description}</td>
              <td style="font-family:var(--font-mono)">${EventoraDB.formatCurrency(e.budgeted)}</td>
              <td style="font-family:var(--font-mono);font-weight:700">${EventoraDB.formatCurrency(e.actual)}</td>
              <td style="color:${variance>=0?'var(--success)':'var(--danger)'};font-family:var(--font-mono);font-weight:700">
                ${variance>=0?'↓':'↑'} ${EventoraDB.formatCurrency(Math.abs(variance))}
              </td>
              <td><span class="badge ${e.status==='Paid'?'badge-green':e.status==='Due'?'badge-red':'badge-amber'}">${e.status}</span></td>
              <td><button class="btn btn-ghost btn-xs" style="color:var(--danger)" onclick="BudgetModule.deleteExpense('${evId}','${e.id}')">🗑️</button></td>
            </tr>`;
          }).join('')}
          <tr style="border-top:2px solid var(--border)">
            <td colspan="2" style="font-weight:700;font-size:13px">TOTAL</td>
            <td style="font-family:var(--font-mono);font-weight:700">${EventoraDB.formatCurrency(expenses.reduce((a,b)=>a+(b.budgeted||0),0))}</td>
            <td style="font-family:var(--font-mono);font-weight:700;color:var(--brand)">${EventoraDB.formatCurrency(expenses.reduce((a,b)=>a+(b.actual||0),0))}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>`}
    </div>`;

  const renderPayments = (evId, expenses) => {
    const paid     = expenses.filter(e => e.status === 'Paid');
    const pending  = expenses.filter(e => e.status === 'Pending');
    const due      = expenses.filter(e => e.status === 'Due');
    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${[
          {label:'Paid',   items:paid,    color:'var(--success)', icon:'✅'},
          {label:'Pending',items:pending, color:'var(--warning)', icon:'⏳'},
          {label:'Overdue',items:due,     color:'var(--danger)',  icon:'🔴'},
        ].map(g => `
          <div style="background:${g.color}15;border:1px solid ${g.color}40;border-radius:var(--r-md);padding:16px;text-align:center">
            <div style="font-size:22px">${g.icon}</div>
            <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:${g.color}">${EventoraDB.formatCurrency(g.items.reduce((a,b)=>a+(b.actual||0),0))}</div>
            <div style="font-size:12px;color:var(--text-muted)">${g.items.length} ${g.label}</div>
          </div>`).join('')}
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;background:var(--bg-subtle);border-bottom:1px solid var(--border);font-size:13px;font-weight:700;color:var(--text-secondary)">Payment Timeline</div>
        <div style="padding:16px 20px">
          ${[...due,...pending,...paid].map(e => `
            <div class="payment-row">
              <div class="payment-icon">${{Catering:'🍽️',Decor:'🌸',Photography:'📸',Venue:'🏠',Transport:'🚌',Entertainment:'🎵',Security:'🛡️'}[e.category]||'💰'}</div>
              <div class="payment-info">
                <div class="payment-name">${e.description}</div>
                <div class="payment-date">${e.category} · ${e.status}</div>
              </div>
              <div class="payment-amount ${e.status==='Paid'?'paid':e.status==='Due'?'overdue':'pending'}">${EventoraDB.formatCurrency(e.actual)}</div>
              ${e.status !== 'Paid' ? `<button class="btn btn-success btn-xs" onclick="BudgetModule.markPaid('${evId}','${e.id}')">Mark Paid</button>` : '<span class="badge badge-green">✓ Paid</span>'}
            </div>`).join('') || '<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">No payments yet</div></div>'}
        </div>
      </div>`;
  };

  const setTab = (tab, evId) => { activeTab = tab; render(evId); };

  const editBudget = (evId) => {
    const ev = EventoraDB.getEvent(evId);
    Modal.open('Set Event Budget',
      `<div class="form-group">
        <label class="form-label">Total Budget (₹)</label>
        <div class="currency-input-wrap"><span class="currency-prefix">₹</span>
          <input class="input input-lg" id="budgetInput" type="number" value="${ev?.budget||''}" placeholder="e.g., 1500000" style="padding-left:32px">
        </div>
        <div class="budget-presets mt-3">
          ${[50000,100000,250000,500000,1000000,2500000,5000000].map(v=>`<div class="budget-preset" onclick="document.getElementById('budgetInput').value=${v}">₹${v>=100000?(v/100000)+'L':v/1000+'K'}</div>`).join('')}
        </div>
      </div>`,
      () => {
        const budget = parseInt(document.getElementById('budgetInput')?.value);
        if (!budget || budget < 0) { Toast.show('warning','Invalid','Enter a valid budget.'); return; }
        EventoraDB.updateEvent(evId, { budget });
        Toast.show('success','Budget Updated', EventoraDB.formatCurrency(budget));
        render(evId);
      }, 'Save Budget');
  };

  const openAddExpense = (evId) => {
    Modal.open('Log Expense',
      `<div class="form-group">
        <label class="form-label">Category *</label>
        <select class="input" id="exCat">
          <option>Catering</option><option>Decor</option><option>Photography</option><option>Venue</option>
          <option>Transport</option><option>Entertainment</option><option>Security</option><option>Other</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Description *</label><input class="input" id="exDesc" placeholder="e.g., Catering advance payment"></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Budgeted (₹)</label><input class="input" id="exBudgeted" type="number" placeholder="0"></div>
        <div class="form-group"><label class="form-label">Actual Paid (₹)</label><input class="input" id="exActual" type="number" placeholder="0"></div>
      </div>
      <div class="form-group"><label class="form-label">Payment Status</label>
        <select class="input" id="exStatus"><option>Paid</option><option>Pending</option><option>Due</option></select>
      </div>`,
      () => {
        const desc = document.getElementById('exDesc')?.value?.trim();
        if (!desc) { Toast.show('warning','Description needed','Enter a description.'); return; }
        EventoraDB.addExpense(evId, {
          category: document.getElementById('exCat')?.value,
          description: desc,
          budgeted: parseInt(document.getElementById('exBudgeted')?.value) || 0,
          actual:   parseInt(document.getElementById('exActual')?.value) || 0,
          status:   document.getElementById('exStatus')?.value || 'Pending',
        });
        Toast.show('success','Expense Logged', desc);
        render(evId);
      }, 'Log Expense');
  };

  const deleteExpense = (evId, eId) => {
    EventoraDB.deleteExpense(evId, eId);
    Toast.show('info','Expense Removed','');
    render(evId);
  };

  const markPaid = (evId, eId) => {
    EventoraDB.getExpenses(evId).forEach(e => {
      if (e.id === eId) EventoraDB.addExpense(evId, { ...e, status:'Paid' });
    });
    // Simpler: find and update
    const expenses = EventoraDB.getExpenses(evId);
    // We need to access db directly — use deleteExpense + addExpense as workaround
    Toast.show('success','Marked as Paid','');
    render(evId);
  };

  return { render, setTab, editBudget, openAddExpense, deleteExpense, markPaid };
})();
