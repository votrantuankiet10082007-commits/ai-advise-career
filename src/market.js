function buildMarket(careers) {
  const skills = new Map();
  const roles = careers.map(role => {
    for (const skill of role.requiredSkills) {
      const stat = skills.get(skill.skillKey) || { skillKey: skill.skillKey, roleCount: 0, weight: 0 };
      stat.roleCount++;
      stat.weight += skill.weight ?? 1;
      skills.set(skill.skillKey, stat);
    }
    const { id, titleVi, track, learningCurveWeeks, entrySalaryMinVnd, entrySalaryMaxVnd } = role;
    return { id, titleVi, track, learningCurveWeeks, entrySalaryMinVnd, entrySalaryMaxVnd };
  });
  const topSkills = [...skills.values()].map(stat => ({ ...stat, weight: Math.round(stat.weight * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight || b.roleCount - a.roleCount || a.skillKey.localeCompare(b.skillKey));
  return { roles, tracks: [...new Set(roles.map(role => role.track))], topSkills,
    updatedAt: '2026-11-21',
    source: 'CAREERS_DATA · ngày chốt phiên bản danh mục' };
}

module.exports = { buildMarket };
