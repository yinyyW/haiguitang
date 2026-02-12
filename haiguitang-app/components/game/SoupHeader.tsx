"use client";

import type { ReactNode } from "react";
import { Tag } from "../ui/Tag";
import type { SoupType } from "../../lib/types";

interface SoupHeaderProps {
  surface: string;
  soupType: SoupType;
  title?: string | null;
}

const SOUP_TYPE_LABELS: Record<SoupType, string> = {
  CLEAR: "清汤",
  RED: "红汤",
  BLACK: "黑汤",
};

const getTagVariant = (soupType: SoupType): "clear" | "red" | "black" => {
  if (soupType === "CLEAR") return "clear";
  if (soupType === "RED") return "red";
  return "black";
};

export const SoupHeader = ({
  surface,
  soupType,
  title,
}: SoupHeaderProps): ReactNode => {
  return (
    <header className=" shrink-0 border-b border-slate-700/60 bg-slate-900/80 px-4 py-4 md:px-6">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag variant={getTagVariant(soupType)} size="sm">
            {SOUP_TYPE_LABELS[soupType]}
          </Tag>
          {title != null && title !== "" && (
            <span className="text-sm text-slate-400">{title}</span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-100 md:text-lg">
          {surface}
        </p>
      </div>
    </header>
  );
};
