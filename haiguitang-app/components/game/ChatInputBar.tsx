"use client";

import type { ReactNode } from "react";
import { useState, useCallback } from "react";
import { Textarea } from "../ui/Input";
import { Button } from "../ui/Button";

interface ChatInputBarProps {
  onSend: (content: string) => void;
  onReveal: () => void;
  onEnd: () => void;
  isLoading: boolean;
  canReveal: boolean;
  canEnd: boolean;
  hintList?: string[] | null;
}

export const ChatInputBar = ({
  onSend,
  onReveal,
  onEnd,
  isLoading,
  canReveal,
  canEnd,
  hintList,
}: ChatInputBarProps): ReactNode => {
  const [value, setValue] = useState<string>("");
  const [isHintsOpen, setIsHintsOpen] = useState<boolean>(false);
  const hasHints = Boolean(hintList && hintList.length > 0);

  const handleSubmit = useCallback((): void => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue("");
  }, [value, isLoading, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-700/60 bg-slate-900/80 px-4 py-4 md:px-6">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex gap-2">
          <Textarea
            value={value}
            onChange={(e): void => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入封闭式问题，例如：这个人是男的吗？"
            disabled={isLoading}
            isLoading={isLoading}
            rows={2}
            className="min-h-[44px] resize-none"
          />
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!value.trim() || isLoading}
          >
            发送
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onReveal}
            disabled={isLoading || !canReveal}
          >
            揭晓
          </Button>
          {hasHints && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsHintsOpen((v) => !v)}
              disabled={isLoading}
            >
              {isHintsOpen ? "收起提示" : `提示（${hintList!.length} 条）`}
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={onEnd}
            disabled={isLoading || !canEnd}
          >
            结束本局
          </Button>
        </div>
        {hasHints && isHintsOpen && (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
            {hintList!.map((h, i) => (
              <li key={i} className="list-none">
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
