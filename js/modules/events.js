/**
 * EVENTORA - Event Planning & Scheduling Module (Asymmetric Editorial Layout)
 * Senior Frontend Architect & Product Designer Implementation
 */

window.EventsModule = {
    currentFilter: 'all',

    categoryImages: {
        'Wedding': 'assets/3d/wedding_3d.jpg',
        'Tech Conference': 'assets/3d/tech_3d.jpg',
        'Birthday Gala': 'assets/3d/gala_3d.jpg',
        'Corporate Summit': 'assets/3d/gala_3d.jpg',
        'Music Festival': 'assets/3d/festival_3d.jpg'
    },

    render() {
        const container = document.getElementById('eventsGrid');
        if (!container) return;

        const events = window.EventoraDB.getEvents();
        const filtered = this.currentFilter === 'all' 
            ? events 
            : events.filter(e => e.event_type.toLowerCase() === this.currentFilter.toLowerCase() || e.status.toLowerCase() === this.currentFilter.toLowerCase());

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="grid-column: span 12; text-align: center; padding: 56px 24px; background: var(--bg-surface); border-radius: var(--radius-2xl); border: 1px dashed var(--border-hairline);">
                    <div style="font-size: 32px; margin-bottom: 12px;">📅</div>
                    <h3 style="font-family: var(--font-heading); font-size: 18px; margin-bottom: 6px; color: var(--text-high);">No events matching filter</h3>
                    <p style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 20px;">Try selecting a different filter or schedule a new event.</p>
                    <button class="btn btn-primary btn-sm" onclick="App.openModal('modalCreateEvent')">+ Create Event</button>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map((ev, index) => {
            const daysLeft = this.calculateDaysRemaining(ev.event_date);
            const dateObj = new Date(ev.event_date);
            const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
            const dayStr = dateObj.getDate();

            const imgUrl = this.categoryImages[ev.event_type] || this.categoryImages['Corporate Summit'];
            const isNearBudget = ev.budget_utilization > 90;

            // Asymmetric layout classes
            const colClass = index === 0 ? 'event-feature-card' : index === 1 ? 'event-secondary-card' : 'event-standard-card';

            // SVG Circular Progress ring
            const radius = 16;
            const circumference = 2 * Math.PI * radius;
            const progress = Math.min(ev.budget_utilization, 100);
            const offset = circumference - (progress / 100) * circumference;

            const avatarColors = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981'];
            const mockInitials = ['AK', 'SC', 'DR', 'SN'];

            return `
                <div class="luma-event-card tilt-card ${colClass}" id="event-card-${ev.event_id}">
                    <div class="luma-card-media" style="background-image: url('${imgUrl}'); ${index === 0 ? 'height: 220px;' : 'height: 175px;'}">
                        <div class="calendar-date-pill">
                            <div class="calendar-month">${monthStr}</div>
                            <div class="calendar-day">${dayStr}</div>
                        </div>

                        <span class="luma-category-tag">
                            ${ev.event_type}
                        </span>
                    </div>

                    <div class="luma-card-body">
                        <div>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                <span class="event-status-pill status-${ev.status}">${ev.status}</span>
                                <span style="font-size: 11.5px; color: var(--accent-cyan); font-weight: 600; font-family: var(--font-mono);">
                                    ${daysLeft > 0 ? `${daysLeft} days to go` : daysLeft === 0 ? 'Today' : 'Concluded'}
                                </span>
                            </div>

                            <h3 style="font-size: ${index === 0 ? '21px' : '18px'};">${ev.title}</h3>
                            <p class="luma-venue-line">📍 ${ev.venue}</p>

                            <div class="avatar-stack-container">
                                <div class="avatar-stack">
                                    ${mockInitials.map((init, i) => `
                                        <div class="avatar-circle" style="background: ${avatarColors[i]};">${init}</div>
                                    `).join('')}
                                    <span class="avatar-more">+${ev.confirmed_attendees} attending</span>
                                </div>
                                <span style="font-size: 11.5px; color: var(--text-muted); font-family: var(--font-mono);">Capacity: ${ev.target_guests}</span>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 14px; border-top: 1px solid var(--border-hairline);">
                            <div class="circular-progress-wrap">
                                <svg class="progress-ring">
                                    <circle class="progress-ring-circle-bg" cx="20" cy="20" r="${radius}"></circle>
                                    <circle class="progress-ring-circle ${isNearBudget ? 'warning' : ''}" cx="20" cy="20" r="${radius}" 
                                        style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                                    </circle>
                                </svg>
                                <div>
                                    <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Budget ${ev.budget_utilization}%</div>
                                    <div style="font-size: 13px; font-weight: 700; color: var(--text-high); font-family: var(--font-mono);">₹${(ev.total_spent / 1000).toFixed(0)}k / ₹${(ev.total_budget / 1000).toFixed(0)}k</div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-secondary btn-sm" onclick="EventsModule.selectEventForDetails(${ev.event_id})" title="Manage Event">Manage</button>
                                <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="EventsModule.deleteEvent(${ev.event_id})" title="Delete Event">✕</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    calculateDaysRemaining(dateStr) {
        const target = new Date(dateStr);
        const today = new Date();
        const diffTime = target - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    filter(type) {
        this.currentFilter = type;
        document.querySelectorAll('.event-filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === type);
        });
        if (window.InteractiveFx) window.InteractiveFx.playSynth('click');
        this.render();
    },

    selectEventForDetails(eventId) {
        window.GuestsModule.currentEventFilter = eventId;
        window.BudgetModule.currentEventFilter = eventId;
        App.switchTab('guests');
        App.showToast(`Filtered to Event #${eventId}`, 'info');
        if (window.InteractiveFx) window.InteractiveFx.playSynth('sql');
    },

    handleCreateSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const newEvent = {
            title: form.title.value,
            event_type: form.event_type.value,
            venue: form.venue.value,
            event_date: form.event_date.value,
            start_time: form.start_time.value,
            target_guests: form.target_guests.value,
            total_budget: form.total_budget.value,
            status: form.status.value,
            description: form.description.value
        };

        window.EventoraDB.addEvent(newEvent);
        App.closeModal('modalCreateEvent');
        form.reset();
        App.refreshAllModules();
        App.showToast('Event created successfully in Relational Database!', 'success');
        if (window.InteractiveFx) window.InteractiveFx.playSynth('sql');
    },

    deleteEvent(eventId) {
        if (confirm('Are you sure you want to delete this event? All linked bookings, guests, and expenses will be removed per Referential Integrity rules.')) {
            window.EventoraDB.deleteEvent(eventId);
            App.refreshAllModules();
            App.showToast('Event and cascading relations deleted.', 'info');
        }
    }
};
