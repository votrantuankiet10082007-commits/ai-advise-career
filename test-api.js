const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');

test('Đánh giá nghề, thị trường, tài khoản, Premium và CV SQLite', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'advise-test-'));
  const probe = net.createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env, DATABASE_DIR: directory, HOST: '127.0.0.1', PORT: String(port), PUBLIC_ORIGIN: origin,
    NODE_ENV: 'development', BANK_NAME: 'Test Bank', BANK_ACCOUNT: '0000', BANK_HOLDER: 'TEST ONLY',
    PREMIUM_PRICE_T1_VND: '50000', PREMIUM_PRICE_T2_VND: '100000', PREMIUM_PRICE_T3_VND: '200000', GEMINI_API_KEY: '', OPENAI_API_KEY: ''
  };
  let server;
  async function start(preload) {
    const args = preload ? ['--require', preload, 'server.js'] : ['server.js'];
    server = spawn(process.execPath, args, { cwd: __dirname, env });
    await Promise.race([
      once(server.stdout, 'data'),
      once(server, 'exit').then(([code]) => { throw new Error('Máy chủ thoát: ' + code); })
    ]);
  }
  async function stop() {
    if (server && server.exitCode === null && server.signalCode === null) {
      const done = once(server, 'exit');
      server.kill();
      await done;
    }
  }
  t.after(async () => {
    await stop();
    await rm(directory, { recursive: true, force: true });
  });
  await start();
  async function request(path, { method = 'GET', payload, cookie, requestOrigin } = {}) {
    const headers = {};
    if (payload) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    if (requestOrigin) headers.Origin = requestOrigin;
    const response = await fetch(origin + path, { method, headers, body: payload ? JSON.stringify(payload) : undefined });
    const data = response.headers.get('content-type').includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const post = (path, payload, cookie) => request(path, { method: 'POST', payload, cookie });
  const a = { name: 'Sinh viên A', email: 'a@example.test', password: 'test-password-A' };
  const b = { name: 'Sinh viên B', email: 'b@example.test', password: 'test-password-B' };

  const home = (await request('/')).data;
  const target = home.match(/url=\.([^"]+)/)[1];
  assert.match((await request(target)).data, /Hồ sơ kỹ năng/);
  const logoPath = '/stitch_ai_career_advisor/assets/logo.png';
  const logoResponse = await fetch(origin + logoPath);
  assert.equal(logoResponse.status, 200);
  assert.match(logoResponse.headers.get('content-type'), /^image\/png\b/);
  const logoBytes = Buffer.from(await logoResponse.arrayBuffer());
  assert.equal(logoBytes.subarray(1, 4).toString('ascii'), 'PNG');
  for (const directory of ['nh_gi_g_i_ngh_nghi_p_it', 'dang_nhap_tai_khoan', 'thi_truong_nganh_it', 'chinh_sua_cv_ai']) {
    const { data } = await request(`/stitch_ai_career_advisor/${directory}/code.html`);
    assert.ok(data.includes(logoPath), directory);
  }
  assert.equal((await request(target.replace('code.html', 'app.js'))).status, 200);
  assert.equal((await request('/api/health')).data.status, 'healthy');
  for (const dir of ['dang_nhap_tai_khoan', 'thi_truong_nganh_it', 'chinh_sua_cv_ai', 'premium']) {
    for (const file of ['code.html', 'style.css', 'app.js']) {
      assert.equal((await request(`/stitch_ai_career_advisor/${dir}/${file}`)).status, 200);
    }
  }
  const { data: market } = await request('/api/market');
  assert.match(market.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(market.aiAvailable, false);
  assert.ok(market.roles.length > 0 && market.topSkills.length > 0);
  assert.ok(market.roles.every(role => role.entrySalaryMinVnd <= role.entrySalaryMaxVnd && role.learningCurveWeeks > 0));
  assert.ok(market.topSkills.every((skill, index) => !index || skill.weight <= market.topSkills[index - 1].weight));
  assert.ok(market.skillsByTrack[market.tracks[0]].length > 0);
  assert.match((await post('/api/market/comment', { track: market.tracks[0] })).data.summary, /danh mục/);

  const cv = {
    name: 'Sinh viên A', targetRoleId: 'role-be-01', objective: 'Mục tiêu: Học phát triển API',
    skills: [{ group: 'Backend', items: 'java, sql' }],
    projects: [{ name: 'Danh bạ', action: 'Viết API', result: '3 API chạy được' }]
  };
  const generated = await post('/api/ai/cv-generate', { cv, consent: true });
  assert.equal(generated.status, 200);
  assert.equal(generated.data.provider, 'Bộ quy tắc');
  assert.equal(generated.data.objective, 'Học phát triển API');
  assert.equal(generated.data.projectDescriptions[0], 'Phần việc: Viết API\nKết quả: 3 API chạy được');
  assert.ok(generated.data.atsKeywords.includes('sql'));
  const emptyCv = (await post('/api/ai/cv-generate', { cv: {} })).data;
  assert.equal(emptyCv.objective, '');
  assert.deepEqual(emptyCv.projectDescriptions, []);
  assert.ok(emptyCv.suggestions.length > 0);
  const reviewed = await post('/api/ai/cv-review', { cv });
  assert.equal(typeof reviewed.data.summary, 'string');
  assert.ok(Array.isArray(reviewed.data.suggestions));
  assert.equal((await post('/api/ai/cv-generate', { cv: { objective: 'a'.repeat(33000) } })).status, 413);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    assert.equal((await request('/api/cv', { method, payload: method === 'PUT' ? { cv } : undefined })).status, 401);
  }

  for (const hidden of ['/.env', '/database/accounts.sqlite', '/server.js']) assert.equal((await request(hidden)).status, 404);
  const careers = (await request('/api/careers')).data;
  assert.ok(careers.total >= 15);
  const assessment = { student: { skills: ['java', 'git', 'sql'], primaryInterests: ['SOFTWARE_ENGINEERING'] } };
  assert.equal((await post('/api/evaluate', assessment)).data.rankings.length, careers.total);
  const roadmap = { ...assessment, roleId: 'backend-developer' };
  assert.ok((await post('/api/explain', roadmap)).data.criticalRoadmap.length > 0);
  assert.equal((await post('/api/premium/roadmap', roadmap)).status, 401);
  assert.equal((await request('/api/profile')).status, 401);
  assert.equal((await request('/api/auth/register', { method: 'POST', payload: a, requestOrigin: 'https://other.example' })).status, 403);
  const first = await post('/api/auth/register', a);
  assert.equal(first.status, 201);
  assert.ok(first.cookie);
  const second = await post('/api/auth/register', b);
  assert.equal(second.status, 201);
  const saveCv = await request('/api/cv', { method: 'PUT', payload: { cv }, cookie: first.cookie });
  assert.equal(saveCv.status, 200);
  assert.equal((await request('/api/cv', { cookie: first.cookie })).data.cv.name, cv.name);
  assert.equal((await request('/api/cv?userId=' + encodeURIComponent((await request('/api/profile', { cookie: first.cookie })).data.user.id), { cookie: second.cookie })).data.cv, null);
  assert.equal((await request('/api/cv', { method: 'DELETE', cookie: second.cookie })).status, 200);
  assert.equal((await request('/api/cv', { method: 'DELETE', cookie: first.cookie, requestOrigin: 'https://other.example' })).status, 403);

  assert.equal((await post('/api/auth/register', { ...a, email: a.email.toUpperCase() })).status, 409);
  assert.equal((await post('/api/auth/login', { ...a, password: 'incorrect' })).status, 401);

  const update = await request('/api/profile', { method: 'PUT', payload: { university: 'Trường A', github: 'https://github.com/example', premium: 1, premiumTier: 3 }, cookie: first.cookie });
  assert.equal(update.data.user.premium, 0);
  assert.equal(update.data.user.premiumTier, 0);
  const plans = (await request('/api/premium/tiers')).data.tiers;
  assert.deepEqual(plans.map(({ price, roleLimit, aiLimit }) => [price, roleLimit, aiLimit]),
    [[50000, 3, 30], [100000, 5, 60], [200000, null, 100]]);
  assert.equal(update.data.user.university, 'Trường A');
  const orders = await Promise.all([post('/api/premium/order', { tier: 1 }, first.cookie), post('/api/premium/order', { tier: 1 }, first.cookie)]);
  const order = orders[0].data.order;
  assert.equal(order.code, orders[1].data.order.code);
  assert.equal((await request('/api/premium/order', { cookie: second.cookie })).data.order, null);
  const orderB = (await post('/api/premium/order', { tier: 1 }, second.cookie)).data.order;
  const confirm = (code, amount, ref) => spawnSync(process.execPath,
    ['scripts/confirm-payment.js', code, String(amount), ref], { cwd: __dirname, env, encoding: 'utf8' });

  assert.equal(confirm(order.code, 48000, 'REF-A').status, 1);
  const confirmed = confirm(order.code, 50000, 'REF-A');
  assert.equal(confirmed.status, 0, confirmed.stderr);
  assert.equal(confirm(order.code, 50000, 'REF-A').status, 0);
  assert.equal(confirm(orderB.code, 50000, 'REF-A').status, 1);
  const premiumStatus = async cookie => (await request('/api/premium/status', { cookie })).data;
  assert.equal(order.amount, 50000);
  assert.equal((await premiumStatus(first.cookie)).tier, 1);
  assert.equal((await premiumStatus(second.cookie)).tier, 0);
  assert.equal((await post('/api/premium/activate', {}, first.cookie)).status, 400);
  const assessed = await post('/api/evaluate', assessment, first.cookie);
  const activated = await post('/api/premium/activate', {}, first.cookie);
  const initialRoles = activated.data.unlockedRoles;
  assert.deepEqual(initialRoles.map(role => role.id), assessed.data.rankings.slice(0, 3).map(role => role.roleId));
  const roleSlug = initialRoles[0].slug;
  const lockedSlug = assessed.data.rankings[3].roleSlug;
  assert.equal((await request('/api/premium/learn/' + lockedSlug, { cookie: first.cookie })).status, 403);
  assert.equal((await post('/api/premium/tutor', { roleSlug: lockedSlug, question: 'Học gì?' }, first.cookie)).status, 403);
  const coursePath = '/api/premium/learn/' + roleSlug;
  const schedulePath = '/api/premium/schedule/' + roleSlug;
  const schedule = (await request(schedulePath, { cookie: first.cookie })).data;
  assert.ok(schedule.months.length >= 3);
  assert.deepEqual((await request(schedulePath, { cookie: first.cookie })).data, schedule);
  const lessonId = (await request(coursePath, { cookie: first.cookie })).data.lessons[0].id;
  assert.equal((await request('/api/premium/progress', {
    method: 'PUT', payload: { roleSlug, lessonId, completed: true }, cookie: first.cookie
  })).status, 200);
  assert.equal((await request(coursePath, { cookie: second.cookie })).status, 403);
  assert.equal((await post('/api/premium/tutor', { roleSlug, question: 'Giải thích bài đầu.' }, first.cookie)).status, 503);
  assert.equal((await premiumStatus(first.cookie)).aiUsed, 0);

  const openedRoadmap = { ...assessment, roleId: roleSlug };
  assert.ok((await post('/api/premium/roadmap', openedRoadmap, first.cookie)).data.criticalRoadmap.length > 1);
  assert.equal((await post('/api/premium/roadmap', openedRoadmap, second.cookie)).status, 403);

  const preload = join(directory, 'ai-stub.cjs');
  await writeFile(preload, `
    const provider = require(${JSON.stringify(join(__dirname, 'src/feature-ai.js'))});
    provider.hasKey = () => true;
    provider.requestJson = async (prompt, validate) => {
      if (JSON.parse(prompt).question === 'Lỗi giả lập') return null;
      await new Promise(resolve => setTimeout(resolve, 15));
      const value = { answer: 'Nội dung trả lời dùng trong kiểm thử.' };
      return validate(value) ? { value, provider: 'test' } : null;
    };
  `);
  await stop();
  await start(preload);
  const tutor = question => post('/api/premium/tutor', { roleSlug, lessonId, question }, first.cookie);
  assert.equal((await tutor('Lỗi giả lập')).status, 503);
  assert.equal((await premiumStatus(first.cookie)).aiUsed, 0);
  for (let i = 0; i < 29; i++) assert.equal((await tutor('Giải thích bài học.')).status, 200);
  const simultaneous = await Promise.all([tutor('Câu thứ nhất'), tutor('Câu thứ hai')]);
  assert.deepEqual(simultaneous.map(response => response.status).sort(), [200, 429]);
  assert.equal((await tutor('Hỏi thêm')).status, 429);
  assert.equal((await premiumStatus(first.cookie)).aiUsed, 30);

  const place = async (tier, cookie) => (await post('/api/premium/order', { tier }, cookie)).data.order;
  const tier2 = await place(2, first.cookie);
  assert.equal(tier2.amount, 50000);
  assert.equal((await post('/api/premium/order', { tier: 3 }, first.cookie)).status, 409);
  assert.equal(confirm(tier2.code, tier2.amount, 'REF-T2').status, 0);
  assert.equal(confirm(order.code, 50000, 'REF-A').status, 0);
  assert.equal((await post('/api/premium/order', { tier: 1 }, first.cookie)).status, 409);
  const upgraded = await premiumStatus(first.cookie);
  assert.equal(upgraded.tier, 2);
  assert.equal(upgraded.aiRemaining, 30);
  assert.deepEqual(upgraded.unlockedRoles.map(role => role.id), assessed.data.rankings.slice(0, 5).map(role => role.roleId));

  const tier3 = await place(3, first.cookie);
  assert.equal(tier3.amount, 100000);
  assert.equal(confirm(tier3.code, tier3.amount, 'REF-T3').status, 0);
  assert.equal((await premiumStatus(first.cookie)).unlockedRoles.length, careers.total);
  assert.equal((await premiumStatus(first.cookie)).aiRemaining, 70);
  assert.equal((await premiumStatus(second.cookie)).pendingOrder.code, orderB.code);

  const third = await post('/api/auth/register', { ...a, email: 'c@example.test' });
  const directTier3 = await place(3, third.cookie);
  assert.equal(directTier3.amount, 200000);
  assert.equal(confirm(directTier3.code, directTier3.amount, 'REF-C').status, 0);
  assert.equal((await premiumStatus(third.cookie)).unlockedRoles.length, careers.total);
  assert.equal((await request(coursePath, { cookie: third.cookie })).data.lessons[0].completed, false);
  for (const role of careers.data) {
    const result = await request('/api/premium/learn/' + role.slug, { cookie: third.cookie });
    assert.equal(result.status, 200);
    assert.deepEqual([...new Set(result.data.lessons.map(lesson => lesson.skillKey))].sort(),
      [...new Set(role.requiredSkills.map(skill => skill.skillKey))].sort());
  }
  const defaultSchedule = (await request(schedulePath, { cookie: third.cookie })).data;
  await post('/api/evaluate', { student: { ...assessment.student, weeklyAvailableHours: 5 } }, third.cookie);
  const slower = (await request(schedulePath, { cookie: third.cookie })).data;
  assert.ok(slower.months.length > defaultSchedule.months.length);
  assert.ok(slower.months.every(month => month.weeks.every(week => week.hours === 5 && week.lessons.length)));
  const fourth = await post('/api/auth/register', { ...a, email: 'd@example.test' });
  assert.equal((await place(2, fourth.cookie)).amount, 100000);
  const changedAssessment = { student: { skills: ['figma', 'design-system'] } };
  const again = await post('/api/premium/activate', changedAssessment, first.cookie);
  assert.equal(again.data.unlockedRoles.length, careers.total);


  await stop();
  await start();
  const saved = (await request('/api/profile', { cookie: first.cookie })).data.user;
  assert.equal(saved.github, 'https://github.com/example');
  assert.equal(saved.premium, 1);
  assert.equal(saved.premiumTier, 3);
  assert.equal((await request('/api/cv', { cookie: first.cookie })).data.cv.projects[0].result, '3 API chạy được');
  assert.equal((await request('/api/cv', { method: 'DELETE', cookie: first.cookie })).status, 200);
  assert.equal((await request('/api/cv', { cookie: first.cookie })).data.cv, null);

  assert.equal(saved.university, 'Trường A');
  assert.equal(saved.password, undefined);
  assert.equal((await post('/api/auth/logout', undefined, first.cookie)).status, 200);
  assert.equal((await request('/api/profile', { cookie: first.cookie })).status, 401);
  assert.equal((await post('/api/auth/login', a)).status, 200);
});
