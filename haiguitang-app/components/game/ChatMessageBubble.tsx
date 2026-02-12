"use client";

import type { ReactNode } from "react";
import { Tag } from "../ui/Tag";
import type { Message, AnswerType } from "../../lib/types";

interface ChatMessageBubbleProps {
  message: Message;
}

const ANSWER_TYPE_MAP: Record<NonNullable<AnswerType>, { label: string; variant: "answer-yes" | "answer-no" | "answer-irrelevant" | "answer-mixed" }> = {
  YES: { label: "是", variant: "answer-yes" },
  NO: { label: "不是", variant: "answer-no" },
  IRRELEVANT: { label: "不重要", variant: "answer-irrelevant" },
  BOTH: { label: "是也不是", variant: "answer-mixed" },
};

export const ChatMessageBubble = ({
  message,
}: ChatMessageBubbleProps): ReactNode => {
  const isUser = message.role === "USER";
  const answerMeta = message.answer_type
    ? ANSWER_TYPE_MAP[message.answer_type]
    : null;

  if (isUser) {
    return (
      <div className="flex justify-end mx-auto w-full max-w-3xl">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-amber-500/20 px-4 py-2.5 text-slate-600">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mx-auto w-full max-w-3xl">
      <div className="max-w-[85%] space-y-1.5">
        {answerMeta != null && (
          <Tag variant={answerMeta.variant} size="sm">
            {answerMeta.label}
          </Tag>
        )}
        <div className="rounded-2xl rounded-bl-md border border-slate-600/60 bg-slate-800/80 px-4 py-2.5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
};
