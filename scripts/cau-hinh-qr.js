const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const settings = {
  BANK_NAME: 'ZaloPay (BVBank)',
  BANK_ACCOUNT: '99ZP25245M27898356',
  BANK_HOLDER: 'Võ Trần Tuấn Kiệt',
  BANK_QR_FILE: 'database/bank-qr.jpg'
};

if (!fs.existsSync(path.join(root, 'package.json'))) {
  throw new Error('Giải nén bản cập nhật vào thư mục dự án gốc có package.json.');
}
fs.accessSync(path.join(root, settings.BANK_QR_FILE), fs.constants.R_OK);
const source = fs.existsSync(envPath) ? envPath : path.join(root, '.env.example');
const original = fs.existsSync(source) ? fs.readFileSync(source, 'utf8') : '';
const newline = original.includes('\r\n') ? '\r\n' : '\n';
const keys = /^\s*(?:export\s+)?(BANK_NAME|BANK_ACCOUNT|BANK_HOLDER|BANK_QR_FILE)\s*=/;
const lines = original.trimEnd().split(/\r?\n/).filter(line => !keys.test(line));
for (const [key, value] of Object.entries(settings)) lines.push(key + '=' + value);
const temporary = envPath + '.' + randomUUID() + '.tmp';
try {
  fs.writeFileSync(temporary, lines.join(newline) + newline, { mode: 0o600 });
  fs.renameSync(temporary, envPath);
} finally {
  fs.rmSync(temporary, { force: true });
}
console.log('Đã cấu hình QR ZaloPay cho các đơn Premium mới.');
