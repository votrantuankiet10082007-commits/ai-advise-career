const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const dir = 'stitch_ai_career_advisor';
const home = 'nh_gi_g_i_ngh_nghi_p_it';
const url = '/' + dir + '/tra_cuu_nghe/code.html';
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const writes = new Map();
const records = [];
let group;
for (const row of fs.readFileSync(path.join(__dirname,'roles.txt'),'utf8').trim().split(/\r?\n/)) {
  const [name,description,skills] = row.split('|');
  if (description) records.push({group,name,description,skills});
  else group = name;
}
const groups = [...new Set(records.map(r=>r.group))];
const cssUrl = '/' + dir + '/assets/jobs.css';
const form = '<form class="jobs-search wrap" role="search" action="'+url+'"><input name="q" type="search" aria-label="Tìm công việc IT" placeholder="Tìm nghề, kỹ năng hoặc nhóm nghề…"><button>Tìm nghề</button></form>';
const link = name => url+'?q='+encodeURIComponent(name);
const source = '<a href="https://marketing.itviec.com/insight_article_q3_2026">ITviec · Quý III/2026</a>';
function addShared(html) {
  if (!html.includes(cssUrl)) html=html.replace('</head>','<link rel="stylesheet" href="'+cssUrl+'"></head>');
  if (!html.includes('class="jobs-search')) html=html.replace('</header>',form+'</header>');
  return html;
}
const pages = fs.readdirSync(path.join(root,dir)).filter(p=>p!=='tra_cuu_nghe' && fs.existsSync(path.join(root,dir,p,'code.html')));
let lookup;
for (const page of pages) {
  const file = dir+'/'+page+'/code.html';
  let html=addShared(read(file));
  if (!html.includes('class="jobs-search')) throw Error('Thiếu header: '+file);
  if (page===home) {
    lookup=html.slice(0,html.indexOf('<main')).replace(/<title>.*?<\/title>/s,'<title>Tra cứu nghề IT</title>').replace(/<script[^>]+src="\.\/app.js"[^>]*><\/script>/g,'').replaceAll('href="./style.css"','href="../'+home+'/style.css"').replace(/ aria-current="page"/g,'');
    lookup=lookup.replace(/<span id="session-status"[^>]*>.*?<\/span>/s,'').replace(/<button[^>]*id="nav-logout"[^>]*>.*?<\/button>/s,'');
    if (!html.includes('id="jobs-chart"')) {
      const bars=groups.map(g=>{const roles=records.filter(r=>r.group===g);return '<details><summary>'+g+' <meter aria-label="Số nghề" min="0" max="8" value="'+roles.length+'"></meter> '+roles.length+' nghề</summary><p>'+roles.map(r=>'<a href="'+link(r.name)+'">'+r.name+'</a>').join(' · ')+'</p></details>';}).join('');
      html=html.replace('</main>','<section class="jobs-panel" id="jobs-chart"><h2>Việc làm theo nhóm ngành IT</h2><p>Số chức danh trong danh mục. Chọn một nhóm để xem từng nghề.</p>'+bars+'<h3>Tín hiệu tuyển dụng tại Việt Nam</h3><p>Trong quý I/2026, tỷ lệ tin trên ITviec đề cập đến từng kỹ năng:</p><p>Back-end <meter min="0" max="100" value="33.2"></meter> 33,2%</p><p>Python <meter min="0" max="100" value="18.6"></meter> 18,6%</p><a href="https://marketing.itviec.com/insight-article-q12026">ITviec · Quý I/2026</a><p>Quý III/2026, tỷ trọng tuyển dụng nhóm dữ liệu và AI vẫn cao trong khi tuyển dụng IT nói chung thu hẹp.</p>'+source+'<p><a href="'+url+'">Tra cứu tất cả nghề →</a></p></section></main>');
    }
  }
  if (page===home) html=html.replace(/<h3>Tín hiệu tuyển dụng tại Việt Nam<\/h3>[\s\S]*?(?=<p><a href="[^"]*tra_cuu_nghe)/, '<h3>Tuyển dụng IT theo quý</h3><p>Nguồn: ITviec · Việt Nam</p><div id="jobs-quarters" aria-live="polite"></div><script defer src="/'+dir+'/assets/quarters.js"></script>');
  writes.set(file,html);
}
if (!lookup) throw Error('Thiếu trang đánh giá nghề.');
const cards=records.map(r=>{
  const related=records.filter(v=>v.group===r.group && v!==r).slice(0,3);
  let demand='Báo cáo quý chưa công bố mức tuyển riêng cho chức danh này.';
  if ([groups[1],groups[4]].includes(r.group)) demand='Nhóm Data/AI/ML duy trì tỷ trọng tuyển dụng cao trong quý III/2026. Báo cáo chưa tách số tin cho chức danh này.';
  return '<article class="jobs-card" data-name="'+r.name+'"><small>'+r.group+'</small><h2>'+r.name+'</h2><p>'+r.description+'</p><p><b>Kỹ năng</b> · '+r.skills+'</p><p><b>Nhu cầu nhân sự</b> · '+demand+'</p><p><b>Nghề tương tự</b> · '+related.map(v=>'<a href="'+link(v.name)+'">'+v.name+'</a>').join(' · ')+'</p></article>';
}).join('');
writes.set(url.slice(1),lookup+'<main class="wrap"><h1>Tra cứu nghề IT</h1><p>Nguồn nhu cầu tuyển dụng · ITviec · Quý III/2026</p><p id="jobs-count" role="status"></p><div class="jobs-grid">'+cards+'</div></main><script src="./jobs.js"></script></body></html>');
writes.set(dir+'/tra_cuu_nghe/jobs.js',`const normalize = text => text.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replaceAll('đ','d').replace(/[_/]/g,' ').trim();
const input=document.querySelector('.jobs-search input');
input.value=new URLSearchParams(location.search).get('q') || '';
const q=normalize(input.value);
const cards=[...document.querySelectorAll('.jobs-card')];
const exact=cards.some(card=>normalize(card.dataset.name)===q);
let count=0;
for(const card of cards){
  const text=[...card.children].slice(0,4).map(el=>el.textContent).join(' ');
  card.hidden=exact ? normalize(card.dataset.name)!==q : !q.split(/\\s+/).every(word=>normalize(text).includes(word));
  if (!card.hidden) count++;
}
document.getElementById('jobs-count').textContent=count ? count+' nghề phù hợp' : 'Chưa tìm thấy nghề. Hãy thử tên nghề hoặc kỹ năng khác.';
`);
writes.set(cssUrl.slice(1),`.top{position:sticky;top:0;z-index:10}.jobs-search{display:flex;gap:.5rem;padding-block:.4rem .7rem}.jobs-search input{flex:1;min-width:0}.jobs-search button{background:#1558ae;color:white;border:0;border-radius:6px;padding:0 1rem}.jobs-panel,.jobs-card{background:var(--surface,#fff);color:var(--ink,#182a46);border:1px solid var(--line,#ccdef3);border-radius:12px;padding:1.25rem;margin-block:1rem}.jobs-panel a,.jobs-card a{color:var(--primary,#145aa5)}.jobs-panel meter{width:min(36%,18rem);accent-color:#2068bc}.jobs-panel meter::-webkit-meter-optimum-value{background:#2068bc}.jobs-panel summary{cursor:pointer}.jobs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:1rem}.jobs-card{margin:0}.jobs-card h2{margin:.4rem 0}.jobs-card[hidden]{display:none}@media print{.jobs-search{display:none}}`);
let server=read('server.js');
const marker='const assets = new Map([';
if (!server.includes(marker)) throw Error('Không tìm thấy danh sách tài nguyên của server.');
for(const [file,type] of [[url,'text/html'],[url.replace('code.html','jobs.js'),'text/javascript'],[cssUrl,'text/css']]){
 if (!server.includes("'"+file+"'")) server=server.replace(marker,marker+"\n  ['"+file+"', ['"+file.slice(1)+"', '"+type+"']],");
}
const quarterScript='/'+dir+'/assets/quarters.js';
if (!server.includes("'"+quarterScript+"'")) server=server.replace(marker, marker+"\n  ['"+quarterScript+"', ['"+quarterScript.slice(1)+"', 'text/javascript']],");
const routeMarker = 'const asset = assets.get(route);';
if (!server.includes("'/api/jobs/quarters'")) {
  if (!server.includes(routeMarker)) throw Error('Không tìm thấy vị trí xử lý API.');
  server=server.replace(routeMarker,"if (route === '/api/jobs/quarters' && req.method === 'GET') return json(200, await require('./src/quarterly.cjs')());\n    "+routeMarker);
}
for(const [target,file] of [['src/quarterly.cjs','quarterly.cjs'],[quarterScript.slice(1),'quarters.js']])
  writes.set(target,fs.readFileSync(path.join(__dirname,file),'utf8'));
writes.set('server.js',server);
for(const [file,contents] of writes){
 const dst=path.join(root,file);
 fs.mkdirSync(path.dirname(dst),{recursive:true});
 fs.writeFileSync(dst,contents);
}
console.log('Đã thêm biểu đồ và trang tra cứu '+records.length+' nghề.');
