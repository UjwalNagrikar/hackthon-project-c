'use strict';

/* =========================================
   API HELPERS
========================================= */
const API = {
  async get(url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `GET failed: ${url}`);
    return data;
  },

  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `POST failed: ${url}`);
    return data;
  },

  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `PUT failed: ${url}`);
    return data;
  },

  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `DELETE failed: ${url}`);
    return data;
  }
};

/* =========================================
   GLOBAL STATE
========================================= */
let editStudentId = null;
let editCompanyId = null;

/* =========================================
   NAVIGATION
========================================= */
const PAGE_MAP = {
  dashboard: 'page-dashboard',
  students: 'page-students',
  companies: 'page-companies',
  internships: 'page-internships',
  placements: 'page-placements',
  search: 'page-search',
  reports: 'page-reports',
  admin: 'page-admin',
  'student-dash': 'page-student-dash'
};

const PAGE_TITLES = {
  dashboard: ['Admin Dashboard', '· Overview'],
  students: ['Students', '· Module 2'],
  companies: ['Companies', '· Module 3'],
  internships: ['Internships', '· Module 4'],
  placements: ['Placements', '· Module 5'],
  search: ['Search & Filter', '· Module 6'],
  reports: ['Reports', '· Module 7'],
  admin: ['Admin Settings', '· Module 1'],
  'student-dash': ['Student Dashboard', '· Module 9']
};

const PAGE_ACTIONS = {
  students: `<button class="btn btn-primary btn-sm" onclick="openStudentModal()">+ Add Student</button>`,
  companies: `<button class="btn btn-primary btn-sm" onclick="openCompanyModal()">+ Add Company</button>`
};

async function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(PAGE_MAP[page]);
  if (target) target.classList.add('active');

  const [title, sub] = PAGE_TITLES[page] || ['', ''];
  const titleEl = document.getElementById('topbar-title');
  const subEl = document.getElementById('topbar-sub');
  const actionEl = document.getElementById('topbar-actions');

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  if (actionEl) actionEl.innerHTML = PAGE_ACTIONS[page] || '';

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${page}'`)) n.classList.add('active');
  });

  if (page === 'dashboard') await renderDashboard();
  if (page === 'students') await renderStudentTable();
  if (page === 'companies') await renderCompanyTable();
  if (page === 'reports') await renderReports();
  if (page === 'admin') await renderUsers();
  if (page === 'student-dash') await loadStudentDash();

  await updateBadges();
}

/* =========================================
   TOAST
========================================= */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) {
    alert(msg);
    return;
  }

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/* =========================================
   MODALS
========================================= */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

