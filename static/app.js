/* ═══════════════════════════════════════════════
   IPTS — Internship & Placement Tracking System
   Application Logic
   ═══════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════
   DATA STORE  (localStorage wrapper)
══════════════════════════════════════ */
const DB = {
  get: (key)       => JSON.parse(localStorage.getItem('ipts_' + key) || '[]'),
  set: (key, val)  => localStorage.setItem('ipts_' + key, JSON.stringify(val)),
  id:  ()          => Date.now().toString(36) + Math.random().toString(36).slice(2)
};

/* shared edit-state */
let editId = null;

/* chart instances (kept so we can destroy before redrawing) */
let chartBranch, chartMonthly;
let chartPie, chartPkg, chartBranch2, chartSector, chartTrend;

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
const PAGE_MAP = {
  dashboard:    'page-dashboard',
  students:     'page-students',
  companies:    'page-companies',
  internships:  'page-internships',
  placements:   'page-placements',
  search:       'page-search',
  reports:      'page-reports',
  admin:        'page-admin',
  'student-dash': 'page-student-dash'
};

const PAGE_TITLES = {
  dashboard:    ['Admin Dashboard',   '· Overview'],
  students:     ['Students',          '· Module 2'],
  companies:    ['Companies',         '· Module 3'],
  internships:  ['Internships',       '· Module 4'],
  placements:   ['Placements',        '· Module 5'],
  search:       ['Search & Filter',   '· Module 6'],
  reports:      ['Reports',           '· Module 7'],
  admin:        ['Admin Settings',    '· Module 1'],
  'student-dash': ['Student Dashboard', '· Module 9']
};

const PAGE_ACTIONS = {
  students:    `<button class="btn btn-primary btn-sm" onclick="openStudentModal()">+ Add Student</button>`,
  companies:   `<button class="btn btn-primary btn-sm" onclick="openCompanyModal()">+ Add Company</button>`,
  internships: `<button class="btn btn-primary btn-sm" onclick="openInternModal()">+ Add Internship</button>`,
  placements:  `<button class="btn btn-primary btn-sm" onclick="openPlaceModal()">+ Add Placement</button>`
};

function navigate(page) {
  /* deactivate all pages & nav items */
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  /* activate target page */
  const target = document.getElementById(PAGE_MAP[page]);
  if (target) target.classList.add('active');

  /* update topbar */
  const [title, sub] = PAGE_TITLES[page] || ['', ''];
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-sub').textContent   = sub;
  document.getElementById('topbar-actions').innerHTML = PAGE_ACTIONS[page] || '';

  /* highlight active nav item */
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(`'${page}'`)) n.classList.add('active');
  });

  /* render page content */
  const renderers = {
    dashboard:      renderDashboard,
    students:       renderStudentTable,
    companies:      renderCompanyTable,
    internships:    renderInternTable,
    placements:     renderPlaceTable,
    reports:        renderReports,
    admin:          renderAdmin
  };
  if (renderers[page]) renderers[page]();
  updateBadges();
}

function updateBadges() {
  document.getElementById('badge-students').textContent    = DB.get('students').length;
  document.getElementById('badge-companies').textContent   = DB.get('companies').length;
  document.getElementById('badge-internships').textContent = DB.get('internships').length;
  document.getElementById('badge-placements').textContent  = DB.get('placements').length;
}

