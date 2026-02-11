import { createPool } from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';

type RawSoupType = 'WHITE' | 'RED' | 'BLACK';
type SoupType = 'CLEAR' | 'RED' | 'BLACK';

interface RawPuzzle {
  title: string;
  soup_type: RawSoupType;
  difficulty: number;
  tags?: string[];
  surface: string;
  bottom: string;
  hint_list?: string[];
  language?: string;
  status?: string;
  source?: string;
}

const SOUP_TYPE_MAP: Record<RawSoupType, SoupType> = {
  WHITE: 'CLEAR',
  RED: 'RED',
  BLACK: 'BLACK',
};

async function importPuzzles() {
  const filePath = path.resolve(__dirname, '../../puzzle_collection.json');
  const content = await fs.readFile(filePath, 'utf-8');
  const json = JSON.parse(content) as { puzzles: RawPuzzle[] };

  const pool = createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'haiguitang',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
  });

  const sql =
    'INSERT INTO puzzles (title, soup_type, difficulty, tags, surface, bottom, hint_list, language, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  for (const p of json.puzzles) {
    const soupType = SOUP_TYPE_MAP[p.soup_type];
    const difficulty = p.difficulty ?? 3;
    const tags = p.tags && p.tags.length ? JSON.stringify(p.tags) : null;
    const hintList = p.hint_list && p.hint_list.length ? JSON.stringify(p.hint_list) : null;
    const language = p.language ?? 'zh-CN';
    const status = p.status ?? 'ACTIVE';
    const source = p.source ?? 'OFFICIAL';

    await pool.query(sql, [
      p.title,
      soupType,
      difficulty,
      tags,
      p.surface,
      p.bottom,
      hintList,
      language,
      status,
      source,
    ]);
  }

  await pool.end();
}

importPuzzles().catch((err) => {
  console.error(err);
  process.exit(1);
});