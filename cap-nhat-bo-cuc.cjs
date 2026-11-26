const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const site = 'stitch_ai_career_advisor';
const asset = site + '/assets/layout.css';
const stylesheet = '<link rel="stylesheet" href="/' + asset + '">';
const css = `@media screen {
  :root {
    --layout-gap: clamp(1rem, 2.6vw, 2rem);
    --layout-section: clamp(1.75rem, 4vw, 3rem);
    --layout-padding: clamp(1rem, 2.6vw, 1.75rem);
  }

  body { line-height: 1.6; }
  .wrap { width: min(1160px, calc(100% - clamp(2rem, 6vw, 4rem))); }
  main.wrap { padding-block: var(--layout-section); }
  main.wrap > section + section { margin-block-start: var(--layout-section); }
  main .intro { padding: 0 0 var(--layout-section); }
  main .intro .lead { max-width: 62ch; }

  main h1, main .intro h1, main.page h1 {
    font-size: clamp(1.85rem, 4.8vw, 3.25rem);
    line-height: 1.13;
    letter-spacing: -.035em;
    overflow-wrap: anywhere;
    margin-block: 0 1.25rem;
  }
  main h2 { line-height: 1.25; margin-block: 0 .75rem; }
  main h3 { line-height: 1.35; }
  main p { overflow-wrap: anywhere; }
  :is(.panel, .jobs-panel, .jobs-card, .account-menu) > :last-child { margin-block-end: 0; }
  :is(.panel, .jobs-panel, .jobs-card, .account-menu) { padding: var(--layout-padding); }

  .top .nav { gap: .5rem 1.5rem; padding-block: .65rem; }
  .top nav { gap: .25rem .9rem; min-width: 0; }
  .top nav a { display: inline-block; padding-block: .3rem; }
  .top .mark { overflow: hidden; }
  .top .brand { min-width: 0; }
  .top .jobs-search { gap: .625rem; padding-block: 0 .75rem; }
  .jobs-search input { min-width: 0; }
  .jobs-search button { flex: 0 0 auto; white-space: nowrap; }

  :is(.workspace, .cv-workspace, .account-layout, .price-grid, .jobs-grid) {
    gap: var(--layout-gap);
  }
  :is(.workspace, .cv-workspace, .account-layout, .price-grid, .jobs-grid) > * { min-width: 0; }
  #careers { gap: .75rem; }
  .jobs-panel details + details { margin-block-start: .65rem; }
  .jobs-panel summary { overflow-wrap: anywhere; }
  .jobs-card { overflow-wrap: anywhere; }

  form fieldset { min-inline-size: 0; }
  :is(main, dialog) form label { gap: .4rem; margin-block: .75rem .5rem; }
  main .actions { gap: .625rem; margin-block: 1rem; }
  .editor > section, .editor fieldset + fieldset { margin-block-start: 1.5rem; }
  .cv-entry + .cv-entry { margin-block-start: 1rem; }
  .preview .paper { padding: var(--layout-padding); }
  .table-scroll { max-width: 100%; }
  dialog { max-height: calc(100dvh - 2rem); overflow: auto; }
  #payment-details dt, #payment-details dd { overflow-wrap: anywhere; }
  #payment-details dd { min-width: 0; }
  .footer { margin-block-start: var(--layout-section); }

  @media (max-width: 820px) {
    .top .nav { flex-wrap: wrap; }
    :is(.workspace, .cv-workspace, .account-layout) { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 560px) {
    .top .nav { gap: .3rem .75rem; min-height: 0; }
    .top nav { gap: 0 .75rem; font-size: .875rem; }
    .top .jobs-search button { padding-inline: .65rem; }
    .price-grid, #careers, .salary-chart { grid-template-columns: minmax(0, 1fr); }
    .cv-workspace .preview { min-width: 0; }
  }
}
`;

const serverFile = path.join(root, 'server.js');
const marker = 'const assets = new Map([';
let server = fs.readFileSync(serverFile, 'utf8');
if (!server.includes(marker)) throw new Error('Không tìm thấy phần khai báo tài nguyên trong server.js.');
const updates = new Map();
if (!server.includes("'/" + asset + "'")) {
  const entry = "  ['/" + asset + "', ['" + asset + "', 'text/css']],";
  server = server.replace(marker, marker + (server.includes('\r\n') ? '\r\n' : '\n') + entry);
  updates.set(serverFile, server);
}

for (const directory of fs.readdirSync(path.join(root, site), { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const file = path.join(root, site, directory.name, 'code.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes(stylesheet)) continue;
  if (!/<\/head>/i.test(html)) throw new Error('Không tìm thấy thẻ head trong ' + directory.name);
  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  updates.set(file, html.replace(/<\/head>/i, '  ' + stylesheet + newline + '</head>'));
}
updates.set(path.join(root, asset), css);
for (const [file, content] of updates) fs.writeFileSync(file, content, 'utf8');
console.log('Đã cập nhật bố cục các trang.');
