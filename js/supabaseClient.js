/**
 * EVENTORA - Supabase Cloud PostgreSQL Backend Engine
 * Manages Supabase client connection, Realtime sync, PostgreSQL CRUD operations,
 * schema validation, and transparent dual-mode fallback.
 */

window.EventoraSupabase = {
    client: null,
    isConnected: false,
    latencyMs: null,

    // Storage Keys
    STORAGE_KEYS: {
        URL: 'eventora_supabase_url',
        KEY: 'eventora_supabase_key'
    },

    // Default credentials (auto-connect)
    DEFAULT_URL: 'https://qihysexovrckrgsrqaeu.supabase.co',
    DEFAULT_KEY: 'sb_publishable_qp_J-pjTRu5pqenqaX7RlA_vrxqvm1R',

    init() {
        // Use saved credentials, fallback to defaults
        const url = this.getUrl() || this.DEFAULT_URL;
        const key = this.getKey() || this.DEFAULT_KEY;

        // Save defaults to localStorage if not already set
        if (!this.getUrl()) localStorage.setItem(this.STORAGE_KEYS.URL, this.DEFAULT_URL);
        if (!this.getKey()) localStorage.setItem(this.STORAGE_KEYS.KEY, this.DEFAULT_KEY);

        if (url && key && window.supabase) {
            try {
                this.client = window.supabase.createClient(url, key);
                this.testConnection(false);
            } catch (err) {
                console.warn('Supabase initialization warning:', err.message);
                this.updateStatusPill(false);
            }
        } else {
            this.updateStatusPill(false);
        }
    },

    getUrl() {
        return localStorage.getItem(this.STORAGE_KEYS.URL) || '';
    },

    getKey() {
        return localStorage.getItem(this.STORAGE_KEYS.KEY) || '';
    },

    saveCredentials(url, key) {
        url = (url || '').trim();
        key = (key || '').trim();

        localStorage.setItem(this.STORAGE_KEYS.URL, url);
        localStorage.setItem(this.STORAGE_KEYS.KEY, key);

        if (url && key && window.supabase) {
            this.client = window.supabase.createClient(url, key);
            return this.testConnection(true);
        } else {
            this.client = null;
            this.isConnected = false;
            this.updateStatusPill(false);
            return Promise.resolve({ success: false, message: 'Credentials cleared.' });
        }
    },

    async testConnection(showToast = true) {
        if (!this.client) {
            this.isConnected = false;
            this.updateStatusPill(false);
            return { success: false, message: 'Supabase client is not initialized.' };
        }

        const start = performance.now();
        try {
            // Ping the events table
            const { data, error, count } = await this.client
                .from('events')
                .select('*', { count: 'exact', head: false })
                .limit(1);

            const duration = Math.round(performance.now() - start);
            this.latencyMs = duration;

            if (error) {
                // If table doesn't exist yet, it's still connected to Supabase project
                if (error.code === '42P01' || error.message.includes('relation "events" does not exist')) {
                    this.isConnected = true;
                    this.updateStatusPill(true, 'Connected (Tables Need Creation)');
                    if (showToast && window.App) {
                        window.App.showToast(`Supabase Connected (${duration}ms). Please run the SQL schema in Supabase Editor.`, 'info');
                    }
                    return {
                        success: true,
                        latencyMs: duration,
                        message: 'Connected to Supabase project, but "events" table was not found. Run data/supabase_schema.sql in Supabase SQL Editor.'
                    };
                }
                throw error;
            }

            this.isConnected = true;
            this.updateStatusPill(true, `Connected (${duration}ms)`);

            if (showToast && window.App) {
                window.App.showToast(`✓ Live Supabase PostgreSQL Connected (${duration}ms)`, 'success');
            }

            return {
                success: true,
                latencyMs: duration,
                message: `Successfully connected to Supabase PostgreSQL! Latency: ${duration}ms.`
            };
        } catch (err) {
            this.isConnected = false;
            this.updateStatusPill(false);
            const msg = err.message || 'Connection failed';
            if (showToast && window.App) {
                window.App.showToast(`Supabase connection failed: ${msg}`, 'error');
            }
            return { success: false, message: msg };
        }
    },

    updateStatusPill(isOnline, customLabel) {
        const pill = document.getElementById('supabaseStatusPill');
        const text = document.getElementById('supabaseStatusText');
        const dot = document.getElementById('supabaseStatusDot');

        if (!pill || !text) return;

        if (isOnline) {
            pill.classList.add('connected');
            text.innerText = customLabel || 'Supabase Connected';
            if (dot) dot.style.background = '#10b981';
        } else {
            pill.classList.remove('connected');
            text.innerText = this.getUrl() ? 'Supabase Offline' : 'Connect Supabase';
            if (dot) dot.style.background = '#f59e0b';
        }
    },

    // --- CRUD OPERATIONS (Direct to Cloud PostgreSQL) ---

    // 1. Events
    async fetchEvents() {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('events').select('*').order('event_id', { ascending: true });
        if (error) { console.error('Supabase fetchEvents error:', error); return null; }
        return data;
    },

    async insertEvent(eventData) {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('events').insert([eventData]).select();
        if (error) throw error;
        return data ? data[0] : null;
    },

    async deleteEvent(eventId) {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('events').delete().eq('event_id', eventId);
        if (error) throw error;
        return true;
    },

    // 2. Vendors
    async fetchVendors() {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('vendors').select('*').order('vendor_id', { ascending: true });
        if (error) { console.error('Supabase fetchVendors error:', error); return null; }
        return data;
    },

    // 3. Guests
    async fetchGuests() {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('guests').select('*').order('guest_id', { ascending: true });
        if (error) { console.error('Supabase fetchGuests error:', error); return null; }
        return data;
    },

    async insertGuest(guestData) {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('guests').insert([guestData]).select();
        if (error) throw error;
        return data ? data[0] : null;
    },

    // 4. Expenses
    async fetchExpenses() {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('expenses').select('*').order('expense_id', { ascending: true });
        if (error) { console.error('Supabase fetchExpenses error:', error); return null; }
        return data;
    },

    async insertExpense(expenseData) {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('expenses').insert([expenseData]).select();
        if (error) throw error;
        return data ? data[0] : null;
    },

    // 5. Payments
    async fetchPayments() {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('payments').select('*').order('payment_id', { ascending: true });
        if (error) { console.error('Supabase fetchPayments error:', error); return null; }
        return data;
    },

    async insertPayment(paymentData) {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('payments').insert([paymentData]).select();
        if (error) throw error;
        return data ? data[0] : null;
    },

    // 6. Bookings
    async fetchBookings() {
        if (!this.isConnected || !this.client) return null;
        const { data, error } = await this.client.from('bookings').select('*').order('booking_id', { ascending: true });
        if (error) { console.error('Supabase fetchBookings error:', error); return null; }
        return data;
    },

    // Push local seed data to Supabase
    async seedCloudDatabase() {
        if (!this.isConnected || !this.client) {
            throw new Error('Supabase is not connected. Please connect your project first.');
        }

        const local = window.EventoraDB.data;
        const results = {};

        // Users
        if (local.users && local.users.length) {
            const { error: userErr } = await this.client.from('users').upsert(local.users, { onConflict: 'email' });
            results.users = userErr ? userErr.message : 'OK';
        }

        // Events
        if (local.events && local.events.length) {
            const cleanEvents = local.events.map(({ description, ...rest }) => rest);
            const { error: eventErr } = await this.client.from('events').upsert(cleanEvents, { onConflict: 'event_id' });
            results.events = eventErr ? eventErr.message : 'OK';
        }

        // Vendors
        if (local.vendors && local.vendors.length) {
            const { error: vErr } = await this.client.from('vendors').upsert(local.vendors, { onConflict: 'vendor_id' });
            results.vendors = vErr ? vErr.message : 'OK';
        }

        // Guests
        if (local.guests && local.guests.length) {
            const { error: gErr } = await this.client.from('guests').upsert(local.guests, { onConflict: 'guest_id' });
            results.guests = gErr ? gErr.message : 'OK';
        }

        // Expenses
        if (local.expenses && local.expenses.length) {
            const { error: exErr } = await this.client.from('expenses').upsert(local.expenses, { onConflict: 'expense_id' });
            results.expenses = exErr ? exErr.message : 'OK';
        }

        // Payments
        if (local.payments && local.payments.length) {
            const { error: pErr } = await this.client.from('payments').upsert(local.payments, { onConflict: 'payment_id' });
            results.payments = pErr ? pErr.message : 'OK';
        }

        return results;
    }
};

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.EventoraSupabase.init();
});
