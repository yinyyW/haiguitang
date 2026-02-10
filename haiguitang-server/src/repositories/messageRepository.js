const { getDbPool } = require('../db');

const createMessage = async ({ sessionId, role, content, answerType = null }) => {
  const db = getDbPool();
  const [result] = await db.query(
    'INSERT INTO messages (session_id, role, content, answer_type) VALUES (?, ?, ?, ?)',
    [sessionId, role, content, answerType],
  );

  const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
  return rows[0] || null;
};

const getMessagesBySessionId = async (sessionId) => {
  const db = getDbPool();
  const [rows] = await db.query(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows;
};

module.exports = {
  createMessage,
  getMessagesBySessionId,
};