/* ══════════════════════════════════════
   MODULE 8 — ADMIN DASHBOARD
══════════════════════════════════════ */
function renderDashboard() {
  const students    = DB.get('students');
  const companies   = DB.get('companies');
  const internships = DB.get('internships');
  const placements  = DB.get('placements');

  const placed  = students.filter(s => s.status === 'Placed').length;
  const rate    = students.length ? Math.round(placed / students.length * 100) : 0;
  const avgCtc  = placements.length
    ? (placements.reduce((a, p) => a + parseFloat(p.ctc || 0), 0) / placements.length).toFixed(2)
    : 0;
  const maxCtc  = placements.length
    ? Math.max(...placements.map(p => parseFloat(p.ctc || 0))).toFixed(2)
    : 0;

  document.getElementById('dash-stats').innerHTML = `
    <div class="stat-card blue">
      <div class="stat-label">Total Students</div>
      <div class="stat-value blue">${students.length}</div>
      <div class="stat-delta">Registered in system</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Placed</div>
      <div class="stat-value green">${placed}</div>
      <div class="stat-delta">${rate}% placement rate</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar" style="width:${rate}%;background:var(--success)"></div>
      </div>
    </div>
    <div class="stat-card coral">
      <div class="stat-label">Companies</div>
      <div class="stat-value coral">${companies.length}</div>
      <div class="stat-delta">Registered companies</div>
    </div>
    <div class="stat-card gold">
      <div class="stat-label">Avg CTC (LPA)</div>
      <div class="stat-value gold">₹${avgCtc}</div>
      <div class="stat-delta">Highest: ₹${maxCtc} LPA</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-label">Internships</div>
      <div class="stat-value blue">${internships.length}</div>
      <div class="stat-delta">${internships.filter(i => i.status === 'Ongoing').length} ongoing</div>
    </div>`;

  /* Branch placement-rate bar chart */
  const branches = {};
  students.forEach(s => {
    const b = s.branch || 'Other';
    if (!branches[b]) branches[b] = { total: 0, placed: 0 };
    branches[b].total++;
    if (s.status === 'Placed') branches[b].placed++;
  });
  const bLabels = Object.keys(branches);
  const bData   = bLabels.map(b => branches[b].total ? Math.round(branches[b].placed / branches[b].total * 100) : 0);

  const ctx1 = document.getElementById('chartBranch').getContext('2d');
  if (chartBranch) chartBranch.destroy();
  chartBranch = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: bLabels.length ? bLabels : ['No Data'],
      datasets: [{ data: bLabels.length ? bData : [0], backgroundColor: '#58a6ff', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { max: 100, ticks: { color: '#8b949e', callback: v => v + '%' }, grid: { color: '#21262d' } },
        x: { ticks: { color: '#8b949e', maxRotation: 0 }, grid: { display: false } }
      }
    }
  });

  /* Monthly placements line chart */
  const months  = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
  const monthly = new Array(12).fill(0);
  placements.forEach(p => {
    if (p.offerDate) {
      const m   = new Date(p.offerDate).getMonth();
      const idx = m >= 6 ? m - 6 : m + 6;
      if (idx >= 0 && idx < 12) monthly[idx]++;
    }
  });

  const ctx2 = document.getElementById('chartMonthly').getContext('2d');
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        data: monthly,
        borderColor: '#3fb950',
        backgroundColor: 'rgba(63,185,80,0.1)',
        fill: true, tension: 0.4, pointBackgroundColor: '#3fb950'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        x: { ticks: { color: '#8b949e' }, grid: { display: false } }
      }
    }
  });

  /* Recent activity */
  const activities = JSON.parse(localStorage.getItem('ipts_activity') || '[]').slice(-8).reverse();
  const actEl = document.getElementById('activity-list');
  actEl.innerHTML = activities.length
    ? activities.map(a => `
        <div class="activity-item">
          <div class="activity-dot" style="background:${a.color}"></div>
          <div>
            <div class="activity-text">${a.text}</div>
            <div class="activity-time">${a.time}</div>
          </div>
        </div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">🕐</div><p>No recent activity</p></div>`;

  /* Top hiring companies */
  const companyHires = {};
  placements.forEach(p => {
    const comp = DB.get('companies').find(c => c.id === p.companyId);
    const name = comp ? comp.name : p.companyId;
    companyHires[name] = (companyHires[name] || 0) + 1;
  });
  const sorted = Object.entries(companyHires).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('top-companies-list').innerHTML = sorted.length
    ? sorted.map(([name, count], i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light);">
          <span style="font-size:11px;font-family:var(--mono);color:var(--sub);width:18px">#${i + 1}</span>
          <span style="font-size:13px;flex:1">${name}</span>
          <span class="badge badge-green">${count} hired</span>
        </div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">🏆</div><p>No placement data yet</p></div>`;
}

/* ══════════════════════════════════════
   MODULE 2 — STUDENTS
══════════════════════════════════════ */
function openStudentModal(id = null) {
  editId = id;
  document.getElementById('student-modal-title').textContent = id ? 'Edit Student' : 'Add Student';

  /* reset fields */
  ['prn','name','email','phone','div','cgpa','ssc','hsc','skills','address'].forEach(f => {
    const el = document.getElementById('s-' + f); if (el) el.value = '';
  });
  document.getElementById('s-backlogs').value = '0';
  document.getElementById('s-branch').value   = 'BCCA';
  document.getElementById('s-year').value     = 'Final Year';
  document.getElementById('s-status').value   = 'Seeking';

  if (id) {
    const s = DB.get('students').find(x => x.id === id);
    if (s) {
      ['prn','name','email','phone','branch','year','div','cgpa','backlogs','ssc','hsc','status','skills','address']
        .forEach(f => { const el = document.getElementById('s-' + f); if (el) el.value = s[f] || ''; });
    }
  }
  document.getElementById('modal-student').classList.add('open');
}

function saveStudent() {
  const prn  = document.getElementById('s-prn').value.trim();
  const name = document.getElementById('s-name').value.trim();
  if (!prn || !name) { toast('PRN and Name are required', 'error'); return; }

  const students = DB.get('students');
  const obj = {
    id:        editId || DB.id(),
    prn, name,
    email:     document.getElementById('s-email').value,
    phone:     document.getElementById('s-phone').value,
    branch:    document.getElementById('s-branch').value,
    year:      document.getElementById('s-year').value,
    div:       document.getElementById('s-div').value,
    cgpa:      document.getElementById('s-cgpa').value,
    backlogs:  document.getElementById('s-backlogs').value,
    ssc:       document.getElementById('s-ssc').value,
    hsc:       document.getElementById('s-hsc').value,
    status:    document.getElementById('s-status').value,
    skills:    document.getElementById('s-skills').value,
    address:   document.getElementById('s-address').value,
    createdAt: editId
      ? (students.find(s => s.id === editId)?.createdAt || new Date().toISOString())
      : new Date().toISOString()
  };

  if (editId) {
    students[students.findIndex(s => s.id === editId)] = obj;
    logActivity(`Updated student <strong>${name}</strong>`, '#58a6ff');
  } else {
    students.push(obj);
    logActivity(`Added student <strong>${name}</strong>`, '#3fb950');
  }

  DB.set('students', students);
  closeModal('modal-student');
  renderStudentTable();
  updateBadges();
  toast(editId ? 'Student updated!' : 'Student added!', 'success');
  editId = null;
}

function renderStudentTable() {
  const q      = (document.getElementById('student-search')?.value || '').toLowerCase();
  const branch = document.getElementById('student-filter-branch')?.value || '';
  const status = document.getElementById('student-filter-status')?.value || '';

  const students = DB.get('students').filter(s =>
    (!q      || [s.name, s.prn, s.email, s.branch, s.skills].some(v => (v || '').toLowerCase().includes(q))) &&
    (!branch || s.branch === branch) &&
    (!status || s.status === status)
  );

  const tbody = document.getElementById('student-table-body');
  const empty = document.getElementById('student-empty');

  if (!students.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const statusBadge = {
    Placed:       'badge-green',
    Interning:    'badge-blue',
    Seeking:      'badge-gold',
    'Not Seeking':'badge-gray'
  };

  tbody.innerHTML = students.map(s => `
    <tr>
      <td class="td-mono">${s.prn}</td>
      <td><strong>${s.name}</strong></td>
      <td>${s.branch}</td>
      <td>${s.year} / ${s.div || '—'}</td>
      <td><span class="td-mono">${s.cgpa || '—'}</span></td>
      <td class="td-mono" style="font-size:11px">${s.email || '—'}</td>
      <td><span class="badge ${statusBadge[s.status] || 'badge-gray'}">${s.status}</span></td>
      <td>
        <span class="inline-edit"   onclick="openStudentModal('${s.id}')">✏ Edit</span>
        <span class="inline-delete" onclick="deleteRecord('students','${s.id}','${s.name}',renderStudentTable)">✕</span>
      </td>
    </tr>`).join('');
}

/* ══════════════════════════════════════
   MODULE 3 — COMPANIES
══════════════════════════════════════ */
function openCompanyModal(id = null) {
  editId = id;
  document.getElementById('company-modal-title').textContent = id ? 'Edit Company' : 'Add Company';

  ['name','location','contact','email','phone','about','roles'].forEach(f => {
    const el = document.getElementById('c-' + f); if (el) el.value = '';
  });
  document.getElementById('c-openings').value = '1';
  document.getElementById('c-mincgpa').value  = '';
  document.getElementById('c-sector').value   = 'IT / Software';
  document.getElementById('c-status').value   = 'Active';

  if (id) {
    const c = DB.get('companies').find(x => x.id === id);
    if (c) {
      ['name','sector','location','contact','email','phone','mincgpa','openings','status','about','roles']
        .forEach(f => { const el = document.getElementById('c-' + f); if (el) el.value = c[f] || ''; });
    }
  }
  document.getElementById('modal-company').classList.add('open');
}

function saveCompany() {
  const name = document.getElementById('c-name').value.trim();
  if (!name) { toast('Company name is required', 'error'); return; }

  const companies = DB.get('companies');
  const obj = {
    id:       editId || DB.id(),
    name,
    sector:   document.getElementById('c-sector').value,
    location: document.getElementById('c-location').value,
    contact:  document.getElementById('c-contact').value,
    email:    document.getElementById('c-email').value,
    phone:    document.getElementById('c-phone').value,
    mincgpa:  document.getElementById('c-mincgpa').value,
    openings: document.getElementById('c-openings').value,
    status:   document.getElementById('c-status').value,
    about:    document.getElementById('c-about').value,
    roles:    document.getElementById('c-roles').value
  };

  if (editId) {
    companies[companies.findIndex(c => c.id === editId)] = obj;
    logActivity(`Updated company <strong>${name}</strong>`, '#58a6ff');
  } else {
    companies.push(obj);
    logActivity(`Added company <strong>${name}</strong>`, '#d29922');
  }

  DB.set('companies', companies);
  closeModal('modal-company');
  renderCompanyTable();
  updateBadges();
  toast(editId ? 'Company updated!' : 'Company added!', 'success');
  editId = null;
}

function renderCompanyTable() {
  const q      = (document.getElementById('company-search')?.value || '').toLowerCase();
  const sector = document.getElementById('company-filter-sector')?.value || '';

  const companies = DB.get('companies').filter(c =>
    (!q      || [c.name, c.sector, c.location, c.contact].some(v => (v || '').toLowerCase().includes(q))) &&
    (!sector || c.sector === sector)
  );

  const tbody = document.getElementById('company-table-body');
  const empty = document.getElementById('company-empty');

  if (!companies.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const sBadge = { Active: 'badge-green', 'Drive Completed': 'badge-gray', Blacklisted: 'badge-coral' };

  tbody.innerHTML = companies.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.sector}</td>
      <td>${c.location || '—'}</td>
      <td>${c.contact  || '—'}</td>
      <td class="td-mono">${c.email   || '—'}</td>
      <td class="td-mono" style="text-align:center">${c.openings || '0'}</td>
      <td><span class="badge ${sBadge[c.status] || 'badge-gray'}">${c.status}</span></td>
      <td>
        <span class="inline-edit"   onclick="openCompanyModal('${c.id}')">✏ Edit</span>
        <span class="inline-delete" onclick="deleteRecord('companies','${c.id}','${c.name}',renderCompanyTable)">✕</span>
      </td>
    </tr>`).join('');
}

/* ══════════════════════════════════════
   MODULE 4 — INTERNSHIPS
══════════════════════════════════════ */
function openInternModal(id = null) {
  editId = id;
  document.getElementById('intern-modal-title').textContent = id ? 'Edit Internship' : 'Add Internship';

  /* populate dropdowns */
  const students  = DB.get('students');
  const companies = DB.get('companies');
  document.getElementById('i-student').innerHTML =
    `<option value="">-- Select Student --</option>` +
    students.map(s => `<option value="${s.id}">${s.name} (${s.prn})</option>`).join('');
  document.getElementById('i-company').innerHTML =
    `<option value="">-- Select Company --</option>` +
    companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  ['role','stipend','start','end','remarks'].forEach(f => {
    const el = document.getElementById('i-' + f); if (el) el.value = '';
  });
  document.getElementById('i-status').value = 'Ongoing';
  document.getElementById('i-mode').value   = 'In-Office';

  if (id) {
    const intern = DB.get('internships').find(x => x.id === id);
    if (intern) {
      document.getElementById('i-student').value  = intern.studentId;
      document.getElementById('i-company').value  = intern.companyId;
      document.getElementById('i-role').value     = intern.role;
      document.getElementById('i-stipend').value  = intern.stipend;
      document.getElementById('i-start').value    = intern.start;
      document.getElementById('i-end').value      = intern.end;
      document.getElementById('i-mode').value     = intern.mode;
      document.getElementById('i-status').value   = intern.status;
      document.getElementById('i-remarks').value  = intern.remarks;
    }
  }
  document.getElementById('modal-intern').classList.add('open');
}

function saveIntern() {
  const studentId = document.getElementById('i-student').value;
  const companyId = document.getElementById('i-company').value;
  const role      = document.getElementById('i-role').value.trim();
  if (!studentId || !companyId || !role) { toast('Student, Company and Role are required', 'error'); return; }

  const internships = DB.get('internships');
  const obj = {
    id: editId || DB.id(),
    studentId, companyId, role,
    stipend:  document.getElementById('i-stipend').value,
    start:    document.getElementById('i-start').value,
    end:      document.getElementById('i-end').value,
    mode:     document.getElementById('i-mode').value,
    status:   document.getElementById('i-status').value,
    remarks:  document.getElementById('i-remarks').value
  };

  const sName = DB.get('students').find(s => s.id === studentId)?.name  || '';
  const cName = DB.get('companies').find(c => c.id === companyId)?.name || '';

  if (editId) {
    internships[internships.findIndex(x => x.id === editId)] = obj;
  } else {
    internships.push(obj);
    logActivity(`<strong>${sName}</strong> started internship at <strong>${cName}</strong>`, '#58a6ff');
  }

  DB.set('internships', internships);
  closeModal('modal-intern');
  renderInternTable();
  updateBadges();
  toast(editId ? 'Internship updated!' : 'Internship added!', 'success');
  editId = null;
}

function renderInternTable() {
  const q      = (document.getElementById('intern-search')?.value || '').toLowerCase();
  const status = document.getElementById('intern-filter-status')?.value || '';
  const students  = DB.get('students');
  const companies = DB.get('companies');

  const internships = DB.get('internships').filter(i => {
    const sName = students.find(s  => s.id  === i.studentId)?.name || '';
    const cName = companies.find(c => c.id  === i.companyId)?.name || '';
    return (!q      || [sName, cName, i.role].some(v => v.toLowerCase().includes(q))) &&
           (!status || i.status === status);
  });

  const tbody = document.getElementById('intern-table-body');
  const empty = document.getElementById('intern-empty');

  if (!internships.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const sBadge = { Ongoing: 'badge-blue', Completed: 'badge-green', 'Offer Received': 'badge-gold', Terminated: 'badge-coral' };

  tbody.innerHTML = internships.map(i => {
    const s = students.find(x  => x.id === i.studentId);
    const c = companies.find(x => x.id === i.companyId);
    return `<tr>
      <td>${s?.name || '—'}<br><span class="td-mono" style="font-size:10px">${s?.prn || ''}</span></td>
      <td>${c?.name || '—'}</td>
      <td>${i.role}</td>
      <td class="td-mono">${i.start || '—'}</td>
      <td class="td-mono">${i.end   || '—'}</td>
      <td class="td-mono">₹${i.stipend ? Number(i.stipend).toLocaleString() : '—'}</td>
      <td><span class="badge ${sBadge[i.status] || 'badge-gray'}">${i.status}</span></td>
      <td>
        <span class="inline-edit"   onclick="openInternModal('${i.id}')">✏ Edit</span>
        <span class="inline-delete" onclick="deleteRecord('internships','${i.id}','internship',renderInternTable)">✕</span>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   MODULE 5 — PLACEMENTS
══════════════════════════════════════ */
function openPlaceModal(id = null) {
  editId = id;
  document.getElementById('place-modal-title').textContent = id ? 'Edit Placement' : 'Add Placement';

  const students  = DB.get('students');
  const companies = DB.get('companies');
  document.getElementById('p-student').innerHTML =
    `<option value="">-- Select Student --</option>` +
    students.map(s => `<option value="${s.id}">${s.name} (${s.prn})</option>`).join('');
  document.getElementById('p-company').innerHTML =
    `<option value="">-- Select Company --</option>` +
    companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  ['role','ctc','offer-date','join-date','location','remarks'].forEach(f => {
    const el = document.getElementById('p-' + f); if (el) el.value = '';
  });
  document.getElementById('p-type').value = 'On-Campus';

  if (id) {
    const p = DB.get('placements').find(x => x.id === id);
    if (p) {
      document.getElementById('p-student').value    = p.studentId;
      document.getElementById('p-company').value    = p.companyId;
      document.getElementById('p-role').value       = p.role;
      document.getElementById('p-ctc').value        = p.ctc;
      document.getElementById('p-type').value       = p.type;
      document.getElementById('p-offer-date').value = p.offerDate;
      document.getElementById('p-join-date').value  = p.joinDate;
      document.getElementById('p-location').value   = p.location;
      document.getElementById('p-remarks').value    = p.remarks;
    }
  }
  document.getElementById('modal-place').classList.add('open');
}

function savePlace() {
  const studentId = document.getElementById('p-student').value;
  const companyId = document.getElementById('p-company').value;
  const role      = document.getElementById('p-role').value.trim();
  const ctc       = document.getElementById('p-ctc').value;
  if (!studentId || !companyId || !role || !ctc) {
    toast('Student, Company, Role and CTC are required', 'error'); return;
  }

  const placements = DB.get('placements');
  const obj = {
    id: editId || DB.id(),
    studentId, companyId, role, ctc,
    type:      document.getElementById('p-type').value,
    offerDate: document.getElementById('p-offer-date').value,
    joinDate:  document.getElementById('p-join-date').value,
    location:  document.getElementById('p-location').value,
    remarks:   document.getElementById('p-remarks').value
  };

  const sName = DB.get('students').find(s  => s.id === studentId)?.name  || '';
  const cName = DB.get('companies').find(c => c.id === companyId)?.name  || '';

  if (editId) {
    placements[placements.findIndex(x => x.id === editId)] = obj;
  } else {
    placements.push(obj);
    /* auto-mark student as Placed */
    const students = DB.get('students');
    const si = students.findIndex(s => s.id === studentId);
    if (si !== -1) { students[si].status = 'Placed'; DB.set('students', students); }
    logActivity(`<strong>${sName}</strong> placed at <strong>${cName}</strong> — ₹${ctc} LPA`, '#3fb950');
  }

  DB.set('placements', placements);
  closeModal('modal-place');
  renderPlaceTable();
  updateBadges();
  toast(editId ? 'Placement updated!' : 'Placement recorded! Student status updated to Placed.', 'success');
  editId = null;
}

function renderPlaceTable() {
  const q      = (document.getElementById('place-search')?.value || '').toLowerCase();
  const type   = document.getElementById('place-filter-type')?.value || '';
  const students  = DB.get('students');
  const companies = DB.get('companies');

  const placements = DB.get('placements').filter(p => {
    const sName = students.find(s  => s.id === p.studentId)?.name  || '';
    const cName = companies.find(c => c.id === p.companyId)?.name  || '';
    return (!q    || [sName, cName, p.role, String(p.ctc)].some(v => String(v || '').toLowerCase().includes(q))) &&
           (!type || p.type === type);
  });

  const tbody = document.getElementById('place-table-body');
  const empty = document.getElementById('place-empty');

  if (!placements.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const typeBadge = {
    'On-Campus':               'badge-blue',
    'Off-Campus':              'badge-gold',
    'PPO (Pre-Placement Offer)': 'badge-green',
    Lateral:                   'badge-coral'
  };

  tbody.innerHTML = placements.map(p => {
    const s = students.find(x  => x.id === p.studentId);
    const c = companies.find(x => x.id === p.companyId);
    return `<tr>
      <td>${s?.name || '—'}<br><span class="td-mono" style="font-size:10px">${s?.prn || ''}</span></td>
      <td>${c?.name || '—'}</td>
      <td>${p.role}</td>
      <td class="td-mono" style="color:var(--success);font-weight:600">₹${p.ctc} LPA</td>
      <td><span class="badge ${typeBadge[p.type] || 'badge-gray'}" style="font-size:10px">${p.type}</span></td>
      <td class="td-mono">${p.offerDate || '—'}</td>
      <td class="td-mono">${p.joinDate  || '—'}</td>
      <td>
        <span class="inline-edit"   onclick="openPlaceModal('${p.id}')">✏ Edit</span>
        <span class="inline-delete" onclick="deleteRecord('placements','${p.id}','placement record',renderPlaceTable)">✕</span>
      </td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════
   MODULE 6 — GLOBAL SEARCH
══════════════════════════════════════ */
function globalSearch() {
  const q      = document.getElementById('global-search').value.toLowerCase();
  const filter = document.getElementById('global-filter-type').value;
  const el     = document.getElementById('global-results');

  if (!q) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Type to search across all records</p></div>`;
    return;
  }

  const students    = DB.get('students');
  const companies   = DB.get('companies');
  const internships = DB.get('internships');
  const placements  = DB.get('placements');
  let html = '';

  if (!filter || filter === 'students') {
    const res = students.filter(s =>
      [s.name, s.prn, s.email, s.branch, s.skills].some(v => (v || '').toLowerCase().includes(q))
    );
    if (res.length) html += `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><span class="panel-title">👤 Students (${res.length})</span></div>
        <div class="table-wrap"><table><thead><tr><th>PRN</th><th>Name</th><th>Branch</th><th>CGPA</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${res.map(s => `<tr>
          <td class="td-mono">${s.prn}</td>
          <td>${s.name}</td><td>${s.branch}</td>
          <td class="td-mono">${s.cgpa || '—'}</td>
          <td><span class="badge ${s.status === 'Placed' ? 'badge-green' : s.status === 'Interning' ? 'badge-blue' : 'badge-gold'}">${s.status}</span></td>
          <td><span class="inline-edit" onclick="navigate('students')">View →</span></td>
        </tr>`).join('')}</tbody></table></div>
      </div>`;
  }

  if (!filter || filter === 'companies') {
    const res = companies.filter(c =>
      [c.name, c.sector, c.location, c.contact].some(v => (v || '').toLowerCase().includes(q))
    );
    if (res.length) html += `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><span class="panel-title">🏢 Companies (${res.length})</span></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Sector</th><th>Location</th><th>Openings</th><th>Status</th></tr></thead>
        <tbody>${res.map(c => `<tr>
          <td><strong>${c.name}</strong></td><td>${c.sector}</td><td>${c.location || '—'}</td>
          <td class="td-mono">${c.openings || 0}</td>
          <td><span class="badge ${c.status === 'Active' ? 'badge-green' : 'badge-gray'}">${c.status}</span></td>
        </tr>`).join('')}</tbody></table></div>
      </div>`;
  }

  if (!filter || filter === 'internships') {
    const res = internships.filter(i => {
      const s = students.find(x  => x.id === i.studentId)?.name  || '';
      const c = companies.find(x => x.id === i.companyId)?.name  || '';
      return [s, c, i.role].some(v => v.toLowerCase().includes(q));
    });
    if (res.length) html += `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><span class="panel-title">📋 Internships (${res.length})</span></div>
        <div class="table-wrap"><table><thead><tr><th>Student</th><th>Company</th><th>Role</th><th>Stipend</th><th>Status</th></tr></thead>
        <tbody>${res.map(i => {
          const s = students.find(x  => x.id === i.studentId);
          const c = companies.find(x => x.id === i.companyId);
          return `<tr><td>${s?.name || '—'}</td><td>${c?.name || '—'}</td><td>${i.role}</td>
            <td class="td-mono">₹${i.stipend ? Number(i.stipend).toLocaleString() : '—'}</td>
            <td><span class="badge ${i.status === 'Ongoing' ? 'badge-blue' : 'badge-green'}">${i.status}</span></td>
          </tr>`;
        }).join('')}</tbody></table></div>
      </div>`;
  }

  if (!filter || filter === 'placements') {
    const res = placements.filter(p => {
      const s = students.find(x  => x.id === p.studentId)?.name  || '';
      const c = companies.find(x => x.id === p.companyId)?.name  || '';
      return [s, c, p.role, String(p.ctc)].some(v => v.toLowerCase().includes(q));
    });
    if (res.length) html += `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><span class="panel-title">🎯 Placements (${res.length})</span></div>
        <div class="table-wrap"><table><thead><tr><th>Student</th><th>Company</th><th>Role</th><th>CTC</th><th>Type</th></tr></thead>
        <tbody>${res.map(p => {
          const s = students.find(x  => x.id === p.studentId);
          const c = companies.find(x => x.id === p.companyId);
          return `<tr><td>${s?.name || '—'}</td><td>${c?.name || '—'}</td><td>${p.role}</td>
            <td class="td-mono" style="color:var(--success)">₹${p.ctc} LPA</td>
            <td><span class="badge badge-blue" style="font-size:10px">${p.type}</span></td>
          </tr>`;
        }).join('')}</tbody></table></div>
      </div>`;
  }

  el.innerHTML = html ||
    `<div class="empty-state"><div class="empty-icon">🔍</div><p>No results found for "<strong>${q}</strong>"</p></div>`;
}

/* ══════════════════════════════════════
   MODULE 7 — REPORTS
══════════════════════════════════════ */
function switchReportTab(tab, el) {
  document.querySelectorAll('#page-reports .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('report-overview').style.display = tab === 'overview' ? '' : 'none';
  document.getElementById('report-charts').style.display   = tab === 'charts'   ? '' : 'none';
  document.getElementById('report-export').style.display   = tab === 'export'   ? '' : 'none';
  if (tab === 'charts') renderCharts();
}

function renderReports() {
  const students   = DB.get('students');
  const placements = DB.get('placements');

  const placed    = students.filter(s => s.status === 'Placed').length;
  const interning = students.filter(s => s.status === 'Interning').length;
  const seeking   = students.filter(s => s.status === 'Seeking').length;
  const avgCtc    = placements.length
    ? (placements.reduce((a, p) => a + parseFloat(p.ctc || 0), 0) / placements.length).toFixed(2) : 0;
  const maxCtc    = placements.length
    ? Math.max(...placements.map(p => parseFloat(p.ctc || 0))).toFixed(2) : 0;

  document.getElementById('report-stats-grid').innerHTML = `
    <div class="stat-card green"><div class="stat-label">Placed Students</div><div class="stat-value green">${placed}</div>
      <div class="stat-delta">${students.length ? Math.round(placed / students.length * 100) : 0}% of total</div></div>
    <div class="stat-card blue"><div class="stat-label">Interning</div><div class="stat-value blue">${interning}</div></div>
    <div class="stat-card gold"><div class="stat-label">Still Seeking</div><div class="stat-value gold">${seeking}</div></div>
    <div class="stat-card coral"><div class="stat-label">Avg CTC</div><div class="stat-value coral">₹${avgCtc}</div>
      <div class="stat-delta">Max: ₹${maxCtc} LPA</div></div>`;

  setTimeout(() => {
    /* Status doughnut */
    const ctx3 = document.getElementById('chartPieStatus')?.getContext('2d');
    if (ctx3) {
      if (chartPie) chartPie.destroy();
      chartPie = new Chart(ctx3, {
        type: 'doughnut',
        data: {
          labels: ['Placed', 'Interning', 'Seeking', 'Not Seeking'],
          datasets: [{
            data: [placed, interning, seeking, students.filter(s => s.status === 'Not Seeking').length],
            backgroundColor: ['#3fb950', '#58a6ff', '#d29922', '#484f58'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 } } } }
        }
      });
    }

    /* Package distribution bar */
    const pkgBuckets = { '<4': 0, '4-6': 0, '6-8': 0, '8-12': 0, '12+': 0 };
    placements.forEach(p => {
      const v = parseFloat(p.ctc || 0);
      if      (v <  4) pkgBuckets['<4']++;
      else if (v <  6) pkgBuckets['4-6']++;
      else if (v <  8) pkgBuckets['6-8']++;
      else if (v < 12) pkgBuckets['8-12']++;
      else              pkgBuckets['12+']++;
    });
    const ctx4 = document.getElementById('chartPackage')?.getContext('2d');
    if (ctx4) {
      if (chartPkg) chartPkg.destroy();
      chartPkg = new Chart(ctx4, {
        type: 'bar',
        data: {
          labels: Object.keys(pkgBuckets).map(k => k + ' LPA'),
          datasets: [{
            data: Object.values(pkgBuckets),
            backgroundColor: ['#484f58', '#d29922', '#58a6ff', '#3fb950', '#f78166'],
            borderRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
            x: { ticks: { color: '#8b949e' }, grid: { display: false } }
          }
        }
      });
    }
  }, 100);
}

function renderCharts() {
  const students   = DB.get('students');
  const placements = DB.get('placements');
  const companies  = DB.get('companies');

  setTimeout(() => {
    /* Branch % bar */
    const branches = {};
    students.forEach(s => {
      if (!branches[s.branch]) branches[s.branch] = { t: 0, p: 0 };
      branches[s.branch].t++;
      if (s.status === 'Placed') branches[s.branch].p++;
    });
    const bl = Object.keys(branches);
    const bd = bl.map(b => branches[b].t ? Math.round(branches[b].p / branches[b].t * 100) : 0);
    const ctx5 = document.getElementById('chartBranch2')?.getContext('2d');
    if (ctx5) {
      if (chartBranch2) chartBranch2.destroy();
      chartBranch2 = new Chart(ctx5, {
        type: 'bar',
        data: { labels: bl.length ? bl : ['No Data'], datasets: [{ data: bl.length ? bd : [0], backgroundColor: '#58a6ff', borderRadius: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { max: 100, ticks: { color: '#8b949e', callback: v => v + '%' }, grid: { color: '#21262d' } },
            x: { ticks: { color: '#8b949e' }, grid: { display: false } }
          }
        }
      });
    }

    /* Sector doughnut */
    const sectors = {};
    placements.forEach(p => {
      const c = companies.find(x => x.id === p.companyId);
      const s = c?.sector || 'Other';
      sectors[s] = (sectors[s] || 0) + 1;
    });
    const sl = Object.keys(sectors);
    const ctx6 = document.getElementById('chartSector')?.getContext('2d');
    if (ctx6) {
      if (chartSector) chartSector.destroy();
      chartSector = new Chart(ctx6, {
        type: 'doughnut',
        data: {
          labels: sl.length ? sl : ['No Data'],
          datasets: [{
            data: sl.length ? sl.map(s => sectors[s]) : [1],
            backgroundColor: ['#58a6ff', '#3fb950', '#d29922', '#f78166', '#a371f7', '#39d353', '#ff7b72'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { color: '#8b949e', font: { size: 11 } } } }
        }
      });
    }

    /* Monthly trend line */
    const months  = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
    const monthly = new Array(12).fill(0);
    placements.forEach(p => {
      if (p.offerDate) {
        const m   = new Date(p.offerDate).getMonth();
        const idx = m >= 6 ? m - 6 : m + 6;
        if (idx >= 0 && idx < 12) monthly[idx]++;
      }
    });
    const ctx7 = document.getElementById('chartTrend')?.getContext('2d');
    if (ctx7) {
      if (chartTrend) chartTrend.destroy();
      chartTrend = new Chart(ctx7, {
        type: 'line',
        data: {
          labels: months,
          datasets: [{
            data: monthly, borderColor: '#f78166',
            backgroundColor: 'rgba(247,129,102,0.1)',
            fill: true, tension: 0.4, pointBackgroundColor: '#f78166'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
            x: { ticks: { color: '#8b949e' }, grid: { display: false } }
          }
        }
      });
    }
  }, 100);
}

function exportReport(type) {
  const students    = DB.get('students');
  const placements  = DB.get('placements');
  const companies   = DB.get('companies');
  const internships = DB.get('internships');
  let csvRows = [], filename = 'report.csv';

  if (type === 'student-list') {
    filename = 'student_master_list.csv';
    csvRows  = [['PRN','Name','Branch','Year','CGPA','Backlogs','Email','Phone','Status','Skills']];
    students.forEach(s => csvRows.push([s.prn,s.name,s.branch,s.year,s.cgpa,s.backlogs,s.email,s.phone,s.status,s.skills]));

  } else if (type === 'placement-report') {
    filename = 'placement_report.csv';
    csvRows  = [['Student Name','PRN','Branch','Company','Role','CTC (LPA)','Type','Offer Date','Joining Date']];
    placements.forEach(p => {
      const s = students.find(x  => x.id === p.studentId);
      const c = companies.find(x => x.id === p.companyId);
      csvRows.push([s?.name,s?.prn,s?.branch,c?.name,p.role,p.ctc,p.type,p.offerDate,p.joinDate]);
    });

  } else if (type === 'company-report') {
    filename = 'company_report.csv';
    csvRows  = [['Company','Sector','Location','Openings','Min CGPA','Status','Hires']];
    companies.forEach(c => {
      const hires = placements.filter(p => p.companyId === c.id).length;
      csvRows.push([c.name,c.sector,c.location,c.openings,c.mincgpa,c.status,hires]);
    });

  } else if (type === 'internship-report') {
    filename = 'internship_report.csv';
    csvRows  = [['Student','PRN','Company','Role','Start','End','Stipend','Status']];
    internships.forEach(i => {
      const s = students.find(x  => x.id === i.studentId);
      const c = companies.find(x => x.id === i.companyId);
      csvRows.push([s?.name,s?.prn,c?.name,i.role,i.start,i.end,i.stipend,i.status]);
    });

  } else if (type === 'unplaced-report') {
    filename = 'unplaced_students.csv';
    csvRows  = [['PRN','Name','Branch','CGPA','Email','Phone','Status']];
    students.filter(s => s.status === 'Seeking' || s.status === 'Interning')
      .forEach(s => csvRows.push([s.prn,s.name,s.branch,s.cgpa,s.email,s.phone,s.status]));

  } else {
    filename = 'annual_summary_report.csv';
    const placed  = students.filter(s => s.status === 'Placed').length;
    const avgCtc  = placements.length
      ? (placements.reduce((a, p) => a + parseFloat(p.ctc || 0), 0) / placements.length).toFixed(2) : 0;
    const maxCtc  = placements.length
      ? Math.max(...placements.map(p => parseFloat(p.ctc || 0))).toFixed(2) : 0;
    csvRows = [
      ['Annual Placement Summary Report'], [''],
      ['Metric', 'Value'],
      ['Total Students',    students.length],
      ['Total Placed',      placed],
      ['Placement Rate',    students.length ? (placed / students.length * 100).toFixed(1) + '%' : '0%'],
      ['Avg CTC (LPA)',     avgCtc],
      ['Highest CTC (LPA)', maxCtc],
      ['Total Companies',   companies.length],
      ['Total Internships', internships.length]
    ];
  }

  const csv  = csvRows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  toast(`Exported ${filename}`, 'success');
}

/* ══════════════════════════════════════
   MODULE 1 — ADMIN SETTINGS
══════════════════════════════════════ */
function switchAdminTab(tab, el) {
  document.querySelectorAll('#page-admin .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('admin-users').style.display    = tab === 'users'    ? '' : 'none';
  document.getElementById('admin-settings').style.display = tab === 'settings' ? '' : 'none';
  document.getElementById('admin-data').style.display     = tab === 'data'     ? '' : 'none';
}

function renderAdmin() { renderUserTable(); }

function renderUserTable() {
  const users = DB.get('users');
  document.getElementById('user-table-body').innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td class="td-mono">${u.username}</td>
      <td>${u.role}</td>
      <td>${u.dept     || '—'}</td>
      <td class="td-mono" style="font-size:11px">${u.lastLogin || 'Never'}</td>
      <td><span class="badge ${u.status === 'Active' ? 'badge-green' : 'badge-gray'}">${u.status}</span></td>
      <td><span class="inline-delete" onclick="deleteRecord('users','${u.id}','${u.name}',renderUserTable)">✕</span></td>
    </tr>`).join('') ||
    `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon" style="font-size:20px">👥</div><p>No users added</p></div></td></tr>`;
}

function openUserModal() { document.getElementById('modal-user').classList.add('open'); }

function saveUser() {
  const name     = document.getElementById('u-name').value.trim();
  const username = document.getElementById('u-username').value.trim();
  if (!name || !username) { toast('Name and username required', 'error'); return; }

  const users = DB.get('users');
  users.push({
    id:       DB.id(), name, username,
    role:     document.getElementById('u-role').value,
    dept:     document.getElementById('u-dept').value,
    email:    document.getElementById('u-email').value,
    status:   document.getElementById('u-status').value,
    lastLogin: null
  });
  DB.set('users', users);
  closeModal('modal-user');
  renderUserTable();
  toast('User added!', 'success');
}

/* ══════════════════════════════════════
   MODULE 9 — STUDENT DASHBOARD
══════════════════════════════════════ */
function loadStudentDash() {
  const q = document.getElementById('dash-student-search').value.toLowerCase();
  const s = DB.get('students').find(x =>
    x.name.toLowerCase().includes(q) || x.prn.toLowerCase().includes(q)
  );
  const el = document.getElementById('student-dash-content');

  if (!s) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>No student found. Try a different name or PRN.</p></div>`;
    return;
  }

  const internships = DB.get('internships').filter(i => i.studentId === s.id);
  const placements  = DB.get('placements').filter(p  => p.studentId === s.id);
  const companies   = DB.get('companies');

  const statusColor = {
    Placed:       'var(--success)',
    Interning:    'var(--primary)',
    Seeking:      'var(--warn)',
    'Not Seeking': 'var(--sub)'
  };

  el.innerHTML = `
    <div class="student-hero">
      <div class="student-hero-avatar">${s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:20px;font-weight:700">${s.name}</div>
        <div style="font-size:13px;color:var(--sub);margin-top:2px">${s.prn} · ${s.branch} · ${s.year}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge" style="background:${statusColor[s.status]}22;color:${statusColor[s.status]}">${s.status}</span>
          ${s.cgpa ? `<span class="badge badge-gray">CGPA: ${s.cgpa}</span>` : ''}
          ${s.backlogs ? `<span class="badge badge-coral">Backlogs: ${s.backlogs}</span>` : `<span class="badge badge-green">No Backlogs</span>`}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--sub)">Contact</div>
        <div style="font-size:12px;margin-top:2px">${s.email || '—'}</div>
        <div style="font-size:12px">${s.phone || '—'}</div>
      </div>
    </div>

    <div class="section-grid">
      <div class="panel">
        <div class="panel-header"><span class="panel-title">📚 Academic Details</span></div>
        <div class="panel-body">
          <table style="width:100%">
            <tr><td style="color:var(--sub);font-size:12px;padding:5px 0">CGPA</td>          <td style="font-family:var(--mono);font-size:13px">${s.cgpa     || '—'}</td></tr>
            <tr><td style="color:var(--sub);font-size:12px;padding:5px 0">10th %</td>         <td style="font-family:var(--mono);font-size:13px">${s.ssc      || '—'}%</td></tr>
            <tr><td style="color:var(--sub);font-size:12px;padding:5px 0">12th/Diploma %</td><td style="font-family:var(--mono);font-size:13px">${s.hsc      || '—'}%</td></tr>
            <tr><td style="color:var(--sub);font-size:12px;padding:5px 0">Backlogs</td>       <td style="font-family:var(--mono);font-size:13px">${s.backlogs || 0}</td></tr>
            <tr><td style="color:var(--sub);font-size:12px;padding:5px 0">Division</td>       <td style="font-size:13px">${s.div || '—'}</td></tr>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><span class="panel-title">🛠 Skills</span></div>
        <div class="panel-body">
          ${s.skills
            ? s.skills.split(',').map(sk => `<span class="badge badge-gray" style="margin:3px 3px 3px 0;display:inline-block">${sk.trim()}</span>`).join('')
            : '<span style="font-size:13px;color:var(--sub)">No skills listed</span>'}
        </div>
      </div>
    </div>

    ${internships.length ? `
    <div class="panel" style="margin-bottom:16px;">
      <div class="panel-header"><span class="panel-title">📋 Internships (${internships.length})</span></div>
      <div class="table-wrap"><table><thead>
        <tr><th>Company</th><th>Role</th><th>Stipend</th><th>Start</th><th>End</th><th>Status</th></tr>
      </thead><tbody>
        ${internships.map(i => {
          const c = companies.find(x => x.id === i.companyId);
          return `<tr>
            <td>${c?.name || '—'}</td><td>${i.role}</td>
            <td class="td-mono">₹${i.stipend ? Number(i.stipend).toLocaleString() : '—'}</td>
            <td class="td-mono">${i.start || '—'}</td>
            <td class="td-mono">${i.end   || '—'}</td>
            <td><span class="badge ${i.status === 'Ongoing' ? 'badge-blue' : 'badge-green'}">${i.status}</span></td>
          </tr>`;
        }).join('')}
      </tbody></table></div>
    </div>` : ''}

    ${placements.length
      ? `<div class="panel">
          <div class="panel-header"><span class="panel-title">🎯 Placement Record</span></div>
          <div class="panel-body">
            ${placements.map(p => {
              const c = companies.find(x => x.id === p.companyId);
              return `<div style="background:var(--success-dim);border:1px solid var(--success);border-radius:8px;padding:14px;margin-bottom:10px;">
                <div style="font-size:16px;font-weight:700;color:var(--success)">₹${p.ctc} LPA</div>
                <div style="font-size:14px;margin-top:4px">${p.role} at <strong>${c?.name || '—'}</strong></div>
                <div style="font-size:12px;color:var(--sub);margin-top:4px">${p.type} · Offer: ${p.offerDate || '—'} · Joining: ${p.joinDate || '—'}</div>
              </div>`;
            }).join('')}
          </div>
        </div>`
      : `<div class="panel"><div class="panel-body"><div class="empty-state"><div class="empty-icon">🎯</div><p>No placement record yet</p></div></div></div>`}
  `;
}

/* ══════════════════════════════════════
   HELPERS — MODALS
══════════════════════════════════════ */
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  editId = null;
}

/* ══════════════════════════════════════
   HELPERS — DELETE & CONFIRM
══════════════════════════════════════ */
function deleteRecord(collection, id, label, refresh) {
  showConfirm(`Delete "${label}"?`, 'This action cannot be undone.', () => {
    const data = DB.get(collection).filter(x => x.id !== id);
    DB.set(collection, data);
    logActivity(`Deleted <strong>${label}</strong>`, '#f78166');
    if (typeof refresh === 'function') refresh();
    updateBadges();
    toast(`${label} deleted`, 'success');
  });
}

let confirmCallback = null;

function showConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  confirmCallback = cb;
  document.getElementById('confirm-dialog').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-dialog').classList.remove('open');
  confirmCallback = null;
}

document.getElementById('confirm-ok-btn').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirm();
});

function confirmClear() {
  showConfirm('Clear ALL Data?', 'This will permanently delete all students, companies, internships, and placements.', () => {
    ['students','companies','internships','placements','users','activity'].forEach(k =>
      localStorage.removeItem('ipts_' + k)
    );
    updateBadges();
    toast('All data cleared', 'success');
  });
}

/* ══════════════════════════════════════
   HELPERS — ACTIVITY LOG
══════════════════════════════════════ */
function logActivity(text, color) {
  const activities = JSON.parse(localStorage.getItem('ipts_activity') || '[]');
  activities.push({
    text, color,
    time: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  });
  if (activities.length > 50) activities.splice(0, activities.length - 50);
  localStorage.setItem('ipts_activity', JSON.stringify(activities));
}

/* ══════════════════════════════════════
   HELPERS — TOAST NOTIFICATIONS
══════════════════════════════════════ */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el        = document.createElement('div');
  el.className    = `toast ${type}`;
  el.innerHTML    = `<span>${type === 'success' ? '✓' : '✕'}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ══════════════════════════════════════
   HELPERS — DATA BACKUP
══════════════════════════════════════ */
function backupData() {
  const backup = {};
  ['students','companies','internships','placements','users'].forEach(k => { backup[k] = DB.get(k); });
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `ipts_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  toast('Backup downloaded!', 'success');
}

/* ══════════════════════════════════════
   SAMPLE DATA LOADER
══════════════════════════════════════ */
function loadSampleData() {
  showConfirm('Load Sample Data?', 'This will add sample records to all modules.', () => {
    const cId1 = DB.id(), cId2 = DB.id(), cId3 = DB.id(), cId4 = DB.id();
    const sId1 = DB.id(), sId2 = DB.id(), sId3 = DB.id(), sId4 = DB.id(), sId5 = DB.id();

    DB.set('companies', [
      ...DB.get('companies'),
      { id: cId1, name: 'TechMahindra',    sector: 'IT / Software',    location: 'Pune, MH',    contact: 'Priya Sharma',  email: 'hr@techmahindra.com', phone: '020-12345678', mincgpa: '6.0', openings: '50',  status: 'Active',          about: 'Leading IT firm',         roles: 'Software Engineer, Analyst' },
      { id: cId2, name: 'Infosys',          sector: 'IT / Software',    location: 'Bangalore',   contact: 'Rahul Verma',   email: 'campus@infosys.com',  phone: '080-87654321', mincgpa: '6.5', openings: '120', status: 'Drive Completed',  about: 'Top IT company',          roles: 'Systems Engineer, Developer' },
      { id: cId3, name: 'KPIT Technologies',sector: 'IT / Software',    location: 'Pune, MH',    contact: 'Anjali Mehta',  email: 'hr@kpit.com',         phone: '020-11112222', mincgpa: '7.0', openings: '30',  status: 'Active',          about: 'Automotive IT solutions', roles: 'Software Engineer' },
      { id: cId4, name: 'WNS Global',       sector: 'Banking / Finance',location: 'Nagpur, MH',  contact: 'Sanjay Patil',  email: 'recruit@wns.com',     phone: '0712-9876543', mincgpa: '5.5', openings: '80',  status: 'Active',          about: 'BPO and analytics',       roles: 'Analyst, Executive' }
    ]);

    DB.set('students', [
      ...DB.get('students'),
      { id: sId1, prn: 'BCCA2021001', name: 'Arjun Deshmukh',  email: 'arjun@gmail.com',  phone: '9876543210', branch: 'BCCA',                year: 'Final Year', div: 'A', cgpa: '8.5', backlogs: '0', ssc: '85.4', hsc: '79.2', status: 'Placed',   skills: 'Python, SQL, Django, AWS',               address: 'Nagpur, MH',  createdAt: new Date().toISOString() },
      { id: sId2, prn: 'BCCA2021002', name: 'Sneha Kulkarni',  email: 'sneha@gmail.com',  phone: '9123456789', branch: 'BCCA',                year: 'Final Year', div: 'A', cgpa: '7.8', backlogs: '0', ssc: '88.0', hsc: '82.0', status: 'Placed',   skills: 'Java, Spring Boot, MySQL',               address: 'Wardha, MH',  createdAt: new Date().toISOString() },
      { id: sId3, prn: 'CS2021041',   name: 'Rahul Meshram',   email: 'rahul@gmail.com',  phone: '8765432109', branch: 'Computer Science',    year: 'Final Year', div: 'B', cgpa: '9.1', backlogs: '0', ssc: '92.0', hsc: '88.5', status: 'Placed',   skills: 'React, Node.js, Docker, Kubernetes',    address: 'Nagpur, MH',  createdAt: new Date().toISOString() },
      { id: sId4, prn: 'BCCA2021020', name: 'Pooja Joshi',     email: 'pooja@gmail.com',  phone: '7654321098', branch: 'BCCA',                year: 'Final Year', div: 'B', cgpa: '6.9', backlogs: '1', ssc: '76.0', hsc: '72.5', status: 'Interning',skills: 'HTML, CSS, JavaScript',                  address: 'Nagpur, MH',  createdAt: new Date().toISOString() },
      { id: sId5, prn: 'IT2021015',   name: 'Vivek Thakre',    email: 'vivek@gmail.com',  phone: '6543210987', branch: 'Information Technology',year:'Final Year', div: 'A', cgpa: '7.4', backlogs: '0', ssc: '81.0', hsc: '77.0', status: 'Seeking',  skills: 'C++, Data Structures, Python',           address: 'Amravati, MH',createdAt: new Date().toISOString() }
    ]);

    DB.set('internships', [
      ...DB.get('internships'),
      { id: DB.id(), studentId: sId4, companyId: cId1, role: 'Frontend Developer Intern', stipend: '12000', start: '2025-01-06', end: '2025-04-30', mode: 'Hybrid',    status: 'Ongoing',   remarks: 'Performing well' },
      { id: DB.id(), studentId: sId1, companyId: cId3, role: 'Software Intern',           stipend: '18000', start: '2024-06-01', end: '2024-11-30', mode: 'In-Office', status: 'Completed', remarks: 'Received PPO' }
    ]);

    DB.set('placements', [
      ...DB.get('placements'),
      { id: DB.id(), studentId: sId1, companyId: cId3, role: 'Software Engineer', ctc: '6.5', type: 'PPO (Pre-Placement Offer)', offerDate: '2024-11-15', joinDate: '2025-07-01', location: 'Pune',      remarks: '' },
      { id: DB.id(), studentId: sId2, companyId: cId2, role: 'Systems Engineer',  ctc: '4.5', type: 'On-Campus',                  offerDate: '2024-12-10', joinDate: '2025-06-15', location: 'Bangalore', remarks: '' },
      { id: DB.id(), studentId: sId3, companyId: cId1, role: 'Software Engineer', ctc: '8.0', type: 'On-Campus',                  offerDate: '2024-11-20', joinDate: '2025-07-01', location: 'Pune',      remarks: 'Shortlisted for advanced batch' }
    ]);

    logActivity('Sample data loaded successfully', '#3fb950');
    updateBadges();
    toast('Sample data loaded! Explore the modules.', 'success');
  });
}

/* ══════════════════════════════════════
   INITIALISE
══════════════════════════════════════ */
function init() {
  if (!DB.get('users').length) {
    DB.set('users', [{
      id:        DB.id(),
      name:      'Admin User',
      username:  'admin',
      role:      'Admin',
      dept:      'Placement Cell',
      email:     'admin@raisoni.net',
      status:    'Active',
      lastLogin: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    }]);
  }
  updateBadges();
  navigate('dashboard');
}

init();