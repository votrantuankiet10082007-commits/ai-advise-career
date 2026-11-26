const sections = {
  education: ['school', 'degree', 'period'],
  skills: ['group', 'items'],
  projects: ['name', 'stack', 'action', 'result', 'description'],
  experience: ['company', 'role', 'period', 'details'],
  certificates: ['title', 'issuer', 'date']
};
const longFields = new Set(['items', 'action', 'result', 'details']);

function normalizeCv(input, field, list) {
  const cv = {
    name: field(input?.name), email: field(input?.email, 255), phone: field(input?.phone, 50),
    location: field(input?.location), links: field(input?.links, 300),
    objective: field(input?.objective, 500), targetRoleId: field(input?.targetRoleId)
  };
  for (const [key, fields] of Object.entries(sections)) {
    cv[key] = list(input?.[key]).slice(0, 10).map(item => Object.fromEntries(fields.map(name =>
      [name, field(item?.[name], name === 'description' ? 840 : longFields.has(name) ? 400 : 120)]
    ))).filter(item => Object.values(item).some(Boolean));
  }
  return cv;
}

function keywords(cv, role) {
  const stated = new Set([...cv.skills.map(item => item.items), ...cv.projects.map(item => item.stack)]
    .flatMap(text => text.toLowerCase().split(/[,;\n]+/).map(item => item.trim())));
  return (role?.requiredSkills || []).map(item => item.skillKey).filter(skill => stated.has(skill.toLowerCase()));
}

function reviewCv(cv, role) {
  const suggestions = [];
  if (!cv.name || !cv.email) suggestions.push('Bổ sung họ tên và email liên hệ.');
  if (!cv.objective) suggestions.push('Bổ sung mục tiêu nghề nghiệp của bạn.');
  if (!role) suggestions.push('Chọn vị trí mục tiêu để đối chiếu kỹ năng.');
  if (!cv.skills.length) suggestions.push('Liệt kê kỹ năng đã sử dụng theo nhóm.');
  // Dự án có thể bỏ trống nếu ứng viên chưa có.
  if (cv.projects.some(item => !item.action || !item.result)) suggestions.push('Bổ sung phần việc và kết quả thực tế cho dự án còn thiếu.');
  if (role && cv.skills.length && !keywords(cv, role).length) suggestions.push('Kiểm tra cách ghi kỹ năng theo tên công cụ bạn thực sự đã dùng.');
  return {
    summary: suggestions.length ? 'Kiểm tra các mục cần bổ sung trước khi gửi CV.' : 'CV đã có đủ các mục được kiểm tra.',
    suggestions
  };
}

// A model chooses among grounded variants. Its raw text never replaces CV facts.
async function generateCv(cv, role, choose) {
  const ats = keywords(cv, role);
  const objective = cv.objective.replace(/^(?:mục tiêu(?: nghề nghiệp)?\s*:\s*|tôi\s+mong muốn\s+)/i, '').trim();
  const objectiveOptions = objective
    ? [...new Set([objective, 'Mong muốn ' + objective[0].toLowerCase() + objective.slice(1)])].filter(option => option.length <= 500)
    : [''];
  const projectOptions = cv.projects.map(project => {
    const { action, result } = project;
    return [...new Set([
      [action, result].filter(Boolean).join('\n'),
      [action && 'Phần việc: ' + action, result && 'Kết quả: ' + result].filter(Boolean).join('\n')
    ])];
  });
  const choice = objective || projectOptions.some(options => options[0]) || ats.length ? await choose(
    'Chọn phương án trình bày CV phù hợp nhất với vai trò. Các mảng dùng chỉ số từ 0. Trả JSON gồm objectiveIndex, projectIndexes (mỗi dự án một chỉ số), atsKeywords (tập con lấy từ từ khóa được cung cấp). Dữ liệu: ' +
    JSON.stringify({ role: role?.titleVi, objectiveOptions, projectOptions, ats }),
    result => Number.isInteger(result?.objectiveIndex) && objectiveOptions[result.objectiveIndex] !== undefined &&
      Array.isArray(result.projectIndexes) && result.projectIndexes.length === projectOptions.length &&
      result.projectIndexes.every((index, i) => Number.isInteger(index) && projectOptions[i][index] !== undefined) &&
      Array.isArray(result.atsKeywords) && result.atsKeywords.every(skill => ats.includes(skill))
  ) : null;
  return {
    objective: objectiveOptions[choice?.value.objectiveIndex ?? 0],
    projectDescriptions: projectOptions.map((options, i) => options[choice?.value.projectIndexes[i] ?? (options.length - 1)]),
    atsKeywords: [...new Set(choice?.value.atsKeywords ?? ats)],
    suggestions: reviewCv(cv, role).suggestions,
    provider: choice?.provider ?? 'Bộ quy tắc'
  };
}

module.exports = { normalizeCv, reviewCv, generateCv };
