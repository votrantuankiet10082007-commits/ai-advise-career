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

let market;
let commentVersion = 0;
let evaluationVersion = 0;
const tracks = {
  SOFTWARE_ENGINEERING: 'Phát triển phần mềm', DATA_AND_AI: 'Dữ liệu và AI',
  SYSTEM_AND_SECURITY: 'Hệ thống và bảo mật', PRODUCT_AND_DESIGN: 'Sản phẩm và thiết kế'
};
const number = new Intl.NumberFormat('vi-VN');
const money = role => `${number.format(role.entrySalaryMinVnd / 1e6)}–${number.format(role.entrySalaryMaxVnd / 1e6)}`;

function drawSalary(roles) {
  const peak = Math.max(1, ...roles.map(role => role.entrySalaryMaxVnd));
  const svgNs = 'http://www.w3.org/2000/svg';
  return roles.map(role => {
    const figure = el('figure');
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 40 100');
    svg.setAttribute('aria-hidden', 'true');
    const bar = document.createElementNS(svgNs, 'rect');
    const height = 100 * role.entrySalaryMaxVnd / peak;
    for (const [key, value] of Object.entries({ x: 5, width: 30, y: 100 - height, height, rx: 3 })) bar.setAttribute(key, value);
    svg.append(bar);
    figure.append(svg, el('figcaption', `${role.titleVi} · ${money(role)} triệu`));
    return figure;
  });
}

function render() {
  commentVersion++;
  evaluationVersion++;
  $('matches').replaceChildren();
  $('evaluate-status').textContent = '';
  const track = $('track').value;
  const roles = market.roles.filter(role => !track || role.track === track);
  roles.sort((a, b) => $('sort').value === 'weeks' ? a.learningCurveWeeks - b.learningCurveWeeks : b.entrySalaryMaxVnd - a.entrySalaryMaxVnd);
  $('roles').replaceChildren(...roles.map(role => {
    const row = el('tr');
    const title = el('th', role.titleVi);
    title.scope = 'row';
    row.append(title, el('td', tracks[role.track] || role.track), el('td', money(role)), el('td', role.learningCurveWeeks));
    return row;
  }));
  $('salary-chart').replaceChildren(...drawSalary(roles));
  const skills = (track ? market.skillsByTrack[track] : market.topSkills).slice(0, 8);
  $('skills-chart').replaceChildren(...skills.map(skill => {
    const item = el('li', `${skill.skillKey} · ${skill.roleCount} nghề · trọng số ${number.format(skill.weight)}`);
    const bar = el('progress');
    bar.max = skills[0].weight;
    bar.value = skill.weight;
    bar.setAttribute('aria-label', 'Trọng số ' + skill.skillKey);
    item.append(bar);
    return item;
  }));
  $('comment-status').textContent = '';
}
$('filters').addEventListener('submit', event => event.preventDefault());
$('filters').addEventListener('change', render);
$('comment').addEventListener('click', () => {
  const version = ++commentVersion;
  run($('comment-status'), $('comment'), async () => {
    try {
      const result = await api('market/comment', 'POST', { track: $('track').value });
      if (version === commentVersion) $('comment-status').textContent = `${result.summary} Nguồn: ${result.source}. Phương thức: ${result.provider}.`;
    } catch (error) {
      if (version === commentVersion) throw error;
    }
  });
});
$('evaluate').addEventListener('submit', event => {
  event.preventDefault();
  const version = ++evaluationVersion;
  $('matches').replaceChildren();
  run($('evaluate-status'), event.currentTarget.querySelector('button'), async () => {
    const skills = Array.from($('skill-select').selectedOptions, option => ({ skillKey: option.value, level: 3 }));
    const track = $('track').value;
    try {
      const { rankings } = await api('evaluate', 'POST', { student: { skills, primaryInterests: track ? [track] : [] } });
      if (version !== evaluationVersion) return;
      const results = rankings.filter(role => !track || role.track === track).slice(0, 3);
      $('matches').replaceChildren(...results.map(role => el('li', `${role.roleTitleVi} · ${role.overallMatchPercent}%`)));
      $('evaluate-status').textContent = results.length ? 'Các nghề phù hợp nhất trong nhóm đang xem.' : 'Chưa có kết quả.';
    } catch (error) {
      if (version === evaluationVersion) throw error;
    }
  });
});

getSession().catch(() => {});
run($('market-status'), null, async () => {
  market = await api('market');
  if (!market.roles.length) {
    $('market-status').textContent = 'Danh mục chưa có nghề.';
    return;
  }
  for (const track of market.tracks) $('track').add(new Option(tracks[track] || track, track));
  const skills = [...market.topSkills].sort((a, b) => a.skillKey.localeCompare(b.skillKey));
  for (const skill of skills) $('skill-select').add(new Option(skill.skillKey, skill.skillKey));
  $('comment').textContent = market.aiAvailable ? 'AI nhận xét' : 'Xem nhận xét';
  $('market-status').textContent = `Cập nhật danh mục: ${market.updatedAt.split('-').reverse().join('/')} · Nguồn: ${market.source}.`;
  $('market-content').hidden = false;
  render();
}, 'Đang tải danh mục…');
