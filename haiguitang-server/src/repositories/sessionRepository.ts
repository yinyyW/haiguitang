import { getDbPool } from '../db';
import type { Session } from '../models/types';
import type { CreateSessionInput } from '../models/types';

export const createSession = async (input: CreateSessionInput): Promise<Session | null> => {
  const db = getDbPool();
  const { userId, puzzleId, soupType, title = null } = input;
  const [result] = await db.query(
    'INSERT INTO sessions (user_id, puzzle_id, soup_type, title) VALUES (?, ?, ?, ?)',
    [userId, puzzleId, soupType, title],
  );
  const insertResult = result as { insertId: number };
  const [rows] = await db.query('SELECT * FROM sessions WHERE id = ?', [insertResult.insertId]);
  const list = rows as Session[];
  return list[0] ?? null;
};

export const getSessionsByUserId = async (
  userId: number,
  limit: number,
): Promise<Session[]> => {
  const db = getDbPool();
  const [rows] = await db.query(
    'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit],
  );
  return rows as Session[];
};

export const getSessionById = async (id: number): Promise<Session | null> => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT * FROM sessions WHERE id = ?', [id]);
  const list = rows as Session[];
  if (!list.length) return null;
  return list[0];
};

export const incrementQuestionCount = async (sessionId: number): Promise<void> => {
  const db = getDbPool();
  await db.query(
    'UPDATE sessions SET question_count = question_count + 1, updated_at = NOW(3) WHERE id = ?',
    [sessionId],
  );
};

export const updateSessionStatus = async (
  sessionId: number,
  status: 'PLAYING' | 'REVEALED' | 'QUIT',
): Promise<Session | null> => {
  const db = getDbPool();
  await db.query(
    'UPDATE sessions SET status = ?, ended_at = NOW(3), updated_at = NOW(3) WHERE id = ?',
    [status, sessionId],
  );
  return getSessionById(sessionId);
};
