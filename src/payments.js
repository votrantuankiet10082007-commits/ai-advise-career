const { randomBytes } = require('node:crypto');
const db = require('./database');
const { bank } = require('./config');
const { getTier } = require('./tiers');
const transaction = require('./transaction');

function getPayment(userId, pendingOnly = false) {
  return db.prepare(`
    SELECT code, tier, amount, bank_name, bank_account, bank_holder, status, created_at, confirmed_at
    FROM payments WHERE user_id = ? AND (? = 0 OR status = 'pending') ORDER BY rowid DESC LIMIT 1
  `).get(userId, Number(pendingOnly)) || null;
}

function createPayment(userId, tier, fail) {
  return transaction(db, () => {
    const current = db.prepare('SELECT premiumTier FROM users WHERE id = ?').get(userId).premiumTier;
    if (tier <= current) fail(409, 'Bạn cần chọn gói cao hơn gói đang dùng.');
    const pending = getPayment(userId, true);
    if (pending) {
      if (pending.tier !== tier) fail(409, 'Bạn đã có đơn đang chờ cho gói khác.');
      return pending;
    }
    if (!bank) fail(503, 'Thanh toán chuyển khoản chưa được cấu hình.');
    const amount = getTier(tier).price - (getTier(current)?.price ?? 0);
    db.prepare(`
      INSERT INTO payments (code, user_id, tier, amount, bank_name, bank_account, bank_holder, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('AC' + randomBytes(7).toString('hex').toUpperCase(), userId, tier, amount, bank.name,
      bank.account, bank.holder, new Date().toISOString());
    return getPayment(userId, true);
  });
}

function cancelPayment(userId, code, fail) {
  transaction(db, () => {
    const order = db.prepare(`
      SELECT status FROM payments WHERE code = ? AND user_id = ?
    `).get(code, userId);

    if (!order) fail(404, 'Không tìm thấy đơn thanh toán.');
    if (order.status === 'cancelled') return;
    if (order.status !== 'pending') {
      fail(409, 'Chỉ có thể hủy đơn đang chờ thanh toán.');
    }

    db.prepare(`
      UPDATE payments SET status = 'cancelled' WHERE code = ?
    `).run(code);
  });
}

function confirmPayment(code, amount, reference) {
  try {
    transaction(db, () => {
      const order = db.prepare('SELECT * FROM payments WHERE code = ?').get(code);
      if (!order || order.amount !== amount) throw new Error('Kiểm tra lại mã đơn và số tiền.');
      if (order.status === 'confirmed') {
        if (order.bank_reference !== reference) throw new Error('Đơn này đã được xác nhận với mã giao dịch khác.');
        return;
      }
      if (order.status !== 'pending') throw new Error('Đơn không còn chờ xác nhận.');
      db.prepare(`
        UPDATE payments SET status = 'confirmed', confirmed_at = ?, bank_reference = ? WHERE code = ?
      `).run(new Date().toISOString(), reference, code);
      db.prepare('UPDATE users SET premium = 1, premiumTier = MAX(premiumTier, ?) WHERE id = ?').run(order.tier, order.user_id);
    });
  } catch (error) {
    if (error.message.includes('payments.bank_reference')) throw new Error('Mã giao dịch đã được dùng cho đơn khác.');
    throw error;
  }
}
module.exports = { getPayment, createPayment, cancelPayment, confirmPayment };
