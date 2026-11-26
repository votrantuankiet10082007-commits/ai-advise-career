const fs = require('node:fs');
const path = require('node:path');
const photoChanges = {
  "server.js": [
    [
      "          if (!avatarChoices.has(input.avatar)) fail(400, 'Avatar không hợp lệ.');",
      "          const photo = typeof input.avatar === 'string' && input.avatar.length <= 20000\n            ? /^data:image\\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.avatar) : null;\n          const bytes = photo && Buffer.from(photo[1], 'base64');\n          const jpeg = bytes && bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 &&\n            bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217 &&\n            bytes.toString('base64') === photo[1];\n          if (!avatarChoices.has(input.avatar) && !jpeg) fail(400, 'Avatar không hợp lệ hoặc quá lớn.');"
    ],
    [
      "default-src 'self'; style-src",
      "default-src 'self'; img-src 'self' data:; style-src"
    ]
  ],
  "stitch_ai_career_advisor/dang_nhap_tai_khoan/code.html": [
    [
      "<option value=\"initials\">Chữ viết tắt</option>",
      "<option value=\"initials\">Chữ viết tắt</option>\n          <option value=\"photo\">Ảnh cá nhân</option>"
    ],
    [
      "        <label>Trường<input",
      "        <label>Chọn ảnh từ máy tính\n          <input id=\"avatar-file\" type=\"file\" accept=\"image/jpeg,image/png,image/webp\">\n        </label>\n        <label>Trường<input"
    ]
  ],
  "stitch_ai_career_advisor/dang_nhap_tai_khoan/style.css": [
    [
      "#avatar { padding:10px;border-radius:10px;background:#484f88 }",
      "#avatar { padding:10px;border-radius:10px;background:#484f88 }\n#avatar:has(img) { padding: 0; }\n#avatar img { display: block; width: 52px; height: 52px; border-radius: 10px; object-fit: cover; }"
    ]
  ],
  "stitch_ai_career_advisor/dang_nhap_tai_khoan/app.js": [
    [
      "  profile.elements.avatar.value = user.avatar || 'initials';",
      "  const isPhoto = user.avatar?.startsWith('data:image/jpeg;base64,');\n  if (isPhoto) {\n    const image = document.createElement('img');\n    image.src = user.avatar;\n    image.alt = 'Ảnh đại diện';\n    $('avatar').replaceChildren(image);\n  }\n  profile.elements.avatar.value = isPhoto ? 'photo' : user.avatar || 'initials';\n  $('avatar-file').value = '';"
    ],
    [
      "profile.addEventListener('submit', event => {",
      "$('avatar-file').addEventListener('change', event => {\n  if (event.target.files.length) profile.elements.avatar.value = 'photo';\n});\n\nasync function encodeAvatar(file) {\n  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {\n    throw new Error('Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB.');\n  }\n  let image;\n  try {\n    image = await createImageBitmap(file);\n  } catch {\n    throw new Error('Không đọc được ảnh đã chọn.');\n  }\n  try {\n    const side = Math.min(image.width, image.height);\n    const canvas = document.createElement('canvas');\n    canvas.width = canvas.height = 128;\n    const context = canvas.getContext('2d');\n    context.fillStyle = '#fff';\n    context.fillRect(0, 0, 128, 128);\n    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2,\n      side, side, 0, 0, 128, 128);\n    return canvas.toDataURL('image/jpeg', 0.65);\n  } finally {\n    image.close();\n  }\n}\n\nprofile.addEventListener('submit', event => {"
    ],
    [
      "    const { user } = await api('profile', 'PUT', Object.fromEntries(new FormData(profile)));",
      "    const data = Object.fromEntries(new FormData(profile));\n    if (data.avatar === 'photo') {\n      const file = $('avatar-file').files[0];\n      if (file) data.avatar = await encodeAvatar(file);\n      else if ($('avatar').querySelector('img')) delete data.avatar;\n      else throw new Error('Hãy chọn ảnh từ máy tính.');\n    }\n    const { user } = await api('profile', 'PUT', data);"
    ]
  ]
};
const accountChanges = {
  "src/database.js": [
    [
      "const transaction = require('./transaction');",
      "const transaction = require('./transaction');\nconst { randomInt } = require('node:crypto');\n\nfunction nextPublicId() {\n  const exists = db.prepare('SELECT 1 FROM users WHERE publicId = ?');\n  let id;\n  do {\n    id = String(randomInt(100000000, 1000000000));\n  } while (exists.get(id));\n  return id;\n}\n"
    ],
    [
      "  if (!profileColumns.has('premiumTier')) {",
      "  if (!profileColumns.has('publicId')) db.exec('ALTER TABLE users ADD COLUMN publicId TEXT');\n  if (!profileColumns.has('avatar')) db.exec(\"ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT 'initials'\");\n  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_public_id ON users(publicId)');\n  const assign = db.prepare('UPDATE users SET publicId = ? WHERE id = ?');\n  for (const user of db.prepare('SELECT id FROM users WHERE publicId IS NULL').all()) {\n    assign.run(nextPublicId(), user.id);\n  }\n  if (!profileColumns.has('premiumTier')) {"
    ],
    [
      "module.exports = db;",
      "db.nextPublicId = nextPublicId;\nmodule.exports = db;"
    ]
  ],
  "src/auth.js": [
    [
      "SELECT users.id, email, name, premium",
      "SELECT users.id, publicId, avatar, email, name, premium"
    ]
  ],
  "server.js": [
    [
      "async function body(req) {",
      "const accountTransaction = require('./src/transaction');\nconst avatarChoices = new Set(['initials', 'laptop', 'rocket', 'robot']);\nconst nameKey = name => name.normalize('NFKC').trim().replace(/\\s+/g, ' ').toLowerCase();\n\nfunction checkAccountName(name, id) {\n  const key = nameKey(name);\n  for (const user of db.prepare('SELECT id, name FROM users').iterate()) {\n    if (user.id !== id && nameKey(user.name) === key) fail(409, 'Tên này đã được sử dụng.');\n  }\n}\n\nasync function body(req) {"
    ],
    [
      "(register && (password.length < 10 || !name))) fail(400, 'Kiểm tra họ tên, email và mật khẩu (10–128 ký tự khi đăng ký).');",
      "(register && (!name || password.length < 8 || !/\\p{L}/u.test(password) ||\n          !/[0-9]/.test(password) || !/[^\\p{L}\\p{N}\\p{M}\\s]/u.test(password)))) {\n      fail(400, register ? 'Nhập họ tên, email và mật khẩu 8–128 ký tự có chữ cái, số và ký tự đặc biệt.' : 'Kiểm tra email và mật khẩu.');\n    }"
    ],
    [
      "      const result = db.prepare('INSERT INTO users (id, email, name, password) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')\n        .run(id, email, name, hash);\n      if (!result.changes) fail(409, 'Email đã được đăng ký.');",
      "      accountTransaction(db, () => {\n        if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'Email đã được đăng ký.');\n        checkAccountName(name, id);\n        db.prepare('INSERT INTO users (id, email, name, password, publicId) VALUES (?, ?, ?, ?, ?)')\n          .run(id, email, name, hash, db.nextPublicId());\n      });"
    ],
    [
      "        const profile = { ...user, ...update };\n        db.prepare('UPDATE users SET name = ?, university = ?, role = ?, targetSpecialty = ?, facebook = ?, linkedin = ?, github = ?, projectUrl = ? WHERE id = ?')\n          .run(profile.name, profile.university, profile.role, profile.targetSpecialty, profile.facebook, profile.linkedin, profile.github, profile.projectUrl, user.id);",
      "        if ('avatar' in input) {\n          if (!avatarChoices.has(input.avatar)) fail(400, 'Avatar không hợp lệ.');\n          update.avatar = input.avatar;\n        }\n        const profile = { ...user, ...update };\n        accountTransaction(db, () => {\n          if (nameKey(profile.name) !== nameKey(user.name)) checkAccountName(profile.name, user.id);\n          db.prepare('UPDATE users SET name = ?, university = ?, role = ?, targetSpecialty = ?, facebook = ?, linkedin = ?, github = ?, projectUrl = ?, avatar = ? WHERE id = ?')\n            .run(profile.name, profile.university, profile.role, profile.targetSpecialty, profile.facebook, profile.linkedin, profile.github, profile.projectUrl, profile.avatar, user.id);\n        });"
    ],
    [
      "          if (!avatarChoices.has(input.avatar)) fail(400, 'Avatar không hợp lệ.');",
      "          const photo = typeof input.avatar === 'string' && input.avatar.length <= 20000\n            ? /^data:image\\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.avatar) : null;\n          const bytes = photo && Buffer.from(photo[1], 'base64');\n          const jpeg = bytes && bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 &&\n            bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217 &&\n            bytes.toString('base64') === photo[1];\n          if (!avatarChoices.has(input.avatar) && !jpeg) fail(400, 'Avatar không hợp lệ hoặc quá lớn.');"
    ],
    [
      "default-src 'self'; style-src",
      "default-src 'self'; img-src 'self' data:; style-src"
    ]
  ],
  "stitch_ai_career_advisor/dang_nhap_tai_khoan/code.html": [
    [
      "<p id=\"profile-email\"></p>",
      "<p id=\"profile-email\"></p>\n      <p>Mã người dùng <strong id=\"public-id\"></strong></p>"
    ],
    [
      "        <label>Trường<input",
      "        <label>Avatar<select name=\"avatar\">\n          <option value=\"initials\">Chữ viết tắt</option>\n          <option value=\"laptop\">💻 Máy tính</option>\n          <option value=\"rocket\">🚀 Tên lửa</option>\n          <option value=\"robot\">🤖 Robot</option>\n        </select></label>\n        <label>Trường<input"
    ],
    [
      "<option value=\"initials\">Chữ viết tắt</option>",
      "<option value=\"initials\">Chữ viết tắt</option>\n          <option value=\"photo\">Ảnh cá nhân</option>"
    ],
    [
      "        <label>Trường<input",
      "        <label>Chọn ảnh từ máy tính\n          <input id=\"avatar-file\" type=\"file\" accept=\"image/jpeg,image/png,image/webp\">\n        </label>\n        <label>Trường<input"
    ]
  ],
  "stitch_ai_career_advisor/dang_nhap_tai_khoan/app.js": [
    [
      "password.minLength = value ? 10 : 0;",
      "password.minLength = value ? 8 : 0;"
    ],
    [
      "  $('avatar').textContent = user.name.trim().split(/\\s+/).slice(-2).map(word => word[0]).join('').toUpperCase();",
      "  const initials = user.name.trim().split(/\\s+/).slice(-2).map(word => [...word][0]).join('').toUpperCase();\n  const avatars = { laptop: '💻', rocket: '🚀', robot: '🤖' };\n  $('avatar').textContent = avatars[user.avatar] || initials;\n  $('public-id').textContent = user.publicId;\n  profile.elements.avatar.value = user.avatar || 'initials';"
    ],
    [
      "(register && (!data.name.trim() || data.password.length < 10 || data.password.length > 128))) {\n    $('status').textContent = 'Kiểm tra email, họ tên và mật khẩu (10–128 ký tự khi đăng ký).';",
      "(register && (!data.name.trim() || data.password.length < 8 || data.password.length > 128 ||\n        !/\\p{L}/u.test(data.password) || !/[0-9]/.test(data.password) || !/[^\\p{L}\\p{N}\\p{M}\\s]/u.test(data.password)))) {\n    $('status').textContent = register ? 'Mật khẩu cần 8–128 ký tự, gồm chữ cái, số và ký tự đặc biệt. Hãy kiểm tra cả họ tên và email.' : 'Kiểm tra email và mật khẩu.';"
    ],
    [
      "  profile.elements.avatar.value = user.avatar || 'initials';",
      "  const isPhoto = user.avatar?.startsWith('data:image/jpeg;base64,');\n  if (isPhoto) {\n    const image = document.createElement('img');\n    image.src = user.avatar;\n    image.alt = 'Ảnh đại diện';\n    $('avatar').replaceChildren(image);\n  }\n  profile.elements.avatar.value = isPhoto ? 'photo' : user.avatar || 'initials';\n  $('avatar-file').value = '';"
    ],
    [
      "profile.addEventListener('submit', event => {",
      "$('avatar-file').addEventListener('change', event => {\n  if (event.target.files.length) profile.elements.avatar.value = 'photo';\n});\n\nasync function encodeAvatar(file) {\n  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {\n    throw new Error('Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB.');\n  }\n  let image;\n  try {\n    image = await createImageBitmap(file);\n  } catch {\n    throw new Error('Không đọc được ảnh đã chọn.');\n  }\n  try {\n    const side = Math.min(image.width, image.height);\n    const canvas = document.createElement('canvas');\n    canvas.width = canvas.height = 128;\n    const context = canvas.getContext('2d');\n    context.fillStyle = '#fff';\n    context.fillRect(0, 0, 128, 128);\n    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2,\n      side, side, 0, 0, 128, 128);\n    return canvas.toDataURL('image/jpeg', 0.65);\n  } finally {\n    image.close();\n  }\n}\n\nprofile.addEventListener('submit', event => {"
    ],
    [
      "    const { user } = await api('profile', 'PUT', Object.fromEntries(new FormData(profile)));",
      "    const data = Object.fromEntries(new FormData(profile));\n    if (data.avatar === 'photo') {\n      const file = $('avatar-file').files[0];\n      if (file) data.avatar = await encodeAvatar(file);\n      else if ($('avatar').querySelector('img')) delete data.avatar;\n      else throw new Error('Hãy chọn ảnh từ máy tính.');\n    }\n    const { user } = await api('profile', 'PUT', data);"
    ]
  ],
  "stitch_ai_career_advisor/dang_nhap_tai_khoan/style.css": [
    [
      "#avatar { padding:10px;border-radius:10px;background:#484f88 }",
      "#avatar { padding:10px;border-radius:10px;background:#484f88 }\n#avatar:has(img) { padding: 0; }\n#avatar img { display: block; width: 52px; height: 52px; border-radius: 10px; object-fit: cover; }"
    ]
  ]
};
const pending = new Map();
const hasAccountUpdate = fs.readFileSync(path.join(__dirname, 'src/database.js'), 'utf8').includes('users_public_id');
const changes = hasAccountUpdate ? photoChanges : accountChanges;
for (const [relative, edits] of Object.entries(changes)) {
  const file = path.join(__dirname, relative);
  const original = fs.readFileSync(file, 'utf8');
  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  let content = original.replace(/\r\n/g, '\n');
  if (relative.endsWith('/style.css')) {
    const marker = '/* Ảnh đại diện tài khoản */';
    if (!content.includes(marker) && !content.includes('#avatar:has(img)')) {
      content += '\n' + marker + '\n' +
        '#avatar:has(img) { padding: 0; }\n' +
        '#avatar img { display: block; width: 52px; height: 52px; border-radius: 10px; object-fit: cover; }\n';
    }
    pending.set(file, content.replace(/\n/g, newline));
    continue;
  }
  for (const [before, after] of edits) {
    if (content.includes(after)) continue;
    if (content.split(before).length !== 2) throw Error('Phiên bản khác tại ' + relative + '. Chưa ghi thay đổi.');
    content = content.replace(before, () => after);
  }
  pending.set(file, content.replace(/\n/g, newline));
}
for (const [file, content] of pending) fs.writeFileSync(file, content, 'utf8');
console.log('Đã cập nhật tính năng chọn ảnh đại diện.');
