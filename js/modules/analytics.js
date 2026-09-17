/**
 * EVENTORA 3.0 — Analytics Module (fixed chart rendering)
 */
window.AnalyticsModule = (() => {
  const render = (evId) => {
    const c = document.getElementById('tab-analytics');
    if (!c) return;
    const ev       = EventoraDB.getEvent(evId);
    const guests   = EventoraDB.getGuests(evId);
    const tasks    = EventoraDB.getTasks(evId);
    const expenses = EventoraDB.getExpenses(evId);
    const bookings = EventoraDB.getBookings(evId);

    const attending  = guests.filter(g=>g.rsvp==='Attending').length;
    const declined   = guests.filter(g=>g.rsvp==='Declined').length;
    const pending    = guests.filter(g=>g.rsvp==='Pending').length;
    const checkedIn  = guests.filter(g=>g.checkedIn).length;
    const taskDone   = tasks.filter(t=>t.status==='Done').length;
    const totalSpent = expenses.reduce((a,b)=>a+(b.actual||0),0);
    const budget     = ev?.budget || 0;

    // Expense by category
    const catSpend = {};
    expenses.forEach(e => { catSpend[e.category] = (catSpend[e.category]||0)+(e.actual||0); });
    const catEntries = Object.entries(catSpend).sort((a,b)=>b[1]-a[1]);
    const maxSpend = catEntries[0]?.[1] || 1;

    // RSVP donut data
    const rsvpData = [
      {label:'Attending',val:attending,color:'#10B981'},
      {label:'Pending',  val:pending,  color:'#F59E0B'},
      {label:'Declined', val:declined, color:'#EF4444'},
    ].filter(d=>d.val>0);
    const totalRsvp = rsvpData.reduce((a,b)=>a+b.val,0)||1;

    const donutSvg = (data, total, size=120) => {
      let offset = 0;
      const r = size/2 - 10, cx = size/2, cy = size/2, circumference = 2*Math.PI*r;
      const segments = data.map(d => {
        const pct = d.val / total;
        const seg = { ...d, pct, dash:pct*circumference, offset };
        offset += pct * circumference;
        return seg;
      });
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        ${segments.map(s=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="18" stroke-dasharray="${s.dash} ${circumference-s.dash}" stroke-dashoffset="${-s.offset}" stroke-linecap="round"/>`).join('')}
        <circle cx="${cx}" cy="${cy}" r="${r-14}" fill="white"/>
      </svg>`;
    };

    c.innerHTML = `
      <div class="mod-header">
        <div>
          <div class="mod-title">📈 Analytics & Reports</div>
          <div class="mod-subtitle">Real-time event performance data</div>
        </div>
        <div class="mod-actions">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">📄 Export Report</button>
        </div>
      </div>

      <!-- KPI Grid -->
      <div class="analytics-kpi-grid">
        ${[
          {icon:'👥',label:'Total Guests',val:guests.length,sub:`${attending} attending`,change:'+'+attending,pos:true},
          {icon:'✅',label:'RSVP Rate',val:guests.length?(Math.round((attending+declined)/guests.length*100)+'%'):'—',sub:`${attending} confirmed`,change:''},
          {icon:'📋',label:'Task Progress',val:tasks.length?(Math.round(taskDone/tasks.length*100)+'%'):'—',sub:`${taskDone} of ${tasks.length} done`,change:''},
          {icon:'💰',label:'Budget Used',val:EventoraDB.formatCurrency(totalSpent),sub:budget?(Math.round(totalSpent/budget*100)+'% of '+EventoraDB.formatCurrency(budget)):'No budget set',change:''},
          {icon:'🤝',label:'Vendors Booked',val:bookings.length,sub:'',change:''},
          {icon:'✓',label:'Check-In Rate',val:attending?(Math.round(checkedIn/attending*100)+'%'):'—',sub:`${checkedIn} checked in`,change:''},
        ].map(k=>`
          <div class="analytics-kpi-card">
            <div class="akpi-icon">${k.icon}</div>
            <div class="akpi-val">${k.val}</div>
            <div class="akpi-label">${k.label}</div>
            ${k.sub?`<div style="font-size:12px;color:var(--text-subtle);margin-top:3px">${k.sub}</div>`:''}
            ${k.change?`<div class="akpi-change pos">↑ ${k.change}</div>`:''}
          </div>`).join('')}
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">

        <!-- RSVP Donut -->
        <div class="chart-card">
          <div class="chart-title">Guest RSVP Status</div>
          <div class="chart-subtitle">Breakdown of all guest responses</div>
          <div class="donut-wrap">
            <div style="position:relative;flex-shrink:0">
              ${donutSvg(rsvpData, totalRsvp, 140)}
              <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
                <div style="font-family:var(--font-head);font-size:22px;font-weight:800">${guests.length}</div>
                <div style="font-size:10px;color:var(--text-muted)">Total</div>
              </div>
            </div>
            <div class="chart-legend">
              ${rsvpData.map(d=>`
                <div class="legend-row">
                  <span class="legend-dot" style="background:${d.color}"></span>
                  <span class="legend-label">${d.label}</span>
                  <span class="legend-val">${d.val} <span style="color:var(--text-subtle);font-weight:400">(${Math.round(d.val/totalRsvp*100)}%)</span></span>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Budget Breakdown Donut -->
        <div class="chart-card">
          <div class="chart-title">Spending by Category</div>
          <div class="chart-subtitle">How budget is being allocated</div>
          ${catEntries.length > 0 ? (() => {
            const colors = ['#7C3AED','#06B6D4','#10B981','#F59E0B','#EC4899','#3B82F6','#EF4444'];
            const donutData = catEntries.slice(0,6).map((e,i)=>({label:e[0],val:e[1],color:colors[i%colors.length]}));
            const totalCat = donutData.reduce((a,b)=>a+b.val,0)||1;
            return `<div class="donut-wrap">
              <div style="position:relative;flex-shrink:0">
                ${donutSvg(donutData, totalCat, 140)}
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
                  <div style="font-family:var(--font-head);font-size:16px;font-weight:800">${EventoraDB.formatCurrency(totalSpent)}</div>
                  <div style="font-size:10px;color:var(--text-muted)">Spent</div>
                </div>
              </div>
              <div class="chart-legend">
                ${donutData.map(d=>`
                  <div class="legend-row">
                    <span class="legend-dot" style="background:${d.color}"></span>
                    <span class="legend-label">${d.label}</span>
                    <span class="legend-val">${EventoraDB.formatCurrency(d.val)}</span>
                  </div>`).join('')}
              </div>
            </div>`;
          })() : `<div class="empty-state" style="padding:20px"><div class="empty-icon">💰</div><div class="empty-title">No expenses yet</div></div>`}
        </div>

        <!-- Task Progress Bar chart -->
        <div class="chart-card">
          <div class="chart-title">Task Completion</div>
          <div class="chart-subtitle">Progress across task categories</div>
          ${(() => {
            const catMap = {};
            tasks.forEach(t => {
              const cat = t.category||'General';
              if (!catMap[cat]) catMap[cat] = {total:0,done:0};
              catMap[cat].total++;
              if (t.status==='Done') catMap[cat].done++;
            });
            const entries = Object.entries(catMap);
            if (entries.length === 0) return `<div class="empty-state" style="padding:20px"><div class="empty-icon">✅</div><div class="empty-title">No tasks yet</div></div>`;
            return entries.map(([cat,{total,done}]) => {
              const pct = Math.round(done/total*100);
              return `<div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                  <span style="font-size:13px;font-weight:500;color:var(--text-secondary)">${cat}</span>
                  <span style="font-size:12px;font-weight:700;color:var(--text-primary)">${done}/${total} (${pct}%)</span>
                </div>
                <div class="prog-track"><div class="prog-fill success" style="width:${pct}%"></div></div>
              </div>`;
            }).join('');
          })()}
        </div>

        <!-- Spending vs Budget bar chart -->
        <div class="chart-card">
          <div class="chart-title">Spend vs Budget by Category</div>
          <div class="chart-subtitle">Actual spending compared to budget</div>
          ${catEntries.length > 0 ? `
            <div style="display:flex;flex-direction:column;gap:10px">
              ${catEntries.map(([cat,actual]) => {
                const budgeted = expenses.filter(e=>e.category===cat).reduce((a,b)=>a+(b.budgeted||0),0);
                const pctActual = maxSpend ? Math.round(actual/maxSpend*100) : 0;
                const pctBudget = maxSpend && budgeted ? Math.round(budgeted/maxSpend*100) : 0;
                const over = actual > budgeted;
                return `<div>
                  <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">${cat}</span>
                    <span style="font-size:11px;color:${over?'var(--danger)':'var(--success)'};font-weight:700">${over?'▲ Over':'✓ Under'}</span>
                  </div>
                  <div class="prog-track" style="height:8px;margin-bottom:2px">
                    <div style="height:100%;width:${pctBudget}%;background:var(--border-md);border-radius:var(--r-full)"></div>
                  </div>
                  <div class="prog-track" style="height:8px">
                    <div style="height:100%;width:${pctActual}%;background:${over?'var(--danger)':'var(--brand)'};border-radius:var(--r-full);transition:width 0.6s var(--ease)"></div>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-subtle);margin-top:2px">
                    <span>Budget: ${EventoraDB.formatCurrency(budgeted)}</span>
                    <span>Actual: ${EventoraDB.formatCurrency(actual)}</span>
                  </div>
                </div>`;
              }).join('')}
            </div>` : `<div class="empty-state" style="padding:20px"><div class="empty-icon">📊</div><div class="empty-title">No expense data yet</div></div>`}
        </div>
      </div>

      <!-- Summary Card -->
      <div class="card" style="margin-top:20px;background:linear-gradient(135deg,var(--brand-light),var(--accent-light))">
        <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:14px">📊 Event Health Summary</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          ${[
            {label:'Planning Score', val: tasks.length ? taskDone+'/'+tasks.length+' tasks done' : 'No tasks', ok:taskDone===tasks.length&&tasks.length>0},
            {label:'Budget Health',  val: budget ? (totalSpent<=budget?'✓ Within budget':'⚠️ Over budget') : 'Budget not set', ok:budget&&totalSpent<=budget},
            {label:'Guest Response', val: guests.length ? attending+' confirmed, '+pending+' pending' : 'No guests added', ok:pending===0&&attending>0},
            {label:'Vendor Coverage',val: bookings.length>0 ? bookings.length+' vendors booked' : 'No vendors yet', ok:bookings.length>0},
          ].map(s=>`
            <div style="background:${s.ok?'var(--success-bg)':'var(--bg-white)'};border:1px solid ${s.ok?'var(--success)':'var(--border)'};border-radius:var(--r-md);padding:14px">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${s.ok?'var(--success)':'var(--text-muted)'};margin-bottom:4px">${s.label}</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${s.val}</div>
            </div>`).join('')}
        </div>
      </div>`;
  };

  return { render };
})();
