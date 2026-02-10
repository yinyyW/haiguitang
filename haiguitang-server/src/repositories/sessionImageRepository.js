const { getDbPool } = require('../db');

const createSessionImage = async ({ sessionId, imageUrl, promptUsed = null }) => {
  const db = getDbPool();
  const [result] = await db.query(
    'INSERT INTO session_images (session_id, image_url, prompt_used) VALUES (?, ?, ?)',
    [sessionId, imageUrl, promptUsed],
  );

  const [rows] = await db.query('SELECT * FROM session_images WHERE id = ?', [result.insertId]);
  return rows[0] || null;
};

const getImagesBySessionId = async (sessionId) => {
  const db = getDbPool();
  const [rows] = await db.query(
    'SELECT * FROM session_images WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows;
};

module.exports = {
  createSessionImage,
  getImagesBySessionId,
};

