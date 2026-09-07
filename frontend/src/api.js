const API_URL = 'http://127.0.0.1:8000';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const loginUser = async (username, password) => {
    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        
        const res = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (!res.ok) throw new Error("Invalid credentials");
        return res.json();
    } catch(e) {
        console.error(e);
        throw e;
    }
};


// --- Generic master-data CRUD ---------------------------------------------
// Every master resource (categories, units, customers, suppliers, taxes,
// products) exposes the same five endpoints, so one factory covers them all.

const request = async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options.headers || {}) }
    });

    // An expired or invalid session is not a per-request failure: every
    // authenticated call will keep failing until the user signs in again, so
    // end the session rather than letting saves fail silently.
    if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:expired'));
        throw new Error('Your session has expired — please sign in again.');
    }

    if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            if (body && body.detail) {
                detail = typeof body.detail === 'string'
                    ? body.detail
                    // FastAPI validation errors are an array of objects whose
                    // `loc` ends with the offending field — name it, otherwise
                    // the message is an untraceable "Input should be a ...".
                    : body.detail.map(d => {
                        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
                        return field && field !== 'body' ? `${field}: ${d.msg}` : d.msg;
                    }).join(', ');
            }
        } catch {
            // response had no JSON body; keep the status-based message
        }
        throw new Error(detail);
    }

    if (res.status === 204) return null;
    return res.json();
};

