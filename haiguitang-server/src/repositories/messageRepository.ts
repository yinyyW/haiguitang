import { getDbPool } from '../db';
import type { Message } from '../models/types';
import type { CreateMessageInput } from '../models/types';

export const createMessage = async (input: CreateMessageInput): Promise<Message | null> => {
  const db = getDbPool();
  const { sessionId, role, content, answerType = null } = input;
  const [result] = await db.query(
    'INSERT INTO messages (session_id, role, content, answer_type) VALUES (?, ?, ?, ?)',
    [sessionId, role, content, answerType],
  );
  const insertResult = result as { insertId: number };
  const [rows] = await db.query('SELECT * FROM messages WHERE id = ?', [insertResult.insertId]);
  const list = rows as Message[];
  return list[0] ?? null;
};

export const getMessagesBySessionId = async (sessionId: number): Promise<Message[]> => {
  const db = getDbPool();
  const [rows] = await db.query(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows as Message[];
};
