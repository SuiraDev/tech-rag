"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import { AppIcon } from "./app-icon";
import { RagChat } from "./rag-chat";
import {
  deleteConversation,
  getConversations,
  type Conversation,
} from "@/lib/api";

export function ChatPage() {
  const [conversationKey, setConversationKey] = useState(0);
  const [shouldRestoreHistory, setShouldRestoreHistory] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [conversationIdToRestore, setConversationIdToRestore] =
    useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await getConversations());
    } catch {
      // O chat continua utilizável quando o histórico não pode ser carregado.
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setShouldRestoreHistory(false);
    setConversationIdToRestore(undefined);
    setActiveConversationId(undefined);
    setSidebarOpen(false);
    setConversationKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshConversations();
    }, 0);

    function handleKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSidebarOpen((open) => !open);
        return;
      }

      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        (event.key === "n" || event.key === "N")
      ) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        const isTyping =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target?.isContentEditable === true;
        if (isTyping) {
          return;
        }
        event.preventDefault();
        startNewConversation();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", handleKey);
    };
  }, [refreshConversations, startNewConversation]);

  function selectConversation(conversationId: string) {
    setShouldRestoreHistory(false);
    setConversationIdToRestore(conversationId);
    setActiveConversationId(conversationId);
    setSidebarOpen(false);
    setConversationKey((current) => current + 1);
  }

  async function removeConversation(conversationId: string) {
    setDeleteError(null);
    try {
      await deleteConversation(conversationId);
    } catch {
      setDeleteError(
        "Não foi possível excluir a conversa. Verifique a API e tente de novo.",
      );
      return;
    }

    if (conversationId === activeConversationId) {
      startNewConversation();
    }
    void refreshConversations();
  }

  const handleConversationChange = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      void refreshConversations();
    },
    [refreshConversations],
  );

  return (
    <div className="bg-aurora flex min-h-dvh flex-col overflow-x-clip text-zinc-100 md:flex-row">
      <AppHeader
        activeConversationId={activeConversationId}
        conversations={conversations}
        onClose={() => setSidebarOpen(false)}
        onDeleteConversation={removeConversation}
        onNewConversation={startNewConversation}
        onOpen={() => setSidebarOpen(true)}
        onSelectConversation={selectConversation}
        open={sidebarOpen}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {deleteError && (
          <div
            role="alert"
            className="mx-4 mt-3 flex w-[calc(100%-2rem)] max-w-3xl items-center gap-2.5 rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-2.5 sm:mx-auto sm:mt-4 sm:w-[calc(100%-4rem)]"
          >
            <AppIcon
              className="size-4 shrink-0 text-rose-300"
              icon="lucide:circle-alert"
            />
            <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 text-rose-100">
              {deleteError}
            </p>
            <button
              aria-label="Dispensar erro de exclusão"
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-rose-200/70 transition hover:bg-white/10 hover:text-rose-100"
              onClick={() => setDeleteError(null)}
              type="button"
            >
              <AppIcon className="size-3.5" icon="lucide:x" />
            </button>
          </div>
        )}
        <RagChat
          conversationIdToRestore={conversationIdToRestore}
          key={conversationKey}
          onConversationChange={handleConversationChange}
          restoreHistory={shouldRestoreHistory}
        />
      </div>
    </div>
  );
}
