const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const directory = 'stitch_ai_career_advisor';
const shared = directory + '/assets';
const account = directory + '/dang_nhap_tai_khoan';
const scriptPath = shared + '/display-theme.js';
const stylePath = shared + '/display-theme.css';

const themeScript = `(() => {
  const key = 'career.account.display';
  const validThemes = ['light', 'dark', 'system'];

  function syncTheme() {
    let theme = 'light';
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (validThemes.includes(saved?.theme)) theme = saved.theme;
    } catch {
      // Keep the page's default theme when storage is unavailable.
      if (document.documentElement.dataset.theme) return;
    }
    document.documentElement.dataset.theme = theme;
    const picker = document.getElementById('theme');
    if (picker) picker.value = theme;
  }

  syncTheme();
  window.addEventListener('pageshow', event => {
    if (event.persisted) syncTheme();
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) syncTheme();
  });
})();
`;

const darkColors = `color-scheme: dark;
    --canvas: #181c30;
    --ink: #eef0ff;
    --muted: #c6cada;
    --line: #515772;
    --primary: #aebaff;
    --primary-hover: #454e9d;
    --accent: #303858;
    --surface: #242940;`;

const themeStyle = `@media screen {
  :root[data-theme="dark"] {
    ${darkColors}
  }

  :root[data-theme="dark"] {
    color: var(--ink);
    background: var(--canvas);
  }

  :root[data-theme="dark"] :is(.top, .panel, .outline, input, textarea, select, details, dialog) {
    background: var(--surface);
  }

  :root[data-theme="dark"] .top {
    color: var(--ink);
  }

  :root[data-theme="dark"] :is(.primary, [role="tab"][aria-selected="true"], .tabs [aria-pressed="true"]) {
    background: #343f88;
    color: #fff;
  }

  :root[data-theme="dark"] .primary:hover {
    background: var(--primary-hover);
  }

  :root[data-theme="dark"] #cancel-payment {
    color: #ffaea6;
  }

  :root[data-theme="dark"] .paper {
    color: #191e34;
  }

  :root[data-theme="dark"] .redirect-page {
    background: var(--canvas) !important;
  }
}
`;

const files = new Map();
function update(relative, transform) {
  const fullPath = path.join(root, relative);
  const original = fs.readFileSync(fullPath, 'utf8');
  files.set(fullPath, transform(original));
}

function includeTheme(html, relative) {
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  let updated = html;
  if (!updated.includes('"/' + scriptPath + '"')) {
    updated = updated.replace(/<head\b[^>]*>/i, match =>
      match + eol + '  <script src="/' + scriptPath + '"></script>');
  }
  if (!updated.includes('"/' + stylePath + '"')) {
    updated = updated.replace(/^([ \t]*)<\/head>/im, (_, indent) =>
      indent + '  <link rel="stylesheet" href="/' + stylePath + '">' + eol + indent + '</head>');
  }
  if (!updated.includes('"/' + scriptPath + '"') || !updated.includes('"/' + stylePath + '"')) {
    throw new Error('Không tìm được thẻ head trong ' + relative);
  }
  return updated;
}

try {
  update('server.js', source => {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const marker = 'const assets = new Map([';
    if (!source.includes(marker)) throw new Error('Không tìm thấy danh sách tài nguyên trong server.js.');
    const assets = [[scriptPath, 'text/javascript'], [stylePath, 'text/css']]
      .filter(([file]) => !source.includes("'/" + file + "'"))
      .map(([file, mime]) => "  ['/" + file + "', ['" + file + "', '" + mime + "']],");
    return assets.length ? source.replace(marker, marker + eol + assets.join(eol)) : source;
  });

  const pages = ['nh_gi_g_i_ngh_nghi_p_it', 'thi_truong_nganh_it', 'chinh_sua_cv_ai', 'dang_nhap_tai_khoan', 'premium'];
  for (const name of pages) {
    const relative = directory + '/' + name + '/code.html';
    update(relative, source => includeTheme(source.replace(
      'Áp dụng cho trang tài khoản trên trình duyệt này.',
      'Áp dụng cho tất cả các trang trên trình duyệt này.'
    ), relative));
  }
  update('index.html', source => includeTheme(source.replace(/<body(?=\s|>)(?![^>]*\bclass=)/i,
    '<body class="redirect-page"'), 'index.html'));

  update(account + '/style.css', source => source.replace(
    /\.top\s*,\s*(?=\.panel\s*,\s*input\s*,\s*select\s*,\s*\.outline\s*\{\s*background\s*:\s*var\(--surface)/g,
    ''
  ));

  // Convert the OS preference into a theme for the shared CSS while keeping
  // "system" selected in the account form and stored in localStorage.
  const systemStyle = themeStyle.replaceAll(':root[data-theme="dark"]', ':root[data-theme="system"]');
  files.set(path.join(root, scriptPath), themeScript);
  files.set(path.join(root, stylePath), themeStyle + systemStyle.replace('@media screen {', '@media screen and (prefers-color-scheme: dark) {'));

  for (const [file, contents] of files) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== contents) {
      fs.writeFileSync(file, contents, 'utf8');
    }
  }
  console.log('Đã đồng bộ giao diện trên tất cả các trang. Hãy khởi động lại server.');
} catch (error) {
  console.error('Cập nhật thất bại: ' + error.message);
  process.exitCode = 1;
}
