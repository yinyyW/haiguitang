import { getDbPool } from '../db';
import type { User } from '../models/types';
import type { CreateUserInput } from '../models/types';

export const getUserByExternalId = async (externalId: string): Promise<User | null> => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT * FROM users WHERE external_id = ?', [externalId]);
  const list = rows as User[];
  if (!list.length) return null;
  return list[0];
};

export const createUser = async (input: CreateUserInput): Promise<User | null> => {
  const db = getDbPool();
  const { externalId, nickname = null, avatarUrl = null } = input;
  const [result] = await db.query(
    'INSERT INTO users (external_id, nickname, avatar_url) VALUES (?, ?, ?)',
    [externalId, nickname, avatarUrl],
  );
  const insertResult = result as { insertId: number };
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [insertResult.insertId]);
  const list = rows as User[];
  return list[0] ?? null;
};
