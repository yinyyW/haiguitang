// haiguitang-app/app/page.tsx
import type { ReactNode } from "react";
import { SoupTypeSelector } from "../components/home/SoupTypeSelector";
import { HistorySidebar } from "../components/home/HistorySidebar";

const Home = (): ReactNode => {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:px-6 md:py-6">
      <aside className="hidden h-full w-64 shrink-0 md:block">
        <HistorySidebar />
      </aside>
      <main className="flex-1">
        <div className="flex h-full flex-col rounded-3xl border border-slate-800 bg-slate-950/70 shadow-[0_0_40px_rgba(15,23,42,0.9)]">
          <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 md:px-6">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-slate-50 md:text-xl">
                海龟汤 · AI 主持人
              </h1>
              <p className="text-xs text-slate-400 md:text-sm">
                像和聊天机器人说话一样，用封闭式问题抽丝剥茧。
              </p>
            </div>
          </header>
          <div className="flex flex-1 flex-col md:flex-row">
            <section className="flex flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-300 md:px-5 md:py-4">
                  <p className="leading-relaxed">
                    像问聊天机器人一样提问，但回答只有「是 /
                    不是 / 不重要 / 是也不是」。
                  </p>
                </div>
                <div className="flex-1">
                  <SoupTypeSelector />
                </div>
              </div>
            </section>
            <aside className="border-t border-slate-800 px-4 py-3 md:hidden">
              <HistorySidebar />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;