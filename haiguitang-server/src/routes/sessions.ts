import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserByExternalId, createUser } from '../repositories/userRepository';
import { getRandomPuzzleBySoupType } from '../repositories/puzzleRepository';
import {
  createSession,
  getSessionById,
  getSessionsByUserId,
  incrementQuestionCount,
  updateSessionStatus,
} from '../repositories/sessionRepository';
import { getPuzzleById } from '../repositories/puzzleRepository';
import { createMessage, getMessagesBySessionId } from '../repositories/messageRepository';
import {
  formatSessionForApi,
  formatPuzzleForApi,
  formatMessageForApi,
  replyError,
  getRequestId,
} from '../lib/api';
import type { SoupType } from '../models/types';

type AiAnswerType = 'YES' | 'NO' | 'IRRELEVANT' | 'BOTH';

interface OpenAiMessage {
  content?: unknown;
}

interface OpenAiChoice {
  message?: unknown;
}

interface OpenAiResponse {
  choices?: unknown;
}

const ANSWER_TEXT_BY_TYPE: Record<AiAnswerType, string> = {
  YES: '是',
  NO: '不是',
  IRRELEVANT: '不重要',
  BOTH: '是也不是',
};

const isAiAnswerType = (value: unknown): value is AiAnswerType =>
  value === 'YES' || value === 'NO' || value === 'IRRELEVANT' || value === 'BOTH';

const extractContentFromOpenAiResponse = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const response = data as OpenAiResponse;
  if (!Array.isArray(response.choices) || response.choices.length === 0) return null;
  const firstChoice = response.choices[0] as OpenAiChoice;
  if (!firstChoice || typeof firstChoice !== 'object') return null;
  if (!firstChoice.message || typeof firstChoice.message !== 'object') return null;
  const message = firstChoice.message as OpenAiMessage;
  if (typeof message.content === 'string') return message.content;
  return null;
};

const parseAnswerTypeFromContent = (rawContent: string | null): AiAnswerType | null => {
  if (!rawContent) return null;
  const trimmed = rawContent.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && 'answer_type' in parsed) {
      const answerTypeValue = (parsed as { answer_type?: unknown }).answer_type;
      if (isAiAnswerType(answerTypeValue)) return answerTypeValue;
    }
  } catch {
    // ignore json parse error
  }
  const upper = trimmed.toUpperCase();
  if (isAiAnswerType(upper)) return upper;
  if (upper.includes('BOTH')) return 'BOTH';
  if (upper.includes('IRRELEVANT')) return 'IRRELEVANT';
  if (upper.includes('YES')) return 'YES';
  if (upper.includes('NO')) return 'NO';
  return null;
};

const classifyAnswerWithAi = async (params: {
  question: string;
  puzzleSurface: string;
  puzzleBottom: string;
}): Promise<AiAnswerType> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            '你是一个海龟汤游戏的裁判，根据给定的汤面、汤底和玩家的问题，判断该问题的回答应该是：YES(是)、NO(不是)、IRRELEVANT(不重要/无关)、BOTH(是也不是)。只输出一个 JSON，例如：{"answer_type":"YES"}，answer_type 只能是 YES/NO/IRRELEVANT/BOTH 之一，不要输出其他内容。',
        },
        {
          role: 'user',
          content: `汤面：${params.puzzleSurface}\n汤底：${params.puzzleBottom}\n玩家问题：${params.question}`,
        },
      ],
      temperature: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`AI HTTP error: ${response.status}`);
  }
  const data = (await response.json()) as unknown;
  const content = extractContentFromOpenAiResponse(data);
  const answerType = parseAnswerTypeFromContent(content);
  if (answerType) return answerType;
  return 'IRRELEVANT';
};

const SOUP_TYPES: SoupType[] = ['CLEAR', 'RED', 'BLACK'];

const getExternalId = (request: FastifyRequest): string | undefined =>
  (request.headers['x-external-id'] as string)?.trim() || undefined;

const ensureUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ id: number } | null> => {
  const externalId = getExternalId(request);
  if (!externalId) {
    const reqId = getRequestId();
    return reply.status(401).send({
      error: replyError('UNAUTHORIZED', 'Missing or invalid X-External-Id', reqId),
    }) as unknown as null;
  }
  let user = await getUserByExternalId(externalId);
  if (!user) user = await createUser({ externalId });
  if (!user) {
    const reqId = getRequestId();
    return reply.status(500).send({
      error: replyError('INTERNAL', 'Failed to get or create user', reqId),
    }) as unknown as null;
  }
  return { id: user.id };
};

