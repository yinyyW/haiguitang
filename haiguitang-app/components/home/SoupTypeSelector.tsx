"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { createSession } from "@/lib/api/sessions";

type SoupType = "CLEAR" | "RED" | "BLACK";

interface SoupOption {
  id: SoupType;
  title: string;
  description: string;
  highlight: string;
}

const SOUP_OPTIONS: SoupOption[] = [
  {
    id: "CLEAR",
    title: "清汤",
    description: "经典入门，规则清晰，适合第一次玩海龟汤。",
    highlight: "推荐新手",
  },
  {
    id: "RED",
    title: "红汤",
    description: "情绪更浓、氛围更强，故事感更重的汤局。",
    highlight: "情绪浓度+",
  },
  {
    id: "BLACK",
    title: "黑汤",
    description: "反转与猎奇并存，适合资深玩家挑战。",
    highlight: "高难度",
  },
];

interface SoupTypeSelectorProps {
  apiBaseUrl: string;
  externalId: string;
}

export const SoupTypeSelector = (): ReactNode => {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<SoupType>("CLEAR");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleStart = async (): Promise<void> => {
    if (!selectedType || isLoading) return;
    setIsLoading(true);
    try {
      const { session } = await createSession(selectedType)
      const sessionId = session?.id;
      setIsLoading(false);
      if (!sessionId) return;
      router.push(`/game/${sessionId}`);
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <section className="w-full space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-200 dark:text-slate-50">
          选择这一局的汤
        </h2>
        <p className="text-sm text-slate-300 dark:text-slate-300">
          从清汤开始熟悉规则，或者直接挑战红汤 / 黑汤。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SOUP_OPTIONS.map((option) => {
          const isActive = option.id === selectedType;
          return (
            <button
              key={option.id}
              type="button"
              onClick={(): void => setSelectedType(option.id)}
              className={`group flex flex-col justify-between rounded-2xl border px-4 py-4 text-left transition-all cursor-pointer ${
                isActive
                  ? "border-amber-300 bg-slate-900/80 shadow-lg shadow-amber-500/20"
                  : "border-slate-700/70 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900/70"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-50">
                    {option.title}
                  </h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                    {option.highlight}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed dark:text-slate-300 ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button
          variant="primary"
          size="lg"
          isLoading={isLoading}
          onClick={handleStart}
        >
          开始这一局
        </Button>
      </div>
    </section>
  );
};

