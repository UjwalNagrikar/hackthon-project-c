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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `POST failed: ${url}`);
    return data;
  },
  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
let editStudentId   = null;
let editCompanyId   = null;
let editInternId    = null;
let editPlaceId     = null;
let chartBranchInst = null;
let chartMonthlyInst = null;
let chartPieInst    = null;
let chartPkgInst    = null;
let chartBranch2Inst = null;
let chartSectorInst = null;
let confirmCallback = null;

/* =========================================
   NAVIGATION
========================================= */
const PAGE_MAP = {
  dashboard: 'page-dashboard', students: 'page-students',
  companies: 'page-companies', internships: 'page-internships',
  placements: 'page-placements', search: 'page-search',
  reports: 'page-reports', admin: 'page-admin',
  'student-dash': 'page-student-dash'
};
const PAGE_TITLES = {
  dashboard: ['Admin Dashboard', '· Overview'],
  students:  ['Students', '· Module 2'],
  companies: ['Companies', '· Module 3'],
  internships: ['Internships', '· Module 4'],
  placements: ['Placements', '· Module 5'],
  search:    ['Search & Filter', '· Module 6'],
  reports:   ['Reports', '· Module 7'],
  admin:     ['Admin Settings', '· Module 1'],
  'student-dash': ['Student Dashboard', '· Student View']
};
const PAGE_ACTIONS = {
  students:   `<button class="btn btn-primary btn-sm" onclick="openStudentModal()">+ Add Student</button>`,
  companies:  `<button class="btn btn-primary btn-sm" onclick="openCompanyModal()">+ Add Company</button>`,
  internships:`<button class="btn btn-primary btn-sm" onclick="openInternModal()">+ Add Internship</button>`,
  placements: `<button class="btn btn-primary btn-sm" onclick="openPlaceModal()">+ Add Placement</button>`
};

async function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const target = document.getElementById(PAGE_MAP[page]);
  if (target) target.classList.add('active');
  const [title, sub] = PAGE_TITLES[page] || ['', ''];
  setText('topbar-title', title);
  setText('topbar-sub', sub);
  const actionEl = document.getElementById('topbar-actions');
  if (actionEl) actionEl.innerHTML = PAGE_ACTIONS[page] || '';
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${page}'`)) n.classList.add('active');
  });
  if (page === 'dashboard')  await renderDashboard();
  if (page === 'students')   await renderStudentTable();
  if (page === 'companies')  await renderCompanyTable();
  if (page === 'internships') await renderInternTable();
  if (page === 'placements') await renderPlaceTable();
  if (page === 'reports')    await renderReports();
  if (page === 'admin')      await renderUsers();
  if (page === 'student-dash') await loadStudentDash();
  if (page === 'search')     { const el = document.getElementById('global-results'); if (el) el.innerHTML = ''; }
  await updateBadges();
}

/* =========================================
   TOAST
========================================= */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) { alert(msg); return; }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* =========================================
   CONFIRM DIALOG
========================================= */
function showConfirm(title, msg, cb) {
  confirmCallback = cb;
  setText('confirm-title', title);
  setText('confirm-msg', msg);
  const dlg = document.getElementById('confirm-dialog');
  if (dlg) dlg.style.display = 'flex';
  const btn = document.getElementById('confirm-ok-btn');
  if (btn) btn.onclick = () => { closeConfirm(); cb(); };
}
function closeConfirm() {
  const dlg = document.getElementById('confirm-dialog');
  if (dlg) dlg.style.display = 'none';
}

/* =========================================
   MODALS
========================================= */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// ── Student Modal ──
function resetStudentForm() {
  ['s-prn','s-name','s-email','s-phone','s-div','s-cgpa','s-backlogs','s-ssc','s-hsc','s-skills','s-address','s-added_by'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  setValue('s-branch', 'BCCA');
  setValue('s-year', 'Final Year');
  setValue('s-status', 'Seeking');
  setValue('s-backlogs', '0');
}

async function openStudentModal(id = null) {
  editStudentId = id;
  setText('student-modal-title', id ? 'Edit Student' : 'Add Student');
  resetStudentForm();
  if (id) {
    try {
      const s = await API.get(`/api/students/${id}`);
      setValue('s-prn', s.prn); setValue('s-name', s.name);
      setValue('s-email', s.email); setValue('s-phone', s.phone);
      setValue('s-branch', s.branch); setValue('s-year', s.year);
      setValue('s-div', s.division); setValue('s-cgpa', s.cgpa);
      setValue('s-backlogs', s.backlogs); setValue('s-ssc', s.ssc);
      setValue('s-hsc', s.hsc); setValue('s-status', s.status);
      setValue('s-skills', s.skills); setValue('s-address', s.address);
      setValue('s-added_by', s.added_by);
    } catch (err) { toast(err.message, 'error'); return; }
  }
  const modal = document.getElementById('modal-student');
  if (modal) modal.classList.add('open');
}

async function saveStudent() {
  const payload = {
    prn: getValue('s-prn'), name: getValue('s-name'),
    email: getValue('s-email'), phone: getValue('s-phone'),
    branch: getValue('s-branch'), year: getValue('s-year'),
    division: getValue('s-div'), cgpa: getValue('s-cgpa'),
    backlogs: getValue('s-backlogs'), ssc: getValue('s-ssc'),
    hsc: getValue('s-hsc'), status: getValue('s-status'),
    skills: getValue('s-skills'), address: getValue('s-address'),
    added_by: getValue('s-added_by') || 'Admin'
  };
  if (!payload.prn || !payload.name) { toast('PRN and Name are required', 'error'); return; }
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
  } catch (err) { toast(err.message, 'error'); }
}

