function buildRoadmap(evaluation, role, premium) {
  const gaps = evaluation.topGaps.map(gap => gap.skillKey);
  const skills = [...new Set([...evaluation.failedConstraints, ...gaps, ...role.requiredSkills.map(s => s.skillKey)])];
  const focus = skills.slice(0, premium ? 4 : 1);
  return {
    success: true,
    aiProvider: 'Matching Engine',
    executiveSummaryVi: `Điểm phù hợp với ${role.titleVi} là ${evaluation.overallMatchPercent}%. Bắt đầu với ${focus[0]}.`,
    criticalRoadmap: focus.map((skill, index) => ({
      phaseNumber: index + 1,
      phaseTitle: skill,
      durationWeeks: 2,
      learningMilestones: [
        `Tuần 1: ôn khái niệm cốt lõi của ${skill} và hoàn thành hai bài tập nhỏ.`,
        `Tuần 2: dùng ${skill} trong một bài thực hành thuộc hướng ${role.slug}, rồi ghi lại cách kiểm thử.`
      ],
      proofProjectTitle: `Kho mã thực hành ${skill} có README và ví dụ chạy.`
    }))
  };
}
module.exports = { buildRoadmap };
