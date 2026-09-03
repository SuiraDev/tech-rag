"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import { RagChat } from "./rag-chat";
import { getConversations, type Conversation } from "@/lib/api";

export function ChatPage() {
  const [conversationKey, setConversationKey] = useState(0);
  const [shouldRestoreHistory, setShouldRestoreHistory] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [conversationIdToRestore, setConversationIdToRestore] = useState<string>();

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await getConversations());
    } catch {
      // O chat continua utilizável quando o histórico não pode ser carregado.
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshConversations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [refreshConversations]);

  function startNewConversation() {
    setShouldRestoreHistory(false);
    setConversationIdToRestore(undefined);
    setActiveConversationId(undefined);
    setConversationKey((current) => current + 1);
  }

  function selectConversation(conversationId: string) {
    setShouldRestoreHistory(false);
    setConversationIdToRestore(conversationId);
    setActiveConversationId(conversationId);
    setConversationKey((current) => current + 1);
  }

  const handleConversationChange = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    void refreshConversations();
  }, [refreshConversations]);

  return (
    <div className="flex min-h-screen">
      <AppHeader
        activeConversationId={activeConversationId}
        conversations={conversations}
        onNewConversation={startNewConversation}
        onSelectConversation={selectConversation}
      />
      <RagChat
        conversationIdToRestore={conversationIdToRestore}
        key={conversationKey}
        onConversationChange={handleConversationChange}
        restoreHistory={shouldRestoreHistory}
      />
    </div>
  );
}
