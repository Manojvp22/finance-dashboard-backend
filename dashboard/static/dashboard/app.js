const state = {
    token: sessionStorage.getItem('financeToken') || '',
    theme: localStorage.getItem('financeTheme') || 'light',
    currentUser: null,
    users: [],
    records: [],
    auditLogs: [],
    summary: null,
};

const money = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
});

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function isAdmin() {
    return state.currentUser?.role === 'admin';
}

function isAnalyst() {
    return state.currentUser?.role === 'analyst';
}

function roleLabel(role) {
    return ({ admin: 'Admin', analyst: 'Analyst', viewer: 'User' })[role] || 'User';
}

function setStatus(message, isError = false) {
    qs('#statusLine').textContent = message;
    qs('#statusLine').classList.toggle('error', isError);
}

function setPanelStatus(id, message, isError = false) {
    const panel = qs(id);
    panel.textContent = message;
    panel.classList.toggle('error', isError);
}

async function api(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
    }
    return response.status === 204 ? null : response.json();
}

function rowsFromPayload(payload) {
    return Array.isArray(payload) ? payload : payload.results || [];
}

async function apiList(path) {
    const items = [];
    let nextPath = path;
    while (nextPath) {
        const payload = await api(nextPath);
        items.push(...rowsFromPayload(payload));
        nextPath = payload.next ? new URL(payload.next).pathname + new URL(payload.next).search : null;
    }
    return items;
}

function formatMoney(value) {
    return money.format(Number(value || 0));
}

