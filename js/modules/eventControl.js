/**
 * EVENTORA — Customer Event Control Center & Event-Day Live Operations Module
 * Real-time monitoring of booked vendors, assigned Eventora operations staff,
 * arrival progression, emergency hotlines, and post-service review modal.
 */
window.EventControlModule = (() => {
  const render = (evId) => {
    const container = document.getElementById('tab-live');
    if (!container) return;

    const ev = EventoraDB.getEvent(evId);
    if (!ev) {
      container.innerHTML = `<div class="card" style="padding:24px;text-align:center">Select or create an event to access Event Control Center.</div>`;
      return;
    }

    const bookings = EventoraDB.getBookingsForEvent(evId);
    const tasks = EventoraDB.getTasks(evId);
    const schedule = EventoraDB.getSchedule(evId);

    container.innerHTML = `
      <div class="event-control-wrap">
        <!-- Control Center Header -->
        <div class="card" style="background:var(--bg-white);border:1.5px solid var(--border);padding:24px;margin-bottom:24px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
            <div>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="badge badge-red" style="font-size:12px;padding:4px 10px">● LIVE OPERATIONS CENTER</span>
                <span style="font-size:13px;color:var(--text-muted)">Event Date: <strong>${ev.eventDate || 'Scheduled'}</strong></span>
              </div>
              <h1 style="font-family:var(--font-head);font-size:28px;font-weight:900;color:var(--text-primary);margin:6px 0 0">${ev.title}</h1>
              <div style="font-size:14px;color:var(--text-muted);margin-top:2px">
                📍 Venue: <strong>${ev.venueName || ev.venue || 'Taj Falaknuma Palace'}</strong> · 👥 Target: <strong>${ev.guestCapacity || 250} Guests</strong> · 💰 Budget: <strong>${EventoraDB.formatCurrency(ev.budget || 800000)}</strong>
              </div>
            </div>
            <div style="text-align:right">
              <button class="btn btn-secondary btn-sm" onclick="EventControlModule.openEmergencyModal('${evId}')">🚨 Emergency Helpdesk</button>
            </div>
          </div>
        </div>

        <!-- Coordinated Service Providers & Live Operations Grid -->
        <div class="workspace-section">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">🛡️ Booked Vendors & Live Field Staff Status</div>
            <button class="btn btn-primary btn-sm" onclick="App.switchTab('vendors')">+ Add More Services</button>
          </div>

          ${bookings.length === 0 ? `
            <div class="empty-state-box card" style="padding:32px">
              <div style="font-size:36px;margin-bottom:8px">🛎️</div>
              <div style="font-weight:800;font-size:16px">No services booked for this event yet</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">Browse Catering, Photography, Decor, and DJs from our verified marketplace.</div>
              <button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="App.switchTab('vendors')">Browse Marketplace</button>
            </div>
          ` : `
            <div style="display:grid;gap:16px;margin-top:16px">
              ${bookings.map(b => {
                const isCompleted = b.status === EventoraDB.BOOKING_STATUS.COMPLETED;
                const isAccepted = b.status === EventoraDB.BOOKING_STATUS.ACCEPTED || b.status === EventoraDB.BOOKING_STATUS.CONFIRMED;
                const isInProgress = b.status === EventoraDB.BOOKING_STATUS.IN_PROGRESS;

                return `
                  <div class="card" style="border:1.5px solid var(--border);padding:20px">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
                      <div>
                        <div style="display:flex;align-items:center;gap:8px">
                          <span class="badge badge-gray">${b.vendorCategory}</span>
                          <span class="badge ${isCompleted ? 'badge-green' : isAccepted ? 'badge-info' : 'badge-amber'}">
                            ${b.status}
                          </span>
                        </div>
                        <h3 style="font-size:18px;font-weight:800;margin:6px 0 2px">${b.vendorName}</h3>
                        <div style="font-size:13px;color:var(--text-muted)">
                          Package: <strong>${b.packageName}</strong> (${b.guestCount} guests) · Cost: <strong>${EventoraDB.formatCurrency(b.total)}</strong>
                        </div>
                      </div>

                      <div style="text-align:right">
                        ${isCompleted ? `
                          <button class="btn btn-primary btn-sm" onclick="EventControlModule.openReviewModal('${b.id}', '${b.vendorId}', '${b.vendorName}')">
                            ⭐ Rate & Review Vendor
                          </button>
                        ` : `
                          <span class="badge badge-amber" style="padding:6px 12px">
                            ${b.operationalStatus || 'Operations Lead Monitoring'}
                          </span>
                        `}
                      </div>
                    </div>

                    <!-- Coordinator details -->
                    <div style="margin-top:14px;padding:12px;background:var(--bg-subtle);border-radius:var(--r-sm);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:13px">
                      <div style="display:flex;align-items:center;gap:10px">
                        <span style="font-size:18px">👷</span>
                        <div>
                          <strong>Eventora Field Lead:</strong> ${b.assignedEmployeeName || 'Rahul Verma (Catering Operations)'}
                          <span style="color:var(--text-muted);margin-left:6px">(+91 98765 11001)</span>
                        </div>
                      </div>
                      <div style="color:var(--success);font-weight:700">
                        ✓ On-site coordination active
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- Run of Day Timeline -->
        <div class="workspace-section" style="margin-top:36px">
          <div class="section-row-nav">
            <div class="section-row-nav-title" style="font-size:18px">⏱️ Today's Schedule & Run of Show</div>
            <button class="btn btn-secondary btn-sm" onclick="App.switchTab('schedule')">Edit Timeline</button>
          </div>

          <div class="card" style="margin-top:14px;padding:20px;border:1.5px solid var(--border)">
            ${schedule.length === 0 ? `
              <div style="color:var(--text-muted);font-size:13px">Add schedule milestones in the Schedule tab to monitor live countdowns.</div>
            ` : `
              <div class="live-timeline-list">
                ${schedule.map(s => `
                  <div class="live-timeline-item" style="display:flex;align-items:flex-start;gap:16px;padding:10px 0;border-bottom:1px solid var(--border)">
                    <div style="font-family:var(--font-mono);font-weight:800;color:var(--brand);min-width:60px">${s.startTime || '18:00'}</div>
                    <div style="flex:1">
                      <div style="font-weight:700;font-size:14px">${s.title}</div>
                      <div style="font-size:12px;color:var(--text-muted)">📍 ${s.location || 'Main Venue'}</div>
                    </div>
                    <span class="badge badge-gray">Scheduled</span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Post-Completion Review Modal
   */
  const openReviewModal = (bookingId, vendorId, vendorName) => {
    const html = `
      <div>
        <p style="font-size:13.5px;color:var(--text-muted);margin-bottom:16px">
          Help future organizers! Rate your verified experience with <strong>${vendorName}</strong>.
        </p>

        <div class="form-group">
          <label class="form-label" style="font-weight:700">Overall Rating (1 to 5 Stars)</label>
          <select class="input" id="revOverallRating" style="font-size:16px;font-weight:700">
            <option value="5">⭐⭐⭐⭐⭐ (5.0 - Exceptional)</option>
            <option value="4">⭐⭐⭐⭐ (4.0 - Very Good)</option>
            <option value="3">⭐⭐⭐ (3.0 - Average)</option>
            <option value="2">⭐⭐ (2.0 - Below Expectations)</option>
            <option value="1">⭐ (1.0 - Poor)</option>
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Food & Service Quality</label>
            <select class="input" id="revQuality">
              <option value="5">5 / 5</option>
              <option value="4">4 / 5</option>
              <option value="3">3 / 5</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Punctuality & Timeliness</label>
            <select class="input" id="revTimeliness">
              <option value="5">5 / 5</option>
              <option value="4">4 / 5</option>
              <option value="3">3 / 5</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Your Review & Comments</label>
          <textarea class="input" id="revComment" rows="3" placeholder="Describe the taste, setup presentation, and on-site hospitality..."></textarea>
        </div>
      </div>
    `;

    Modal.open(
      `Review ${vendorName}`,
      html,
      () => {
        const rating = Number(document.getElementById('revOverallRating')?.value || 5);
        const quality = Number(document.getElementById('revQuality')?.value || 5);
        const timeliness = Number(document.getElementById('revTimeliness')?.value || 5);
        const comment = document.getElementById('revComment')?.value || 'Superb quality and seamless execution!';

        EventoraDB.addReview({
          bookingId,
          vendorId,
          customerName: 'Priya Sharma (Client)',
          rating,
          quality,
          timeliness,
          comment
        });

        Toast.show('success', 'Review Published! ⭐', `Thank you! Your feedback updated ${vendorName}'s official rating.`);
        const evId = EventoraDB.getActiveEventId();
        if (evId) render(evId);
      },
      'Submit Official Review'
    );
  };

  const openEmergencyModal = (evId) => {
    Modal.open(
      '🚨 Eventora Operations Hotline',
      `
        <div style="padding:10px 0">
          <p style="font-size:13.5px;color:var(--text-secondary);margin-bottom:14px">
            Your event is protected by dedicated 24/7 Eventora operations managers.
          </p>
          <div class="card" style="background:var(--bg-subtle);padding:14px;margin-bottom:12px">
            <strong>Dedicated Operations Dispatcher:</strong><br>
            📞 +91 98765 00001 (Priority Event Day Response)
          </div>
          <div class="card" style="background:var(--bg-subtle);padding:14px">
            <strong>On-Site Field Supervisor:</strong><br>
            Rahul Verma · 📞 +91 98765 11001
          </div>
        </div>
      `
    );
  };

  return {
    render,
    openReviewModal,
    openEmergencyModal
  };
})();
