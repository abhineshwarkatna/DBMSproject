/**
 * EVENTORA - Budget & Expense Management Module
 */

window.BudgetModule = {
    currentEventFilter: 'all',

    render() {
        this.renderEventSelector();
        const tableBody = document.getElementById('expensesTableBody');
        if (!tableBody) return;

        let expenses = window.EventoraDB.getExpenses();
        let events = window.EventoraDB.getEvents();

        if (this.currentEventFilter !== 'all') {
            expenses = expenses.filter(x => x.event_id === Number(this.currentEventFilter));
            events = events.filter(e => e.event_id === Number(this.currentEventFilter));
        }

        const totalAllocated = events.reduce((s, e) => s + (Number(e.total_budget) || 0), 0);
        const totalEstimated = expenses.reduce((s, x) => s + (Number(x.estimated_cost) || 0), 0);
        const totalActual = expenses.reduce((s, x) => s + (Number(x.actual_cost) || 0), 0);
        const variance = totalAllocated - totalActual;
        const utilizationPct = totalAllocated > 0 ? Math.round((totalActual / totalAllocated) * 100) : 0;

        // Update Stat Cards in Budget View
        const allocatedEl = document.getElementById('budgetTotalAllocated');
        const spentEl = document.getElementById('budgetTotalSpent');
        const remainingEl = document.getElementById('budgetTotalRemaining');
        const pctEl = document.getElementById('budgetUtilizationBar');

        if (allocatedEl) allocatedEl.innerText = '₹' + totalAllocated.toLocaleString('en-IN');
        if (spentEl) spentEl.innerText = '₹' + totalActual.toLocaleString('en-IN');
        if (remainingEl) {
            remainingEl.innerText = '₹' + Math.abs(variance).toLocaleString('en-IN') + (variance < 0 ? ' (Overrun)' : ' (Remaining)');
            remainingEl.style.color = variance < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)';
        }
        if (pctEl) {
            pctEl.style.width = Math.min(utilizationPct, 100) + '%';
            pctEl.className = 'budget-progress-fill ' + (utilizationPct > 100 ? 'warning' : '');
            document.getElementById('budgetPctLabel').innerText = `${utilizationPct}% Used`;
        }

        if (expenses.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">No expenses recorded for this event.</td></tr>`;
            return;
        }

        tableBody.innerHTML = expenses.map(x => `
            <tr>
                <td><strong style="font-family: var(--font-mono); color: var(--secondary);">#EXP-${x.expense_id}</strong></td>
                <td><strong>${x.item_name}</strong><br><span style="font-size: 11px; color: var(--text-muted);">${x.event_title}</span></td>
                <td><span class="team-chip" style="font-size: 11px;">${x.category}</span></td>
                <td>₹${Number(x.estimated_cost).toLocaleString('en-IN')}</td>
                <td><strong style="color: var(--text-primary);">₹${Number(x.actual_cost).toLocaleString('en-IN')}</strong></td>
                <td>
                    <span class="team-chip" style="font-size: 11px; ${x.payment_status === 'Paid' ? 'border-color: var(--accent-emerald); color: var(--accent-emerald);' : 'border-color: var(--accent-amber); color: var(--accent-amber);'}">
                        ${x.payment_status}
                    </span>
                </td>
            </tr>
        `).join('');
    },

    renderEventSelector() {
        const select = document.getElementById('budgetEventFilterSelect');
        const modalSelect = document.getElementById('expenseEventSelect');
        const events = window.EventoraDB.getEvents();

        if (select && select.children.length <= 1) {
            select.innerHTML = '<option value="all">All Events Combined</option>' + events.map(e => `
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

    handleAddSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const newExpense = {
            event_id: form.event_id.value,
            category: form.category.value,
            item_name: form.item_name.value,
            estimated_cost: form.estimated_cost.value,
            actual_cost: form.actual_cost.value,
            payment_status: form.payment_status.value
        };

        window.EventoraDB.addExpense(newExpense);
        App.closeModal('modalAddExpense');
        form.reset();
        App.refreshAllModules();
        App.showToast('Itemized expense logged to event ledger!', 'success');
    }
};