function resetStudentForm() {
  const ids = [
    's-prn', 's-name', 's-email', 's-phone', 's-div', 's-cgpa',
    's-backlogs', 's-ssc', 's-hsc', 's-skills', 's-address', 's-added_by'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  if (document.getElementById('s-branch')) document.getElementById('s-branch').value = 'BCCA';
  if (document.getElementById('s-year')) document.getElementById('s-year').value = 'Final Year';
  if (document.getElementById('s-status')) document.getElementById('s-status').value = 'Seeking';
  if (document.getElementById('s-backlogs')) document.getElementById('s-backlogs').value = '0';
}

function resetCompanyForm() {
  const ids = [
    'c-name', 'c-location', 'c-contact', 'c-email', 'c-phone',
    'c-mincgpa', 'c-openings', 'c-about', 'c-roles'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  if (document.getElementById('c-sector')) document.getElementById('c-sector').value = 'IT / Software';
  if (document.getElementById('c-status')) document.getElementById('c-status').value = 'Active';
}

async function openStudentModal(id = null) {
  editStudentId = id;
  const title = document.getElementById('student-modal-title');
  if (title) title.textContent = id ? 'Edit Student' : 'Add Student';

  resetStudentForm();

  if (id) {
    try {
      const s = await API.get(`/api/students/${id}`);
      setValue('s-prn', s.prn);
      setValue('s-name', s.name);
      setValue('s-email', s.email);
      setValue('s-phone', s.phone);
      setValue('s-branch', s.branch);
      setValue('s-year', s.year);
      setValue('s-div', s.division || s.div);
      setValue('s-cgpa', s.cgpa);
      setValue('s-backlogs', s.backlogs);
      setValue('s-ssc', s.ssc);
      setValue('s-hsc', s.hsc);
      setValue('s-status', s.status);
      setValue('s-skills', s.skills);
      setValue('s-address', s.address);
      setValue('s-added_by', s.added_by);
    } catch (err) {
      toast(err.message, 'error');
      return;
    }
  }

  const modal = document.getElementById('modal-student');
  if (modal) modal.classList.add('open');
}

function openCompanyModal(id = null) {
  editCompanyId = id;
  const title = document.getElementById('company-modal-title');
  if (title) title.textContent = id ? 'Edit Company' : 'Add Company';
  resetCompanyForm();
  const modal = document.getElementById('modal-company');
  if (modal) modal.classList.add('open');
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

/* =========================================
   BADGES
========================================= */
async function updateBadges() {
  try {
    const [students, companies, placements] = await Promise.all([
      API.get('/api/students'),
      API.get('/api/companies'),
      API.get('/api/placements').catch(() => []),
    ]);

    setText('badge-students', students.length);
    setText('badge-companies', companies.length);
    setText('badge-internships', 0);
    setText('badge-placements', placements.length);
  } catch (err) {
    console.error(err);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* =========================================
   DASHBOARD
========================================= */
async function renderDashboard() {
  try {
    const [students, companies, placements, stats] = await Promise.all([
      API.get('/api/students'),
      API.get('/api/companies'),
      API.get('/api/placements').catch(() => []),
      API.get('/api/stats').catch(() => ({}))
    ]);

    const placed = students.filter(s => s.status === 'Placed').length;
    const rate = students.length ? Math.round((placed / students.length) * 100) : 0;
    const avgCtc = placements.length
      ? (placements.reduce((sum, p) => sum + Number(p.ctc || 0), 0) / placements.length).toFixed(2)
      : 0;
    const maxCtc = placements.length
      ? Math.max(...placements.map(p => Number(p.ctc || 0))).toFixed(2)
      : 0;

    const dash = document.getElementById('dash-stats');
    if (!dash) return;

    dash.innerHTML = `
      <div class="stat-card blue">
        <div class="stat-label">Total Students</div>
        <div class="stat-value blue">${stats.total_students ?? students.length}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Placed</div>
        <div class="stat-value green">${placed}</div>
        <div class="stat-delta">${rate}% placement rate</div>
      </div>
      <div class="stat-card coral">
        <div class="stat-label">Companies</div>
        <div class="stat-value coral">${stats.total_companies ?? companies.length}</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-label">Avg CTC (LPA)</div>
        <div class="stat-value gold">₹${avgCtc}</div>
        <div class="stat-delta">Highest: ₹${maxCtc} LPA</div>
      </div>
    `;
  } catch (err) {
    toast('Failed to load dashboard', 'error');
  }
}

/* =========================================
   STUDENTS
========================================= */
async function saveStudent() {
  const payload = {
    prn: getValue('s-prn'),
    name: getValue('s-name'),
    email: getValue('s-email'),
    phone: getValue('s-phone'),
    branch: getValue('s-branch'),
    year: getValue('s-year'),
    division: getValue('s-div'),
    cgpa: getValue('s-cgpa'),
    backlogs: getValue('s-backlogs'),
    ssc: getValue('s-ssc'),
    hsc: getValue('s-hsc'),
    status: getValue('s-status'),
    skills: getValue('s-skills'),
    address: getValue('s-address'),
    added_by: getValue('s-added_by') || 'Unknown'
  };

  if (!payload.prn || !payload.name) {
    toast('PRN and Name are required', 'error');
    return;
  }

  try {
    if (editStudentId) {
      await API.put(`/api/students/${editStudentId}`, payload);
      toast('Student updated successfully');
    } else {
      await API.post('/api/students', payload);
      toast('Student added successfully');
    }

    closeModal('modal-student');
    editStudentId = null;
    await renderStudentTable();
    await updateBadges();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function renderStudentTable() {
  const tbody = document.getElementById('student-table-body');
  const empty = document.getElementById('student-empty');
  if (!tbody) return;

  try {
    const q = (getValue('student-search') || '').toLowerCase();
    const branch = getValue('student-filter-branch');
    const status = getValue('student-filter-status');

    let students = await API.get('/api/students');

    students = students.filter(s =>
      (!q || [s.name, s.prn, s.email, s.branch, s.skills, s.added_by].some(v => String(v || '').toLowerCase().includes(q))) &&
      (!branch || s.branch === branch) &&
      (!status || s.status === status)
    );

    if (!students.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    const statusBadge = {
      Placed: 'badge-green',
      Interning: 'badge-blue',
      Seeking: 'badge-gold',
      'Not Seeking': 'badge-gray'
    };

    tbody.innerHTML = students.map(s => `
      <tr>
        <td class="td-mono">${s.prn || '—'}</td>
        <td><strong>${s.name || '—'}</strong></td>
        <td>${s.branch || '—'}</td>
        <td>${s.year || '—'} / ${s.division || '—'}</td>
        <td class="td-mono">${s.cgpa || '—'}</td>
        <td class="td-mono">${s.email || '—'}</td>
        <td>${s.added_by || 'Unknown'}</td>
        <td><span class="badge ${statusBadge[s.status] || 'badge-gray'}">${s.status || '—'}</span></td>
        <td>
          <span class="inline-edit" onclick="openStudentModal(${s.id})">✏ Edit</span>
          <span class="inline-delete" onclick="deleteStudent(${s.id}, '${escapeHtml(s.name)}')">✕</span>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (empty) empty.style.display = '';
    tbody.innerHTML = '';
    toast('Failed to load students', 'error');
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;

  try {
    await API.delete(`/api/students/${id}`);
    toast('Student deleted');
    await renderStudentTable();
    await updateBadges();
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* =========================================
   COMPANIES
========================================= */
async function saveCompany() {
  const payload = {
    name: getValue('c-name'),
    sector: getValue('c-sector'),
    location: getValue('c-location'),
    contact_person: getValue('c-contact'),
    email: getValue('c-email'),
    phone: getValue('c-phone'),
    min_cgpa: getValue('c-mincgpa'),
    openings: getValue('c-openings'),
    status: getValue('c-status'),
    about: getValue('c-about'),
    roles: getValue('c-roles')
  };

  if (!payload.name) {
    toast('Company name is required', 'error');
    return;
  }

  try {
    await API.post('/api/companies', payload);
    toast('Company added successfully');
    closeModal('modal-company');
    await renderCompanyTable();
    await updateBadges();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function renderCompanyTable() {
  const tbody = document.getElementById('company-table-body');
  const empty = document.getElementById('company-empty');
  if (!tbody) return;

  try {
    const q = (getValue('company-search') || '').toLowerCase();
    const sector = getValue('company-filter-sector');

    let companies = await API.get('/api/companies');

    companies = companies.filter(c =>
      (!q || [c.name, c.sector, c.location, c.contact_person, c.email].some(v => String(v || '').toLowerCase().includes(q))) &&
      (!sector || c.sector === sector)
    );

    if (!companies.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    tbody.innerHTML = companies.map(c => `
      <tr>
        <td><strong>${c.name || '—'}</strong></td>
        <td>${c.sector || '—'}</td>
        <td>${c.location || '—'}</td>
        <td>${c.contact_person || '—'}</td>
        <td class="td-mono">${c.email || '—'}</td>
        <td class="td-mono">${c.openings || 0}</td>
        <td><span class="badge badge-green">${c.status || 'Active'}</span></td>
        <td>—</td>
      </tr>
    `).join('');
  } catch (err) {
    if (empty) empty.style.display = '';
    tbody.innerHTML = '';
    toast('Failed to load companies', 'error');
  }
}

/* =========================================
   REPORTS / USERS / STUDENT DASH
========================================= */
async function renderReports() {
  try {
    const stats = await API.get('/api/stats');
    const box = document.getElementById('report-stats-grid');
    if (!box) return;

    box.innerHTML = `
      <div class="stat-card green">
        <div class="stat-label">Students</div>
        <div class="stat-value green">${stats.total_students || 0}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Companies</div>
        <div class="stat-value blue">${stats.total_companies || 0}</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-label">Placements</div>
        <div class="stat-value gold">${stats.total_placements || 0}</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function renderUsers() {
  const tbody = document.getElementById('user-table-body');
  if (!tbody) return;

  try {
    const users = await API.get('/api/users');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${u.name || '—'}</strong></td>
        <td class="td-mono">${u.username || '—'}</td>
        <td>${u.role || '—'}</td>
        <td>${u.department || '—'}</td>
        <td class="td-mono">${u.last_login || 'Never'}</td>
        <td><span class="badge ${u.status === 'Active' ? 'badge-green' : 'badge-gray'}">${u.status || '—'}</span></td>
        <td>—</td>
      </tr>
    `).join('') || `
      <tr>
        <td colspan="7">No users found</td>
      </tr>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function loadStudentDash() {
  const result = document.getElementById('student-dash-content');
  if (!result) return;

  const q = (getValue('dash-student-search') || '').toLowerCase();

  if (!q) {
    result.innerHTML = `<div class="empty-state"><p>Type name or PRN to search student</p></div>`;
    return;
  }

  try {
    const students = await API.get('/api/students');
    const s = students.find(x =>
      String(x.name || '').toLowerCase().includes(q) ||
      String(x.prn || '').toLowerCase().includes(q)
    );

    if (!s) {
      result.innerHTML = `<div class="empty-state"><p>No student found</p></div>`;
      return;
    }

    result.innerHTML = `
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Student Details</span></div>
        <div class="panel-body">
          <p><strong>Name:</strong> ${s.name || '—'}</p>
          <p><strong>PRN:</strong> ${s.prn || '—'}</p>
          <p><strong>Branch:</strong> ${s.branch || '—'}</p>
          <p><strong>Year:</strong> ${s.year || '—'}</p>
          <p><strong>CGPA:</strong> ${s.cgpa || '—'}</p>
          <p><strong>Status:</strong> ${s.status || '—'}</p>
          <p><strong>Added By:</strong> ${s.added_by || 'Unknown'}</p>
        </div>
      </div>
    `;
  } catch (err) {
    result.innerHTML = `<div class="empty-state"><p>Failed to load student dashboard</p></div>`;
  }
}

/* =========================================
   HELPERS
========================================= */
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/* =========================================
   INIT
========================================= */
document.addEventListener('DOMContentLoaded', async () => {
  await navigate('dashboard');
});