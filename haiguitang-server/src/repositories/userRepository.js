const { getDbPool } = require('../db');

const getUserByExternalId = async (externalId) => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT * FROM users WHERE external_id = ?', [externalId]);
  if (!rows.length) return null;
  return rows[0];
};

const createUser = async ({ externalId, nickname = null, avatarUrl = null }) => {
  const db = getDbPool();
  const [result] = await db.query(
    'INSERT INTO users (external_id, nickname, avatar_url) VALUES (?, ?, ?)',
    [externalId, nickname, avatarUrl],
  );

  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  return rows[0] || null;
};

module.exports = {
  getUserByExternalId,
  createUser,
};

