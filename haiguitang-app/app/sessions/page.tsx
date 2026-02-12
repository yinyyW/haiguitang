"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchSessions } from "../../lib/api/sessions";
import type { Session } from "../../lib/types";
import { Tag } from "../../components/ui/Tag";

const SessionsPage = (): ReactNode => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const loadSessions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage("");
    try {
      const items = await fetchSessions();
      setSessions(items);
    } catch (e) {
      setIsError(true);
      setErrorMessage(
        e instanceof Error ? e.message : "历史会话暂时不可用，请稍后重试。",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const formatSoupTypeLabel = (soupType: Session["soup_type"]): string => {
    if (soupType === "CLEAR") return "清汤";
    if (soupType === "RED") return "红汤";
    return "黑汤";
  };

  const formatStatusLabel = (status: Session["status"]): string => {
    if (status === "PLAYING") return "进行中";
    if (status === "REVEALED") return "已揭晓";
    return "已结束";
  };

  const formatDateTime = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col gap-4 px-4 py-6 md:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-50 md:text-xl">
            历史会话
          </h1>
          <p className="text-xs text-slate-400">
            按时间倒序展示你与 AI 的海龟汤对话。
          </p>
        </div>
        <Link
          href="/"
          className="text-xs text-amber-400 hover:text-amber-300"
        >
          ← 返回大厅
        </Link>
      </header>

      {isLoading ? (
        <div className="mt-8 flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-500">加载历史会话中…</p>
        </div>
      ) : isError ? (
        <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={(): void => {
              void loadSessions();
            }}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            重试
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-12 flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-sm text-slate-500">还没有历史会话。</p>
          <Link
            href="/"
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            去新开一局
          </Link>
        </div>
      ) : (
        <main className="mt-4 flex-1 space-y-3">
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/game/${session.id}`}
                  className="block rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 hover:border-amber-400/60 hover:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag
                          size="sm"
                          variant={
                            session.soup_type === "CLEAR"
                              ? "clear"
                              : session.soup_type === "RED"
                                ? "red"
                                : "black"
                          }
                        >
                          {formatSoupTypeLabel(session.soup_type)}
                        </Tag>
                        <span className="text-xs text-slate-400">
                          {formatStatusLabel(session.status)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-100">
                        {session.title ?? `海龟汤 · 会话 #${session.id}`}
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-slate-500">
                      <div>{formatDateTime(session.created_at)}</div>
                      <div>{`提问 ${session.question_count} 次`}</div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      )}
    </div>
  );
};

export default SessionsPage;
