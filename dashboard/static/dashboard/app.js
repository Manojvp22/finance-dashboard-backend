const state = {
    token: sessionStorage.getItem('financeToken') || '',
    currentUser: null,
    users: [],
    records: [],
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

function setStatus(message, isError = false) {
    const statusLine = qs('#statusLine');
    statusLine.textContent = message;
    statusLine.classList.toggle('error', isError);
}

function setLoginStatus(message, isError = false) {
    const loginStatus = qs('#loginStatus');
    loginStatus.textContent = message;
    loginStatus.classList.toggle('error', isError);
}

async function api(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(path, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
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

function showEmpty(container, message) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function lockApp() {
    document.body.classList.add('locked');
    qs('#loginEmail').focus();
}

function unlockApp() {
    document.body.classList.remove('locked');
}

async function login(event) {
    event.preventDefault();
    setLoginStatus('Checking your account...');

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
        setLoginStatus('Invalid email or password.', true);
    }
}

async function logout() {
    try {
        await api('/api/auth/logout/', { method: 'POST' });
    } catch (error) {
        // The local session still needs to be cleared even if the token is already expired.
    }
    state.token = '';
    state.currentUser = null;
    sessionStorage.removeItem('financeToken');
    lockApp();
    setLoginStatus('Signed out.');
}

async function restoreSession() {
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
        setLoginStatus('Your session expired. Please log in again.', true);
    }
}

function renderSession() {
    const user = state.currentUser || {};
    qs('#sessionName').textContent = user.name || user.email || 'Signed in';
    qs('#sessionRole').textContent = user.role || 'user';
}

async function loadData() {
    try {
        setStatus('Loading finance data...');
        const [summary, users, records] = await Promise.all([
            api('/api/dashboard/summary/'),
            apiList('/api/users/').catch(() => []),
            apiList('/api/records/').catch(() => []),
        ]);

        state.summary = summary;
        state.users = users;
        state.records = records;

        renderAll();
        setStatus(`Signed in as ${state.currentUser?.role || 'user'}.`);
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
                    <strong>${escapeHtml(item.category)}</strong>
                </div>
                <strong>${formatMoney(item.amount)}</strong>
            </div>
        `).join('');
    }
}

function renderRecordCreatorOptions() {
    const select = qs('#recordCreatedBy');
    if (!state.users.length) {
        select.innerHTML = '<option value="">No users available</option>';
        return;
    }

    select.innerHTML = state.users
        .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${escapeHtml(user.role)})</option>`)
        .join('');
}

function renderRecords() {
    const table = qs('#recordsTable');
    if (!state.records.length) {
        table.innerHTML = '<tr><td colspan="6">No records available for this account.</td></tr>';
        return;
    }

    table.innerHTML = state.records.map((record) => `
        <tr>
            <td><span class="pill ${escapeHtml(record.type)}">${escapeHtml(record.type)}</span></td>
            <td>${escapeHtml(record.category)}</td>
            <td>${formatMoney(record.amount)}</td>
            <td>${escapeHtml(record.date)}</td>
            <td class="description-cell">${escapeHtml(record.description || '-')}</td>
            <td>
                <div class="actions-cell">
                    <button class="table-action" type="button" data-edit-record="${record.id}">Edit</button>
                    <button class="table-action danger" type="button" data-delete-record="${record.id}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderUsers() {
    const grid = qs('#usersGrid');
    if (!state.users.length) {
        showEmpty(grid, 'Only admin accounts can view user management.');
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
            <p class="eyebrow">${escapeHtml(user.role)}${user.has_password ? '' : ' - password needed'}</p>
            <div class="card-actions">
                <button class="table-action" type="button" data-edit-user="${user.id}">Edit</button>
                <button class="table-action danger" type="button" data-delete-user="${user.id}">Delete</button>
            </div>
        </article>
    `).join('');
}

function switchView(viewName) {
    qsa('.nav-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
    qsa('.view').forEach((view) => view.classList.remove('active'));
    qs(`#${viewName}View`).classList.add('active');
}

function resetRecordForm() {
    qs('#recordId').value = '';
    qs('#recordForm').reset();
    qs('#recordDate').valueAsDate = new Date();
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
        category: qs('#recordCategory').value,
        date: qs('#recordDate').value,
        description: qs('#recordDescription').value,
        created_by: qs('#recordCreatedBy').value,
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
        setStatus('Only admin accounts can save records.', true);
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

    if (password) {
        payload.password = password;
    }

    try {
        await api(id ? `/api/users/${id}/` : '/api/users/', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        resetUserForm();
        await loadData();
        setStatus('User saved.');
    } catch (error) {
        setStatus('Only admin accounts can save users. New users also need an 8 character password.', true);
    }
}

function editRecord(id) {
    const record = state.records.find((item) => String(item.id) === String(id));
    if (!record) return;
    qs('#recordId').value = record.id;
    qs('#recordAmount').value = record.amount;
    qs('#recordType').value = record.type;
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

    if (target.matches('.nav-tab')) {
        switchView(target.dataset.view);
    }

    if (target.matches('[data-edit-record]')) {
        switchView('records');
        editRecord(target.dataset.editRecord);
    }

    if (target.matches('[data-delete-record]')) {
        deleteRecord(target.dataset.deleteRecord);
    }

    if (target.matches('[data-edit-user]')) {
        switchView('users');
        editUser(target.dataset.editUser);
    }

    if (target.matches('[data-delete-user]')) {
        deleteUser(target.dataset.deleteUser);
    }
});

qs('#loginForm').addEventListener('submit', login);
qs('#logoutButton').addEventListener('click', logout);
qs('#refreshButton').addEventListener('click', loadData);
qs('#recordForm').addEventListener('submit', saveRecord);
qs('#userForm').addEventListener('submit', saveUser);
qs('#cancelRecordEdit').addEventListener('click', resetRecordForm);
qs('#cancelUserEdit').addEventListener('click', resetUserForm);

resetRecordForm();
resetUserForm();
restoreSession();
