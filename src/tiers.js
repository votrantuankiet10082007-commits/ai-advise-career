const TIERS = [
  { tier: 1, roleLimit: 3, aiLimit: 30, defaultPrice: 50000 },
  { tier: 2, roleLimit: 5, aiLimit: 60, defaultPrice: 100000 },
  { tier: 3, roleLimit: null, aiLimit: 100, defaultPrice: 200000 }
].map(({ tier, roleLimit, aiLimit, defaultPrice }) => {
  const price = Number(process.env[`PREMIUM_PRICE_T${tier}_VND`] || defaultPrice);
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error(`Giá Premium gói ${tier} không hợp lệ.`);
  return Object.freeze({ tier, roleLimit, aiLimit, price });
});
if (TIERS.some((plan, index) => index && plan.price <= TIERS[index - 1].price)) {
  throw new Error('Giá Premium phải tăng dần theo gói.');
}
module.exports = { TIERS: Object.freeze(TIERS), getTier: tier => TIERS[tier - 1] };
