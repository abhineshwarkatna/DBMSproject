/**
 * EVENTORA 3.0 — DBMS Studio
 * Live SQL editor, schema explorer, and ER diagram
 */
window.DbmsModule = (() => {
  let activeQuery = '';
  let selectedTable = null;

  const SCHEMA = {
    Events: {
      color:'#7C3AED', x:20, y:20,
      fields:[
        {name:'event_id',type:'UUID',key:'pk'},
        {name:'title',type:'VARCHAR(200)'},
        {name:'category',type:'VARCHAR(50)'},
        {name:'subtype',type:'VARCHAR(100)'},
        {name:'event_date',type:'DATE'},
        {name:'start_time',type:'TIME'},
        {name:'status',type:'ENUM'},
        {name:'budget',type:'DECIMAL(15,2)'},
        {name:'venue_id',type:'UUID',key:'fk'},
        {name:'organizer_id',type:'UUID',key:'fk'},
        {name:'created_at',type:'TIMESTAMP'},
      ]
    },
    Guests: {
      color:'#06B6D4', x:280, y:20,
      fields:[
        {name:'guest_id',type:'UUID',key:'pk'},
        {name:'event_id',type:'UUID',key:'fk'},
        {name:'full_name',type:'VARCHAR(100)'},
        {name:'email',type:'VARCHAR(200)'},
        {name:'phone',type:'VARCHAR(15)'},
        {name:'rsvp_status',type:'ENUM'},
        {name:'guest_role',type:'VARCHAR(50)'},
        {name:'table_number',type:'VARCHAR(20)'},
        {name:'dietary_pref',type:'VARCHAR(100)'},
        {name:'checked_in',type:'BOOLEAN'},
        {name:'checked_in_at',type:'TIMESTAMP'},
      ]
    },
    Expenses: {
      color:'#10B981', x:540, y:20,
      fields:[
        {name:'expense_id',type:'UUID',key:'pk'},
        {name:'event_id',type:'UUID',key:'fk'},
        {name:'category',type:'VARCHAR(50)'},
        {name:'description',type:'TEXT'},
        {name:'budgeted_amount',type:'DECIMAL(15,2)'},
        {name:'actual_amount',type:'DECIMAL(15,2)'},
        {name:'pay_status',type:'ENUM'},
        {name:'created_at',type:'TIMESTAMP'},
      ]
    },
    Vendors: {
      color:'#F59E0B', x:20, y:280,
      fields:[
        {name:'vendor_id',type:'UUID',key:'pk'},
        {name:'name',type:'VARCHAR(200)'},
        {name:'category',type:'VARCHAR(100)'},
        {name:'contact_name',type:'VARCHAR(100)'},
        {name:'phone',type:'VARCHAR(15)'},
        {name:'city',type:'VARCHAR(100)'},
        {name:'rating',type:'DECIMAL(3,2)'},
        {name:'base_price',type:'DECIMAL(15,2)'},
        {name:'is_verified',type:'BOOLEAN'},
      ]
    },
    Bookings: {
      color:'#EC4899', x:280, y:280,
      fields:[
        {name:'booking_id',type:'UUID',key:'pk'},
        {name:'event_id',type:'UUID',key:'fk'},
        {name:'vendor_id',type:'UUID',key:'fk'},
        {name:'service_desc',type:'TEXT'},
        {name:'agreed_cost',type:'DECIMAL(15,2)'},
        {name:'status',type:'ENUM'},
        {name:'booked_at',type:'TIMESTAMP'},
      ]
    },
    Tasks: {
      color:'#3B82F6', x:540, y:280,
      fields:[
        {name:'task_id',type:'UUID',key:'pk'},
        {name:'event_id',type:'UUID',key:'fk'},
        {name:'title',type:'VARCHAR(200)'},
        {name:'category',type:'VARCHAR(100)'},
        {name:'priority',type:'ENUM'},
        {name:'status',type:'ENUM'},
        {name:'deadline',type:'DATE'},
        {name:'assignee',type:'VARCHAR(100)'},
      ]
    },
    Schedule: {
      color:'#6B7280', x:20, y:520,
      fields:[
        {name:'item_id',type:'UUID',key:'pk'},
        {name:'event_id',type:'UUID',key:'fk'},
        {name:'title',type:'VARCHAR(200)'},
        {name:'start_time',type:'TIME'},
        {name:'end_time',type:'TIME'},
        {name:'location',type:'VARCHAR(200)'},
        {name:'speaker',type:'VARCHAR(200)'},
        {name:'type',type:'ENUM'},
      ]
    },
    Venues: {
      color:'#8B5CF6', x:280, y:520,
      fields:[
        {name:'venue_id',type:'UUID',key:'pk'},
        {name:'name',type:'VARCHAR(200)'},
        {name:'address',type:'TEXT'},
        {name:'city',type:'VARCHAR(100)'},
        {name:'capacity',type:'INTEGER'},
        {name:'venue_type',type:'ENUM'},
        {name:'facilities',type:'JSON'},
      ]
    },
  };

  const PRESETS = [
    {label:'All Events', q:'SELECT * FROM Events ORDER BY event_date ASC;'},
    {label:'Guest Count by RSVP', q:'SELECT rsvp_status, COUNT(*) AS count\nFROM Guests\nGROUP BY rsvp_status;'},
    {label:'Top Expenses', q:'SELECT category, SUM(actual_amount) AS total\nFROM Expenses\nGROUP BY category\nORDER BY total DESC;'},
    {label:'Overdue Tasks', q:"SELECT title, priority, deadline\nFROM Tasks\nWHERE deadline < CURDATE()\n  AND status != 'Done'\nORDER BY priority DESC;"},
    {label:'Booked Vendors', q:"SELECT v.name, b.service_desc, b.agreed_cost, b.status\nFROM Bookings b\nJOIN Vendors v ON b.vendor_id = v.vendor_id\nWHERE b.status = 'Confirmed';"},
    {label:'Budget vs Actual', q:'SELECT category,\n  SUM(budgeted_amount) AS budget,\n  SUM(actual_amount) AS actual,\n  SUM(budgeted_amount - actual_amount) AS variance\nFROM Expenses\nGROUP BY category;'},
    {label:'Event Schedule', q:'SELECT title, start_time, end_time, location, type\nFROM Schedule\nORDER BY start_time;'},
    {label:'Checked-In Guests', q:"SELECT full_name, guest_role, checked_in_at\nFROM Guests\nWHERE checked_in = TRUE\nORDER BY checked_in_at;"},
  ];

  const executeQuery = (evId) => {
    const q = document.getElementById('sqlEditor')?.value?.trim();
    if (!q) { setResults('<div class="empty-state" style="padding:20px"><div class="empty-title">Write a query above</div></div>'); return; }
    activeQuery = q;
    // Generate sample results from actual data
    const ev = EventoraDB.getEvent(evId || EventoraDB.getActiveEventId());
    const guests   = ev ? EventoraDB.getGuests(ev.id)   : [];
    const expenses = ev ? EventoraDB.getExpenses(ev.id) : [];
    const tasks    = ev ? EventoraDB.getTasks(ev.id)    : [];
    const bookings = ev ? EventoraDB.getBookings(ev.id) : [];
    const schedule = ev ? EventoraDB.getSchedule(ev.id) : [];

    let rows = [], cols = [];
    const ql = q.toLowerCase();

    if (ql.includes('from guests') && ql.includes('rsvp_status') && ql.includes('count')) {
      cols = ['rsvp_status','count'];
      const groups = {};
      guests.forEach(g => { groups[g.rsvp] = (groups[g.rsvp]||0)+1; });
      rows = Object.entries(groups).map(([s,c])=>({rsvp_status:s,count:c}));
    } else if (ql.includes('from guests')) {
      cols = ['full_name','email','rsvp_status','guest_role','dietary_pref','checked_in'];
      rows = guests.map(g=>({full_name:g.name,email:g.email||'—',rsvp_status:g.rsvp,guest_role:g.role||'Guest',dietary_pref:g.dietary||'—',checked_in:g.checkedIn?'Yes':'No'}));
    } else if (ql.includes('from expenses') && ql.includes('category') && ql.includes('sum')) {
      cols = ['category','budget','actual','variance'];
      const grp = {};
      expenses.forEach(e => {
        const c = e.category;
        if (!grp[c]) grp[c] = {budget:0,actual:0};
        grp[c].budget += e.budgeted||0; grp[c].actual += e.actual||0;
      });
      rows = Object.entries(grp).map(([cat,v])=>({category:cat,budget:'₹'+v.budget.toLocaleString('en-IN'),actual:'₹'+v.actual.toLocaleString('en-IN'),variance:'₹'+(v.budget-v.actual).toLocaleString('en-IN')}));
    } else if (ql.includes('from tasks') && ql.includes('done')) {
      cols = ['title','priority','deadline'];
      const today = new Date().toISOString().split('T')[0];
      rows = tasks.filter(t=>t.deadline&&t.deadline<today&&t.status!=='Done').map(t=>({title:t.name,priority:t.priority||'Medium',deadline:t.deadline}));
    } else if (ql.includes('from bookings') || (ql.includes('join') && ql.includes('vendor'))) {
      cols = ['vendor_name','service_desc','agreed_cost','status'];
      rows = bookings.map(b=>({vendor_name:b.vendorName,service_desc:b.service,agreed_cost:'₹'+b.cost.toLocaleString('en-IN'),status:b.status}));
    } else if (ql.includes('from schedule') || ql.includes('from tasks')) {
      if (ql.includes('from schedule')) {
        cols = ['title','start_time','end_time','location','type'];
        rows = schedule.map(s=>({title:s.title,start_time:s.startTime||'—',end_time:s.endTime||'—',location:s.location||'—',type:s.type||'session'}));
      } else {
        cols = ['title','category','priority','status','deadline'];
        rows = tasks.map(t=>({title:t.name,category:t.category||'General',priority:t.priority||'Medium',status:t.status||'Todo',deadline:t.deadline||'—'}));
      }
    } else if (ql.includes('from events')) {
      cols = ['title','category','event_date','budget','status'];
      rows = EventoraDB.getAllEvents().map(e=>({title:e.title,category:e.category,event_date:e.eventDate||'—',budget:'₹'+(e.budget||0).toLocaleString('en-IN'),status:e.status||'Planning'}));
    } else {
      // Generic fallback — show event summary
      cols = ['property','value'];
      rows = ev ? [
        {property:'Event',value:ev.title},{property:'Category',value:ev.category},
        {property:'Date',value:ev.eventDate||'TBD'},{property:'Guests',value:guests.length},
        {property:'Budget',value:'₹'+(ev.budget||0).toLocaleString('en-IN')},
        {property:'Tasks Done',value:`${tasks.filter(t=>t.status==='Done').length}/${tasks.length}`},
      ] : [{property:'Status',value:'No active event'}];
    }

    const html = rows.length === 0 ?
      '<div style="padding:20px;text-align:center;color:var(--text-muted)">No results returned.</div>' :
      `<table class="data-table" style="font-size:12px">
        <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row=>`<tr>${cols.map(col=>`<td style="font-family:var(--font-mono)">${row[col]??'—'}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <div style="padding:10px 16px;background:var(--bg-subtle);border-top:1px solid var(--border);font-size:12px;color:var(--text-muted)">
        ✅ Query executed · ${rows.length} row(s) returned · ${cols.length} column(s)
      </div>`;
    setResults(html);
  };

  const setResults = (html) => {
    const r = document.getElementById('sqlResults');
    if (r) r.innerHTML = html;
  };

  const render = () => {
    const c = document.getElementById('tab-dbms');
    if (!c) return;
    const evId = EventoraDB.getActiveEventId();

    c.innerHTML = `
      <div class="dbms-header">
        <div class="dbms-header-icon">⚡</div>
        <div>
          <div class="dbms-header-title">DBMS Studio</div>
          <div class="dbms-header-sub">Live SQL editor connected to your EVENTORA event database</div>
          <div class="dbms-badges">
            <span class="badge badge-violet">8 Tables</span>
            <span class="badge badge-green">Live Data</span>
            <span class="badge badge-blue">SQLite Engine</span>
            <span class="badge badge-amber">DBMS Term Project</span>
          </div>
        </div>
      </div>

      <div class="dbms-layout">
        <!-- Schema Explorer -->
        <div class="schema-explorer">
          <div class="schema-explorer-header">📂 Schema Explorer — ${Object.keys(SCHEMA).length} Tables</div>
          ${Object.entries(SCHEMA).map(([tname, tdef]) => `
            <div class="schema-table-card ${selectedTable===tname?'open':''}">
              <div class="schema-table-header" onclick="DbmsModule.toggleTable('${tname}')">
                <span class="schema-table-icon" style="color:${tdef.color}">▶</span>
                <span class="schema-table-name" style="color:${tdef.color}">${tname}</span>
                <span style="font-size:11px;color:var(--text-subtle)">${tdef.fields.length} cols</span>
              </div>
              <div class="schema-fields">
                ${tdef.fields.map(f => `
                  <div class="schema-field">
                    ${f.key ? `<span class="field-key ${f.key}">${f.key.toUpperCase()}</span>` : '<span style="width:24px"></span>'}
                    <span class="field-name">${f.name}</span>
                    <span class="field-type">${f.type}</span>
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>

        <!-- SQL Editor + Results -->
        <div>
          <div class="sql-editor-card" style="margin-bottom:20px">
            <div class="sql-editor-tabs-row">
              <div class="sql-editor-tab-btns">
                <div class="sql-tab-btn active">SQL Query</div>
                <div class="sql-tab-btn" onclick="Toast.show('info','Tables','Use the schema explorer on the left.')">Tables</div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-xs" onclick="document.getElementById('sqlEditor').value=''">🗑️ Clear</button>
                <button class="btn btn-primary btn-sm" onclick="DbmsModule.executeQuery('${evId}')">▶ Run Query</button>
              </div>
            </div>
            <textarea class="sql-textarea" id="sqlEditor" spellcheck="false" placeholder="-- Write your SQL query here&#10;-- Press Ctrl+Enter to run&#10;SELECT * FROM Events LIMIT 10;"
              onkeydown="if((e=arguments[0]).ctrlKey&&e.key==='Enter'){e.preventDefault();DbmsModule.executeQuery('${evId}')}"
            >${activeQuery||'SELECT * FROM Events\nORDER BY event_date ASC;'}</textarea>
            <div class="sql-preset-row">
              <span class="sql-preset-label">Quick Queries:</span>
              ${PRESETS.map(p=>`<div class="sql-preset-btn" onclick="document.getElementById('sqlEditor').value=\`${p.q.replace(/`/g,'\\`')}\`;DbmsModule.executeQuery('${evId}')">${p.label}</div>`).join('')}
            </div>
          </div>

          <!-- Results -->
          <div class="sql-editor-card">
            <div class="sql-editor-tabs-row">
              <div class="sql-editor-tab-btns">
                <div class="sql-tab-btn active">Results</div>
              </div>
              <div style="font-size:12px;color:var(--text-muted)">Click "Run Query" to see data</div>
            </div>
            <div class="sql-results-area" id="sqlResults">
              <div class="empty-state" style="padding:24px">
                <div class="empty-icon">📊</div>
                <div class="empty-title">No query run yet</div>
                <div class="empty-sub">Write a SQL query above or click a Quick Query preset.</div>
              </div>
            </div>
          </div>

          <!-- ER Diagram -->
          <div class="er-diagram" style="margin-top:20px">
            <div style="font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--text-primary);margin-bottom:4px">📐 Entity Relationship Diagram</div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Simplified ER diagram showing key relationships between tables</div>
            <div class="er-diagram-canvas" style="height:420px;position:relative;overflow:auto">
              <!-- ER Boxes -->
              ${Object.entries(SCHEMA).map(([tname, tdef]) => `
                <div class="er-table-box" style="left:${tdef.x}px;top:${tdef.y}px">
                  <div class="er-table-head" style="background:${tdef.color}">${tname}</div>
                  ${tdef.fields.slice(0,5).map(f=>`
                    <div class="er-table-field ${f.key||''}">
                      ${f.key?`[${f.key.toUpperCase()}] `:''}${f.name}: ${f.type}
                    </div>`).join('')}
                  ${tdef.fields.length > 5 ? `<div class="er-table-field" style="color:var(--text-subtle)">+ ${tdef.fields.length-5} more...</div>` : ''}
                </div>`).join('')}

              <!-- Relationship arrows via SVG overlay -->
              <svg style="position:absolute;inset:0;pointer-events:none;overflow:visible" width="800" height="600">
                <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#9CA3AF"/></marker></defs>
                <!-- Guests → Events -->
                <line x1="280" y1="60" x2="160" y2="60" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
                <!-- Expenses → Events -->
                <line x1="540" y1="60" x2="420" y2="60" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
                <!-- Bookings → Events -->
                <line x1="280" y1="330" x2="140" y2="200" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
                <!-- Bookings → Vendors -->
                <line x1="280" y1="310" x2="200" y2="310" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
                <!-- Tasks → Events -->
                <line x1="540" y1="310" x2="420" y2="200" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
                <!-- Schedule → Events -->
                <line x1="20" y1="540" x2="90" y2="180" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
              </svg>
            </div>
            <!-- Relationship legend -->
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:16px;font-size:12px;color:var(--text-muted)">
              <div style="display:flex;align-items:center;gap:6px"><svg width="30" height="12"><line x1="0" y1="6" x2="24" y2="6" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/></svg> Foreign Key Reference</div>
              ${[{from:'Events',to:'Guests',rel:'1:N'},{from:'Events',to:'Tasks',rel:'1:N'},{from:'Events',to:'Expenses',rel:'1:N'},{from:'Vendors',to:'Bookings',rel:'1:N'}].map(r=>`<div><strong style="color:var(--text-primary)">${r.from}</strong> → <strong style="color:var(--text-primary)">${r.to}</strong> <span>(${r.rel})</span></div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  };

  const toggleTable = (tname) => {
    selectedTable = selectedTable === tname ? null : tname;
    render();
    // Auto fill query for the table
    const qmap = {Events:'SELECT * FROM Events ORDER BY event_date ASC;', Guests:'SELECT * FROM Guests;', Expenses:'SELECT category, SUM(actual_amount) AS total FROM Expenses GROUP BY category;', Tasks:'SELECT title, priority, status, deadline FROM Tasks ORDER BY deadline;', Bookings:'SELECT * FROM Bookings;', Schedule:'SELECT title, start_time, end_time, location FROM Schedule ORDER BY start_time;'};
    if (tname && qmap[tname]) {
      const ed = document.getElementById('sqlEditor');
      if (ed) ed.value = qmap[tname];
    }
  };

  return { render, executeQuery, toggleTable, setResults };
})();
