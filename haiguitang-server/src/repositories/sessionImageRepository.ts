import { getDbPool } from '../db';
import type { SessionImage } from '../models/types';
import type { CreateSessionImageInput } from '../models/types';

export const createSessionImage = async (
  input: CreateSessionImageInput,
): Promise<SessionImage | null> => {
  const db = getDbPool();
  const { sessionId, imageUrl, promptUsed = null } = input;
  const [result] = await db.query(
    'INSERT INTO session_images (session_id, image_url, prompt_used) VALUES (?, ?, ?)',
    [sessionId, imageUrl, promptUsed],
  );
  const insertResult = result as { insertId: number };
  const [rows] = await db.query('SELECT * FROM session_images WHERE id = ?', [
    insertResult.insertId,
  ]);
  const list = rows as SessionImage[];
  return list[0] ?? null;
};

export const getImagesBySessionId = async (sessionId: number): Promise<SessionImage[]> => {
  const db = getDbPool();
  const [rows] = await db.query(
    'SELECT * FROM session_images WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
  return rows as SessionImage[];
};
