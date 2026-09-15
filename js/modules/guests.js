/**
 * EVENTORA - Guest Management & RSVP Module
 */

window.GuestsModule = {
    currentEventFilter: 'all',
    searchQuery: '',

    render() {
        this.renderEventSelector();
        const tableBody = document.getElementById('guestsTableBody');
        if (!tableBody) return;

        let guests = window.EventoraDB.getGuests();
        if (this.currentEventFilter !== 'all') {
            guests = guests.filter(g => g.event_id === Number(this.currentEventFilter));
        }

        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            guests = guests.filter(g => g.full_name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q));
        }

        // Summary counts
        const total = guests.length;
        const attending = guests.filter(g => g.rsvp_status === 'Attending').reduce((s, g) => s + 1 + g.plus_ones, 0);
        const declined = guests.filter(g => g.rsvp_status === 'Declined').length;
        const pending = guests.filter(g => g.rsvp_status === 'Pending').length;

        const summaryEl = document.getElementById('guestStatsSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <span class="team-chip">Total Invited: <strong>${total}</strong></span>
                <span class="team-chip" style="border-color: var(--accent-emerald);">Attending (incl. +1s): <strong style="color: var(--accent-emerald);">${attending}</strong></span>
                <span class="team-chip" style="border-color: var(--accent-amber);">Pending: <strong style="color: var(--accent-amber);">${pending}</strong></span>
                <span class="team-chip" style="border-color: var(--accent-rose);">Declined: <strong style="color: var(--accent-rose);">${declined}</strong></span>
            `;
        }

        if (guests.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No guests match the selected filter.</td></tr>`;
            return;
        }

        tableBody.innerHTML = guests.map(g => `
            <tr>
                <td><strong style="font-family: var(--font-mono); color: var(--secondary);">#G-${g.guest_id}</strong></td>
                <td>
                    <div style="font-weight: 600;">${g.full_name}</div>
                    <div style="font-size: 11.5px; color: var(--text-muted);">${g.email} | ${g.phone || 'No phone'}</div>
                </td>
                <td><span style="font-size: 12.5px; color: var(--text-secondary);">${g.event_title}</span></td>
                <td>
                    <select class="rsvp-select ${g.rsvp_status}" onchange="GuestsModule.handleRSVPChange(${g.guest_id}, this.value)">
                        <option value="Attending" ${g.rsvp_status === 'Attending' ? 'selected' : ''}>Attending</option>
                        <option value="Pending" ${g.rsvp_status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Declined" ${g.rsvp_status === 'Declined' ? 'selected' : ''}>Declined</option>
                    </select>
                </td>
                <td><span class="team-chip" style="font-size: 11px;">${g.dietary_pref}</span></td>
                <td><strong>+${g.plus_ones}</strong></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="GuestsModule.deleteGuest(${g.guest_id})" title="Remove Guest" style="color: var(--accent-rose);">✕</button>
                </td>
            </tr>
        `).join('');
    },

    renderEventSelector() {
        const select = document.getElementById('guestEventFilterSelect');
        const modalSelect = document.getElementById('guestEventSelect');
        const events = window.EventoraDB.getEvents();

        if (select && select.children.length <= 1) {
            select.innerHTML = '<option value="all">All Events</option>' + events.map(e => `
                <option value="${e.event_id}" ${Number(this.currentEventFilter) === e.event_id ? 'selected' : ''}>${e.title}</option>
            `).join('');
        }

        if (modalSelect) {
            modalSelect.innerHTML = events.map(e => `
                <option value="${e.event_id}">${e.title}</option>
            `).join('');
        }
    },

    filterByEvent(eventId) {
        this.currentEventFilter = eventId;
        this.render();
    },

    handleSearch(query) {
        this.searchQuery = query;
        this.render();
    },

    handleRSVPChange(guestId, newStatus) {
        window.EventoraDB.updateGuestRSVP(guestId, newStatus);
        App.refreshAllModules();
        App.showToast(`Guest RSVP updated to ${newStatus}`, 'info');
    },

    handleAddSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const newGuest = {
            event_id: form.event_id.value,
            full_name: form.full_name.value,
            email: form.email.value,
            phone: form.phone.value,
            rsvp_status: form.rsvp_status.value,
            dietary_pref: form.dietary_pref.value,
            plus_ones: form.plus_ones.value
        };

        window.EventoraDB.addGuest(newGuest);
        App.closeModal('modalAddGuest');
        form.reset();
        App.refreshAllModules();
        App.showToast('Guest added to event guestlist!', 'success');
    },

    deleteGuest(guestId) {
        window.EventoraDB.deleteGuest(guestId);
        App.refreshAllModules();
        App.showToast('Guest record removed.', 'info');
    }
};
