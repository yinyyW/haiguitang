export type SoupType = 'CLEAR' | 'RED' | 'BLACK';
export type SessionStatus = 'PLAYING' | 'REVEALED' | 'QUIT';
export type MessageRole = 'USER' | 'ASSISTANT';
export type PuzzleStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

export interface User {
  id: number;
  external_id: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Puzzle {
  id: number;
  title: string;
  soup_type: SoupType;
  difficulty: number;
  tags: string[] | null;
  surface: string;
  bottom: string;
  hint_list: string[] | null;
  language: string;
  status: PuzzleStatus;
  source: string;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface Session {
  id: number;
  user_id: number;
  puzzle_id: number;
  soup_type: SoupType;
  title: string | null;
  status: SessionStatus;
  question_count: number;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: number;
  session_id: number;
  role: MessageRole;
  content: string;
  answer_type: string | null;
  created_at: Date;
}

export interface SessionImage {
  id: number;
  session_id: number;
  image_url: string;
  prompt_used: string | null;
  created_at: Date;
}

export interface CreateSessionInput {
  userId: number;
  puzzleId: number;
  soupType: SoupType;
  title?: string | null;
}

export interface CreateMessageInput {
  sessionId: number;
  role: MessageRole;
  content: string;
  answerType?: string | null;
}

export interface CreateUserInput {
  externalId: string;
  nickname?: string | null;
  avatarUrl?: string | null;
}

export interface CreateSessionImageInput {
  sessionId: number;
  imageUrl: string;
  promptUsed?: string | null;
}
