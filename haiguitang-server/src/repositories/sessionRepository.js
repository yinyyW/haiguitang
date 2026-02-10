const { getDbPool } = require('../db');

const createSession = async ({ userId, puzzleId, soupType, title = null }) => {
  const db = getDbPool();
  const [result] = await db.query(
    'INSERT INTO sessions (user_id, puzzle_id, soup_type, title) VALUES (?, ?, ?, ?)',
    [userId, puzzleId, soupType, title],
  );

  const [rows] = await db.query('SELECT * FROM sessions WHERE id = ?', [result.insertId]);
  return rows[0] || null;
};

const getSessionById = async (id) => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT * FROM sessions WHERE id = ?', [id]);
  if (!rows.length) return null;
  return rows[0];
};

module.exports = {
  createSession,
  getSessionById,
};

