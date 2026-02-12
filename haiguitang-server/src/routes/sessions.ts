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

    const content = typeof (request.body as { content?: string })?.content === 'string'
      ? (request.body as { content: string }).content.trim()
      : '';
    if (!content) {
      return reply.status(400).send({
        error: replyError('INVALID_ARGUMENT', 'content is required', getRequestId()),
      });
    }

    const reqId = getRequestId();
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
    
    // create dump messages
    const assistantMessage = await createMessage({
      sessionId,
      role: 'ASSISTANT',
      content: '是',
      answerType: 'YES',
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