export const registerSessionRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/sessions', async (request, reply) => {
    const user = await ensureUser(request, reply);
    if (!user) return;

    const rawLimit = (request.query as { limit?: number })?.limit;
    const limit = Math.min(Number(rawLimit) || 50, 100);
    const sessions = await getSessionsByUserId(user.id, limit);

    return reply.send({
      items: sessions.map(formatSessionForApi),
    });
  });

  app.post<{
    Body: { soup_type?: string; difficulty?: number };
  }>('/api/sessions', async (request, reply) => {
    const user = await ensureUser(request, reply);
    if (!user) return;

    const body = request.body ?? {};
    const soupType = body.soup_type as string | undefined;
    if (!soupType || !SOUP_TYPES.includes(soupType as SoupType)) {
      return reply.status(400).send({
        error: replyError('INVALID_ARGUMENT', 'Invalid soup_type', getRequestId(), {}),
      });
    }
    const reqId = getRequestId();
    const difficulty = body.difficulty as number | undefined;
    const puzzle = await getRandomPuzzleBySoupType(soupType as SoupType, difficulty);
    if (!puzzle) {
      return reply.status(404).send({
        error: replyError(
          'NOT_FOUND',
          'No active puzzle for this soup type',
          reqId,
        ),
      });
    }

    const title = puzzle.title ? `海龟汤 · ${puzzle.title}` : '海龟汤 · 清汤';
    const session = await createSession({
      userId: user.id,
      puzzleId: puzzle.id,
      soupType: soupType as SoupType,
      title,
    });
    if (!session) {
      return reply.status(500).send({
        error: replyError('INTERNAL', 'Failed to create session', reqId),
      });
    }

    return reply.status(201).send({
      session: formatSessionForApi(session),
      puzzle: formatPuzzleForApi(puzzle),
    });
  });

  app.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId',
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;

      const sessionId = Number(request.params.sessionId);
      if (!Number.isInteger(sessionId) || sessionId < 1) {
        return reply.status(400).send({
          error: replyError('INVALID_ARGUMENT', 'Invalid session id', getRequestId()),
        });
      }

      const session = await getSessionById(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: replyError('NOT_FOUND', 'Session not found', getRequestId()),
        });
      }
      if (session.user_id !== user.id) {
        return reply.status(403).send({
          error: replyError('FORBIDDEN', 'Not your session', getRequestId()),
        });
      }

      const puzzle = await getPuzzleById(session.puzzle_id);
      if (!puzzle) {
        return reply.status(404).send({
          error: replyError('NOT_FOUND', 'Puzzle not found', getRequestId()),
        });
      }

      return reply.send({
        session: formatSessionForApi(session),
        puzzle: formatPuzzleForApi(puzzle),
      });
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/messages',
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;

      const sessionId = Number(request.params.sessionId);
      if (!Number.isInteger(sessionId) || sessionId < 1) {
        return reply.status(400).send({
          error: replyError('INVALID_ARGUMENT', 'Invalid session id', getRequestId()),
        });
      }

      const session = await getSessionById(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: replyError('NOT_FOUND', 'Session not found', getRequestId()),
        });
      }
      if (session.user_id !== user.id) {
        return reply.status(403).send({
          error: replyError('FORBIDDEN', 'Not your session', getRequestId()),
        });
      }

      const limit = Math.min(
        Number((request.query as { limit?: number })?.limit) || 100,
        100,
      );
      const messages = await getMessagesBySessionId(sessionId);
      const items = messages.slice(0, limit).map(formatMessageForApi);
      return reply.send({
        items,
        next_cursor: messages.length > limit ? String(limit) : null,
      });
    },
  );

  app.post<{
    Params: { sessionId: string };
    Body: { content?: string; stream?: boolean };
  }>('/api/sessions/:sessionId/messages', async (request, reply) => {
    const user = await ensureUser(request, reply);
    if (!user) return;

    const sessionId = Number(request.params.sessionId);
    if (!Number.isInteger(sessionId) || sessionId < 1) {
      return reply.status(400).send({
        error: replyError('INVALID_ARGUMENT', 'Invalid session id', getRequestId()),
      });
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return reply.status(404).send({
        error: replyError('NOT_FOUND', 'Session not found', getRequestId()),
      });
    }
    if (session.user_id !== user.id) {
      return reply.status(403).send({
        error: replyError('FORBIDDEN', 'Not your session', getRequestId()),
      });
    }

    const puzzle = await getPuzzleById(session.puzzle_id);
    if (!puzzle) {
      return reply.status(500).send({
        error: replyError('INTERNAL', 'Puzzle not found for session', getRequestId()),
      });
    }

    const body = (request.body as { content?: string; stream?: boolean }) ?? {};
    const isStream = body.stream === true;
    const content =
      typeof body.content === 'string'
        ? body.content.trim()
        : '';
    if (!content) {
      return reply.status(400).send({
        error: replyError('INVALID_ARGUMENT', 'content is required', getRequestId()),
      });
    }

    const reqId = getRequestId();
    if (isStream) {
      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');

      const writeEvent = (eventName: string, data: unknown): void => {
        reply.raw.write(`event: ${eventName}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const userMessage = await createMessage({
          sessionId,
          role: 'USER',
          content,
        });
        if (!userMessage) {
          writeEvent('error', { message: 'Failed to save message' });
          reply.raw.end();
          return;
        }

        writeEvent('message.created', {
          user_message_id: String(userMessage.id),
        });

        let assistantAnswerType: AiAnswerType;
        try {
          assistantAnswerType = await classifyAnswerWithAi({
            question: content,
            puzzleSurface: puzzle.surface,
            puzzleBottom: puzzle.bottom,
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message
              ? error.message
              : 'AI service unavailable';
          writeEvent('error', { message });
          reply.raw.end();
          return;
        }

        const assistantContent = ANSWER_TEXT_BY_TYPE[assistantAnswerType];

        writeEvent('assistant.delta', {
          delta: assistantContent,
        });

        const assistantMessage = await createMessage({
          sessionId,
          role: 'ASSISTANT',
          content: assistantContent,
          answerType: assistantAnswerType,
        });
        if (!assistantMessage) {
          writeEvent('error', { message: 'Failed to save assistant message' });
          reply.raw.end();
          return;
        }

        await incrementQuestionCount(sessionId);
        const updated = await getSessionById(sessionId);

        writeEvent('assistant.done', {
          assistant_message_id: String(assistantMessage.id),
          content: assistantContent,
          answer_type: assistantAnswerType,
        });

        if (updated) {
          writeEvent('session.updated', {
            session_id: String(updated.id),
            question_count: updated.question_count,
            status: updated.status,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Stream failed';
        writeEvent('error', { message });
      } finally {
        reply.raw.end();
      }

      return;
    }

    const userMessage = await createMessage({
      sessionId,
      role: 'USER',
      content,
    });
    if (!userMessage) {
      return reply.status(500).send({
        error: replyError('INTERNAL', 'Failed to save message', reqId),
      });
    }

    let assistantAnswerType: AiAnswerType;
    try {
      assistantAnswerType = await classifyAnswerWithAi({
        question: content,
        puzzleSurface: puzzle.surface,
        puzzleBottom: puzzle.bottom,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'AI service unavailable';
      return reply.status(503).send({
        error: replyError('AI_UNAVAILABLE', message, reqId),
      });
    }

    const assistantContent = ANSWER_TEXT_BY_TYPE[assistantAnswerType];

    const assistantMessage = await createMessage({
      sessionId,
      role: 'ASSISTANT',
      content: assistantContent,
      answerType: assistantAnswerType,
    });
    if (!assistantMessage) {
      return reply.status(500).send({
        error: replyError('INTERNAL', 'Failed to save assistant message', reqId),
      });
    }

    await incrementQuestionCount(sessionId);
    const updated = await getSessionById(sessionId);

    return reply.send({
      user_message: formatMessageForApi(userMessage),
      assistant_message: formatMessageForApi(assistantMessage),
      session: updated
        ? {
            id: formatSessionForApi(updated).id,
            question_count: updated.question_count,
            status: updated.status,
            updated_at: formatSessionForApi(updated).updated_at,
          }
        : undefined,
    });
  });

  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/reveal',
    async (request, reply) => {
      console.log(`reveal ${request.params.sessionId} answer`);
      const user = await ensureUser(request, reply);
      if (!user) return;

      const sessionId = Number(request.params.sessionId);
      if (!Number.isInteger(sessionId) || sessionId < 1) {
        return reply.status(400).send({
          error: replyError('INVALID_ARGUMENT', 'Invalid session id', getRequestId()),
        });
      }

      const session = await getSessionById(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: replyError('NOT_FOUND', 'Session not found', getRequestId()),
        });
      }
      if (session.user_id !== user.id) {
        return reply.status(403).send({
          error: replyError('FORBIDDEN', 'Not your session', getRequestId()),
        });
      }

      const updated = await updateSessionStatus(sessionId, 'REVEALED');
      const puzzle = await getPuzzleById(session.puzzle_id);
      if (!puzzle || !updated) {
        return reply.status(500).send({
          error: replyError('INTERNAL', 'Failed to reveal', getRequestId()),
        });
      }

      return reply.send({
        session: formatSessionForApi(updated),
        puzzle: formatPuzzleForApi({ ...puzzle, bottom: puzzle.bottom }),
      });
    },
  );

  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/quit',
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;

      const sessionId = Number(request.params.sessionId);
      if (!Number.isInteger(sessionId) || sessionId < 1) {
        return reply.status(400).send({
          error: replyError('INVALID_ARGUMENT', 'Invalid session id', getRequestId()),
        });
      }

      const session = await getSessionById(sessionId);
      if (!session) {
        return reply.status(404).send({
          error: replyError('NOT_FOUND', 'Session not found', getRequestId()),
        });
      }
      if (session.user_id !== user.id) {
        return reply.status(403).send({
          error: replyError('FORBIDDEN', 'Not your session', getRequestId()),
        });
      }

      const updated = await updateSessionStatus(sessionId, 'QUIT');
      if (!updated) {
        return reply.status(500).send({
          error: replyError('INTERNAL', 'Failed to quit', getRequestId()),
        });
      }

      return reply.send({
        session: formatSessionForApi(updated),
      });
    },
  );
};
