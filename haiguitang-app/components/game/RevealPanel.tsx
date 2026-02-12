"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";

interface RevealPanelProps {
  bottom: string;
  onPlayAgain: () => void;
}

export const RevealPanel = ({
  bottom,
  onPlayAgain,
}: RevealPanelProps): ReactNode => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-6 md:px-6">
      <h3 className="text-lg font-semibold text-amber-400">汤底</h3>
      <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-600">
        {bottom}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="md" onClick={onPlayAgain}>
          再来一局
        </Button>
        <Link href="/">
          <Button variant="secondary" size="md">
            返回大厅
          </Button>
        </Link>
      </div>
    </div>
  );
};
