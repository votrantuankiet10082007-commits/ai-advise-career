const { confirmPayment } = require('../src/payments');
const [code, amount, reference] = process.argv.slice(2);
if (!/^AC[A-F0-9]{14}$/.test(code || '') || !/^[1-9][0-9]*$/.test(amount || '') ||
  !Number.isSafeInteger(Number(amount)) || !reference?.trim() || reference.length > 120) {
  console.error('Cách dùng: npm run confirm-payment -- MA_DON SO_TIEN_VND MA_GIAO_DICH_NGAN_HANG');
  process.exitCode = 1;
} else {
  try {
    confirmPayment(code, Number(amount), reference.trim());
    console.log('Đã xác nhận đơn thanh toán Premium.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
