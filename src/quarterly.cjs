const baseline = {
  '2026-1': 'ITviec ghi nhận 33,2% tin tuyển dụng đề cập kỹ năng Back-end và 18,6% đề cập Python.',
  '2026-2': 'Nhu cầu tuyển dụng trên ITviec tăng so với quý 1, đặc biệt ở nhóm AI và dữ liệu.',
  '2026-3': 'Tuyển dụng chung thu hẹp, trong khi nhóm Data/AI/ML vẫn chiếm tỷ trọng cao.'
};
const cache = new Map();
async function readQuarter(year, quarter, current) {
  const key = year + '-' + quarter;
  if (baseline[key]) return baseline[key];
  if (year * 4 + quarter >= current) return year * 4 + quarter === current ? 'Quý đang diễn ra.' : 'Chưa đến kỳ.';
  const previous = cache.get(key);
  if (previous && previous.until > Date.now()) return previous.value;
  const value = (async () => {
    try {
      const response = await fetch('https://marketing.itviec.com/insight_article_q' + quarter + '_' + year, { signal: AbortSignal.timeout(4500), redirect: 'error' });
      if (response.ok) {
        const html = await response.text();
        const headings = [...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(m => m[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
        const period = new RegExp('(?:Q|quý)\\s*0?' + quarter + '[- /]+' + year,'i');
        const summary = headings.find(s => period.test(s) && s.length > 75 && /nhu cầu|tuyển dụng|nhân lực/i.test(s));
        if (summary) return summary;
      }
    } catch {}
    return 'Đang chờ dữ liệu báo cáo.';
  })();
  cache.set(key,{until:Date.now()+86400000,value});
  return value;
}
module.exports = async function quarterly(now = new Date()) {
  const date = new Date(now.getTime()+7*3600000);
  const year = date.getUTCFullYear(), current = year*4+1+Math.floor(date.getUTCMonth()/3);
  const rows = [];
  for (let y=year;y>=2026;y--) for (let q=1;q<=4;q++)
    rows.push(readQuarter(y,q,current).then(summary=>({year:y,quarter:q,summary})));
  return Promise.all(rows);
};
