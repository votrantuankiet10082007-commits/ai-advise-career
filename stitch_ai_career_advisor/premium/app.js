const $ = id => document.getElementById(id);
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'UTC' });
const tabs = [...document.querySelectorAll('[data-panel]')];
let plans = [];
let paymentAvailable = false;
let membership = null;
let selectedRole = '';
let activePanel = 'learn';
let months = [];
let courseRequest = 0;
let asking = false;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

async function api(endpoint, method = 'GET', data) {
  const response = await fetch('/api/premium/' + endpoint, {
    method, headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined, cache: 'no-store'
  });
  const content = await response.json();
  if (!response.ok) throw Object.assign(new Error(content.error || 'Không xử lý được yêu cầu.'), { status: response.status });
  return content;
}

async function run(button, message, task) {
  if (button) button.disabled = true;
  message.textContent = 'Đang xử lý…';
  try {
    await task();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    if (button) button.disabled = false;
  }
}

async function readStatus() {
  try {
    return await api('status');
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

function priceCards() {
  const current = membership?.tier ?? 0;
  const currentPrice = plans.find(plan => plan.tier === current)?.price ?? 0;
  $('prices').replaceChildren(...plans.map(plan => {
    const card = node('article', undefined, 'panel price-card');
    const roles = plan.roleLimit === null ? 'Toàn bộ ngành trong danh mục' : plan.roleLimit + ' ngành phù hợp nhất';
    card.append(node('h2', 'Gói ' + plan.tier), node('p', money.format(plan.price), 'price'),
      node('p', roles), node('p', plan.aiLimit + ' lượt hỏi AI'), node('p', 'Lịch học theo tháng'));
    const pending = membership?.pendingOrder;
    const isPending = pending?.tier === plan.tier;
    let label = 'Chọn gói';
    if (isPending) label = 'Xem đơn đang chờ';
    else if (plan.tier === current) label = 'Gói đang dùng';
    else if (plan.tier < current) label = 'Gói thấp hơn';
    else if (current) label = 'Nâng cấp ' + money.format(plan.price - currentPrice);
    const button = node('button', label, 'primary');
    button.disabled = plan.tier <= current || Boolean(pending && !isPending);
    button.addEventListener('click', () => {
      if (!membership) {
        location.href = '../dang_nhap_tai_khoan/code.html';
        return;
      }
      clearPayment();
      $('payment').showModal();
      run($('check-payment'), $('payment-status'), async () => {
        if (!isPending && !paymentAvailable) throw new Error('Thanh toán chuyển khoản chưa được cấu hình.');
        showPayment(isPending ? pending : (await api('order', 'POST', { tier: plan.tier })).order);
        membership = await readStatus();
        renderMembership();
      });
    });
    card.append(button);
    return card;
  }));
}

const qrImage = $('payment-qr-image');
const cancelButton = $('cancel-payment');
qrImage.addEventListener('load', () => {
  $('payment-qr').hidden = !qrImage.hasAttribute('src');
});
qrImage.addEventListener('error', () => { $('payment-qr').hidden = true; });

function clearPayment() {
  cancelButton.hidden = true;
  delete cancelButton.dataset.code;
  $('payment-details').replaceChildren();
  $('payment-qr').hidden = true;
  qrImage.removeAttribute('src');
}

function showPayment(order) {
  clearPayment();
  cancelButton.dataset.code = order.code;
  cancelButton.hidden = order.status !== 'pending';
  qrImage.src = '/api/premium/order/qr?order=' + encodeURIComponent(order.code);
  const fields = [
    ['Gói', order.tier], ['Ngân hàng', order.bank_name], ['Tài khoản', order.bank_account],
    ['Chủ tài khoản', order.bank_holder], ['Số tiền', money.format(order.amount)], ['Nội dung chuyển khoản', order.code]
  ];
  $('payment-details').replaceChildren(...fields.flatMap(([label, detail]) => [node('dt', label), node('dd', detail)]));
  $('payment-status').textContent = 'Đơn đang chờ đối soát. Chuyển đúng số tiền và ghi mã đơn trong nội dung chuyển khoản.';
}

function renderUsage() {
  const remaining = membership?.aiRemaining ?? 0;
  $('usage').textContent = `Còn ${remaining}/${membership?.aiLimit ?? 0} lượt`;
  $('question').disabled = asking || remaining === 0;
  $('send').disabled = asking || remaining === 0;
  $('upgrade-message').hidden = remaining > 0;
}

function renderMembership() {
  priceCards();
  const tier = membership?.tier ?? 0;
  const roles = membership?.unlockedRoles ?? [];
  $('activate').hidden = !tier || Boolean(roles.length);
  $('study').hidden = !tier || !roles.length;
  if (!roles.length) return;
  $('membership').textContent = 'Premium · Gói ' + tier;
  const select = $('role');
  select.replaceChildren(...roles.map(role => {
    const option = node('option', role.titleVi);
    option.value = role.slug;
    return option;
  }));
  select.value = roles.some(role => role.slug === selectedRole) ? selectedRole : roles[0].slug;
  renderUsage();
  if (select.value !== selectedRole) switchRole();
}

function progress(items) {
  const complete = items.filter(item => item.completed).length;
  const bar = node('progress');
  bar.max = items.length || 1;
  bar.value = complete;
  bar.setAttribute('aria-label', `Hoàn thành ${complete}/${items.length} bài`);
  return bar;
}

function showLessons(lessons) {
  $('lesson').replaceChildren(new Option('Theo ngành đang chọn', ''), ...lessons.map(lesson => new Option(lesson.title, lesson.id)));
  if (!lessons.length) {
    $('lessons').textContent = 'Chưa có bài học.';
    return;
  }
  $('lessons').replaceChildren(node('p', `Tiến độ ngành · ${lessons.filter(lesson => lesson.completed).length}/${lessons.length} bài`),
    progress(lessons), ...lessons.map(lesson => {
      const row = node('article');
      const list = node('ul');
      list.append(...lesson.points.map(point => node('li', point)));
      const button = node('button', lesson.completed ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành', 'outline');
      const message = node('p');
      message.setAttribute('role', 'status');
      button.addEventListener('click', () => {
        const roleSlug = selectedRole;
        run(button, message, async () => {
          const result = await api('progress', 'PUT', { roleSlug, lessonId: lesson.id, completed: !lesson.completed });
          message.textContent = result.completed ? 'Đã lưu hoàn thành.' : 'Đã bỏ đánh dấu.';
          if (roleSlug === selectedRole) await loadCourse();
        });
      });
      row.append(node('h4', lesson.title), progress([lesson]), node('p', 'Mục tiêu · ' + lesson.objective), list,
        node('p', 'Thực hành · ' + lesson.exercise), node('p', 'Tự kiểm tra · ' + lesson.check), button, message);
      return row;
    }));
}

function showMonths() {
  const date = $('start-date').value;
  $('print').disabled = months.length === 0;
  $('months').replaceChildren(...months.map(month => {
    const article = node('article');
    const first = new Date(date + 'T00:00:00Z');
    first.setUTCDate(first.getUTCDate() + (month.weeks[0].week - 1) * 7);
    const end = new Date(date + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + month.weeks.at(-1).week * 7 - 1);
    const interval = date ? ' · ' + dateFormat.format(first) + ' – ' + dateFormat.format(end) : '';
    article.append(node('h4', 'Tháng ' + month.month + interval), node('p', month.objective));
    for (const week of month.weeks) {
      const list = node('ul');
      list.append(...week.lessons.map(lesson => node('li', (lesson.completed ? '✓ ' : '') + lesson.title)));
      article.append(node('strong', `Tuần ${week.week} · ${week.hours} giờ`), progress(week.lessons), list);
    }
    article.append(node('p', 'Dự án minh chứng · ' + month.project), node('p', 'Mốc tự kiểm tra · ' + month.checkpoint));
    return article;
  }));
  if (!months.length) $('months').textContent = 'Chưa có lịch học.';
}

async function loadCourse() {
  const version = ++courseRequest;
  const role = encodeURIComponent(selectedRole);
  $('lessons').textContent = 'Đang tải giáo trình…';
  $('months').textContent = 'Đang tải lịch học…';
  $('lesson').replaceChildren(new Option('Theo ngành đang chọn', ''));
  $('print').disabled = true;
  months = [];
  await Promise.all([
    api('learn/' + role).then(data => {
      if (version === courseRequest) showLessons(data.lessons);
    }).catch(error => {
      if (version === courseRequest) $('lessons').textContent = error.message;
    }),
    api('schedule/' + role).then(data => {
      if (version !== courseRequest) return;
      months = data.months;
      showMonths();
    }).catch(error => {
      if (version === courseRequest) $('months').textContent = error.message;
    })
  ]);
}

function switchRole() {
  selectedRole = $('role').value;
  $('chat').replaceChildren();
  loadCourse();
}

for (const button of tabs) {
  button.setAttribute('aria-pressed', String(button.dataset.panel === activePanel));
  button.addEventListener('click', () => {
    activePanel = button.dataset.panel;
    for (const tab of tabs) {
      const selected = tab.dataset.panel === activePanel;
      tab.setAttribute('aria-pressed', String(selected));
      $(tab.dataset.panel).hidden = !selected;
    }
  });
}

$('role').addEventListener('change', switchRole);
const today = new Date();
$('start-date').value = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$('start-date').addEventListener('change', () => { if (months.length) showMonths(); });
$('print').addEventListener('click', () => window.print());
$('close-payment').addEventListener('click', () => $('payment').close());
cancelButton.addEventListener('click', async () => {
  const { code } = cancelButton.dataset;
  const checkButton = $('check-payment');

  if (!code || checkButton.disabled) return;

  const confirmed = window.confirm(
    'Chỉ hủy nếu bạn chưa chuyển tiền cho đơn này. Bạn muốn hủy đơn?'
  );
  if (!confirmed) return;

  checkButton.disabled = true;
  try {
    await run(cancelButton, $('payment-status'), async () => {
      membership = await api('order/cancel', 'POST', { code });
      clearPayment();
      renderMembership();
      $('payment').close();
      $('status').textContent = 'Đã hủy đơn. Bạn có thể chọn gói để tạo đơn mới.';
    });
  } finally {
    checkButton.disabled = false;
  }
});
$('check-payment').addEventListener('click', () => {
  run($('check-payment'), $('payment-status'), async () => {
    const lastTier = membership?.tier ?? 0;
    membership = await readStatus();
    renderMembership();
    if (!membership) throw new Error('Bạn cần đăng nhập lại.');
    if (membership.pendingOrder) showPayment(membership.pendingOrder);
    else {
      clearPayment();
      $('payment-status').textContent = membership.tier > lastTier
        ? 'Máy chủ đã xác nhận thanh toán. Bạn có thể đóng cửa sổ này.'
        : 'Không có đơn đang chờ.';
    }
  });
});
$('unlock').addEventListener('click', () => run($('unlock'), $('status'), async () => {
  let student;
  try { student = JSON.parse(sessionStorage.getItem('career.assessment')); } catch { }
  membership = await api('activate', 'POST', { student });
  renderMembership();
  $('status').textContent = 'Đã mở các ngành học theo hồ sơ đánh giá.';
}));

$('ask').addEventListener('submit', async event => {
  event.preventDefault();
  if (asking) return;
  const question = $('question').value.trim();
  if (!question) return;
  const roleSlug = selectedRole;
  const lessonId = $('lesson').value || undefined;
  const message = node('p', 'Đang chờ AI trả lời…');
  const exchange = node('article');
  exchange.append(node('h4', 'Câu hỏi'), node('p', question), message);
  $('chat').append(exchange);
  asking = true;
  renderUsage();
  try {
    const response = await api('tutor', 'POST', { question, roleSlug, lessonId });
    Object.assign(membership, response);
    message.textContent = response.answer;
    if (selectedRole === roleSlug) $('question').value = '';
  } catch (error) {
    message.textContent = error.message;
    if (error.status === 429) membership.aiRemaining = 0;
  } finally {
    asking = false;
    renderUsage();
  }
});

run(null, $('status'), async () => {
  const config = await api('tiers');
  plans = config.tiers;
  paymentAvailable = config.paymentAvailable;
  priceCards();
  membership = await readStatus();
  renderMembership();
  $('status').textContent = '';
});
