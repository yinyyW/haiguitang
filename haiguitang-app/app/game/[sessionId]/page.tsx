"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SoupHeader } from "../../../components/game/SoupHeader";
import { ChatMessageList } from "../../../components/game/ChatMessageList";
import { ChatInputBar } from "../../../components/game/ChatInputBar";
import { RevealPanel } from "../../../components/game/RevealPanel";
import { Button } from "../../../components/ui/Button";
import {
  fetchSession,
  fetchMessages,
  postQuestion,
  revealAnswer,
  endSession,
  triggerSessionImage,
  fetchSessionImages,
} from "../../../lib/api/sessions";
import type { Session, Puzzle, Message, SessionImage, AnswerType } from "../../../lib/types";
import { useSseStream } from "@/hooks/useSseStream";

const isSseEnabled = process.env.NEXT_PUBLIC_ENABLE_SSE === "true";
const VALID_ANSWER_TYPES: string[] = ["YES", "NO", "IRRELEVANT", "BOTH"];

const GamePage = (): ReactNode => {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<Session | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bottom, setBottom] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [images, setImages] = useState<SessionImage[]>([]);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const { startStream, stopStream, isStreaming, streamError } = useSseStream();

  const loadSession = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    setIsLoading(true);
    setIsError(false);
    try {
      const { session: s, puzzle: p } = await fetchSession(sessionId);
      setSession(s);
      setPuzzle(p);
    } catch (e) {
      setIsError(true);
      setErrorMessage(e instanceof Error ? e.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const loadMessages = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      const items = await fetchMessages(sessionId);
      setMessages(items);
    } catch (e) {
      setIsError(true);
      setErrorMessage(e instanceof Error ? e.message : "加载消息失败");
    }
  }, [sessionId]);

  const loadImages = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    try {
      const items = await fetchSessionImages(sessionId);
      setImages(items);
    } catch {
      // 静默失败，保持现状
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (session != null) {
      loadMessages();
      void loadImages();
    }
  }, [session, loadMessages, loadImages]);

  useEffect(() => {
    if (streamError) {
      setErrorMessage(streamError);
    }
  }, [streamError]);

  /**
   * SSE Event handler
   * assistant.delta: AI token generating
   * assistant.done: SSE finieshed
   * session.updated: Update question_count/status
   * error: AI error
   */
  const eventHandler = useCallback(
    (eventName: string, payload: unknown): void => {
      if (eventName === "assistant.delta") {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "delta" in payload &&
          typeof (payload as { delta: unknown }).delta === "string"
        ) {
          // Add newly generated text stream into assistant message
          const delta = (payload as { delta: string }).delta;
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const lastIndex = next.length - 1;
            const last = next[lastIndex];
            if (last.role === "ASSISTANT") {
              next[lastIndex] = {
                ...last,
                content: `${last.content}${delta}`,
              };
            }
            return next;
          });
        }
      } else if (eventName === "assistant.done") {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "content" in payload
        ) {
          const data = payload as {
            content?: unknown;
            answer_type?: unknown;
          };
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const lastIndex = next.length - 1;
            const last = next[lastIndex];
            next[lastIndex] = {
              ...last,
              content:
                typeof data.content === "string" ? data.content : last.content,
              answer_type: typeof data.answer_type === "string" &&
              VALID_ANSWER_TYPES.includes(
                data.answer_type as Exclude<AnswerType, null>,
              )
                ? (data.answer_type as AnswerType)
                : last.answer_type,
            };
            return next;
          });
        }
      } else if (eventName === "session.updated") {
        if (
          typeof payload === "object" &&
          payload !== null &&
          "question_count" in payload &&
          "status" in payload
        ) {
          const data = payload as {
            question_count?: unknown;
            status?: unknown;
          };
          setSession((prev) => {
            if (!prev) return prev;
            const nextQuestionCount =
              typeof data.question_count === "number"
                ? data.question_count
                : prev.question_count + 1;
            const nextStatus =
              data.status === "PLAYING" ||
                data.status === "REVEALED" ||
                data.status === "QUIT"
                ? data.status
                : prev.status;
            return {
              ...prev,
              question_count: nextQuestionCount,
              status: nextStatus,
            };
          });
        }
      } else if (eventName === "error") {
        const message =
          typeof payload === "object" &&
            payload !== null &&
            "message" in payload &&
            typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "流式回复出错，请稍后重试。";
        setErrorMessage(message);
      }
    },
    [setMessages, setSession, setErrorMessage],
  );

  const handleGenerateImage = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    setIsImageLoading(true);
    setImageError(null);
    try {
      await triggerSessionImage(sessionId);
      const items = await fetchSessionImages(sessionId);
      setImages(items);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "生成配图失败");
    } finally {
      setIsImageLoading(false);
    }
  }, [sessionId]);

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      if (!sessionId || isSending || isStreaming || session?.status !== "PLAYING")
        return;
      setIsSending(true);
      try {
        const createdAt = new Date().toISOString();
        const optimisticUser: Message = {
          id: `user_${createdAt}`,
          role: "USER",
          content,
          answer_type: null,
          created_at: createdAt,
        };
        const optimisticAssistant: Message = {
          id: `assistant_${createdAt}`,
          role: "ASSISTANT",
          content: "",
          answer_type: null,
          created_at: createdAt,
        };
        setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);

        if (isSseEnabled) {
          await startStream({
            sessionId,
            content,
            onEvent: eventHandler,
          });
        } else {
          const { user_message, assistant_message, session: updatedSession } =
            await postQuestion(sessionId, content);
          setMessages((prev) => {
            if (prev.length < 2) return [...prev, user_message, assistant_message];
            const trimmed = prev.slice(0, -2);
            return [...trimmed, user_message, assistant_message];
          });
          if (updatedSession) {
            setSession((prev) =>
              prev
                ? {
                  ...prev,
                  question_count: updatedSession.question_count,
                  status: updatedSession.status as Session["status"],
                  updated_at: updatedSession.updated_at,
                }
                : prev,
            );
          } else if (session) {
            setSession((s) =>
              s ? { ...s, question_count: s.question_count + 1 } : null,
            );
          }
        }
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "发送失败");
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, isSending, isStreaming, session?.status, startStream, eventHandler],
  );

  const handleReveal = useCallback(async (): Promise<void> => {
    if (!sessionId || session?.status !== "PLAYING") return;
    setIsSending(true);
    try {
      const { session: s, puzzle: p } = await revealAnswer(sessionId);
      setSession(s);
      setBottom(p.bottom ?? null);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "揭晓失败");
    } finally {
      setIsSending(false);
    }
  }, [sessionId, session?.status]);

  const handleEnd = useCallback(async (): Promise<void> => {
    if (!sessionId || session?.status !== "PLAYING") return;
    setIsSending(true);
    try {
      const { session: s } = await endSession(sessionId);
      setSession(s);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "结束失败");
    } finally {
      setIsSending(false);
    }
  }, [sessionId, session?.status]);

  const handlePlayAgain = useCallback((): void => {
    router.push("/");
  }, [router]);

  if (isLoading || !sessionId) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-slate-400">加载中…</p>
      </div>
    );
  }

  if (isError && !session) {
    return (
      <div className="flex min-h-[calc(100vh-3rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">{errorMessage}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={loadSession}>
            重试
          </Button>
          <Link href="/">
            <Button variant="primary" size="md">
              返回大厅
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!session || !puzzle) {
    return null;
  }

  const isPlaying = session.status === "PLAYING";

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/60 px-4 py-2 md:px-6">
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← 返回大厅
        </Link>
        <Link
          href="/sessions"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          历史会话
        </Link>
      </div>
      <SoupHeader
        surface={puzzle.surface}
        soupType={session.soup_type}
        title={session.title}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatMessageList messages={messages} />
        {bottom != null ? (
          <div className="shrink-0 px-4 py-4 md:px-6">
            <RevealPanel
              bottom={bottom}
              onPlayAgain={handlePlayAgain}
              onGenerateImage={handleGenerateImage}
              isGeneratingImage={isImageLoading}
              images={images}
              imageError={imageError}
            />
          </div>
        ) : isPlaying ? (
          <ChatInputBar
            onSend={handleSend}
            onReveal={handleReveal}
            onEnd={handleEnd}
            isLoading={isSending || isStreaming}
            canReveal
            canEnd
          />
        ) : (
          <div className="shrink-0 px-4 py-4 md:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
              <p className="text-slate-500">本局已结束</p>
              <Button variant="primary" size="md" onClick={handlePlayAgain}>
                返回大厅
              </Button>
            </div>
          </div>
        )}
      </div>
      {errorMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-red-900/90 px-4 py-2 text-sm text-red-100">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default GamePage;
