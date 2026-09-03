import Link from "next/link";
import type { Conversation } from "@/lib/api";

interface AppHeaderProps {
  onNewConversation?: () => void;
  conversations?: Conversation[];
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}

export function AppHeader({
  onNewConversation,
  conversations = [],
  activeConversationId,
  onSelectConversation,
}: AppHeaderProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 p-3 md:flex">
        <Link className="mb-5 flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-semibold text-zinc-950" href="/">
          <span className="flex size-7 items-center justify-center rounded-md bg-zinc-900 text-xs text-white">T</span>
          Tech RAG
        </Link>
        {onNewConversation ? (
          <button
            className="flex items-center gap-3 rounded-lg bg-zinc-200 px-3 py-2.5 text-left text-sm font-medium text-zinc-900"
            onClick={onNewConversation}
            type="button"
          >
            <span className="text-lg leading-none">+</span>
            Nova conversa
          </button>
        ) : (
          <Link className="flex items-center gap-3 rounded-lg bg-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-900" href="/">
            <span className="text-lg leading-none">+</span>
            Nova conversa
          </Link>
        )}
        {conversations.length > 0 && (
          <>
            <div className="mt-8 px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Histórico</div>
            <nav aria-label="Histórico de conversas" className="mt-2 space-y-1">
              {conversations.map((conversation) => (
                <button
                  className={`w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-zinc-200 ${
                    conversation.id === activeConversationId
                      ? "bg-zinc-200 font-medium text-zinc-900"
                      : "text-zinc-700"
                  }`}
                  key={conversation.id}
                  onClick={() => onSelectConversation?.(conversation.id)}
                  type="button"
                >
                  {conversation.title}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="mt-8 px-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Biblioteca</div>
        <Link className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-200" href="/documents">
          <span className="text-base">⌘</span>
          Documentos
        </Link>
        <div className="mt-auto rounded-xl bg-white p-3 text-xs leading-5 text-zinc-500 shadow-sm ring-1 ring-zinc-200">
          Respostas geradas a partir dos seus documentos indexados.
        </div>
      </aside>
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 px-4 md:hidden">
        <Link className="font-semibold text-zinc-950" href="/">Tech RAG</Link>
        <Link className="text-sm font-medium text-zinc-600" href="/documents">Documentos</Link>
      </header>
    </>
  );
}
