import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type Conversation } from "@/lib/api";
import { AppIcon } from "./app-icon";

interface AppHeaderProps {
  conversations?: Conversation[];
  activeConversationId?: string;
  onNewConversation?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

function formatConversationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function SidebarBody({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onNavigate,
}: Required<Pick<AppHeaderProps, "conversations">> &
  Omit<AppHeaderProps, "conversations" | "open" | "onOpen" | "onClose"> & {
    onNavigate?: () => void;
  }) {
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimeout = useRef<number>(undefined);
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? conversations.filter((c) => c.title.toLowerCase().includes(normalized))
    : conversations;

  useEffect(() => {
    return () => window.clearTimeout(confirmTimeout.current);
  }, []);

  function armConfirm(conversationId: string) {
    setConfirmId(conversationId);
    window.clearTimeout(confirmTimeout.current);
    confirmTimeout.current = window.setTimeout(() => {
      setConfirmId((current) => (current === conversationId ? null : current));
    }, 6000);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
      <Link
        className="flex items-center gap-3 rounded-2xl px-2 py-1"
        href="/"
        onClick={onNavigate}
      >
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-xl bg-accent text-ink shadow-[0_0_24px_rgba(190,242,100,0.35)]"
        >
          <AppIcon className="size-4" icon="lucide:sparkles" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-bold tracking-tight text-zinc-50">
            Resenha
          </span>
          <span className="block truncate text-[11px] font-medium text-zinc-500">
            estudo local e privado
          </span>
        </span>
      </Link>

      {onNewConversation ? (
        <button
          className="group flex items-center gap-2.5 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-ink shadow-[0_8px_30px_rgba(190,242,100,0.25)] transition hover:bg-accent-soft active:scale-[0.99]"
          onClick={onNewConversation}
          type="button"
        >
          <span
            aria-hidden="true"
            className="flex size-6 items-center justify-center rounded-full bg-ink text-accent transition group-hover:rotate-90"
          >
            <AppIcon className="size-3.5" icon="lucide:plus" />
          </span>
          Nova conversa
          <kbd className="ml-auto hidden rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-semibold lg:inline">
            N
          </kbd>
        </button>
      ) : (
        <Link
          className="flex items-center gap-2.5 rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-ink"
          href="/"
        >
          <AppIcon className="size-4" icon="lucide:plus" /> Nova conversa
        </Link>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold text-zinc-500">
            Conversas
          </p>
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">
            {conversations.length}
          </span>
        </div>
        {conversations.length > 0 && (
          <label className="relative mb-2 block">
            <span className="sr-only">Buscar conversas</span>
            <AppIcon
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600"
              icon="lucide:search"
            />
            <input
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/40 sm:text-[13px]"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              value={query}
            />
          </label>
        )}
        {filtered.length > 0 ? (
          <nav aria-label="Histórico de conversas" className="space-y-1">
            {filtered.map((conversation) => {
              const active = conversation.id === activeConversationId;
              return (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-1 rounded-xl transition ${
                    active
                      ? "bg-white/[0.08] ring-1 ring-white/10"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    className={`min-w-0 flex-1 px-3 py-2 text-left ${
                      active
                        ? "font-semibold text-zinc-50"
                        : "text-zinc-400 group-hover:text-zinc-200"
                    }`}
                    onClick={() => {
                      onSelectConversation?.(conversation.id);
                      onNavigate?.();
                    }}
                    title={`${conversation.title}, ${formatConversationDate(conversation.updatedAt)}`}
                    type="button"
                  >
                    <span className="block truncate text-[13px] leading-5">
                      {conversation.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-4 text-zinc-600">
                      {formatConversationDate(conversation.updatedAt)}
                    </span>
                  </button>
                  {onDeleteConversation &&
                    (confirmId === conversation.id ? (
                      <span className="mr-1 flex shrink-0 items-center gap-1">
                        <button
                          aria-label={`Confirmar exclusão de "${conversation.title}"`}
                          className="flex size-7 items-center justify-center rounded-lg bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/30 transition hover:bg-rose-400/25"
                          onClick={() => {
                            window.clearTimeout(confirmTimeout.current);
                            setConfirmId(null);
                            onDeleteConversation(conversation.id);
                          }}
                          title="Confirmar exclusão"
                          type="button"
                        >
                          <AppIcon className="size-3.5" icon="lucide:check" />
                        </button>
                        <button
                          aria-label="Cancelar exclusão"
                          className="flex size-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                          onClick={() => {
                            window.clearTimeout(confirmTimeout.current);
                            setConfirmId(null);
                          }}
                          title="Cancelar exclusão"
                          type="button"
                        >
                          <AppIcon className="size-3.5" icon="lucide:x" />
                        </button>
                      </span>
                    ) : (
                      <button
                        aria-label={`Excluir "${conversation.title}"`}
                        className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 opacity-0 transition hover:bg-white/10 hover:text-rose-300 focus-visible:opacity-100 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={() => armConfirm(conversation.id)}
                        title="Excluir conversa"
                        type="button"
                      >
                        <AppIcon className="size-3.5" icon="lucide:trash-2" />
                      </button>
                    ))}
                </div>
              );
            })}
          </nav>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs leading-5 text-zinc-600">
            {normalized
              ? "Nenhuma conversa combina com a busca."
              : "Nenhuma conversa ainda. Comece uma acima."}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 px-1 text-[11px] font-semibold text-zinc-500">
          Biblioteca
        </p>
        <Link
          className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-accent/30 hover:bg-white/[0.05]"
          href="/documents"
          onClick={onNavigate}
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-300 ring-1 ring-white/10"
          >
            <AppIcon className="size-4" icon="lucide:library" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-zinc-100">
              Documentos
            </span>
            <span className="block truncate text-xs text-zinc-500">
              Indexe PDFs e notas Markdown
            </span>
          </span>
          <span
            aria-hidden="true"
            className="ml-auto text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-accent"
          >
            <AppIcon className="size-4" icon="lucide:arrow-right" />
          </span>
        </Link>
      </div>

      <p className="mt-auto rounded-2xl bg-white/[0.03] p-3.5 text-[11px] leading-5 text-zinc-500 ring-1 ring-white/[0.07]">
        Respostas geradas <span className="text-zinc-300">apenas</span> do que
        você indexou — sempre com a fonte ao lado.
      </p>
    </div>
  );
}

export function AppHeader({
  conversations = [],
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  open = false,
  onOpen,
  onClose,
}: AppHeaderProps) {
  const bodyProps = {
    conversations,
    activeConversationId,
    onNewConversation,
    onSelectConversation,
    onDeleteConversation,
  };
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 overflow-x-hidden overflow-y-auto border-r border-white/[0.07] bg-ink/80 backdrop-blur md:block">
        <SidebarBody {...bodyProps} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="animate-rise-fast absolute inset-y-0 left-0 w-[85vw] max-w-[300px] overflow-y-auto overscroll-contain border-r border-white/10 bg-panel">
            <button
              aria-label="Fechar menu"
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
              onClick={onClose}
              type="button"
            >
              <AppIcon className="size-4" icon="lucide:x" />
            </button>
            <SidebarBody {...bodyProps} onNavigate={onClose} />
          </aside>
        </div>
      )}

      <header className="flex h-14 w-full shrink-0 items-center gap-1 border-b border-white/[0.07] bg-ink/80 px-2 backdrop-blur sm:px-3 md:hidden">
        {onOpen && (
          <button
            aria-label="Abrir menu"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-zinc-300 hover:bg-white/10 active:scale-95 sm:size-11"
            onClick={onOpen}
            title="Abrir menu (Ctrl+K)"
            type="button"
          >
            <AppIcon className="size-5" icon="lucide:menu" />
          </button>
        )}
        <Link className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-zinc-50" href="/">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-ink"
          >
            <AppIcon className="size-3.5" icon="lucide:sparkles" />
          </span>
          <span className="truncate">Resenha</span>
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {onNewConversation ? (
            <button
              aria-label="Nova conversa"
              className="flex size-10 items-center justify-center rounded-xl text-zinc-200 transition hover:bg-white/10 hover:text-accent-soft active:scale-95 sm:size-11"
              onClick={onNewConversation}
              title="Nova conversa (N)"
              type="button"
            >
              <AppIcon className="size-5" icon="lucide:plus" />
            </button>
          ) : (
            <Link
              aria-label="Nova conversa"
              className="flex size-10 items-center justify-center rounded-xl text-zinc-200 hover:bg-white/10 sm:size-11"
              href="/"
            >
              <AppIcon className="size-5" icon="lucide:plus" />
            </Link>
          )}
          <Link
            className="flex h-10 items-center whitespace-nowrap rounded-xl px-2 text-[13px] font-medium text-zinc-400 hover:text-zinc-100 sm:h-11"
            href="/documents"
          >
            Documentos
          </Link>
        </div>
      </header>
    </>
  );
}
