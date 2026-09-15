/**
 * EVENTORA - Payments & Invoicing Gateway Module
 */

window.PaymentsModule = {
    render() {
        const tableBody = document.getElementById('paymentsTableBody');
        if (!tableBody) return;

        const payments = window.EventoraDB.getPayments();
        if (payments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No payments recorded yet.</td></tr>`;
            return;
        }

        tableBody.innerHTML = payments.map(p => `
            <tr>
                <td><strong style="font-family: var(--font-mono); color: var(--primary-light);">#PAY-${p.payment_id}</strong></td>
                <td><strong style="font-family: var(--font-mono); font-size: 11.5px; color: var(--secondary);">${p.transaction_ref}</strong></td>
                <td>${p.event_title}</td>
                <td>${p.vendor_recipient}</td>
                <td><strong style="color: var(--accent-emerald);">₹${Number(p.amount).toLocaleString('en-IN')}</strong></td>
                <td><span class="team-chip" style="font-size: 11px;">${p.payment_method}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="PaymentsModule.viewInvoice(${p.payment_id})">📄 Receipt</button>
                </td>
            </tr>
        `).join('');

        this.populatePaymentEventSelector();
    },

    populatePaymentEventSelector() {
        const eventSelect = document.getElementById('paymentEventSelect');
        if (eventSelect) {
            const events = window.EventoraDB.getEvents();
            eventSelect.innerHTML = events.map(e => `<option value="${e.event_id}">${e.title}</option>`).join('');
        }
    },

    handleAddSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const newPayment = {
            event_id: form.event_id.value,
            amount: form.amount.value,
            payment_method: form.payment_method.value,
            transaction_ref: 'TXN_' + Math.random().toString(36).substring(2, 9).toUpperCase()
        };

        window.EventoraDB.addPayment(newPayment);
        App.closeModal('modalRecordPayment');
        form.reset();
        App.refreshAllModules();
        App.showToast('Payment recorded with verified transaction reference!', 'success');
    },

    viewInvoice(paymentId) {
        const p = window.EventoraDB.getPayments().find(item => item.payment_id === Number(paymentId));
        if (!p) return;

        const container = document.getElementById('invoiceContent');
        if (!container) return;

        container.innerHTML = `
            <div class="invoice-card">
                <div class="invoice-header">
                    <div>
                        <h2 style="font-family: var(--font-heading); color: var(--primary); font-size: 24px; font-weight: 800;">EVENTORA</h2>
                        <p style="font-size: 12px; color: #64748b;">Plan Smart. Celebrate Smarter.</p>
                        <p style="font-size: 11px; color: #94a3b8; margin-top: 4px;">DBMS Project | Team Abhineshwar</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="font-size: 16px; color: #0f172a;">PAYMENT RECEIPT</h3>
                        <p style="font-family: var(--font-mono); font-size: 12px; color: #64748b;">Ref: ${p.transaction_ref}</p>
                        <p style="font-size: 11.5px; color: #94a3b8;">Date: ${p.payment_date}</p>
                    </div>
                </div>

                <div style="margin: 20px 0; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 13px;">
                    <div><strong>Event:</strong> ${p.event_title}</div>
                    <div><strong>Payee / Vendor:</strong> ${p.vendor_recipient}</div>
                    <div><strong>Payment Method:</strong> ${p.payment_method}</div>
                </div>

                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Status</th>
                            <th style="text-align: right;">Amount Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Event Service Settlement (${p.vendor_recipient})</td>
                            <td><span style="color: #10b981; font-weight: 700;">Verified & Cleared</span></td>
                            <td style="text-align: right;"><strong>₹${Number(p.amount).toLocaleString('en-IN')}</strong></td>
                        </tr>
                    </tbody>
                </table>

                <div style="text-align: right; margin-top: 20px;">
                    <div style="font-size: 14px; color: #64748b;">Total Amount:</div>
                    <div style="font-size: 26px; font-weight: 800; color: #0f172a; font-family: var(--font-heading);">
                        ₹${Number(p.amount).toLocaleString('en-IN')}
                    </div>
                </div>

                <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 11px; color: #94a3b8; text-align: center;">
                    This is a system-generated cryptographic receipt issued by the Eventora DBMS Platform.
                </div>
            </div>
        `;

        App.openModal('modalInvoice');
    }
};