function showEmpty(container, message, colspan = null) {
    if (colspan) {
        container.innerHTML = `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
        return;
    }
    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function applyTheme() {
    document.body.classList.toggle('dark', state.theme === 'dark');
    qs('#themeButton').textContent = state.theme === 'dark' ? 'Light mode' : 'Dark mode';
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('financeTheme', state.theme);
    applyTheme();
}

function showAuthPanel(panelId) {
    ['#loginForm', '#signupForm', '#forgotForm', '#resetForm'].forEach((id) => qs(id).classList.add('hidden'));
    qs(panelId).classList.remove('hidden');
}

function lockApp() {
    document.body.classList.add('locked');
    showAuthPanel('#loginForm');
    qs('#loginEmail').focus();
}

function unlockApp() {
    document.body.classList.remove('locked');
}

async function login(event) {
    event.preventDefault();
    setPanelStatus('#loginStatus', 'Checking your account...');
    try {
        const payload = await api('/api/auth/login/', {
            method: 'POST',
            body: JSON.stringify({
                email: qs('#loginEmail').value,
                password: qs('#loginPassword').value,
            }),
        });
        state.token = payload.token;
        state.currentUser = payload.user;
        sessionStorage.setItem('financeToken', state.token);
        qs('#loginPassword').value = '';
        unlockApp();
        await loadData();
    } catch (error) {
        setPanelStatus('#loginStatus', 'Invalid email or password.', true);
    }
}

async function signup(event) {
    event.preventDefault();
    setPanelStatus('#signupStatus', 'Creating your account...');
    try {
        const payload = await api('/api/auth/signup/', {
            method: 'POST',
            body: JSON.stringify({
                name: qs('#signupName').value,
                email: qs('#signupEmail').value,
                password: qs('#signupPassword').value,
            }),
        });
        state.token = payload.token;
        state.currentUser = payload.user;
        sessionStorage.setItem('financeToken', state.token);
        qs('#signupPassword').value = '';
        unlockApp();
        await loadData();
    } catch (error) {
        setPanelStatus('#signupStatus', 'Could not create account. Email may already exist or password is too short.', true);
    }
}

async function requestPasswordReset(event) {
    event.preventDefault();
    setPanelStatus('#forgotStatus', 'Preparing reset...');
    try {
        const payload = await api('/api/auth/password-reset/', {
            method: 'POST',
            body: JSON.stringify({ email: qs('#forgotEmail').value }),
        });
        if (payload.reset_token) {
            qs('#resetToken').value = payload.reset_token;
            showAuthPanel('#resetForm');
            setPanelStatus('#resetStatus', 'Reset token loaded. Enter a new password.');
        } else {
            setPanelStatus('#forgotStatus', payload.detail || 'If the email exists, a reset link was prepared.');
        }
    } catch (error) {
        setPanelStatus('#forgotStatus', 'Could not prepare reset. Try again later.', true);
    }
}

async function confirmPasswordReset(event) {
    event.preventDefault();
    setPanelStatus('#resetStatus', 'Updating password...');
    try {
        const token = qs('#resetToken').value || new URLSearchParams(window.location.search).get('reset_token') || '';
        await api('/api/auth/password-reset/confirm/', {
            method: 'POST',
            body: JSON.stringify({ token, password: qs('#resetPassword').value }),
        });
        history.replaceState(null, '', window.location.pathname);
        showAuthPanel('#loginForm');
        setPanelStatus('#loginStatus', 'Password updated. Please log in.');
    } catch (error) {
        setPanelStatus('#resetStatus', 'Reset link is invalid, expired, or password is too short.', true);
    }
}

async function logout() {
    try {
        await api('/api/auth/logout/', { method: 'POST' });
    } catch (error) {
        // Clear the local session even if the server token has already expired.
    }
    state.token = '';
    state.currentUser = null;
    sessionStorage.removeItem('financeToken');
    lockApp();
    setPanelStatus('#loginStatus', 'Signed out.');
}

async function restoreSession() {
    const resetToken = new URLSearchParams(window.location.search).get('reset_token');
    if (resetToken) {
        document.body.classList.add('locked');
        qs('#resetToken').value = resetToken;
        showAuthPanel('#resetForm');
        return;
    }

    if (!state.token) {
        lockApp();
        return;
    }

    try {
        state.currentUser = await api('/api/auth/me/');
        unlockApp();
        await loadData();
    } catch (error) {
        sessionStorage.removeItem('financeToken');
        state.token = '';
        lockApp();
        setPanelStatus('#loginStatus', 'Your session expired. Please log in again.', true);
    }
}

function configureRoleExperience() {
    const role = state.currentUser?.role || 'viewer';
    const labels = {
        admin: ['Admin workspace', 'Full control over users, team records, personal records, and audit history.'],
        analyst: ['Analyst workspace', 'Team records and your own records are visible. User administration and audit logs stay locked.'],
        viewer: ['User workspace', 'Only your personal records and personal summary are visible.'],
    };
    qs('#rolePanel').innerHTML = `<strong>${labels[role][0]}</strong><span>${labels[role][1]}</span>`;

    qsa('[data-view="users"], [data-view="audit"]').forEach((button) => {
        button.classList.toggle('hidden', !isAdmin());
    });

    qs('#recordCreatedBy').disabled = !isAdmin();
    qs('#recordScope').querySelector('option[value="team"]').disabled = role === 'viewer';
    if (role === 'viewer') {
        qs('#recordScope').value = 'personal';
    }

    if (!isAdmin() && ['users', 'audit'].includes(qs('.view.active')?.id.replace('View', ''))) {
        switchView('overview');
    }
}

function renderSession() {
    qs('#sessionName').textContent = state.currentUser?.name || state.currentUser?.email || 'Signed in';
    qs('#sessionRole').textContent = roleLabel(state.currentUser?.role);
    configureRoleExperience();
}

async function loadData() {
    try {
        setStatus('Loading finance data...');
        const [summary, users, records, auditLogs] = await Promise.all([
            api('/api/dashboard/summary/'),
            apiList('/api/users/').catch(() => []),
            apiList('/api/records/').catch(() => []),
            apiList('/api/audit-logs/').catch(() => []),
        ]);

        state.summary = summary;
        state.users = users;
        state.records = records;
        state.auditLogs = auditLogs;
        renderAll();
        setStatus(`Signed in as ${roleLabel(state.currentUser?.role)}.`);
    } catch (error) {
        setStatus('Could not load dashboard data for this account.', true);
    }
}

function renderAll() {
    renderSession();
    renderSummary();
    renderRecordCreatorOptions();
    renderRecords();
    renderUsers();
    renderAuditLogs();
}

function renderSummary() {
    const summary = state.summary || {};
    qs('#totalIncome').textContent = formatMoney(summary.total_income);
    qs('#totalExpense').textContent = formatMoney(summary.total_expense);
    qs('#netBalance').textContent = formatMoney(summary.net_balance);

    const categoryList = qs('#categoryList');
    const categories = summary.category_totals || [];
    if (!categories.length) {
        showEmpty(categoryList, 'No category totals available yet.');
    } else {
        const maxTotal = Math.max(...categories.map((item) => Number(item.total || 0)), 1);
        categoryList.innerHTML = categories.map((item) => {
            const size = Math.max((Number(item.total || 0) / maxTotal) * 100, 4);
            return `
                <div class="category-row">
                    <div>
                        <strong>${escapeHtml(item.category)}</strong>
                        <div class="category-bar"><span style="--size: ${size}%"></span></div>
                    </div>
                    <strong>${formatMoney(item.total)}</strong>
                </div>
            `;
        }).join('');
    }

    const recentTransactions = qs('#recentTransactions');
    const transactions = summary.recent_transactions || [];
    if (!transactions.length) {
        showEmpty(recentTransactions, 'No recent transactions found.');
    } else {
        recentTransactions.innerHTML = transactions.map((item) => `
            <div class="transaction-row">
                <div>
                    <span class="pill ${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
                    <span class="pill">${escapeHtml(item.scope || 'personal')}</span>
                    <strong>${escapeHtml(item.category)}</strong>
                </div>
                <strong>${formatMoney(item.amount)}</strong>
            </div>
        `).join('');
    }
}

function renderRecordCreatorOptions() {
    const select = qs('#recordCreatedBy');
    const users = isAdmin() ? state.users : [state.currentUser].filter(Boolean);
    if (!users.length) {
        select.innerHTML = '<option value="">No users available</option>';
        return;
    }
    select.innerHTML = users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${roleLabel(user.role)})</option>`).join('');
    if (!isAdmin() && state.currentUser) {
        select.value = state.currentUser.id;
    }
}

