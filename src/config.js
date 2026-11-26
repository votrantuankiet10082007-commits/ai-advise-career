const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.PORT || 8080);
const production = process.env.NODE_ENV === 'production';
const origin = new URL(process.env.PUBLIC_ORIGIN || `http://localhost:${port}`);
if (production && origin.protocol !== 'https:') {
  throw new Error('PUBLIC_ORIGIN phải dùng HTTPS trong production.');
}
const bank = {
  name: process.env.BANK_NAME?.trim(),
  account: process.env.BANK_ACCOUNT?.trim(),
  holder: process.env.BANK_HOLDER?.trim()
};

module.exports = {
  root, port, production, origin: origin.origin,
  host: process.env.HOST || (production ? '127.0.0.1' : '0.0.0.0'),
  explicitOrigin: Boolean(process.env.PUBLIC_ORIGIN),
  databaseDir: path.resolve(root, process.env.DATABASE_DIR || 'database'),
  bankQrFile: path.resolve(root, process.env.BANK_QR_FILE?.trim() || 'database/bank-qr.jpg'),
  bank: bank.name && bank.account && bank.holder ? bank : null
};
