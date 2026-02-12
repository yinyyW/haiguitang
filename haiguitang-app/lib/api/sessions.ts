import { fetchWithAuth } from "../apiClient";
import type { Session, Puzzle, Message, SoupType } from "../types";

interface CreateSessionResponse {
  session: {
    id: string;
  };
}

interface SessionsListResponse {
  items: Session[];
}

interface SessionDetailResponse {
  session: Session;
  puzzle: Puzzle;
}

interface MessagesResponse {
  items: Message[];
  next_cursor: string | null;
}

interface PostQuestionResponse {
  user_message: Message;
  assistant_message: Message;
  session?: {
    id: string;
    question_count: number;
    status: string;
    updated_at: string;
  };
}

interface RevealResponse {
  session: Session;
  puzzle: Puzzle & { bottom: string };
}

export const createSession = async (
  selectedType: SoupType,
): Promise<CreateSessionResponse> => {
  const res = await fetchWithAuth("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      soup_type: selectedType,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<CreateSessionResponse>;
};

export const fetchSessions = async (): Promise<Session[]> => {
  const res = await fetchWithAuth("/api/sessions");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as SessionsListResponse;
  return data.items;
};

export const fetchSession = async (sessionId: string): Promise<SessionDetailResponse> => {
  const res = await fetchWithAuth(`/api/sessions/${sessionId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<SessionDetailResponse>;
};

export const fetchMessages = async (sessionId: string): Promise<Message[]> => {
  const res = await fetchWithAuth(`/api/sessions/${sessionId}/messages`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as MessagesResponse;
  return data.items;
};

export const postQuestion = async (
  sessionId: string,
  content: string,
): Promise<PostQuestionResponse> => {
  const res = await fetchWithAuth(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, stream: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<PostQuestionResponse>;
};

export const revealAnswer = async (sessionId: string): Promise<RevealResponse> => {
  const res = await fetchWithAuth(`/api/sessions/${sessionId}/reveal`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<RevealResponse>;
};

export const endSession = async (sessionId: string): Promise<{ session: Session }> => {
  const res = await fetchWithAuth(`/api/sessions/${sessionId}/quit`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err?.error?.message as string) ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ session: Session }>;
};
