/**
 * EVENTORA - Interactive DBMS Relational Studio Module
 * Features Live SQL Console, Interactive ER Diagram, Normalization Guide, and SQL Export
 */

window.DbmsStudioModule = {
    presets: {
        budgetVariance: `SELECT 
    e.event_id,
    e.title AS event_title,
    e.event_type,
    e.total_budget AS allocated_budget,
    COALESCE(SUM(x.actual_cost), 0.00) AS total_actual_spent,
    (e.total_budget - COALESCE(SUM(x.actual_cost), 0.00)) AS remaining_balance
FROM events e
LEFT JOIN expenses x ON e.event_id = x.event_id
GROUP BY e.event_id, e.title, e.event_type, e.total_budget;`,

        confirmedBookings: `SELECT 
    b.booking_id,
    e.title AS event_name,
    v.business_name AS vendor,
    v.service_category,
    b.agreed_cost,
    b.booking_status,
    v.phone AS vendor_phone
FROM bookings b
JOIN events e ON b.event_id = e.event_id
JOIN vendors v ON b.vendor_id = v.vendor_id
WHERE b.booking_status = 'Confirmed'
ORDER BY b.agreed_cost DESC;`,

        rsvpStats: `SELECT 
    e.title AS event_title,
    COUNT(g.guest_id) AS total_invited,
    SUM(CASE WHEN g.rsvp_status = 'Attending' THEN 1 + g.plus_ones ELSE 0 END) AS confirmed_attendees,
    SUM(CASE WHEN g.rsvp_status = 'Declined' THEN 1 ELSE 0 END) AS declined_count,
    SUM(CASE WHEN g.rsvp_status = 'Pending' THEN 1 ELSE 0 END) AS pending_responses
FROM events e
LEFT JOIN guests g ON e.event_id = g.event_id
GROUP BY e.event_id, e.title;`,

        selectEvents: `SELECT * FROM events;`,
        selectVendors: `SELECT * FROM vendors;`,
        selectBookings: `SELECT * FROM bookings;`,
        selectGuests: `SELECT * FROM guests;`,
        selectPayments: `SELECT * FROM payments;`
    },

    init() {
        this.renderERDiagram();
        const editor = document.getElementById('sqlEditor');
        if (editor && !editor.value) {
            editor.value = this.presets.budgetVariance;
        }
    },

    loadPreset(presetKey) {
        const editor = document.getElementById('sqlEditor');
        if (editor && this.presets[presetKey]) {
            editor.value = this.presets[presetKey];
            this.runQuery();
        }
    },

    runQuery() {
        const editor = document.getElementById('sqlEditor');
        if (!editor) return;

        const rawSql = editor.value;
        const res = window.EventoraDB.executeSQL(rawSql);

        const metaEl = document.getElementById('sqlExecMeta');
        if (metaEl) {
            metaEl.innerText = `✓ Execution: ${res.executionTime} | Rows returned: ${res.count}`;
        }

        const tableHead = document.getElementById('sqlResultsThead');
        const tableBody = document.getElementById('sqlResultsTbody');
        if (!tableHead || !tableBody) return;

        tableHead.innerHTML = `<tr>${res.columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
        tableBody.innerHTML = res.rows.map(r => `
            <tr>${r.map(val => `<td>${val}</td>`).join('')}</tr>
        `).join('');
    },

    renderERDiagram() {
        const container = document.getElementById('erEntitiesGrid');
        if (!container) return;

        const entities = [
            {
                name: 'users',
                badge: '1:N with events',
                color: '#6366f1',
                attrs: [
                    { name: 'user_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'full_name', isPk: false, isFk: false, type: 'VARCHAR(100)' },
                    { name: 'email', isPk: false, isFk: false, type: 'VARCHAR(120) UNIQUE' },
                    { name: 'role', isPk: false, isFk: false, type: 'ENUM(Admin, Organizer, Client)' }
                ]
            },
            {
                name: 'events',
                badge: 'Central Entity (1:N)',
                color: '#7c3aed',
                attrs: [
                    { name: 'event_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'organizer_id', isPk: false, isFk: true, ref: 'users.user_id', type: 'INT' },
                    { name: 'title', isPk: false, isFk: false, type: 'VARCHAR(150)' },
                    { name: 'event_type', isPk: false, isFk: false, type: 'ENUM' },
                    { name: 'venue', isPk: false, isFk: false, type: 'VARCHAR(150)' },
                    { name: 'event_date', isPk: false, isFk: false, type: 'DATE' },
                    { name: 'total_budget', isPk: false, isFk: false, type: 'DECIMAL(12,2)' }
                ]
            },
            {
                name: 'vendors',
                badge: 'M:N via bookings',
                color: '#06b6d4',
                attrs: [
                    { name: 'vendor_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'business_name', isPk: false, isFk: false, type: 'VARCHAR(120)' },
                    { name: 'service_category', isPk: false, isFk: false, type: 'ENUM' },
                    { name: 'base_price', isPk: false, isFk: false, type: 'DECIMAL(10,2)' },
                    { name: 'rating', isPk: false, isFk: false, type: 'DECIMAL(2,1)' }
                ]
            },
            {
                name: 'bookings',
                badge: 'Relational Junction Table',
                color: '#ec4899',
                attrs: [
                    { name: 'booking_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'event_id', isPk: false, isFk: true, ref: 'events.event_id', type: 'INT' },
                    { name: 'vendor_id', isPk: false, isFk: true, ref: 'vendors.vendor_id', type: 'INT' },
                    { name: 'agreed_cost', isPk: false, isFk: false, type: 'DECIMAL(10,2)' },
                    { name: 'booking_status', isPk: false, isFk: false, type: 'ENUM' }
                ]
            },
            {
                name: 'guests',
                badge: 'Child of events',
                color: '#10b981',
                attrs: [
                    { name: 'guest_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'event_id', isPk: false, isFk: true, ref: 'events.event_id', type: 'INT' },
                    { name: 'full_name', isPk: false, isFk: false, type: 'VARCHAR(100)' },
                    { name: 'rsvp_status', isPk: false, isFk: false, type: 'ENUM' },
                    { name: 'plus_ones', isPk: false, isFk: false, type: 'INT' }
                ]
            },
            {
                name: 'expenses',
                badge: 'Financial Ledger',
                color: '#f59e0b',
                attrs: [
                    { name: 'expense_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'event_id', isPk: false, isFk: true, ref: 'events.event_id', type: 'INT' },
                    { name: 'category', isPk: false, isFk: false, type: 'ENUM' },
                    { name: 'actual_cost', isPk: false, isFk: false, type: 'DECIMAL(10,2)' },
                    { name: 'payment_status', isPk: false, isFk: false, type: 'ENUM' }
                ]
            },
            {
                name: 'payments',
                badge: 'Transaction Audit Log',
                color: '#8b5cf6',
                attrs: [
                    { name: 'payment_id', isPk: true, isFk: false, type: 'INT (AI)' },
                    { name: 'event_id', isPk: false, isFk: true, ref: 'events.event_id', type: 'INT' },
                    { name: 'booking_id', isPk: false, isFk: true, ref: 'bookings.booking_id (Nullable)', type: 'INT' },
                    { name: 'amount', isPk: false, isFk: false, type: 'DECIMAL(10,2)' },
                    { name: 'transaction_ref', isPk: false, isFk: false, type: 'VARCHAR(80) UNIQUE' }
                ]
            }
        ];

        container.innerHTML = entities.map(e => `
            <div class="er-entity-card">
                <div class="er-entity-header" style="border-top: 3px solid ${e.color};">
                    <span>🗄️ ${e.name}</span>
                    <span style="font-size: 10.5px; opacity: 0.85; font-weight: 500;">${e.badge}</span>
                </div>
                <ul class="er-attr-list">
                    ${e.attrs.map(a => `
                        <li class="er-attr-item">
                            <div class="er-attr-name">
                                ${a.isPk ? '<span class="pk-badge">PK 🔑</span>' : ''}
                                ${a.isFk ? `<span class="fk-badge" title="References ${a.ref}">FK 🔗</span>` : ''}
                                <span>${a.name}</span>
                            </div>
                            <span class="er-attr-type">${a.type}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
    },

    exportSQLFile() {
        const link = document.createElement('a');
        link.href = 'data/eventora_schema.sql';
        link.download = 'eventora_schema.sql';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast('Downloaded MySQL schema script (eventora_schema.sql)', 'success');
    }
};
