const fs = require('node:fs');
const path = require('node:path');
const folder = 'stitch_ai_career_advisor/chinh_sua_cv_ai/';
const updates = new Map();

function edit(relative, before, after) {
  const file = path.join(__dirname, relative);
  const original = updates.get(file) ?? fs.readFileSync(file, 'utf8');
  if (original.includes(after)) return;
  if (!original.includes(before)) throw new Error('Không tìm thấy vị trí cập nhật trong ' + relative);
  updates.set(file, original.replace(before, () => after));
}

edit(folder + 'code.html', '<form id="cv-form">', '<form id="cv-form">\n          <p>Các mục có dấu <strong>*</strong> là bắt buộc khi tạo CV.</p>');
edit(folder + 'code.html', 'Họ tên<input data-field="name"', 'Họ tên *<input required data-field="name"');
edit(folder + 'code.html', 'Email<input data-field="email"', 'Email *<input required data-field="email"');
edit(folder + 'code.html', 'GitHub / Portfolio<input', 'GitHub / Portfolio (tùy chọn)<input');
edit(folder + 'app.js', "const longFields = new Set", "const optionalSections = new Set(['projects', 'experience', 'certificates']);\nconst longFields = new Set");
edit(folder + 'app.js', "    wrapper.append(input);", `    if (key === 'skills') {
      input.placeholder = name === 'group'
        ? 'Ví dụ: Lập trình, Làm việc nhóm, Công cụ'
        : 'Ví dụ: Docker, OOP, Java, C++';
    }
    wrapper.append(input);`);
edit(folder + 'app.js', "fieldset.append(el('legend', title), rows,", "fieldset.append(el('legend', optionalSections.has(key) ? title + ' (tùy chọn)' : title), rows,");
edit(folder + 'app.js', "    const version = edited;", `    if (mode === 'generate') {
      if (!form.reportValidity()) return;
      if (!readCv().name) {
        $('ai-status').textContent = 'Hãy nhập họ tên.';
        form.querySelector('[data-field="name"]').focus();
        return;
      }
    }
    const version = edited;`);
edit('src/cv.js', "  if (!cv.projects.length) suggestions.push('Thêm dự án bạn đã thực hiện.');", "  // Dự án có thể bỏ trống nếu ứng viên chưa có.");
edit('server.js', "      // CV text is sent to an external provider only after explicit user consent.", `      if (!cv.name || !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(cv.email)) {
        fail(400, 'Họ tên và email hợp lệ là bắt buộc khi tạo CV.');
      }
      // CV text is sent to an external provider only after explicit user consent.`);

for (const [file, content] of updates) fs.writeFileSync(file, content, 'utf8');
console.log('Đã cập nhật biểu mẫu tạo CV.');