export const createMasterApi = (resource) => ({
    resource,
    list: (search) => request(
        `/${resource}/${search ? `?search=${encodeURIComponent(search)}` : ''}`
    ),
    get: (id) => request(`/${resource}/${id}`),
    create: (payload) => request(`/${resource}/`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    update: (id, payload) => request(`/${resource}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/${resource}/${id}`, { method: 'DELETE' })
});

export const productsApi = createMasterApi('products');
export const categoriesApi = createMasterApi('categories');
export const unitsApi = createMasterApi('units');
export const customersApi = createMasterApi('customers');
export const suppliersApi = createMasterApi('suppliers');
export const taxesApi = createMasterApi('taxes');
export const warehousesApi = createMasterApi('warehouses');
export const openingStockApi = createMasterApi('opening-stock');

// Stock In / Out / Transfer / Adjustment are all rows in stock_movements, so
// each screen gets an API bound to its own movement_type.
export const stockMovementsApi = (movementType) => ({
    resource: 'stock-movements',
    movementType,
    list: () => request(`/stock-movements/?movement_type=${movementType}`),
    get: (id) => request(`/stock-movements/${id}`),
    create: (payload) => request('/stock-movements/', {
        method: 'POST',
        body: JSON.stringify({ ...payload, movement_type: movementType })
    }),
    update: (id, payload) => request(`/stock-movements/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, movement_type: movementType })
    }),
    remove: (id) => request(`/stock-movements/${id}`, { method: 'DELETE' })
});

export const stockBalanceApi = {
    list: (params = '') => request(`/stock-movements/balance${params}`)
};

// Sales documents share one endpoint; each screen binds to its own doc_type.
export const salesDocumentsApi = (docType) => ({
    resource: 'sales-documents',
    docType,
    list: () => request(`/sales-documents/?doc_type=${docType}`),
    get: (id) => request(`/sales-documents/${id}`),
    create: (payload) => request('/sales-documents/', {
        method: 'POST',
        body: JSON.stringify({ ...payload, doc_type: docType })
    }),
    update: (id, payload) => request(`/sales-documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/sales-documents/${id}`, { method: 'DELETE' }),
    // Candidate parents for the "raised against" dropdown.
    listByType: (type) => request(`/sales-documents/?doc_type=${type}`)
});

// Purchase documents mirror sales, keyed on supplier instead of customer.
export const purchaseDocumentsApi = (docType) => ({
    resource: 'purchase-documents',
    docType,
    list: () => request(`/purchase-documents/?doc_type=${docType}`),
    get: (id) => request(`/purchase-documents/${id}`),
    create: (payload) => request('/purchase-documents/', {
        method: 'POST',
        body: JSON.stringify({ ...payload, doc_type: docType })
    }),
    update: (id, payload) => request(`/purchase-documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/purchase-documents/${id}`, { method: 'DELETE' }),
    listByType: (type) => request(`/purchase-documents/?doc_type=${type}`)
});

// --- Trading book ---------------------------------------------------------
// Pass a side to bind Buy/Sell screens; omit it for the full ledger.
export const tradesApi = (side) => ({
    resource: 'trades',
    side,
    list: () => request(`/trades/${side ? `?side=${side}` : ''}`),
    get: (id) => request(`/trades/${id}`),
    create: (payload) => request('/trades/', {
        method: 'POST',
        body: JSON.stringify(side ? { ...payload, side } : payload)
    }),
    update: (id, payload) => request(`/trades/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/trades/${id}`, { method: 'DELETE' })
});

export const positionsApi = {
    list: (params = '') => request(`/trades/positions${params}`)
};

// --- Accounting -----------------------------------------------------------
// The chart lives under /accounting/chart rather than /chart, so it needs its
// own shape instead of createMasterApi's `/<resource>/` convention.
export const chartOfAccountsApi = {
    resource: 'accounting/chart',
    list: (params = '') => request(`/accounting/chart${params}`),
    get: (id) => request(`/accounting/chart/${id}`),
    create: (payload) => request('/accounting/chart', {
        method: 'POST', body: JSON.stringify(payload)
    }),
    update: (id, payload) => request(`/accounting/chart/${id}`, {
        method: 'PUT', body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/accounting/chart/${id}`, { method: 'DELETE' })
};

// Journals, payments, receipts and expenses are one table split by entry_type.
// Pass a single type to bind one screen, an array for a screen covering several,
// or nothing for the whole book.
export const journalEntriesApi = (entryType) => {
    const many = Array.isArray(entryType);
    const query = many
        ? `?entry_types=${entryType.join(',')}`
        : (entryType ? `?entry_type=${entryType}` : '');
    return {
    resource: 'accounting/entries',
    entryType: many ? null : entryType,
    entryTypes: many ? entryType : null,
    list: () => request(`/accounting/entries${query}`),
    get: (id) => request(`/accounting/entries/${id}`),
    create: (payload) => request('/accounting/entries', {
        method: 'POST',
        // With several types the caller chooses; with one it is bound here.
        body: JSON.stringify(
            !many && entryType ? { ...payload, entry_type: entryType } : payload
        )
    }),
    update: (id, payload) => request(`/accounting/entries/${id}`, {
        method: 'PUT', body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/accounting/entries/${id}`, { method: 'DELETE' }),
    listRange: (params) => request(`/accounting/entries${params}`)
    };
};

// Reports are pure aggregations — read-only, no create/update/delete.
export const reportsApi = {
    // One call backs the whole dashboard, so every widget shows the same moment.
    dashboard: () => request('/reports/dashboard'),
    sales: (params = '') => request(`/reports/sales${params}`),
    purchase: (params = '') => request(`/reports/purchase${params}`),
    stock: (params = '') => request(`/reports/stock${params}`),
    gst: (params = '') => request(`/reports/gst${params}`),
    outstanding: (params = '') => request(`/reports/outstanding${params}`)
};

export const accountingReports = {
    ledger: (params) => request(`/accounting/ledger${params}`),
    cashBank: (params = '') => request(`/accounting/cash-bank${params}`),
    trialBalance: (params = '') => request(`/accounting/trial-balance${params}`),
    profitLoss: (params = '') => request(`/accounting/profit-loss${params}`),
    balanceSheet: (params = '') => request(`/accounting/balance-sheet${params}`),
    partyBalances: (params) => request(`/accounting/party-balances${params}`)
};

// --- Passwords ------------------------------------------------------------
export const passwordApi = {
    // Your own: proves you know the current one.
    changeMine: (current_password, new_password) =>
        request('/users/me/password', {
            method: 'PUT',
            body: JSON.stringify({ current_password, new_password })
        }),
    // Someone else's: an administrator reset, no current password needed.
    resetFor: (userId, new_password) =>
        request(`/users/${userId}/password`, {
            method: 'PUT',
            body: JSON.stringify({ new_password })
        })
};

// --- Roles and the permission matrix --------------------------------------
export const rolesApi = {
    // Open to anyone signed in: the menu cannot be built without it.
    mine: () => request('/roles/me'),
    modules: () => request('/roles/modules'),
    // Administrators only, enforced server-side.
    list: () => request('/roles/'),
    create: (payload) => request('/roles/', {
        method: 'POST', body: JSON.stringify(payload)
    }),
    update: (id, payload) => request(`/roles/${id}`, {
        method: 'PUT', body: JSON.stringify(payload)
    }),
    remove: (id) => request(`/roles/${id}`, { method: 'DELETE' })
};

export const roleApi = {
    // Administrators only; the server enforces it regardless of the UI.
    set: (userId, role) => request(`/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
    })
};

// --- Per-user preferences -------------------------------------------------
// Stored against the account, so a setting follows the person to any browser.
// The server identifies them from the bearer token; no user id is sent.
export const preferencesApi = {
    get: () => request('/users/me/preferences'),
    // Merges the given keys, leaving any others untouched.
    save: (preferences) => request('/users/me/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences })
    })
};

export const fetchUsers = () => request('/users/');

export const createUser = (userData) =>
    // Goes through `request` so a role rejection surfaces its real message
    // instead of a generic failure.
    request('/users/', { method: 'POST', body: JSON.stringify(userData) });

// --- Point of sale ---------------------------------------------------------
export const posApi = {
    // Everything the till needs to open: warehouse, walk-in customer, payment
    // methods and the next receipt number, in one call.
    terminal: () => request('/pos/terminal'),
    products: (params = '') => request(`/pos/products${params}`),
    checkout: (payload) => request('/pos/sales', {
        method: 'POST', body: JSON.stringify(payload)
    }),
    sales: (params = '') => request(`/pos/sales${params}`),
    sale: (id) => request(`/pos/sales/${id}`),
    summary: (params = '') => request(`/pos/summary${params}`),
    void: (id) => request(`/pos/sales/${id}/void`, { method: 'POST' })
};
