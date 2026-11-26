const $ = id => document.getElementById(id);

function el(tag, value) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  return node;
}

async function api(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch('/api/' + path, {
      method, headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('Không kết nối được máy chủ.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Yêu cầu không thành công.'), { status: response.status });
  return data;
}

async function run(status, button, action, loading = 'Đang xử lý…') {
  if (button) button.disabled = true;
  status.textContent = loading;
  try {
    await action();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    if (button) button.disabled = false;
  }
}

function displaySession(user) {
  $('session-status').textContent = user ? user.name : 'Chưa đăng nhập';
  $('nav-logout').hidden = !user;
}

async function getSession() {
  $('session-status').textContent = 'Đang kiểm tra phiên…';
  try {
    const { user } = await api('profile');
    displaySession(user);
    return user;
  } catch (error) {
    if (error.status === 401) {
      displaySession(null);
      return null;
    }
    $('session-status').textContent = error.message;
    throw error;
  }
}

$('nav-logout').addEventListener('click', () => run($('session-status'), $('nav-logout'), async () => {
  await api('auth/logout', 'POST');
  location.reload();
}, 'Đang đăng xuất…'));

const form = $('cv-form');
const draftKey = 'ai-advise-career.cv.v1';
const sections = {
  education: ['Học vấn', { school: 'Trường', degree: 'Bằng cấp / Ngành học', period: 'Thời gian' }],
  skills: ['Kỹ năng', { group: 'Nhóm kỹ năng', items: 'Kỹ năng (phân cách bằng dấu phẩy)' }],
  projects: ['Dự án', { name: 'Tên dự án', stack: 'Công nghệ (phân cách bằng dấu phẩy)', action: 'Phần việc đã thực hiện', result: 'Kết quả thực tế', description: 'Mô tả trong CV (tùy chọn)' }],
  experience: ['Kinh nghiệm', { company: 'Đơn vị', role: 'Vị trí', period: 'Thời gian', details: 'Công việc đã làm' }],
  certificates: ['Chứng chỉ', { title: 'Tên chứng chỉ', issuer: 'Đơn vị cấp', date: 'Ngày cấp' }]
};
const optionalSections = new Set(['projects', 'experience', 'certificates']);
const longFields = new Set(['items', 'action', 'result', 'details', 'description']);
let session;
let roleId = '';
let generated;
let edited = 0;
let aiPending = false;
let storageReady = false;
const containers = new Map();
const safeString = value => typeof value === 'string' ? value : '';

function fields(node) {
  return Object.fromEntries([...node.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value.trim()]));
}

function readCv() {
  const cv = fields(form.querySelector('fieldset'));
  cv.targetRoleId = roleId;
  for (const [key, rows] of containers) cv[key] = [...rows.children].map(fields).filter(row => Object.values(row).some(Boolean));
  return cv;
}

function paint() {
  const paper = $('paper');
  const cv = readCv();
  const contact = [cv.email, cv.phone, cv.location, cv.links].filter(Boolean).join(' · ');
  paper.replaceChildren();
  if (cv.name) paper.append(el('h2', cv.name));
  if (contact) paper.append(el('p', contact));
  const objective = generated?.objective ?? cv.objective;
  if (objective) paper.append(el('h3', 'Mục tiêu nghề nghiệp'), el('p', objective));
  for (const [key, [title]] of Object.entries(sections)) {
    if (!cv[key].length) continue;
    paper.append(el('h3', title));
    cv[key].forEach((row, index) => {
      const item = el('div');
      item.className = 'row';
      if (key === 'projects') {
        if (row.name) item.append(el('strong', row.name));
        if (row.stack) item.append(el('p', row.stack));
        const description = generated?.projectDescriptions[index] || row.description || [row.action, row.result].filter(Boolean).join('\n');
        if (description) item.append(el('p', description));
      } else {
        const values = Object.values(row).filter(Boolean);
        item.append(el('strong', values[0]));
        for (const value of values.slice(1)) item.append(el('p', value));
      }
      paper.append(item);
    });
  }
  if (!paper.childElementCount) paper.append(el('p', 'Nhập thông tin để xem CV.'));
}

