const db = require('./database');
const { getTier } = require('./tiers');
const { getPayment } = require('./payments');
const transaction = require('./transaction');
const curriculum = require('./curriculum');

function saveStudent(userId, student) {
  db.prepare(`INSERT INTO premium_profiles VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET student = excluded.student`).run(userId, JSON.stringify(student));
}

function savedStudent(userId) {
  const row = db.prepare('SELECT student FROM premium_profiles WHERE userId = ?').get(userId);
  return row ? JSON.parse(row.student) : null;
}

function unlockedRoles(user, careers) {
  if (user.premiumTier === 3) return careers;
  if (!user.premiumTier) return [];
  const row = db.prepare('SELECT rankings FROM premium_unlocks WHERE userId = ?').get(user.id);
  const ranking = row ? JSON.parse(row.rankings) : [];
  return ranking.slice(0, getTier(user.premiumTier).roleLimit)
    .map(id => careers.find(role => role.id === id)).filter(Boolean);
}

function usage(user) {
  const aiLimit = getTier(user.premiumTier)?.aiLimit ?? 0;
  const aiUsed = db.prepare('SELECT used FROM premium_ai_usage WHERE userId = ?').get(user.id)?.used ?? 0;
  return { aiLimit, aiUsed, aiRemaining: Math.max(0, aiLimit - aiUsed) };
}

function status(user, careers) {
  return {
    tier: user.premiumTier,
    roleLimit: getTier(user.premiumTier)?.roleLimit ?? (user.premiumTier === 3 ? careers.length : 0),
    ...usage(user),
    unlockedRoles: unlockedRoles(user, careers).map(({ id, slug, titleVi }) => ({ id, slug, titleVi })),
    pendingOrder: getPayment(user.id, true),
    hasAssessment: Boolean(savedStudent(user.id))
  };
}

function activate(userId, student, rankings) {
  db.prepare(`INSERT INTO premium_unlocks VALUES (?, ?, ?, ?)
    ON CONFLICT(userId) DO NOTHING`).run(userId, JSON.stringify(rankings), JSON.stringify(student), new Date().toISOString());
}

function learning(user, role) {
  const locked = db.prepare('SELECT student FROM premium_unlocks WHERE userId = ?').get(user.id);
  const student = locked ? JSON.parse(locked.student) : savedStudent(user.id);
  const levels = new Map((student?.skills ?? []).map(skill =>
    typeof skill === 'string' ? [skill.toLowerCase(), 4] : [skill.skillKey.toLowerCase(), skill.level]));
  const gap = skill => Math.max(0, skill.targetScore - (levels.get(skill.skillKey.toLowerCase()) ?? 0));
  const completed = new Set(db.prepare(`SELECT lessonId FROM premium_progress
    WHERE userId = ? AND roleId = ? AND completed = 1`).all(user.id, role.id).map(row => row.lessonId));
  const lessons = [...role.requiredSkills].sort((a, b) => gap(b) - gap(a))
    .flatMap(skill => curriculum[skill.skillKey].map(lesson => ({
      ...lesson, skillKey: skill.skillKey, completed: completed.has(lesson.id)
    })));
  return { lessons, weeklyAvailableHours: student?.weeklyAvailableHours ?? 15 };
}

function setProgress(userId, roleId, lessonId, completed) {
  db.prepare(`INSERT INTO premium_progress VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, roleId, lessonId) DO UPDATE SET completed = excluded.completed`)
    .run(userId, roleId, lessonId, Number(completed));
}

function schedule(role, { lessons, weeklyAvailableHours }) {
  const hours = Math.max(1, Math.min(15, weeklyAvailableHours));
  const totalWeeks = Math.ceil(role.learningCurveWeeks * 15 / hours);
  const monthCount = Math.max(3, Math.ceil(totalWeeks / 4.3));
  const weekCount = Math.max(totalWeeks, monthCount);
  const months = Array.from({ length: monthCount }, (_, index) => {
    const start = Math.floor(index * weekCount / monthCount);
    const end = Math.floor((index + 1) * weekCount / monthCount);
    const weeks = Array.from({ length: end - start }, (_, offset) => {
      const index = start + offset;
      const from = Math.floor(index * lessons.length / weekCount);
      const to = Math.floor((index + 1) * lessons.length / weekCount);
      const selected = lessons.slice(from, Math.max(from + 1, to));
      return {
        week: index + 1, hours, lessons: selected.map(({ id, title, completed }) => ({ id, title, completed }))
      };
    });
    const focus = [...new Set(weeks.flatMap(week => week.lessons.map(lesson => lesson.title)))];
    const projectLesson = lessons.find(lesson => lesson.id === weeks.at(-1).lessons.at(-1)?.id);
    return {
      month: index + 1, objective: 'Học và luyện tập ' + focus.join(', '), weeks,
      project: projectLesson.exercise + ' Ghi cách tái hiện và lưu kết quả làm minh chứng.',
      checkpoint: 'Chạy lại bài làm với một ví dụ mới và đối chiếu tiêu chí tự kiểm tra của các bài trong tháng.'
    };
  });
  return { weeklyAvailableHours, months };
}

function reserve(userId) {
  return transaction(db, () => {
    const { premiumTier } = db.prepare('SELECT premiumTier FROM users WHERE id = ?').get(userId);
    db.prepare('INSERT INTO premium_ai_usage (userId) VALUES (?) ON CONFLICT DO NOTHING').run(userId);
    return db.prepare('UPDATE premium_ai_usage SET used = used + 1 WHERE userId = ? AND used < ?')
      .run(userId, getTier(premiumTier)?.aiLimit ?? 0).changes === 1;
  });
}

function refund(userId) {
  db.prepare('UPDATE premium_ai_usage SET used = used - 1 WHERE userId = ? AND used > 0').run(userId);
}

module.exports = { saveStudent, savedStudent, unlockedRoles, usage, status, activate, learning, setProgress, schedule, reserve, refund };
