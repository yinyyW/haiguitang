export type SoupType = 'CLEAR' | 'RED' | 'BLACK';
export type SessionStatus = 'PLAYING' | 'REVEALED' | 'QUIT';
export type MessageRole = 'USER' | 'ASSISTANT';
export type AnswerType = 'YES' | 'NO' | 'IRRELEVANT' | 'BOTH' | null;
export type SessionImageMode = 'SURFACE' | 'BOTTOM' | 'SUMMARY';

export interface Session {
  id: string;
  soup_type: SoupType;
  title: string | null;
  status: SessionStatus;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface Puzzle {
  id: string;
  title: string;
  surface: string;
  difficulty: number;
  tags: string[];
  bottom?: string;
  hint_list?: string[];
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  answer_type: AnswerType;
  created_at: string;
}

export interface SessionImage {
  id: string;
  image_url: string;
  created_at: string;
}