function changed() {
  edited++;
  generated = undefined;
  $('apply-objective').hidden = true;
  $('apply-projects').hidden = true;
  $('keywords').hidden = true;
  $('suggestions').replaceChildren();
  if (!aiPending) $('ai-status').textContent = '';
  paint();
}

function button(label, handler) {
  const control = el('button', label);
  control.type = 'button';
  control.className = 'outline';
  control.addEventListener('click', handler);
  return control;
}

function addRow(key, values = {}) {
  const rows = containers.get(key);
  if (rows.childElementCount >= 10) return;
  const row = el('div');
  row.className = 'cv-entry';
  for (const [name, label] of Object.entries(sections[key][1])) {
    const wrapper = el('label', label);
    const input = el(longFields.has(name) ? 'textarea' : 'input');
    input.dataset.field = name;
    input.maxLength = name === 'description' ? 840 : longFields.has(name) ? 400 : 120;
    input.value = safeString(values?.[name]).slice(0, input.maxLength);
    if (key === 'skills') {
      input.placeholder = name === 'group'
        ? 'Ví dụ: Lập trình, Làm việc nhóm, Công cụ'
        : 'Ví dụ: Docker, OOP, Java, C++';
    }
    wrapper.append(input);
    row.append(wrapper);
  }
  const actions = el('div');
  actions.className = 'actions';
  actions.append(
    button('Lên', () => { if (row.previousElementSibling) { row.previousElementSibling.before(row); changed(); } }),
    button('Xuống', () => { if (row.nextElementSibling) { row.nextElementSibling.after(row); changed(); } }),
    button('Xóa mục', () => { row.remove(); rows.nextElementSibling.disabled = false; changed(); })
  );
  row.append(actions);
  rows.append(row);
  rows.nextElementSibling.disabled = rows.childElementCount >= 10;
  return row;
}

for (const [key, [title]] of Object.entries(sections)) {
  const fieldset = el('fieldset');
  const rows = el('div');
  containers.set(key, rows);
  fieldset.append(el('legend', optionalSections.has(key) ? title + ' (tùy chọn)' : title), rows, button('Thêm mục', () => {
    const row = addRow(key);
    row?.querySelector('input, textarea').focus();
    changed();
  }));
  $('sections').append(fieldset);
}

function restore(cv) {
  roleId = safeString(cv?.targetRoleId);
  for (const input of form.querySelector('fieldset').querySelectorAll('[data-field]')) {
    input.value = safeString(cv?.[input.dataset.field]);
  }
  for (const [key, rows] of containers) {
    rows.replaceChildren();
    rows.nextElementSibling.disabled = false;
    if (Array.isArray(cv?.[key])) for (const item of cv[key].slice(0, 10)) addRow(key, item);
  }
  changed();
}

form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('input', event => {
  if (event.target === $('roles')) roleId = $('roles').value;
  changed();
});
$('apply-objective').addEventListener('click', () => {
  if (!generated?.objective) return;
  form.querySelector('[data-field="objective"]').value = generated.objective.slice(0, 500);
  paint();
  $('apply-objective').hidden = true;
});

$('apply-projects').addEventListener('click', () => {
  if (!generated) return;
  const rows = [...containers.get('projects').children].filter(row => Object.values(fields(row)).some(Boolean));
  rows.forEach((row, index) => {
    const description = generated.projectDescriptions[index];
    if (description) row.querySelector('[data-field="description"]').value = description;
  });
  $('apply-projects').hidden = true;
  paint();
});

function setAiResult(result, generate) {
  if (generate) {
    generated = result;
    $('apply-objective').hidden = !result.objective || result.objective === readCv().objective;
    $('apply-projects').hidden = !result.projectDescriptions.some(Boolean);
    $('keywords').hidden = false;
    $('keywords').textContent = result.atsKeywords.length ? 'Từ khóa ATS từ kỹ năng đã nhập: ' + result.atsKeywords.join(', ') : 'Chưa có từ khóa khớp vị trí mục tiêu.';
    paint();
  }
  $('suggestions').replaceChildren(...result.suggestions.map(item => el('li', item)));
  $('ai-status').textContent = generate ? `Đã cập nhật bản xem trước · ${result.provider}. Kiểm tra lại trước khi xuất.` : result.summary;
}

