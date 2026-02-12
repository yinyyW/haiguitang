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
} from "../../../lib/api/sessions";
import type { Session, Puzzle, Message } from "../../../lib/types";

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

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (session != null) {
      loadMessages();
    }
  }, [session, loadMessages]);

  const handleSend = useCallback(
    async (content: string): Promise<void> => {
      if (!sessionId || isSending || session?.status !== "PLAYING") return;
      setIsSending(true);
      try {
        const { user_message, assistant_message } = await postQuestion(
          sessionId,
          content,
        );
        setMessages((prev) => [...prev, user_message, assistant_message]);
        if (session) {
          setSession((s) =>
            s ? { ...s, question_count: s.question_count + 1 } : null,
          );
        }
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "发送失败");
      } finally {
        setIsSending(false);
      }
    },
    [sessionId, isSending, session?.status],
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
            <RevealPanel bottom={bottom} onPlayAgain={handlePlayAgain} />
          </div>
        ) : isPlaying ? (
          <ChatInputBar
            onSend={handleSend}
            onReveal={handleReveal}
            onEnd={handleEnd}
            isLoading={isSending}
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
