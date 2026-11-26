const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { production } = require('./config');
const db = require('./database');

const derive = promisify(scrypt);
const lifetime = 7 * 24 * 60 * 60;
const dummySalt = randomBytes(16).toString('hex');
const digest = token => createHash('sha256').update(token).digest('hex');

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

async function checkPassword(password, stored) {
  const [salt, hash] = stored ? stored.split(':') : [dummySalt, '0'.repeat(128)];
  const result = await derive(password, salt, 64);
  return timingSafeEqual(result, Buffer.from(hash, 'hex')) && Boolean(stored);
}

function sessionToken(req) {
  return req.headers.cookie?.match(/(?:^|;\s*)career_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}

function cookie(res, token, age) {
  res.setHeader('Set-Cookie', `career_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${production ? '; Secure' : ''}`);
}

function logout(req, res) {
  const token = sessionToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
  cookie(res, '', 0);
}

function login(req, res, userId) {
  logout(req, res);
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(now);
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), userId, now + lifetime * 1000);
  cookie(res, token, lifetime);
}

function currentUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  return db.prepare(`
    SELECT users.id, publicId, avatar, email, name, premium, premiumTier, university, role, targetSpecialty, facebook, linkedin, github, projectUrl
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires > ?
  `).get(digest(token), Date.now()) || null;
}

module.exports = { hashPassword, checkPassword, login, logout, currentUser };
