"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "../ui/Button";
import type { SessionImage } from "../../lib/types";

interface RevealPanelProps {
  bottom: string;
  onPlayAgain: () => void;
  onGenerateImage?: () => void;
  isGeneratingImage?: boolean;
  images?: SessionImage[];
  imageError?: string | null;
}

export const RevealPanel = ({
  bottom,
  onPlayAgain,
  onGenerateImage,
  isGeneratingImage,
  images,
  imageError,
}: RevealPanelProps): ReactNode => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-6 md:px-6">
      <h3 className="text-lg font-semibold text-amber-400">汤底</h3>
      <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-600">
        {bottom}
      </p>
      <div className="flex flex-wrap gap-3">
        {onGenerateImage && (
          <Button
            variant="secondary"
            size="md"
            onClick={onGenerateImage}
            isLoading={isGeneratingImage}
            disabled={isGeneratingImage}
          >
            生成配图
          </Button>
        )}
        <Button variant="primary" size="md" onClick={onPlayAgain}>
          再来一局
        </Button>
        <Link href="/">
          <Button variant="secondary" size="md">
            返回大厅
          </Button>
        </Link>
      </div>
      {imageError && (
        <p className="text-sm text-red-400">{imageError}</p>
      )}
      {images && images.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">本局已生成的配图：</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                className="group relative overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/60 cursor-pointer"
                onClick={(): void => {
                  window.open(img.image_url, "_blank", "noopener,noreferrer");
                }}
              >
                <img
                  src={img.image_url}
                  alt="海龟汤配图"
                  className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
