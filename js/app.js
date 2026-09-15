/**
 * EVENTORA - Core Application Orchestrator (Next-Gen UI & 3D Integration)
 */

window.App = {
    activeTab: 'overview',

    init() {
        this.initSidebar();
        this.setupNavigation();
        this.setupModals();
        this.setupKeyboardShortcuts();
        this.refreshAllModules();

        // Initial SQL Console Run
        if (window.DbmsStudioModule) {
            window.DbmsStudioModule.init();
            window.DbmsStudioModule.runQuery();
        }
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });
        });
    },

    switchTab(tabId) {
        this.activeTab = tabId;

        if (window.InteractiveFx) {
            window.InteractiveFx.playSynth('tab');
        }

        // Update nav UI
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabId);
        });

        // Switch module views
        document.querySelectorAll('.module-view').forEach(view => {
            view.classList.toggle('active', view.id === `view-${tabId}`);
        });

        // Update Header Title
        const titleMap = {
            'overview': { title: 'Executive Overview', sub: 'Integrated Event Planning & DBMS Architecture' },
            'events': { title: 'Event Planning & Scheduling', sub: 'Active Events, Timelines & Venue Coordination' },
            'vendors': { title: 'Vendor Directory & Marketplace', sub: 'Verified Service Partners, Pricing & Contracts' },
            'guests': { title: 'Guest Management & RSVP', sub: 'Invitations, Attendance Tracking & Dietary Needs' },
            'budget': { title: 'Budget & Expense Ledger', sub: 'Allocated Funds vs Real-time Expenditure' },
            'payments': { title: 'Payments & Invoicing Gateway', sub: 'Transaction Audit Trail & Verified Receipts' },
            'dbms-studio': { title: 'Interactive DBMS Studio', sub: 'Live SQL Query Console, ER Diagrams & 3NF Normalization' },
            'admin': { title: 'Admin Control Center', sub: 'System Health, Relational Constraints & Database Operations' }
        };

        const currentMeta = titleMap[tabId] || { title: 'Eventora', sub: 'Event Planning System' };
        document.getElementById('headerModuleTitle').innerText = currentMeta.title;
        document.getElementById('headerModuleSub').innerText = currentMeta.sub;

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    refreshAllModules() {
        this.updatePlatformStats();
        if (window.EventsModule) window.EventsModule.render();
        if (window.VendorsModule) window.VendorsModule.render();
        if (window.GuestsModule) window.GuestsModule.render();
        if (window.BudgetModule) window.BudgetModule.render();
        if (window.PaymentsModule) window.PaymentsModule.render();
    },

    updatePlatformStats() {
        const stats = window.EventoraDB.getPlatformStats();

        // Stat Card Values
        const countEvents = document.getElementById('statTotalEvents');
        const countBudget = document.getElementById('statTotalBudget');
        const countGuests = document.getElementById('statTotalGuests');
        const countVendors = document.getElementById('statTotalVendors');

        if (countEvents) countEvents.innerText = stats.totalEvents;
        if (countBudget) countBudget.innerText = '₹' + stats.totalBudget.toLocaleString('en-IN');
        if (countGuests) countGuests.innerText = stats.attendingGuests + ' Attending';
        if (countVendors) countVendors.innerText = stats.totalVendors;

        // Header quick badge
        const headerEventsBadge = document.getElementById('headerEventsCount');
        if (headerEventsBadge) headerEventsBadge.innerText = `${stats.totalEvents} Active Events`;
    },

    // Modal Control
    setupModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            if (window.InteractiveFx) window.InteractiveFx.playSynth('mode');
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // Toast Notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icons = { success: '✓', info: 'ℹ', error: '⚠' };
        toast.innerHTML = `<span style="font-weight: 700;">${icons[type] || 'ℹ'}</span> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    },

    // Sidebar Visibility Control
    initSidebar() {
        const savedState = localStorage.getItem('eventora_sidebar_collapsed');
        if (savedState === 'true') {
            document.body.classList.add('sidebar-collapsed');
            const btn = document.getElementById('btnSidebarToggle');
            if (btn) {
                btn.setAttribute('title', 'Show Sidebar (Ctrl+B)');
                btn.setAttribute('aria-label', 'Show Sidebar (Ctrl+B)');
            }
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
        }
    },

    toggleSidebar(forceState) {
        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        const shouldCollapse = forceState !== undefined ? forceState : !isCollapsed;

        document.body.classList.toggle('sidebar-collapsed', shouldCollapse);
        localStorage.setItem('eventora_sidebar_collapsed', shouldCollapse ? 'true' : 'false');

        const btn = document.getElementById('btnSidebarToggle');
        if (btn) {
            btn.setAttribute('title', shouldCollapse ? 'Show Sidebar (Ctrl+B)' : 'Hide Sidebar (Ctrl+B)');
            btn.setAttribute('aria-label', shouldCollapse ? 'Show Sidebar (Ctrl+B)' : 'Hide Sidebar (Ctrl+B)');
        }

        // Trigger Three.js and responsive canvas recalculations
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 320);

        if (window.InteractiveFx) {
            window.InteractiveFx.playSynth('tab');
        }

        this.showToast(shouldCollapse ? 'Sidebar hidden — full workspace mode (Ctrl+B)' : 'Sidebar restored (Ctrl+B)', 'info');
    },

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Close active modals on Escape
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(m => this.closeModal(m.id));
                if (window.InteractiveFx) window.InteractiveFx.closeCommandPalette();
            }
            // Toggle sidebar on Ctrl+B / Cmd+B
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
            // Execute SQL on Ctrl+Enter / Cmd+Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (this.activeTab === 'dbms-studio' && window.DbmsStudioModule) {
                    e.preventDefault();
                    window.DbmsStudioModule.runQuery();
                    this.showToast('SQL Query Executed (Ctrl+Enter)', 'info');
                    if (window.InteractiveFx) window.InteractiveFx.playSynth('sql');
                }
            }
        });
    },

    // Database Reset
    resetDatabase() {
        if (confirm('Reset entire Eventora database to default seed data? All custom entries will be restored to initial presentation demo.')) {
            window.EventoraDB.resetToDefaults();
            this.refreshAllModules();
            if (window.DbmsStudioModule) window.DbmsStudioModule.runQuery();
            this.showToast('Database reset to presentation defaults.', 'success');
            if (window.InteractiveFx) window.InteractiveFx.playSynth('mode');
        }
    }
};

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
});
