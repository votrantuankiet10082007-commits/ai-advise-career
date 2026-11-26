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

const credentials = $('credentials');
const profile = $('profile');
const password = credentials.elements.password;
const submit = credentials.querySelector('[type=submit]');
let register = false;

function setTab(value) {
  register = value;
  $('login-tab').setAttribute('aria-selected', String(!value));
  $('register-tab').setAttribute('aria-selected', String(value));
  $('login-tab').tabIndex = value ? -1 : 0;
  $('register-tab').tabIndex = value ? 0 : -1;
  credentials.setAttribute('aria-labelledby', value ? 'register-tab' : 'login-tab');
  $('name-field').hidden = !value;
  credentials.elements.name.required = value;
  password.minLength = value ? 8 : 0;
  password.autocomplete = value ? 'new-password' : 'current-password';
  submit.textContent = value ? 'Đăng ký' : 'Đăng nhập';
  $('status').textContent = '';
}
setTab(false);
for (const id of ['login-tab', 'register-tab']) {
  $(id).addEventListener('click', () => setTab(id === 'register-tab'));
  $(id).addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setTab(event.key === 'End' || (event.key !== 'Home' && !register));
    $(register ? 'register-tab' : 'login-tab').focus();
  });
}
$('visibility').addEventListener('click', () => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  $('visibility').textContent = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
  $('visibility').setAttribute('aria-pressed', String(show));
});

function renderProfile(user) {
  $('guest').hidden = Boolean(user);
  profile.hidden = !user;
  if (!user) return;
  $('identity-name').textContent = user.name;
  $('identity-detail').textContent = user.premium ? 'Thành viên Premium' : 'Thành viên';
  const initials = user.name.trim().split(/\s+/).slice(-2).map(word => [...word][0]).join('').toUpperCase();
  const avatars = { laptop: '💻', rocket: '🚀', robot: '🤖' };
  $('avatar').textContent = avatars[user.avatar] || initials;
  $('public-id').textContent = user.publicId;
  const isPhoto = user.avatar?.startsWith('data:image/jpeg;base64,');
  if (isPhoto) {
    const image = document.createElement('img');
    image.src = user.avatar;
    image.alt = 'Ảnh đại diện';
    $('avatar').replaceChildren(image);
  }
  profile.elements.avatar.value = isPhoto ? 'photo' : user.avatar || 'initials';
  $('avatar-file').value = '';
  $('profile-email').textContent = user.email;
  $('tier').textContent = user.premium ? 'Premium đang hoạt động' : 'Gói hiện tại: Miễn phí';
  for (const key of ['name', 'university', 'role', 'targetSpecialty', 'facebook', 'linkedin', 'github', 'projectUrl']) profile.elements[key].value = user[key] || '';
}

credentials.addEventListener('submit', event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(credentials));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email) ||
      (register && (!data.name.trim() || data.password.length < 8 || data.password.length > 128 ||
        !/\p{L}/u.test(data.password) || !/[0-9]/.test(data.password) || !/[^\p{L}\p{N}\p{M}\s]/u.test(data.password)))) {
    $('status').textContent = register ? 'Mật khẩu cần 8–128 ký tự, gồm chữ cái, số và ký tự đặc biệt. Hãy kiểm tra cả họ tên và email.' : 'Kiểm tra email và mật khẩu.';
    return;
  }
  run($('status'), submit, async () => {
    await api(register ? 'auth/register' : 'auth/login', 'POST', data);
    credentials.reset();
    renderProfile(await getSession());
    $('status').textContent = '';
  });
});
$('avatar-file').addEventListener('change', event => {
  if (event.target.files.length) profile.elements.avatar.value = 'photo';
});

async function encodeAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB.');
  }
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh đã chọn.');
  }
  try {
    const side = Math.min(image.width, image.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 128, 128);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2,
      side, side, 0, 0, 128, 128);
    return canvas.toDataURL('image/jpeg', 0.65);
  } finally {
    image.close();
  }
}

profile.addEventListener('submit', event => {
  event.preventDefault();
  run($('status'), profile.querySelector('[type=submit]'), async () => {
    const data = Object.fromEntries(new FormData(profile));
    if (data.avatar === 'photo') {
      const file = $('avatar-file').files[0];
      if (file) data.avatar = await encodeAvatar(file);
      else if ($('avatar').querySelector('img')) delete data.avatar;
      else throw new Error('Hãy chọn ảnh từ máy tính.');
    }
    const { user } = await api('profile', 'PUT', data);
    displaySession(user);
    renderProfile(user);
    $('status').textContent = 'Đã lưu hồ sơ.';
  });
});
run($('status'), null, async () => {
  renderProfile(await getSession());
  $('status').textContent = '';
}, 'Đang tải tài khoản…');

function showSettings(open) {
  $('profile-panel').hidden = open;
  $('settings-panel').hidden = !open;
  $('show-settings').setAttribute('aria-pressed', String(open));
  $('show-profile').setAttribute('aria-pressed', String(!open));
}
$('show-settings').onclick = () => showSettings(true);
$('show-profile').onclick = () => showSettings(false);
const storageKey = 'career.account.display';
function applySettings(save) {
  document.documentElement.dataset.theme = $('theme').value;
  document.documentElement.dataset.size = $('size').value;
  if (!save) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ theme: $('theme').value, size: $('size').value }));
    $('settings-status').textContent = 'Đã lưu cài đặt.';
  } catch { $('settings-status').textContent = 'Đã áp dụng cho lần mở trang này.'; }
}
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (['light','dark','system'].includes(saved?.theme)) $('theme').value = saved.theme;
  if (saved?.size === 'large') $('size').value = 'large';
} catch {}
applySettings(false);
for (const id of ['theme','size']) $(id).onchange = () => applySettings(true);
$('reset-settings').onclick = () => {
  $('theme').value = 'light';
  $('size').value = 'normal';
  applySettings(true);
};
