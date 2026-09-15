/**
 * EVENTORA - Vendor Registry & Booking Module (Asymmetric Bento Hierarchy)
 */

window.VendorsModule = {
    currentCategory: 'all',

    vendorImages: {
        1: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?w=600&auto=format&fit=crop&q=80',
        2: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=600&auto=format&fit=crop&q=80',
        3: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=600&auto=format&fit=crop&q=80',
        4: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
        5: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&auto=format&fit=crop&q=80'
    },

    render() {
        const container = document.getElementById('vendorsGrid');
        if (!container) return;

        const vendors = window.EventoraDB.getVendors();
        const filtered = this.currentCategory === 'all'
            ? vendors
            : vendors.filter(v => v.service_category.toLowerCase().includes(this.currentCategory.toLowerCase()));

        container.innerHTML = filtered.map((v, index) => {
            const img = this.vendorImages[v.vendor_id] || this.vendorImages[1];
            const spanClass = index < 2 ? 'event-standard-card' : 'event-secondary-card';

            return `
                <div class="vendor-card tilt-card ${spanClass}" id="vendor-card-${v.vendor_id}" style="padding: 0; overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-hairline); border-radius: var(--radius-2xl);">
                    <!-- Media Banner -->
                    <div style="height: ${index < 2 ? '150px' : '130px'}; background-image: url('${img}'); background-size: cover; background-position: center; position: relative;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,8,13,0.1) 0%, rgba(14,19,31,0.95) 100%);"></div>
                        <div style="position: absolute; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: center;">
                            <span class="vendor-category-tag" style="background: rgba(6,8,13,0.7); backdrop-filter: blur(10px); padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.12); font-size: 10.5px; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase;">
                                ${v.service_category}
                            </span>
                            <div class="vendor-rating" style="background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); padding: 2px 8px; border-radius: 99px; border: 1px solid rgba(255,255,255,0.1); font-size: 11.5px; font-weight: 700; color: #fbbf24;">⭐ ${v.rating}</div>
                        </div>
                    </div>

                    <div style="padding: 22px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 class="vendor-name" style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: var(--text-high); margin-bottom: 8px;">${v.business_name}</h3>
                            <div class="vendor-contact-info" style="font-size: 12.5px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px;">
                                <span>👤 Contact: <strong style="color: var(--text-body);">${v.contact_name}</strong></span>
                                <span>📞 ${v.phone}</span>
                                <span>✉️ ${v.email}</span>
                            </div>

                            <div style="display: flex; align-items: baseline; gap: 6px; margin: 16px 0;">
                                <span class="vendor-price-tag" style="font-family: var(--font-heading); font-size: 20px; font-weight: 800; color: #34d399;">₹${v.base_price.toLocaleString('en-IN')}</span>
                                <span class="vendor-price-sub" style="font-size: 11px; color: var(--text-subtle);">Base Contract</span>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-hairline); padding-top: 14px;">
                            <span style="font-size: 11px; color: var(--accent-emerald); font-weight: 600;">
                                ✓ ${v.badge || 'Verified Partner'}
                            </span>
                            <button class="btn btn-primary btn-sm" onclick="VendorsModule.openBookingModal(${v.vendor_id})">Book Vendor</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.renderBookingsList();
    },

    renderBookingsList() {
        const tableBody = document.getElementById('bookingsTableBody');
        if (!tableBody) return;

        const bookings = window.EventoraDB.getBookings();
        if (bookings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 28px;">No active vendor bookings found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = bookings.map(b => `
            <tr>
                <td><strong style="font-family: var(--font-mono); color: var(--accent-cyan);">#BK-${b.booking_id}</strong></td>
                <td><strong>${b.event_title}</strong></td>
                <td>${b.vendor_name} <br><span style="font-size: 11px; color: var(--text-muted);">${b.vendor_category}</span></td>
                <td><strong style="font-family: var(--font-mono);">₹${b.agreed_cost.toLocaleString('en-IN')}</strong></td>
                <td>
                    <span class="event-status-pill status-${b.booking_status}">${b.booking_status}</span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="VendorsModule.toggleBookingStatus(${b.booking_id}, '${b.booking_status === 'Confirmed' ? 'Completed' : 'Confirmed'}')">
                        ${b.booking_status === 'Confirmed' ? 'Mark Completed' : 'Confirm'}
                    </button>
                </td>
            </tr>
        `).join('');
    },

    filter(cat) {
        this.currentCategory = cat;
        document.querySelectorAll('.vendor-filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === cat);
        });
        if (window.InteractiveFx) window.InteractiveFx.playSynth('click');
        this.render();
    },

    openBookingModal(vendorId) {
        const vendor = window.EventoraDB.getVendorById(vendorId);
        if (!vendor) return;

        const events = window.EventoraDB.getEvents();
        const eventSelect = document.getElementById('bookingEventSelect');
        if (eventSelect) {
            eventSelect.innerHTML = events.map(e => `
                <option value="${e.event_id}">${e.title} (${e.event_type})</option>
            `).join('');
        }

        document.getElementById('bookingVendorId').value = vendor.vendor_id;
        document.getElementById('bookingVendorName').innerText = vendor.business_name;
        document.getElementById('bookingAgreedCost').value = vendor.base_price;

        App.openModal('modalBookVendor');
        if (window.InteractiveFx) window.InteractiveFx.playSynth('mode');
    },

    handleBookingSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const newBooking = {
            event_id: form.event_id.value,
            vendor_id: form.vendor_id.value,
            agreed_cost: form.agreed_cost.value,
            booking_status: 'Confirmed',
            service_notes: form.service_notes.value
        };

        window.EventoraDB.addBooking(newBooking);
        App.closeModal('modalBookVendor');
        form.reset();
        App.refreshAllModules();
        App.showToast('Vendor booked and linked to event expenses!', 'success');
        if (window.InteractiveFx) window.InteractiveFx.playSynth('sql');
    },

    toggleBookingStatus(bookingId, newStatus) {
        window.EventoraDB.updateBookingStatus(bookingId, newStatus);
        App.refreshAllModules();
        App.showToast(`Booking #BK-${bookingId} updated to ${newStatus}`, 'info');
        if (window.InteractiveFx) window.InteractiveFx.playSynth('click');
    }
};
