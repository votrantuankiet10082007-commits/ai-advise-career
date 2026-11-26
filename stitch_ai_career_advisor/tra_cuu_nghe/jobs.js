const normalize = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').replace(/[_/]/g,' ').trim();
const input=document.querySelector('.jobs-search input');
input.value=new URLSearchParams(location.search).get('q') || '';
const q=normalize(input.value);
const cards=[...document.querySelectorAll('.jobs-card')];
const exact=cards.some(card=>normalize(card.dataset.name)===q);
let count=0;
for(const card of cards){
  const text=[...card.children].slice(0,4).map(el=>el.textContent).join(' ');
  card.hidden=exact ? normalize(card.dataset.name)!==q : !q.split(/\s+/).every(word=>normalize(text).includes(word));
  if (!card.hidden) count++;
}
document.getElementById('jobs-count').textContent=count ? count+' nghề phù hợp' : 'Chưa tìm thấy nghề. Hãy thử tên nghề hoặc kỹ năng khác.';