for (const mode of ['generate', 'review']) {
  $(mode).addEventListener('click', () => {
    if (mode === 'generate') {
      if (!form.reportValidity()) return;
      if (!readCv().name) {
        $('ai-status').textContent = 'Hãy nhập họ tên.';
        form.querySelector('[data-field="name"]').focus();
        return;
      }
    }
    const version = edited;
    aiPending = true;
    $('generate').disabled = $('review').disabled = true;
    $('suggestions').replaceChildren();
    run($('ai-status'), null, async () => {
      try {
        const result = await api('ai/cv-' + mode, 'POST', { cv: readCv(), consent: $('consent').checked });
        if (version !== edited) {
          $('ai-status').textContent = 'CV đã thay đổi. Hãy chạy lại để dùng bản mới nhất.';
          return;
        }
        setAiResult(result, mode === 'generate');
      } finally {
        aiPending = false;
        $('generate').disabled = $('review').disabled = false;
      }
    });
  });
}

function setStorageButtons(disabled) {
  $('save').disabled = $('delete').disabled = disabled;
}

$('save').addEventListener('click', () => {
  if (!storageReady) return;
  setStorageButtons(true);
  run($('save-status'), null, async () => {
    try {
      const cv = readCv();
      if (!Object.values(cv).some(value => Array.isArray(value) ? value.length : value)) {
        $('save-status').textContent = 'Nhập thông tin trước khi lưu.';
        return;
      }
      if (session) await api('cv', 'PUT', { cv });
      else {
        try { localStorage.setItem(draftKey, JSON.stringify(cv)); }
        catch { throw new Error('Không lưu được bản nháp trong trình duyệt.'); }
      }
      $('save-status').textContent = 'Đã lưu dữ liệu CV.';
    } finally {
      setStorageButtons(false);
    }
  });
});
$('delete').addEventListener('click', () => {
  if (!storageReady || !window.confirm('Xóa bản CV đã lưu? Nội dung đang chỉnh sửa vẫn ở trên trang.')) return;
  setStorageButtons(true);
  run($('save-status'), null, async () => {
    try {
      if (session) await api('cv', 'DELETE');
      else {
        try { localStorage.removeItem(draftKey); }
        catch { throw new Error('Không xóa được bản nháp trong trình duyệt.'); }
      }
      $('save-status').textContent = 'Đã xóa bản lưu.';
    } finally {
      setStorageButtons(false);
    }
  });
});

$('print').addEventListener('click', () => window.print());
$('json').addEventListener('click', () => {
  const output = { ...readCv() };
  if (generated) {
    output.generated = { objective: generated.objective, projectDescriptions: generated.projectDescriptions, atsKeywords: generated.atsKeywords };
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
  const link = el('a');
  link.href = url;
  link.download = 'cv.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

run($('roles-status'), null, async () => {
  const { data } = await api('careers');
  for (const role of data) $('roles').add(new Option(role.titleVi, role.id));
  $('roles').value = roleId;
  $('roles-status').textContent = data.length ? '' : 'Chưa có vị trí trong danh mục.';
}, 'Đang tải danh mục nghề…');
run($('save-status'), null, async () => {
  try {
    const version = edited;
    session = await getSession();
    $('save-mode').textContent = session ? 'Lưu vào tài khoản của bạn.' : 'Bản nháp khách lưu trong trình duyệt này.';
    const stored = session ? (await api('cv')).cv : JSON.parse(localStorage.getItem(draftKey) || 'null');
    const keptEdits = edited !== version;
    if (stored && !keptEdits) restore(stored);
    storageReady = true;
    setStorageButtons(false);
    $('save-status').textContent = stored ? (keptEdits ? 'Đã giữ nội dung đang nhập.' : 'Có bản CV đã lưu.') : 'Chưa có bản CV đã lưu.';
  } catch (error) {
    $('save-mode').textContent = 'Chưa xác định được bản lưu.';
    if (!session && (error instanceof SyntaxError || error.name === 'SecurityError')) {
      storageReady = true;
      setStorageButtons(false);
      throw new Error('Không đọc được bản nháp trong trình duyệt.');
    }
    throw error;
  }
}, 'Đang tải bản CV…');
paint();
