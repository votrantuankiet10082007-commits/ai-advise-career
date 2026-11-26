(async function refresh() {
  const list = document.getElementById('jobs-quarters');
  try {
    const response = await fetch('/api/jobs/quarters',{cache:'no-store'});
    if (!response.ok) throw Error();
    const rows = await response.json();
    list.replaceChildren(...rows.map(row => {
      const item = document.createElement('p');
      const title = document.createElement('strong');
      title.textContent = 'Quý ' + row.quarter + '/' + row.year + ' · ';
      item.append(title,row.summary);
      return item;
    }));
  } catch {
    if (!list.children.length) list.textContent = 'Chưa tải được dữ liệu theo quý.';
  } finally {
    setTimeout(refresh,3600000);
  }
})();