// ── Company Modal ──
function resetCompanyForm() {
  ['c-name','c-location','c-contact','c-email','c-phone','c-mincgpa','c-openings','c-about','c-roles'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  setValue('c-sector', 'IT / Software');
  setValue('c-status', 'Active');
  setValue('c-openings', '1');
}

async function openCompanyModal(id = null) {
  editCompanyId = id;
  setText('company-modal-title', id ? 'Edit Company' : 'Add Company');
  resetCompanyForm();
  if (id) {
    try {
      const c = await API.get(`/api/companies/${id}`);
      setValue('c-name', c.name); setValue('c-sector', c.sector);
      setValue('c-location', c.location); setValue('c-contact', c.contact_person);
      setValue('c-email', c.email); setValue('c-phone', c.phone);
      setValue('c-mincgpa', c.min_cgpa); setValue('c-openings', c.openings);
      setValue('c-status', c.status); setValue('c-about', c.about);
      setValue('c-roles', c.roles);
    } catch (err) { toast(err.message, 'error'); return; }
  }
  const modal = document.getElementById('modal-company');
  if (modal) modal.classList.add('open');
}

async function saveCompany() {
  const payload = {
    name: getValue('c-name'), sector: getValue('c-sector'),
    location: getValue('c-location'), contact_person: getValue('c-contact'),
    email: getValue('c-email'), phone: getValue('c-phone'),
    min_cgpa: getValue('c-mincgpa'), openings: getValue('c-openings'),
    status: getValue('c-status'), about: getValue('c-about'),
    roles: getValue('c-roles')
  };
  if (!payload.name) { toast('Company name is required', 'error'); return; }
  try {
    if (editCompanyId) {
      await API.put(`/api/companies/${editCompanyId}`, payload);
      toast('Company updated successfully');
    } else {
      await API.post('/api/companies', payload);
      toast('Company added successfully');
    }
    closeModal('modal-company');
    editCompanyId = null;
    await renderCompanyTable();
    await updateBadges();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Internship Modal ──
async function openInternModal(id = null) {
  editInternId = id;
  setText('intern-modal-title', id ? 'Edit Internship' : 'Add Internship');
  // Reset
  ['i-role','i-stipend','i-start','i-end','i-remarks'].forEach(x => setValue(x, ''));
  setValue('i-mode', 'In-Office');
  setValue('i-status', 'Ongoing');

  // Populate student & company dropdowns
  try {
    const [students, companies] = await Promise.all([
      API.get('/api/students'), API.get('/api/companies')
    ]);
    const sSel = document.getElementById('i-student');
    const cSel = document.getElementById('i-company');
    if (sSel) sSel.innerHTML = '<option value="">-- Select Student --</option>' +
      students.map(s => `<option value="${s.id}">${s.name} (${s.prn})</option>`).join('');
    if (cSel) cSel.innerHTML = '<option value="">-- Select Company --</option>' +
      companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (err) { toast('Failed to load dropdowns', 'error'); return; }

  if (id) {
    try {
      const i = await API.get(`/api/internships/${id}`);
      setValue('i-student', i.student_id); setValue('i-company', i.company_id);
      setValue('i-role', i.role); setValue('i-stipend', i.stipend);
      setValue('i-start', i.start_date); setValue('i-end', i.end_date);
      setValue('i-mode', i.mode); setValue('i-status', i.status);
      setValue('i-remarks', i.remarks);
    } catch (err) { toast(err.message, 'error'); return; }
  }
  const modal = document.getElementById('modal-intern');
  if (modal) modal.classList.add('open');
}

async function saveIntern() {
  const payload = {
    student_id: getValue('i-student'), company_id: getValue('i-company'),
    role: getValue('i-role'), stipend: getValue('i-stipend'),
    start_date: getValue('i-start'), end_date: getValue('i-end'),
    mode: getValue('i-mode'), status: getValue('i-status'),
    remarks: getValue('i-remarks')
  };
  if (!payload.student_id || !payload.company_id || !payload.role) {
    toast('Student, Company and Role are required', 'error'); return;
  }
  try {
    if (editInternId) {
      await API.put(`/api/internships/${editInternId}`, payload);
      toast('Internship updated');
    } else {
      await API.post('/api/internships', payload);
      toast('Internship added');
    }
    closeModal('modal-intern');
    editInternId = null;
    await renderInternTable();
    await updateBadges();
  } catch (err) { toast(err.message, 'error'); }
}

// ── Placement Modal ──
async function openPlaceModal(id = null) {
  editPlaceId = id;
  setText('place-modal-title', id ? 'Edit Placement' : 'Add Placement');
  ['p-role','p-ctc','p-offer-date','p-join-date','p-location','p-remarks'].forEach(x => setValue(x, ''));
  setValue('p-type', 'On-Campus');

  try {
    const [students, companies] = await Promise.all([
      API.get('/api/students'), API.get('/api/companies')
    ]);
    const sSel = document.getElementById('p-student');
    const cSel = document.getElementById('p-company');
    if (sSel) sSel.innerHTML = '<option value="">-- Select Student --</option>' +
      students.map(s => `<option value="${s.id}">${s.name} (${s.prn})</option>`).join('');
    if (cSel) cSel.innerHTML = '<option value="">-- Select Company --</option>' +
      companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (err) { toast('Failed to load dropdowns', 'error'); return; }

  if (id) {
    try {
      const p = await API.get(`/api/placements/${id}`);
      setValue('p-student', p.student_id); setValue('p-company', p.company_id);
      setValue('p-role', p.role); setValue('p-ctc', p.ctc);
      setValue('p-type', p.placement_type); setValue('p-offer-date', p.offer_date);
      setValue('p-join-date', p.joining_date); setValue('p-location', p.location);
      setValue('p-remarks', p.remarks);
    } catch (err) { toast(err.message, 'error'); return; }
  }
  const modal = document.getElementById('modal-place');
  if (modal) modal.classList.add('open');
}

async function savePlace() {
  const payload = {
    student_id: getValue('p-student'), company_id: getValue('p-company'),
    role: getValue('p-role'), ctc: getValue('p-ctc'),
    placement_type: getValue('p-type'), offer_date: getValue('p-offer-date'),
    joining_date: getValue('p-join-date'), location: getValue('p-location'),
    remarks: getValue('p-remarks')
  };
  if (!payload.student_id || !payload.company_id || !payload.role || !payload.ctc) {
    toast('Student, Company, Role and CTC are required', 'error'); return;
  }
  try {
    if (editPlaceId) {
      await API.put(`/api/placements/${editPlaceId}`, payload);
      toast('Placement updated');
    } else {
      await API.post('/api/placements', payload);
      toast('Placement added — student status set to Placed');
    }
    closeModal('modal-place');
    editPlaceId = null;
    await renderPlaceTable();
    await updateBadges();
  } catch (err) { toast(err.message, 'error'); }
}

// ── User Modal ──
function openUserModal() {
  ['u-name','u-username','u-dept','u-email'].forEach(x => setValue(x, ''));
  setValue('u-role', 'Admin');
  setValue('u-status', 'Active');
  const modal = document.getElementById('modal-user');
  if (modal) modal.classList.add('open');
}

async function saveUser() {
  const payload = {
    name: getValue('u-name'), username: getValue('u-username'),
    role: getValue('u-role'), department: getValue('u-dept'),
    email: getValue('u-email'), status: getValue('u-status')
  };
  if (!payload.name) { toast('Name is required', 'error'); return; }
  try {
    await API.post('/api/users', payload);
    toast('User added');
    closeModal('modal-user');
    await renderUsers();
  } catch (err) { toast(err.message, 'error'); }
}

/* =========================================
   BADGES
========================================= */
async function updateBadges() {
  try {
    const stats = await API.get('/api/stats');
    setText('badge-students', stats.total_students || 0);
    setText('badge-companies', stats.total_companies || 0);
    setText('badge-internships', stats.total_internships || 0);
    setText('badge-placements', stats.total_placements || 0);
  } catch (err) { console.error('Badge update failed:', err); }
}

/* =========================================
   MODULE 8 – ADMIN DASHBOARD
========================================= */
async function renderDashboard() {
  try {
    const report = await API.get('/api/reports/overview');
    const t = report.totals;
    const ctc = report.ctc;
    const dash = document.getElementById('dash-stats');
    if (!dash) return;

    dash.innerHTML = `
      <div class="stat-card blue">
        <div class="stat-label">Total Students</div>
        <div class="stat-value blue">${t.students}</div>
        <div class="stat-delta">${t.seeking} seeking</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">Placed</div>
        <div class="stat-value green">${t.placed}</div>
        <div class="stat-delta">${report.placement_rate}% placement rate</div>
      </div>
      <div class="stat-card coral">
        <div class="stat-label">Companies</div>
        <div class="stat-value coral">${t.companies}</div>
        <div class="stat-delta">${t.internships} internships</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-label">Avg CTC (LPA)</div>
        <div class="stat-value gold">₹${ctc.avg}</div>
        <div class="stat-delta">Highest: ₹${ctc.max} LPA</div>
      </div>
    `;

    // Branch chart
    const branchLabels = report.branch_stats.map(b => b.branch || 'Unknown');
    const branchRates  = report.branch_stats.map(b => b.total ? Math.round((b.placed / b.total) * 100) : 0);
    renderChart('chartBranch', 'bar', branchLabels, branchRates, 'Placement %',
      ['#6c63ff','#22d3a5','#f97316','#3b82f6','#ec4899','#a78bfa'], chartBranchInst,
      inst => chartBranchInst = inst);

    // Monthly chart
    const months  = report.monthly_placements.map(m => m.month).reverse();
    const counts  = report.monthly_placements.map(m => m.count).reverse();
    renderChart('chartMonthly', 'line', months, counts, 'Placements',
      ['#6c63ff'], chartMonthlyInst, inst => chartMonthlyInst = inst);

    // Recent activity
    const actList = document.getElementById('activity-list');
    if (actList) {
      const placements = await API.get('/api/placements');
      actList.innerHTML = placements.slice(0, 6).map(p => `
        <div class="activity-item">
          <div class="activity-dot green"></div>
          <div>
            <strong>${p.student_name || 'Student'}</strong> placed at
            <strong>${p.company_name || 'Company'}</strong>
            — ₹${p.ctc} LPA
            <div style="font-size:11px;color:var(--sub)">${p.offer_date || ''}</div>
          </div>
        </div>
      `).join('') || '<p style="color:var(--sub);padding:12px">No placements yet</p>';
    }

    // Top companies
    const topList = document.getElementById('top-companies-list');
    if (topList) {
      topList.innerHTML = report.top_companies.map((c, i) => `
        <div class="activity-item">
          <div class="rank-num">${i + 1}</div>
          <div>
            <strong>${c.name}</strong>
            <div style="font-size:12px;color:var(--sub)">${c.hires} hire(s) · Max ₹${c.max_ctc} LPA</div>
          </div>
        </div>
      `).join('') || '<p style="color:var(--sub);padding:12px">No hiring data yet</p>';
    }
  } catch (err) {
    console.error(err);
    toast('Failed to load dashboard', 'error');
  }
}

/* =========================================
   MODULE 2 – STUDENTS
========================================= */
async function renderStudentTable() {
  const tbody = document.getElementById('student-table-body');
  const empty = document.getElementById('student-empty');
  if (!tbody) return;
  try {
    const q       = getValue('student-search').toLowerCase();
    const branch  = getValue('student-filter-branch');
    const status  = getValue('student-filter-status');
    let students  = await API.get('/api/students');

    students = students.filter(s =>
      (!q || [s.name,s.prn,s.email,s.branch,s.skills,s.added_by].some(v => String(v||'').toLowerCase().includes(q))) &&
      (!branch || s.branch === branch) &&
      (!status || s.status === status)
    );

    if (!students.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const statusBadge = { Placed:'badge-green', Interning:'badge-blue', Seeking:'badge-gold', 'Not Seeking':'badge-gray' };
    tbody.innerHTML = students.map(s => `
      <tr>
        <td class="td-mono">${s.prn||'—'}</td>
        <td><strong>${s.name||'—'}</strong></td>
        <td>${s.branch||'—'}</td>
        <td>${s.year||'—'} / ${s.division||'—'}</td>
        <td class="td-mono">${s.cgpa||'—'}</td>
        <td class="td-mono">${s.email||'—'}</td>
        <td><span class="badge ${statusBadge[s.status]||'badge-gray'}">${s.status||'—'}</span></td>
        <td>
          <span class="inline-edit" onclick="openStudentModal(${s.id})">✏ Edit</span>
          <span class="inline-delete" onclick="deleteStudent(${s.id},'${escapeHtml(s.name)}')">✕</span>
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
  showConfirm('Delete Student', `Delete "${name}"? All linked internships and placements will also be removed.`, async () => {
    try {
      await API.delete(`/api/students/${id}`);
      toast('Student deleted');
      await renderStudentTable();
      await updateBadges();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* =========================================
   MODULE 3 – COMPANIES
========================================= */
async function renderCompanyTable() {
  const tbody = document.getElementById('company-table-body');
  const empty = document.getElementById('company-empty');
  if (!tbody) return;
  try {
    const q      = getValue('company-search').toLowerCase();
    const sector = getValue('company-filter-sector');
    let companies = await API.get('/api/companies');

    companies = companies.filter(c =>
      (!q || [c.name,c.sector,c.location,c.contact_person,c.email].some(v => String(v||'').toLowerCase().includes(q))) &&
      (!sector || c.sector === sector)
    );

    if (!companies.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const statusBadge = { Active:'badge-green', 'Drive Completed':'badge-blue', Blacklisted:'badge-red' };
    tbody.innerHTML = companies.map(c => `
      <tr>
        <td><strong>${c.name||'—'}</strong></td>
        <td>${c.sector||'—'}</td>
        <td>${c.location||'—'}</td>
        <td>${c.contact_person||'—'}</td>
        <td class="td-mono">${c.email||'—'}</td>
        <td class="td-mono">${c.openings||0}</td>
        <td><span class="badge ${statusBadge[c.status]||'badge-gray'}">${c.status||'Active'}</span></td>
        <td>
          <span class="inline-edit" onclick="openCompanyModal(${c.id})">✏ Edit</span>
          <span class="inline-delete" onclick="deleteCompany(${c.id},'${escapeHtml(c.name)}')">✕</span>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (empty) empty.style.display = '';
    tbody.innerHTML = '';
    toast('Failed to load companies', 'error');
  }
}

async function deleteCompany(id, name) {
  showConfirm('Delete Company', `Delete "${name}"? All linked records will be removed.`, async () => {
    try {
      await API.delete(`/api/companies/${id}`);
      toast('Company deleted');
      await renderCompanyTable();
      await updateBadges();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* =========================================
   MODULE 4 – INTERNSHIPS
========================================= */
async function renderInternTable() {
  const tbody = document.getElementById('intern-table-body');
  const empty = document.getElementById('intern-empty');
  if (!tbody) return;
  try {
    const q       = getValue('intern-search').toLowerCase();
    const status  = getValue('intern-filter-status');
    let interns   = await API.get('/api/internships');

    interns = interns.filter(i =>
      (!q || [i.student_name,i.company_name,i.role,i.mode].some(v => String(v||'').toLowerCase().includes(q))) &&
      (!status || i.status === status)
    );

    if (!interns.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const statusBadge = { Ongoing:'badge-blue', Completed:'badge-green', 'Offer Received':'badge-gold', Terminated:'badge-red' };
    tbody.innerHTML = interns.map(i => `
      <tr>
        <td><strong>${i.student_name||'—'}</strong><div style="font-size:11px;color:var(--sub)">${i.student_prn||''}</div></td>
        <td>${i.company_name||'—'}</td>
        <td>${i.role||'—'}</td>
        <td>${i.start_date||'—'}</td>
        <td>${i.end_date||'—'}</td>
        <td class="td-mono">${i.stipend ? '₹'+Number(i.stipend).toLocaleString() : '—'}</td>
        <td><span class="badge ${statusBadge[i.status]||'badge-gray'}">${i.status||'—'}</span></td>
        <td>
          <span class="inline-edit" onclick="openInternModal(${i.id})">✏ Edit</span>
          <span class="inline-delete" onclick="deleteIntern(${i.id})">✕</span>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (empty) empty.style.display = '';
    tbody.innerHTML = '';
    toast('Failed to load internships', 'error');
  }
}

async function deleteIntern(id) {
  showConfirm('Delete Internship', 'Delete this internship record?', async () => {
    try {
      await API.delete(`/api/internships/${id}`);
      toast('Internship deleted');
      await renderInternTable();
      await updateBadges();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* =========================================
   MODULE 5 – PLACEMENTS
========================================= */
async function renderPlaceTable() {
  const tbody = document.getElementById('place-table-body');
  const empty = document.getElementById('place-empty');
  if (!tbody) return;
  try {
    const q    = getValue('place-search').toLowerCase();
    const type = getValue('place-filter-type');
    let placements = await API.get('/api/placements');

    placements = placements.filter(p =>
      (!q || [p.student_name,p.company_name,p.role,String(p.ctc||'')].some(v => String(v||'').toLowerCase().includes(q))) &&
      (!type || p.placement_type === type)
    );

    if (!placements.length) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = placements.map(p => `
      <tr>
        <td><strong>${p.student_name||'—'}</strong><div style="font-size:11px;color:var(--sub)">${p.student_prn||''}</div></td>
        <td>${p.company_name||'—'}</td>
        <td>${p.role||'—'}</td>
        <td class="td-mono"><strong>₹${p.ctc||0} LPA</strong></td>
        <td><span class="badge badge-blue">${p.placement_type||'—'}</span></td>
        <td>${p.offer_date||'—'}</td>
        <td>${p.joining_date||'—'}</td>
        <td>
          <span class="inline-edit" onclick="openPlaceModal(${p.id})">✏ Edit</span>
          <span class="inline-delete" onclick="deletePlace(${p.id})">✕</span>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (empty) empty.style.display = '';
    tbody.innerHTML = '';
    toast('Failed to load placements', 'error');
  }
}

async function deletePlace(id) {
  showConfirm('Delete Placement', 'Delete this placement record?', async () => {
    try {
      await API.delete(`/api/placements/${id}`);
      toast('Placement deleted');
      await renderPlaceTable();
      await updateBadges();
    } catch (err) { toast(err.message, 'error'); }
  });
}

/* =========================================
   MODULE 6 – GLOBAL SEARCH
========================================= */
async function globalSearch() {
  const q    = getValue('global-search');
  const type = getValue('global-filter-type');
  const box  = document.getElementById('global-results');
  if (!box) return;

  if (!q || q.length < 2) {
    box.innerHTML = '<p style="color:var(--sub);padding:16px">Type at least 2 characters to search…</p>';
    return;
  }

  box.innerHTML = '<p style="color:var(--sub);padding:16px">Searching…</p>';
  try {
    const params = new URLSearchParams({ q });
    if (type) params.set('type', type);
    const result = await API.get(`/api/search?${params}`);
    let html = '';

    if (result.students?.length) {
      html += `<div class="panel" style="margin-bottom:12px">
        <div class="panel-header"><span class="panel-title">👤 Students (${result.students.length})</span></div>
        <div class="table-wrap"><table><thead><tr>
          <th>PRN</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Status</th><th>Skills</th>
        </tr></thead><tbody>` +
        result.students.map(s => `<tr>
          <td class="td-mono">${s.prn||'—'}</td><td><strong>${s.name||'—'}</strong></td>
          <td>${s.branch||'—'}</td><td>${s.cgpa||'—'}</td>
          <td><span class="badge badge-${s.status==='Placed'?'green':s.status==='Seeking'?'gold':'blue'}">${s.status||'—'}</span></td>
          <td style="font-size:12px">${s.skills||'—'}</td>
        </tr>`).join('') +
        `</tbody></table></div></div>`;
    }

    if (result.companies?.length) {
      html += `<div class="panel" style="margin-bottom:12px">
        <div class="panel-header"><span class="panel-title">🏢 Companies (${result.companies.length})</span></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Name</th><th>Sector</th><th>Location</th><th>Openings</th><th>Status</th>
        </tr></thead><tbody>` +
        result.companies.map(c => `<tr>
          <td><strong>${c.name||'—'}</strong></td><td>${c.sector||'—'}</td>
          <td>${c.location||'—'}</td><td>${c.openings||0}</td>
          <td><span class="badge badge-green">${c.status||'—'}</span></td>
        </tr>`).join('') +
        `</tbody></table></div></div>`;
    }

    if (result.internships?.length) {
      html += `<div class="panel" style="margin-bottom:12px">
        <div class="panel-header"><span class="panel-title">📋 Internships (${result.internships.length})</span></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Student</th><th>Company</th><th>Role</th><th>Start</th><th>End</th><th>Status</th>
        </tr></thead><tbody>` +
        result.internships.map(i => `<tr>
          <td>${i.student_name||'—'}</td><td>${i.company_name||'—'}</td>
          <td>${i.role||'—'}</td><td>${i.start_date||'—'}</td><td>${i.end_date||'—'}</td>
          <td><span class="badge badge-blue">${i.status||'—'}</span></td>
        </tr>`).join('') +
        `</tbody></table></div></div>`;
    }

    if (result.placements?.length) {
      html += `<div class="panel" style="margin-bottom:12px">
        <div class="panel-header"><span class="panel-title">🎯 Placements (${result.placements.length})</span></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Student</th><th>Company</th><th>Role</th><th>CTC</th><th>Type</th><th>Offer Date</th>
        </tr></thead><tbody>` +
        result.placements.map(p => `<tr>
          <td>${p.student_name||'—'}</td><td>${p.company_name||'—'}</td>
          <td>${p.role||'—'}</td><td class="td-mono">₹${p.ctc||0} LPA</td>
          <td>${p.placement_type||'—'}</td><td>${p.offer_date||'—'}</td>
        </tr>`).join('') +
        `</tbody></table></div></div>`;
    }

    if (!html) html = '<div class="empty-state"><p>No results found for "' + escapeHtml(q) + '"</p></div>';
    box.innerHTML = html;
  } catch (err) {
    box.innerHTML = '<p style="color:var(--sub);padding:16px">Search failed. Is the backend running?</p>';
  }
}

/* =========================================
   MODULE 7 – REPORTS
========================================= */
async function renderReports() {
  try {
    const report = await API.get('/api/reports/overview');
    const t = report.totals;

    // Stats grid
    const box = document.getElementById('report-stats-grid');
    if (box) box.innerHTML = `
      <div class="stat-card green">
        <div class="stat-label">Total Students</div>
        <div class="stat-value green">${t.students}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Placed</div>
        <div class="stat-value blue">${t.placed}</div>
      </div>
      <div class="stat-card coral">
        <div class="stat-label">Companies</div>
        <div class="stat-value coral">${t.companies}</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-label">Placement Rate</div>
        <div class="stat-value gold">${report.placement_rate}%</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Avg CTC</div>
        <div class="stat-value blue">₹${report.ctc.avg} LPA</div>
      </div>
      <div class="stat-card coral">
        <div class="stat-label">Internships</div>
        <div class="stat-value coral">${t.internships}</div>
      </div>
    `;

    // Pie: placement status
    const pieLabels = ['Placed','Interning','Seeking','Not Seeking'];
    const total = t.students;
    const notSeeking = total - t.placed - t.interning - t.seeking;
    renderChart('chartPieStatus', 'doughnut', pieLabels,
      [t.placed, t.interning, t.seeking, Math.max(0,notSeeking)],
      'Students', ['#22d3a5','#6c63ff','#f97316','#94a3b8'],
      chartPieInst, inst => chartPieInst = inst);

    // Bar: package distribution
    const pkgData = report.package_distribution;
    renderChart('chartPackage', 'bar',
      ['Below 4 LPA','4–7 LPA','7–12 LPA','Above 12 LPA'],
      [pkgData.below_4||0, pkgData.range_4_7||0, pkgData.range_7_12||0, pkgData.above_12||0],
      'Students', ['#6c63ff','#22d3a5','#f97316','#ec4899'],
      chartPkgInst, inst => chartPkgInst = inst);

    // Branch chart 2
    renderChart('chartBranch2', 'bar',
      report.branch_stats.map(b => b.branch||'Unknown'),
      report.branch_stats.map(b => b.total ? Math.round((b.placed/b.total)*100) : 0),
      'Placement %', ['#6c63ff','#22d3a5','#f97316','#3b82f6','#ec4899'],
      chartBranch2Inst, inst => chartBranch2Inst = inst);

    // Sector chart
    renderChart('chartSector', 'pie',
      report.sector_hiring.map(s => s.sector||'Unknown'),
      report.sector_hiring.map(s => s.hires),
      'Hires', ['#6c63ff','#22d3a5','#f97316','#3b82f6','#ec4899','#a78bfa'],
      chartSectorInst, inst => chartSectorInst = inst);

  } catch (err) { console.error(err); }
}

function switchReportTab(tab, el) {
  document.querySelectorAll('#page-reports .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const map = { overview:'report-overview', charts:'report-charts', export:'report-export' };
  Object.values(map).forEach(id => {
    const div = document.getElementById(id);
    if (div) div.style.display = 'none';
  });
  const show = document.getElementById(map[tab]);
  if (show) show.style.display = '';
}

async function exportReport(type) {
  try {
    let rows, filename, headers;
    if (type === 'placement-report') {
      rows = await API.get('/api/reports/placements');
      headers = ['PRN','Student','Branch','Company','Role','CTC','Type','Offer Date','Joining','Location'];
      filename = 'placement_report.csv';
      rows = rows.map(r => [r.prn,r.student_name,r.branch,r.company_name,r.role,r.ctc,r.placement_type,r.offer_date,r.joining_date,r.location]);
    } else if (type === 'student-report') {
      rows = await API.get('/api/reports/students');
      headers = ['PRN','Name','Branch','Year','CGPA','Backlogs','Status','Skills','Email'];
      filename = 'student_report.csv';
      rows = rows.map(r => [r.prn,r.name,r.branch,r.year,r.cgpa,r.backlogs,r.status,r.skills,r.email]);
    } else if (type === 'internship-report') {
      rows = await API.get('/api/internships');
      headers = ['Student','PRN','Company','Role','Stipend','Start','End','Mode','Status'];
      filename = 'internship_report.csv';
      rows = rows.map(r => [r.student_name,r.student_prn,r.company_name,r.role,r.stipend,r.start_date,r.end_date,r.mode,r.status]);
    } else if (type === 'unplaced-report') {
      const all = await API.get('/api/students');
      rows = all.filter(s => s.status !== 'Placed');
      headers = ['PRN','Name','Branch','CGPA','Backlogs','Status','Email'];
      filename = 'unplaced_students.csv';
      rows = rows.map(r => [r.prn,r.name,r.branch,r.cgpa,r.backlogs,r.status,r.email]);
    } else {
      const report = await API.get('/api/reports/overview');
      const t = report.totals;
      rows = [
        ['Metric','Value'],
        ['Total Students', t.students],
        ['Placed Students', t.placed],
        ['Placement Rate %', report.placement_rate],
        ['Total Companies', t.companies],
        ['Total Internships', t.internships],
        ['Avg CTC (LPA)', report.ctc.avg],
        ['Max CTC (LPA)', report.ctc.max],
        ['Min CTC (LPA)', report.ctc.min],
      ];
      headers = null;
      filename = 'summary_report.csv';
    }

    let csv = headers ? [headers.join(',')].concat(rows.map(r => r.map(v => `"${v||''}"`).join(','))).join('\n')
                      : rows.map(r => r.join(',')).join('\n');
    downloadCSV(csv, filename);
    toast(`Exported ${filename}`);
  } catch (err) { toast('Export failed: ' + err.message, 'error'); }
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* =========================================
   MODULE 1 – ADMIN
========================================= */
async function renderUsers() {
  const tbody = document.getElementById('user-table-body');
  if (!tbody) return;
  try {
    const users = await API.get('/api/users');
    tbody.innerHTML = users.length ? users.map(u => `
      <tr>
        <td><strong>${u.name||'—'}</strong></td>
        <td class="td-mono">${u.username||'—'}</td>
        <td>${u.role||'—'}</td>
        <td>${u.department||'—'}</td>
        <td class="td-mono">${u.email||'—'}</td>
        <td class="td-mono">${u.last_login||'Never'}</td>
        <td><span class="badge ${u.status==='Active'?'badge-green':'badge-gray'}">${u.status||'—'}</span></td>
        <td>
          <span class="inline-delete" onclick="deleteUser(${u.id},'${escapeHtml(u.name)}')">✕</span>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="8" style="text-align:center;color:var(--sub)">No users found</td></tr>`;
  } catch (err) { console.error(err); }
}

async function deleteUser(id, name) {
  showConfirm('Delete User', `Remove user "${name}"?`, async () => {
    try {
      await API.delete(`/api/users/${id}`);
      toast('User removed');
      await renderUsers();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function switchAdminTab(tab, el) {
  document.querySelectorAll('#page-admin .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  const map = { users:'admin-users', settings:'admin-settings', data:'admin-data' };
  Object.values(map).forEach(id => {
    const div = document.getElementById(id);
    if (div) div.style.display = 'none';
  });
  const show = document.getElementById(map[tab]);
  if (show) show.style.display = '';
}

async function backupData() {
  try {
    const data = await API.get('/api/data/backup');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ipts_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast('Backup downloaded');
  } catch (err) { toast('Backup failed: ' + err.message, 'error'); }
}

async function loadSampleData() {
  showConfirm('Load Sample Data', 'This will add sample records to the database. Existing records will be kept.', async () => {
    try {
      await API.post('/api/data/sample', {});
      toast('Sample data loaded successfully');
      await updateBadges();
    } catch (err) { toast('Failed: ' + err.message, 'error'); }
  });
}

async function confirmClear() {
  showConfirm('Clear All Data', '⚠️ This will permanently delete ALL students, companies, internships and placements. This cannot be undone!', async () => {
    try {
      await API.delete('/api/data/clear');
      toast('All data cleared');
      await updateBadges();
    } catch (err) { toast('Failed: ' + err.message, 'error'); }
  });
}

/* =========================================
   STUDENT DASHBOARD (Module 9)
========================================= */
async function loadStudentDash() {
  const result = document.getElementById('student-dash-content');
  if (!result) return;
  const q = getValue('dash-student-search').toLowerCase();
  if (!q) {
    result.innerHTML = `<div class="empty-state"><div class="empty-icon">◎</div><p>Enter a student PRN or name to view their dashboard</p></div>`;
    return;
  }
  try {
    const students = await API.get('/api/students');
    const s = students.find(x =>
      String(x.name||'').toLowerCase().includes(q) ||
      String(x.prn||'').toLowerCase().includes(q)
    );
    if (!s) { result.innerHTML = `<div class="empty-state"><p>No student found</p></div>`; return; }

    // Fetch internships and placements for this student
    const [internships, placements] = await Promise.all([
      API.get('/api/internships').catch(() => []),
      API.get('/api/placements').catch(() => [])
    ]);
    const myInterns  = internships.filter(i => i.student_id === s.id);
    const myPlaces   = placements.filter(p => p.student_id === s.id);
    const statusBadge = { Placed:'badge-green', Interning:'badge-blue', Seeking:'badge-gold', 'Not Seeking':'badge-gray' };

    result.innerHTML = `
      <div class="section-grid">
        <div class="panel">
          <div class="panel-header"><span class="panel-title">📋 Profile</span></div>
          <div class="panel-body">
            <div class="form-grid cols3" style="pointer-events:none;opacity:0.85">
              <div class="form-group"><label>Name</label><input value="${s.name||''}" readonly></div>
              <div class="form-group"><label>PRN</label><input value="${s.prn||''}" readonly></div>
              <div class="form-group"><label>Email</label><input value="${s.email||''}" readonly></div>
              <div class="form-group"><label>Phone</label><input value="${s.phone||''}" readonly></div>
              <div class="form-group"><label>Branch</label><input value="${s.branch||''}" readonly></div>
              <div class="form-group"><label>Year / Division</label><input value="${s.year||''} / ${s.division||''}" readonly></div>
              <div class="form-group"><label>CGPA</label><input value="${s.cgpa||''}" readonly></div>
              <div class="form-group"><label>SSC %</label><input value="${s.ssc||''}" readonly></div>
              <div class="form-group"><label>HSC %</label><input value="${s.hsc||''}" readonly></div>
              <div class="form-group full"><label>Skills</label><input value="${s.skills||''}" readonly></div>
              <div class="form-group"><label>Status</label>
                <span class="badge ${statusBadge[s.status]||'badge-gray'}" style="margin-top:4px;display:inline-block">${s.status||'—'}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-header"><span class="panel-title">📊 Academic</span></div>
          <div class="panel-body">
            <div class="activity-item"><div class="activity-dot blue"></div><div><strong>CGPA:</strong> ${s.cgpa||'—'}</div></div>
            <div class="activity-item"><div class="activity-dot green"></div><div><strong>10th SSC:</strong> ${s.ssc ? s.ssc+'%' : '—'}</div></div>
            <div class="activity-item"><div class="activity-dot gold"></div><div><strong>12th/Diploma:</strong> ${s.hsc ? s.hsc+'%' : '—'}</div></div>
            <div class="activity-item"><div class="activity-dot ${s.backlogs>0?'red':'green'}"></div><div><strong>Backlogs:</strong> ${s.backlogs||0}</div></div>
          </div>
        </div>
      </div>
      ${myPlaces.length ? `
      <div class="panel" style="margin-top:14px">
        <div class="panel-header"><span class="panel-title">🎯 Placement Records</span></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Company</th><th>Role</th><th>CTC</th><th>Type</th><th>Offer Date</th>
        </tr></thead><tbody>` +
        myPlaces.map(p => `<tr>
          <td>${p.company_name||'—'}</td><td>${p.role||'—'}</td>
          <td class="td-mono"><strong>₹${p.ctc||0} LPA</strong></td>
          <td>${p.placement_type||'—'}</td><td>${p.offer_date||'—'}</td>
        </tr>`).join('') +
        `</tbody></table></div></div>` : ''}
      ${myInterns.length ? `
      <div class="panel" style="margin-top:14px">
        <div class="panel-header"><span class="panel-title">📋 Internship Records</span></div>
        <div class="table-wrap"><table><thead><tr>
          <th>Company</th><th>Role</th><th>Stipend</th><th>Start</th><th>End</th><th>Status</th>
        </tr></thead><tbody>` +
        myInterns.map(i => `<tr>
          <td>${i.company_name||'—'}</td><td>${i.role||'—'}</td>
          <td>${i.stipend ? '₹'+Number(i.stipend).toLocaleString() : '—'}</td>
          <td>${i.start_date||'—'}</td><td>${i.end_date||'—'}</td>
          <td><span class="badge badge-blue">${i.status||'—'}</span></td>
        </tr>`).join('') +
        `</tbody></table></div></div>` : ''}
    `;
  } catch (err) {
    result.innerHTML = `<div class="empty-state"><p>Failed to load student dashboard</p></div>`;
  }
}

/* =========================================
   CHART HELPER
========================================= */
function renderChart(canvasId, type, labels, data, label, colors, existingInst, setInst) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (existingInst) { try { existingInst.destroy(); } catch (e) {} }
  const inst = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: type === 'line' ? 'rgba(108,99,255,0.15)' : colors,
        borderColor: type === 'line' ? '#6c63ff' : colors,
        borderWidth: type === 'line' ? 2 : 1,
        fill: type === 'line',
        tension: 0.4,
        pointBackgroundColor: '#6c63ff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: type === 'doughnut' || type === 'pie' } },
      scales: (type === 'bar' || type === 'line') ? {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
      } : {}
    }
  });
  setInst(inst);
}

/* =========================================
   HELPERS
========================================= */
function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function escapeHtml(str) {
  return String(str||'')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}

/* =========================================
   INIT
========================================= */
document.addEventListener('DOMContentLoaded', async () => {
  await navigate('dashboard');
});