import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ProxyAgent, setGlobalDispatcher } from "undici";
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
import type { SoupType, Session, Puzzle } from '../models/types';

type AiAnswerType = 'YES' | 'NO' | 'IRRELEVANT' | 'BOTH';

interface MessageRequestContext {
  sessionId: number;
  session: Session;
  puzzle: Puzzle;
  content: string;
  isStream: boolean;
  reqId: string;
  headersOrigin?: string;
}

const validateMessageRequest = async (
  request: FastifyRequest<{
    Params: { sessionId: string };
    Body: { content?: string; stream?: boolean };
  }>,
  reply: FastifyReply,
  userId: number,
): Promise<MessageRequestContext | null> => {
  const sessionId = Number(request.params.sessionId);
  if (!Number.isInteger(sessionId) || sessionId < 1) {
    reply.status(400).send({
      error: replyError('INVALID_ARGUMENT', 'Invalid session id', getRequestId()),
    });
    return null;
  }
  const session = await getSessionById(sessionId);
  if (!session) {
    reply.status(404).send({
      error: replyError('NOT_FOUND', 'Session not found', getRequestId()),
    });
    return null;
  }
  if (session.user_id !== userId) {
    reply.status(403).send({
      error: replyError('FORBIDDEN', 'Not your session', getRequestId()),
    });
    return null;
  }
  const puzzle = await getPuzzleById(session.puzzle_id);
  if (!puzzle) {
    reply.status(500).send({
      error: replyError('INTERNAL', 'Puzzle not found for session', getRequestId()),
    });
    return null;
  }
  const body = (request.body as { content?: string; stream?: boolean }) ?? {};
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    reply.status(400).send({
      error: replyError('INVALID_ARGUMENT', 'content is required', getRequestId()),
    });
    return null;
  }
  return {
    sessionId,
    session,
    puzzle,
    content,
    isStream: body.stream === true,
    reqId: getRequestId(),
    headersOrigin: request.headers.origin
  };
};

const handlePostMessageStream = async (
  reply: FastifyReply,
  ctx: MessageRequestContext,
): Promise<void> => {
  reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('Access-Control-Allow-Origin', ctx.headersOrigin || '*');
  
  const writeEvent = (eventName: string, data: unknown): void => {
    reply.raw.write(`event: ${eventName}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const userMessage = await createMessage({
      sessionId: ctx.sessionId,
      role: 'USER',
      content: ctx.content,
    });
    if (!userMessage) {
      writeEvent('error', { message: 'Failed to save message' });
      reply.raw.end();
      return;
    }

    writeEvent('message.created', { user_message_id: String(userMessage.id) });

    let assistantAnswerType: AiAnswerType;
    try {
      assistantAnswerType = await classifyAnswerWithAi({
        question: ctx.content,
        puzzleSurface: ctx.puzzle.surface,
        puzzleBottom: ctx.puzzle.bottom,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'AI service unavailable';
      writeEvent('error', { message });
      reply.raw.end();
      return;
    }

    const assistantContent = ANSWER_TEXT_BY_TYPE[assistantAnswerType];
    writeEvent('assistant.delta', { delta: assistantContent });

    const assistantMessage = await createMessage({
      sessionId: ctx.sessionId,
      role: 'ASSISTANT',
      content: assistantContent,
      answerType: assistantAnswerType,
    });
    if (!assistantMessage) {
      writeEvent('error', { message: 'Failed to save assistant message' });
      reply.raw.end();
      return;
    }

    await incrementQuestionCount(ctx.sessionId);
    const updated = await getSessionById(ctx.sessionId);

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
      error instanceof Error && error.message ? error.message : 'Stream failed';
    writeEvent('error', { message });
  } finally {
    reply.raw.end();
  }
};

const handlePostMessageNonStream = async (
  reply: FastifyReply,
  ctx: MessageRequestContext,
): Promise<void> => {
  const userMessage = await createMessage({
    sessionId: ctx.sessionId,
    role: 'USER',
    content: ctx.content,
  });
  if (!userMessage) {
    reply.status(500).send({
      error: replyError('INTERNAL', 'Failed to save message', ctx.reqId),
    });
    return;
  }

  let assistantAnswerType: AiAnswerType;
  try {
    assistantAnswerType = await classifyAnswerWithAi({
      question: ctx.content,
      puzzleSurface: ctx.puzzle.surface,
      puzzleBottom: ctx.puzzle.bottom,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : 'AI service unavailable';
    reply.status(503).send({
      error: replyError('AI_UNAVAILABLE', message, ctx.reqId),
    });
    return;
  }

  const assistantContent = ANSWER_TEXT_BY_TYPE[assistantAnswerType];
  const assistantMessage = await createMessage({
    sessionId: ctx.sessionId,
    role: 'ASSISTANT',
    content: assistantContent,
    answerType: assistantAnswerType,
  });
  if (!assistantMessage) {
    reply.status(500).send({
      error: replyError('INTERNAL', 'Failed to save assistant message', ctx.reqId),
    });
    return;
  }

  await incrementQuestionCount(ctx.sessionId);
  const updated = await getSessionById(ctx.sessionId);

  reply.send({
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
};

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
  if (process.env.NODE_ENV !== 'production') {
    // 这里的 7890 换成你代理软件的 HTTP 端口
    const proxyAgent = new ProxyAgent('http://127.0.0.1:7897'); 
    setGlobalDispatcher(proxyAgent);
    console.log("🌐 已挂载全局代理: http://127.0.0.1:7897");
  }

  // init gemini model
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  
  // const model = genAI.getGenerativeModel({
  //   model: "gemini-3-flash-preview",
  // });

  // ask question, model should only answer yes/no/irrelevant/both
  // const prompt = `
  //   你是一个海龟汤主持人。根据汤底事实回答玩家。
  //   汤底：${params.puzzleBottom}
  //   汤面：${params.puzzleSurface}
    
  //   你必须且只能输出如下格式的 JSON：
  //   {"answer_type": "YES" | "NO" | "IRRELEVANT" | "BOTH"}
    
  //   规则：
  //   - YES: 玩家猜对或符合事实。
  //   - NO: 玩家猜错或不符合事实。
  //   - IRRELEVANT: 问题与真相无关。
  //   - BOTH: 描述中一部分对一部分错，或者情况复杂。
    
  //   玩家问题：${params.question}
  // `;
  try {
    // const result = await model.generateContent(prompt);
    // const responseText = result.response.text();
    
    // const data = JSON.parse(responseText);
    // const content = extractContentFromOpenAiResponse(data);
    // const answerType = parseAnswerTypeFromContent(content);
    // if (answerType) return answerType;
    return 'IRRELEVANT';
  } catch (error) {
    return 'IRRELEVANT';
  }
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

    const ctx = await validateMessageRequest(request, reply, user.id);
    if (!ctx) return;

    if (ctx.isStream) {
      await handlePostMessageStream(reply, ctx);
    } else {
      await handlePostMessageNonStream(reply, ctx);
    }
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
