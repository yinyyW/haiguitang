"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { ChatMessageBubble } from "./ChatMessageBubble";
import type { Message } from "../../lib/types";

interface ChatMessageListProps {
  messages: Message[];
  className?: string;
}

export const ChatMessageList = ({
  messages,
  className,
}: ChatMessageListProps): ReactNode => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      className={`flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6 ${className ?? ""}`}
    >
      {messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          提一个封闭式问题开始推理
        </p>
      ) : (
        messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};
