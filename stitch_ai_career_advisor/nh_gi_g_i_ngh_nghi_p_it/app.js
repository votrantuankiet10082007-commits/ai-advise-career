const $ = id => document.getElementById(id);
let user = null;

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text ?? '';
  if (className) node.className = className;
  return node;
}

async function api(path, method = 'GET', input) {
  const res = await fetch('/api/' + path, {
    method,
    headers: input ? { 'Content-Type': 'application/json' } : {},
    body: input ? JSON.stringify(input) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Không thể kết nối máy chủ.'), { status: res.status });
  return data;
}

function setUser(next) {
  if (user?.id !== next?.id || user?.premium !== next?.premium) {
    for (const roadmap of document.querySelectorAll('.roadmap')) roadmap.replaceChildren();
  }
  user = next;
  $('session-status').textContent = user ? user.name : 'Chưa đăng nhập';
  $('nav-logout').hidden = !user;
  $('premium-button').textContent = user?.premium ? 'Premium ✓' : 'Premium';
}

async function refreshUser() {
  try {
    setUser((await api('profile')).user);
  } catch (error) {
    if (error.status !== 401) throw error;
    setUser(null);
  }
}

function readStudent() {
  const skills = $('skills').value.split(',').map(token => {
    const [key, level] = token.trim().split(':');
    return { skillKey: key.trim(), level: level === undefined ? 3 : Number(level) };
  }).filter(skill => skill.skillKey);
  if (skills.some(s => !Number.isInteger(s.level) || s.level < 1 || s.level > 5)) {
    throw new Error('Mức kỹ năng phải là số nguyên từ 1 đến 5.');
  }
  return { skills, primaryInterests: [$('interest').value].filter(Boolean), weeklyAvailableHours: Number($('hours').value) };
}

async function showRoadmap(button, box, student, roleId) {
  button.disabled = true;
  box.textContent = 'Đang tải lộ trình…';
  const owner = user?.id;
  const tier = user?.premium;
  try {
    let plan;
    try {
      plan = await api(tier ? 'premium/roadmap' : 'explain', 'POST', { student, roleId });
    } catch (error) {
      if (!tier || error.status !== 403) throw error;
      plan = await api('explain', 'POST', { student, roleId });
    }
    if (owner !== user?.id || tier !== user?.premium) return;
    const list = element('ol');
    for (const phase of plan.criticalRoadmap) {
      const item = element('li');
      item.append(element('strong', `${phase.phaseTitle} · ${phase.durationWeeks} tuần`));
      for (const milestone of phase.learningMilestones) item.append(element('p', milestone));
      item.append(element('p', phase.proofProjectTitle));
      list.append(item);
    }
    box.replaceChildren(element('p', plan.executiveSummaryVi), list);
  } catch (error) {
    box.replaceChildren(element('p', error.message));
  } finally {
    button.disabled = false;
  }
}

function resultCard(result, student) {
  const card = element('article', '', 'result');
  const header = element('div', '', 'result-head');
  header.append(element('h3', result.roleTitleVi), element('span', result.overallMatchPercent + '%', 'score'));
  const gaps = [...new Set([...result.failedConstraints, ...result.topGaps.map(s => s.skillKey)])];
  const roadmap = element('div', '', 'roadmap');
  roadmap.setAttribute('aria-live', 'polite');
  const button = element('button', 'Xem lộ trình', 'text');
  button.addEventListener('click', () => showRoadmap(button, roadmap, student, result.roleId));
  card.append(header, element('p', gaps.length ? 'Cần bổ sung: ' + gaps.join(', ') : 'Đã đáp ứng các kỹ năng mục tiêu.'), button, roadmap);
  return card;
}

$('assessment').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const status = $('assessment-status');
  status.hidden = false;
  status.textContent = 'Đang đánh giá…';
  button.disabled = true;
  try {
    const student = readStudent();
    const { rankings } = await api('evaluate', 'POST', { student });
    try {
      if (!user) sessionStorage.setItem('career.assessment', JSON.stringify(student));
      else sessionStorage.removeItem('career.assessment');
    } catch {}
    $('results').replaceChildren(...rankings.slice(0, 3).map(result => resultCard(result, student)));
    status.textContent = rankings.length ? '' : 'Chưa có nghề phù hợp để hiển thị.';
    status.hidden = Boolean(rankings.length);
  } catch (error) {
    status.textContent = error.message;
    status.hidden = false;
  } finally {
    button.disabled = false;
  }
});

async function loadCareers() {
  const box = $('careers');
  box.textContent = 'Đang tải danh mục…';
  try {
    const { data } = await api('careers');
    box.textContent = data.length ? '' : 'Chưa có nghề trong danh mục.';
    for (const career of data) {
      const item = element('details');
      item.append(element('summary', career.titleVi), element('p', career.description),
        element('p', `Khoảng ${career.learningCurveWeeks} tuần · ${career.requiredSkills.map(s => s.skillKey).join(', ')}`));
      box.append(item);
    }
  } catch (error) {
    box.textContent = error.message;
  }
}

loadCareers();
$('nav-logout').addEventListener('click', async () => {
  const button = $('nav-logout');
  button.disabled = true;
  $('session-status').textContent = 'Đang đăng xuất…';
  try {
    await api('auth/logout', 'POST');
    setUser(null);
  } catch (error) {
    $('session-status').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
refreshUser().catch(error => { $('session-status').textContent = error.message; });
if (location.hash === '#premium') location.replace('/stitch_ai_career_advisor/premium/code.html');