function renderRecords() {
    const table = qs('#recordsTable');
    if (!state.records.length) {
        showEmpty(table, 'No records available for this account.', 8);
        return;
    }

    table.innerHTML = state.records.map((record) => `
        <tr>
            <td><span class="pill ${escapeHtml(record.type)}">${escapeHtml(record.type)}</span></td>
            <td><span class="pill">${escapeHtml(record.scope)}</span></td>
            <td>${escapeHtml(record.category)}</td>
            <td>${escapeHtml(record.created_by_name || '-')}</td>
            <td>${formatMoney(record.amount)}</td>
            <td>${escapeHtml(record.date)}</td>
            <td class="description-cell">${escapeHtml(record.description || '-')}</td>
            <td>
                <div class="actions-cell">
                    <button class="table-action" type="button" data-edit-record="${record.id}">Edit</button>
                    <button class="table-action danger ${isAdmin() ? '' : 'hidden'}" type="button" data-delete-record="${record.id}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderUsers() {
    const grid = qs('#usersGrid');
    if (!isAdmin()) {
        showEmpty(grid, 'Only admin accounts can view user management.');
        return;
    }
    if (!state.users.length) {
        showEmpty(grid, 'No users found.');
        return;
    }

    grid.innerHTML = state.users.map((user) => `
        <article class="user-card">
            <header>
                <div>
                    <strong>${escapeHtml(user.name)}</strong>
                    <span class="email">${escapeHtml(user.email)}</span>
                </div>
                <span class="pill ${user.status ? 'income' : 'expense'}">${user.status ? 'active' : 'inactive'}</span>
            </header>
            <p class="eyebrow">${roleLabel(user.role)}${user.has_password ? '' : ' - password needed'}</p>
            <div class="card-actions">
                <button class="table-action" type="button" data-edit-user="${user.id}">Edit</button>
                <button class="table-action danger" type="button" data-delete-user="${user.id}">Delete</button>
            </div>
        </article>
    `).join('');
}

function renderAuditLogs() {
    const table = qs('#auditTable');
    if (!isAdmin()) {
        showEmpty(table, 'Only admin accounts can view audit logs.', 5);
        return;
    }
    if (!state.auditLogs.length) {
        showEmpty(table, 'No audit events yet.', 5);
        return;
    }

    table.innerHTML = state.auditLogs.map((item) => `
        <tr>
            <td>${new Date(item.created_at).toLocaleString()}</td>
            <td>${escapeHtml(item.actor_name || item.actor_email || 'System')}</td>
            <td><span class="pill">${escapeHtml(item.action)}</span></td>
            <td>${escapeHtml(item.entity_type)} #${escapeHtml(item.entity_id || '-')}</td>
            <td class="description-cell">${escapeHtml(item.description || '-')}</td>
        </tr>
    `).join('');
}

function switchView(viewName) {
    if (!isAdmin() && ['users', 'audit'].includes(viewName)) {
        return;
    }
    qsa('.nav-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
    qsa('.view').forEach((view) => view.classList.remove('active'));
    qs(`#${viewName}View`).classList.add('active');
}

function resetRecordForm() {
    qs('#recordId').value = '';
    qs('#recordForm').reset();
    qs('#recordDate').valueAsDate = new Date();
    if (state.currentUser) {
        qs('#recordCreatedBy').value = state.currentUser.id;
    }
    if (state.currentUser?.role === 'viewer') {
        qs('#recordScope').value = 'personal';
    }
}

function resetUserForm() {
    qs('#userId').value = '';
    qs('#userForm').reset();
    qs('#userStatus').checked = true;
    qs('#userPassword').placeholder = 'Required for new users';
}

async function saveRecord(event) {
    event.preventDefault();
    const id = qs('#recordId').value;
    const payload = {
        amount: qs('#recordAmount').value,
        type: qs('#recordType').value,
        scope: qs('#recordScope').value,
        category: qs('#recordCategory').value,
        date: qs('#recordDate').value,
        description: qs('#recordDescription').value,
        created_by: qs('#recordCreatedBy').value || state.currentUser?.id,
    };

    try {
        await api(id ? `/api/records/${id}/` : '/api/records/', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        resetRecordForm();
        await loadData();
        setStatus('Record saved.');
    } catch (error) {
        setStatus('This role cannot save that record.', true);
    }
}

async function saveUser(event) {
    event.preventDefault();
    const id = qs('#userId').value;
    const password = qs('#userPassword').value;
    const payload = {
        name: qs('#userName').value,
        email: qs('#userEmail').value,
        role: qs('#userRole').value,
        status: qs('#userStatus').checked,
    };
    if (password) payload.password = password;

    try {
        await api(id ? `/api/users/${id}/` : '/api/users/', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        resetUserForm();
        await loadData();
        setStatus('User saved.');
    } catch (error) {
        setStatus('Only admin accounts can save users. New users need an 8 character password.', true);
    }
}

function editRecord(id) {
    const record = state.records.find((item) => String(item.id) === String(id));
    if (!record) return;
    qs('#recordId').value = record.id;
    qs('#recordAmount').value = record.amount;
    qs('#recordType').value = record.type;
    qs('#recordScope').value = record.scope;
    qs('#recordCategory').value = record.category;
    qs('#recordDate').value = record.date;
    qs('#recordDescription').value = record.description || '';
    qs('#recordCreatedBy').value = record.created_by;
}

function editUser(id) {
    const user = state.users.find((item) => String(item.id) === String(id));
    if (!user) return;
    qs('#userId').value = user.id;
    qs('#userName').value = user.name;
    qs('#userEmail').value = user.email;
    qs('#userRole').value = user.role;
    qs('#userStatus').checked = Boolean(user.status);
    qs('#userPassword').value = '';
    qs('#userPassword').placeholder = 'Leave blank to keep current password';
}

async function deleteRecord(id) {
    try {
        await api(`/api/records/${id}/`, { method: 'DELETE' });
        await loadData();
        setStatus('Record deleted.');
    } catch (error) {
        setStatus('Only admin accounts can delete records.', true);
    }
}

async function deleteUser(id) {
    try {
        await api(`/api/users/${id}/`, { method: 'DELETE' });
        await loadData();
        setStatus('User deleted.');
    } catch (error) {
        setStatus('Only admin accounts can delete users.', true);
    }
}

document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.matches('[data-toggle-password]')) {
        const input = qs(`#${target.dataset.togglePassword}`);
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        target.textContent = isHidden ? 'Hide' : 'Show';
        target.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    }
    if (target.matches('.nav-tab')) switchView(target.dataset.view);
    if (target.matches('[data-edit-record]')) {
        switchView('records');
        editRecord(target.dataset.editRecord);
    }
    if (target.matches('[data-delete-record]')) deleteRecord(target.dataset.deleteRecord);
    if (target.matches('[data-edit-user]')) {
        switchView('users');
        editUser(target.dataset.editUser);
    }
    if (target.matches('[data-delete-user]')) deleteUser(target.dataset.deleteUser);
});

qs('#loginForm').addEventListener('submit', login);
qs('#signupForm').addEventListener('submit', signup);
qs('#forgotForm').addEventListener('submit', requestPasswordReset);
qs('#resetForm').addEventListener('submit', confirmPasswordReset);
qs('#showSignupButton').addEventListener('click', () => showAuthPanel('#signupForm'));
qs('#showForgotButton').addEventListener('click', () => showAuthPanel('#forgotForm'));
qs('#signupBackToLoginButton').addEventListener('click', () => showAuthPanel('#loginForm'));
qs('#backToLoginButton').addEventListener('click', () => showAuthPanel('#loginForm'));
qs('#resetBackToLoginButton').addEventListener('click', () => showAuthPanel('#loginForm'));
qs('#logoutButton').addEventListener('click', logout);
qs('#themeButton').addEventListener('click', toggleTheme);
qs('#refreshButton').addEventListener('click', loadData);
qs('#recordForm').addEventListener('submit', saveRecord);
qs('#userForm').addEventListener('submit', saveUser);
qs('#cancelRecordEdit').addEventListener('click', resetRecordForm);
qs('#cancelUserEdit').addEventListener('click', resetUserForm);

applyTheme();
resetRecordForm();
resetUserForm();
restoreSession();
