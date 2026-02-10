const { getDbPool } = require('../db');

const getPuzzleById = async (id) => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT * FROM puzzles WHERE id = ?', [id]);
  if (!rows.length) return null;
  return rows[0];
};

module.exports = {
  getPuzzleById,
};

