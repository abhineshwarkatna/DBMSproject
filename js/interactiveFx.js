/**
 * EVENTORA - Interactive Tactile FX Engine
 * 1. 3D Card Tilt with Dynamic Specular Reflection
 * 2. Linear/Raycast Command Palette (Ctrl+K / ⌘K)
 * 3. Web Audio API Micro-interaction Synthesizer
 */

window.InteractiveFx = {
    audioCtx: null,
    isSoundEnabled: true,
    cmdItems: [],
    selectedCmdIndex: 0,

    init() {
        this.setup3DTilt();
        this.setupCommandPalette();
        this.setupAudio();
    },

    // --- 1. 3D CARD TILT & SPECULAR SHINE ---
    setup3DTilt() {
        document.addEventListener('mousemove', (e) => {
            const card = e.target.closest('.tilt-card');
            if (!card) return;

            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Set specular position
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);

            // Calculate tilt angle (-10deg to 10deg)
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -7;
            const rotateY = ((x - centerX) / centerX) * 7;

            card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
        });

        document.addEventListener('mouseout', (e) => {
            const card = e.target.closest('.tilt-card');
            if (card && !card.contains(e.relatedTarget)) {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
            }
        });
    },

    // --- 2. COMMAND PALETTE (Ctrl+K / ⌘K) ---
    setupCommandPalette() {
        // Keyboard trigger
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.toggleCommandPalette();
            }
        });

        // Close on escape or outside click
        const overlay = document.getElementById('commandPaletteModal');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeCommandPalette();
            });
        }

        const input = document.getElementById('cmdSearchInput');
        if (input) {
            input.addEventListener('input', (e) => this.filterCommands(e.target.value));
            input.addEventListener('keydown', (e) => this.handlePaletteKeydown(e));
        }
    },

    toggleCommandPalette() {
        const overlay = document.getElementById('commandPaletteModal');
        if (!overlay) return;

        if (overlay.classList.contains('active')) {
            this.closeCommandPalette();
        } else {
            this.openCommandPalette();
        }
    },

    openCommandPalette() {
        const overlay = document.getElementById('commandPaletteModal');
        const input = document.getElementById('cmdSearchInput');
        if (!overlay) return;

        this.buildIndex();
        overlay.classList.add('active');
        this.playSynth('mode');

        if (input) {
            input.value = '';
            input.focus();
        }
        this.renderCommandList(this.cmdItems);
    },

    closeCommandPalette() {
        const overlay = document.getElementById('commandPaletteModal');
        if (overlay) overlay.classList.remove('active');
    },

    buildIndex() {
        const db = window.EventoraDB;
        this.cmdItems = [
            // Core Navigation
            { title: 'Executive Overview', group: 'Navigation', icon: '📊', action: () => App.switchTab('overview') },
            { title: 'Event Planning & Scheduling', group: 'Navigation', icon: '📅', action: () => App.switchTab('events') },
            { title: 'Vendor Directory & Marketplace', group: 'Navigation', icon: '🤝', action: () => App.switchTab('vendors') },
            { title: 'Guest Management & RSVP', group: 'Navigation', icon: '👥', action: () => App.switchTab('guests') },
            { title: 'Budget & Expense Ledger', group: 'Navigation', icon: '💰', action: () => App.switchTab('budget') },
            { title: 'Payments & Receipts Gateway', group: 'Navigation', icon: '💳', action: () => App.switchTab('payments') },
            { title: 'Interactive DBMS Studio & Live SQL', group: 'Navigation', icon: '⚡', action: () => App.switchTab('dbms-studio') },
            { title: 'System Health & Relational Integrity', group: 'Navigation', icon: '🛡️', action: () => App.switchTab('admin') },

            // Quick Actions
            { title: 'Toggle Sidebar Navigation (Hide/Show) [Ctrl+B]', group: 'Actions', icon: '◨', action: () => App.toggleSidebar() },
            { title: 'Create New Event', group: 'Actions', icon: '➕', action: () => App.openModal('modalCreateEvent') },
            { title: 'Add Guest to Guestlist', group: 'Actions', icon: '➕', action: () => App.openModal('modalAddGuest') },
            { title: 'Log Itemized Expense', group: 'Actions', icon: '➕', action: () => App.openModal('modalAddExpense') },
            { title: 'Download eventora_schema.sql', group: 'Actions', icon: '📥', action: () => DbmsStudioModule.exportSQLFile() },

            // SQL Presets
            { title: 'Run Query: Budget Variance (JOIN & SUM)', group: 'Live SQL', icon: '⚡', action: () => { App.switchTab('dbms-studio'); DbmsStudioModule.loadPreset('budgetVariance'); } },
            { title: 'Run Query: Confirmed Bookings (3-Table JOIN)', group: 'Live SQL', icon: '⚡', action: () => { App.switchTab('dbms-studio'); DbmsStudioModule.loadPreset('confirmedBookings'); } },
            { title: 'Run Query: RSVP Attendance Statistics', group: 'Live SQL', icon: '⚡', action: () => { App.switchTab('dbms-studio'); DbmsStudioModule.loadPreset('rsvpStats'); } },

            // Active Events
            ...db.getEvents().map(e => ({
                title: `${e.title} (${e.event_type})`,
                group: 'Managed Events',
                icon: '📍',
                action: () => EventsModule.selectEventForDetails(e.event_id)
            })),

            // Active Vendors
            ...db.getVendors().map(v => ({
                title: `${v.business_name} • ${v.service_category}`,
                group: 'Vendors',
                icon: '⭐',
                action: () => { App.switchTab('vendors'); VendorsModule.openBookingModal(v.vendor_id); }
            }))
        ];
    },

    filterCommands(query) {
        const q = query.toLowerCase().trim();
        if (!q) {
            this.renderCommandList(this.cmdItems);
            return;
        }

        const filtered = this.cmdItems.filter(item => 
            item.title.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
        );
        this.renderCommandList(filtered);
    },

    renderCommandList(items) {
        const container = document.getElementById('cmdResultsList');
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `<li style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">No commands match your query.</li>`;
            return;
        }

        this.selectedCmdIndex = 0;
        this.currentRenderedItems = items;

        // Group by category
        const groups = {};
        items.forEach((item, index) => {
            if (!groups[item.group]) groups[item.group] = [];
            groups[item.group].push({ ...item, globalIndex: index });
        });

        let html = '';
        Object.keys(groups).forEach(groupName => {
            html += `<div class="cmd-group-title">${groupName}</div>`;
            groups[groupName].forEach(item => {
                const isSelected = item.globalIndex === this.selectedCmdIndex;
                html += `
                    <li class="cmd-item ${isSelected ? 'selected' : ''}" data-index="${item.globalIndex}" onclick="InteractiveFx.executeCommand(${item.globalIndex})">
                        <div class="cmd-item-left">
                            <span>${item.icon}</span>
                            <span style="font-weight: 500;">${item.title}</span>
                        </div>
                        <span class="cmd-item-tag">${item.group}</span>
                    </li>
                `;
            });
        });

        container.innerHTML = html;
    },

    handlePaletteKeydown(e) {
        if (!this.currentRenderedItems || this.currentRenderedItems.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedCmdIndex = (this.selectedCmdIndex + 1) % this.currentRenderedItems.length;
            this.updateSelectedCmdUI();
            this.playSynth('click');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedCmdIndex = (this.selectedCmdIndex - 1 + this.currentRenderedItems.length) % this.currentRenderedItems.length;
            this.updateSelectedCmdUI();
            this.playSynth('click');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.executeCommand(this.selectedCmdIndex);
        } else if (e.key === 'Escape') {
            this.closeCommandPalette();
        }
    },

    updateSelectedCmdUI() {
        document.querySelectorAll('.cmd-item').forEach(el => {
            const idx = Number(el.dataset.index);
            el.classList.toggle('selected', idx === this.selectedCmdIndex);
            if (idx === this.selectedCmdIndex) {
                el.scrollIntoView({ block: 'nearest' });
            }
        });
    },

    executeCommand(index) {
        const item = this.currentRenderedItems[index];
        if (item && item.action) {
            this.playSynth('sql');
            this.closeCommandPalette();
            item.action();
        }
    },

    // --- 3. WEB AUDIO MICRO-INTERACTION SYNTHESIZER ---
    setupAudio() {
        const stored = localStorage.getItem('EVENTORA_SOUND_ENABLED');
        if (stored !== null) {
            this.isSoundEnabled = stored === 'true';
        }
        this.updateSoundBtnUI();
    },

    toggleSound() {
        this.isSoundEnabled = !this.isSoundEnabled;
        localStorage.setItem('EVENTORA_SOUND_ENABLED', String(this.isSoundEnabled));
        this.updateSoundBtnUI();
        if (this.isSoundEnabled) {
            this.playSynth('click');
            App.showToast('Audio feedback enabled', 'info');
        } else {
            App.showToast('Audio feedback muted', 'info');
        }
    },

    updateSoundBtnUI() {
        const btn = document.getElementById('btnSoundToggle');
        if (btn) {
            btn.classList.toggle('active', this.isSoundEnabled);
            btn.innerText = this.isSoundEnabled ? '🔊' : '🔇';
        }
    },

    playSynth(type) {
        if (!this.isSoundEnabled) return;

        try {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                this.audioCtx = new AudioContext();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'sql') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'mode') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.08);
                gain.gain.setValueAtTime(0.03, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            }
        } catch (e) {
            // Audio context not allowed without interaction
        }
    }
};

// Bootstrap interactive FX
document.addEventListener('DOMContentLoaded', () => {
    InteractiveFx.init();
});
