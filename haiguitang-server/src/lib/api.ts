const toIso = (d: Date): string =>
  d instanceof Date ? d.toISOString() : new Date(d as unknown as string).toISOString();

export const formatId = (id: number): string => String(id);

export const formatSessionForApi = (s: {
  id: number;
  user_id: number;
  puzzle_id: number;
  soup_type: string;
  title: string | null;
  status: string;
  question_count: number;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}) => ({
  id: formatId(s.id),
  user_id: formatId(s.user_id),
  puzzle_id: formatId(s.puzzle_id),
  soup_type: s.soup_type,
  title: s.title,
  status: s.status,
  question_count: s.question_count,
  started_at: s.started_at ? toIso(s.started_at) : null,
  ended_at: s.ended_at ? toIso(s.ended_at) : null,
  created_at: toIso(s.created_at),
  updated_at: toIso(s.updated_at),
});

const normalizeHintList = (v: unknown): string[] | null => {
  if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? v : null;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
        ? (parsed as string[])
        : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const formatPuzzleForApi = (p: {
  id: number;
  title: string;
  surface: string;
  difficulty: number;
  tags: string[] | null;
  bottom?: string;
  hint_list?: unknown;
}) => {
  const hintList = normalizeHintList(p.hint_list);
  return {
    id: formatId(p.id),
    title: p.title,
    surface: p.surface,
    difficulty: p.difficulty,
    tags: p.tags ?? [],
    ...(p.bottom != null && { bottom: p.bottom }),
    ...(hintList != null && hintList.length > 0 && { hint_list: hintList }),
  };
};

export const formatMessageForApi = (m: {
  id: number;
  role: string;
  content: string;
  answer_type: string | null;
  created_at: Date;
}) => ({
  id: formatId(m.id),
  role: m.role,
  content: m.content,
  answer_type: m.answer_type,
  created_at: toIso(m.created_at),
});

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_ARGUMENT'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL';

export const replyError = (
  code: ErrorCode,
  message: string,
  requestId: string,
  details: Record<string, unknown> = {},
): { code: ErrorCode; message: string; request_id: string; details: Record<string, unknown> } => ({
  code,
  message,
  request_id: requestId,
  details,
});

export const getRequestId = (): string =>
  `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
