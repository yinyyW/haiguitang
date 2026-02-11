import { getDbPool } from '../db';
import type { Puzzle } from '../models/types';
import type { SoupType } from '../models/types';

export const getPuzzleById = async (id: number): Promise<Puzzle | null> => {
  const db = getDbPool();
  const [rows] = await db.query('SELECT * FROM puzzles WHERE id = ?', [id]);
  const list = rows as Puzzle[];
  if (!list.length) return null;
  return list[0];
};

export const getRandomPuzzleBySoupType = async (
  soupType: SoupType,
  difficulty?: number,
): Promise<Puzzle | null> => {
  const db = getDbPool();
  let sql =
    'SELECT * FROM puzzles WHERE status = ? AND soup_type = ? ORDER BY RAND() LIMIT 1';
  const params: (string | number)[] = ['ACTIVE', soupType];
  if (difficulty != null) {
    sql =
      'SELECT * FROM puzzles WHERE status = ? AND soup_type = ? AND difficulty = ? ORDER BY RAND() LIMIT 1';
    params.push(difficulty);
  }
  const [rows] = await db.query(sql, params);
  const list = rows as Puzzle[];
  if (!list.length) return null;
  return list[0];
};
