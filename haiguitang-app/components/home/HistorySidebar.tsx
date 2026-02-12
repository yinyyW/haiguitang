"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchSessions } from "../../lib/api/sessions";
import type { Session } from "../../lib/types";
import { Tag } from "../ui/Tag";

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

const formatDateTimeShort = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

export const HistorySidebar = (): ReactNode => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const loadSessions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setIsError(false);
    try {
      const items = await fetchSessions();
      setSessions(items);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  return (
    <aside className="w-full rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3 text-xs text-slate-200 md:w-64 md:p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          历史会话
        </span>
        <Link
          href="/sessions"
          className="text-[11px] text-amber-400 hover:text-amber-300"
        >
          全部
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-8 rounded-lg bg-slate-800/70" />
          <div className="h-8 rounded-lg bg-slate-800/70" />
          <div className="h-8 rounded-lg bg-slate-800/70" />
        </div>
      ) : isError ? (
        <button
          type="button"
          onClick={(): void => {
            void loadSessions();
          }}
          className="w-full rounded-lg border border-amber-500/40 bg-slate-900/80 px-3 py-2 text-left text-[11px] text-amber-200 hover:bg-slate-900 cursor-pointer"
        >
          历史会话加载失败，点此重试。
        </button>
      ) : sessions.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          还没有历史会话。
        </p>
      ) : (
        <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/game/${session.id}`}
              className="group block rounded-lg px-2 py-2 text-left hover:bg-slate-800/90"
            >
              <div className="flex items-center justify-between gap-2">
                <Tag
                  size="sm"
                  variant={
                    session.soup_type === "CLEAR"
                      ? "clear"
                      : session.soup_type === "RED"
                        ? "red"
                        : "black"
                  }
                  className="text-[9px]"
                >
                  {formatSoupTypeLabel(session.soup_type)}
                </Tag>
                <span className="text-[10px] text-slate-500">
                  {formatStatusLabel(session.status)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-100">
                {session.title ?? `海龟汤 · 会话 #${session.id}`}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {formatDateTimeShort(session.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
};

