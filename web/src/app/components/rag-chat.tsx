"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  getConversation,
  getConversations,
  startRagQuestion,
  subscribeToRag,
  type RagAnswer,
  type RagProgressStage,
} from "@/lib/api";

interface Message {
  id: string;
  question: string;
  answer?: RagAnswer;
  sources?: RagAnswer["sources"];
  stage: RagProgressStage;
}

interface RagChatProps {
  restoreHistory?: boolean;
  conversationIdToRestore?: string;
  onConversationChange?: (conversationId: string) => void;
}

export function RagChat({
  restoreHistory = true,
  conversationIdToRestore,
  onConversationChange,
}: RagChatProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!restoreHistory && !conversationIdToRestore) {
      return;
    }

    async function restoreLatestConversation() {
      try {
        const conversations = await getConversations();
        const latest = conversationIdToRestore
          ? { id: conversationIdToRestore }
          : conversations[0];

        if (!latest) {
          return;
        }

        const conversation = await getConversation(latest.id);
        const restoredMessages: Message[] = [];

        for (const message of conversation.messages ?? []) {
          if (message.role === "user") {
            restoredMessages.push({
              id: message.id,
              question: message.content,
              stage: "completed",
            });
            continue;
          }

          const question = restoredMessages.at(-1);
          if (question) {
            question.answer = {
              answer: message.content,
              sources: message.sources ?? [],
            };
            question.sources = message.sources;
          }
        }

        setConversationId(conversation.id);
        onConversationChange?.(conversation.id);
        setMessages(restoredMessages);
      } catch {
        setError("Não foi possível restaurar o histórico de conversas.");
      }
    }

    void restoreLatestConversation();
  }, [conversationIdToRestore, onConversationChange, restoreHistory]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();

    if (!value || isLoading) {
      return;
    }

    const messageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: messageId, question: value, stage: "queued" },
    ]);
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);
    setError(undefined);

    try {
      const job = await startRagQuestion(value, conversationId);
      setConversationId(job.conversationId);
      onConversationChange?.(job.conversationId);
      let unsubscribe: () => void = () => {};

      unsubscribe = subscribeToRag(
        job.jobId,
        (progress) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    stage: progress.stage,
                    answer: progress.answer,
                    sources: progress.sources,
                  }
                : message,
            ),
          );

          if (progress.stage === "completed") {
            setIsLoading(false);
            unsubscribe();
          }

          if (progress.stage === "failed") {
            setError(progress.error ?? "Não foi possível gerar uma resposta.");
            setIsLoading(false);
            unsubscribe();
          }
        },
        () => {
          setError("A conexão com a resposta foi perdida.");
          setIsLoading(false);
        },
      );
    } catch {
      setError("Não foi possível conversar com a API. Verifique se o NestJS está ativo.");
      setIsLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function resizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }

  const thinkingLabels: Record<RagProgressStage, string> = {
    queued: "Preparando sua pergunta...",
    searching: "Buscando trechos relevantes nos seus documentos...",
    answering: "Usando o contexto encontrado para preparar a resposta...",
    completed: "Resposta pronta.",
    failed: "Não foi possível concluir esta resposta.",
  };

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-white">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-40 pt-12 sm:px-8">
        <section className="flex flex-1 flex-col gap-8">
          {messages.length === 0 ? (
            <div className="my-auto pb-24 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">T</span>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">Como posso ajudar?</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
                Pergunte sobre suas notas e documentos de tecnologia. As respostas incluem as fontes usadas.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article className="space-y-6" key={message.id}>
                <div className="ml-auto max-w-[85%] rounded-3xl bg-zinc-100 px-5 py-3 text-sm leading-6 text-zinc-900">
                  {message.question}
                </div>
                <div className="max-w-[95%] text-sm leading-7 text-zinc-800">
                  <div className="mb-3 flex items-center gap-2 font-medium text-zinc-950">
                    <span className="flex size-6 items-center justify-center rounded-md bg-zinc-900 text-[10px] text-white">T</span>
                    Tech RAG
                  </div>
                  {message.answer ? (
                    <p className="whitespace-pre-wrap">{message.answer.answer}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-zinc-500">
                        <span className="flex gap-1" aria-hidden="true">
                          <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                          <span className="size-1.5 animate-bounce rounded-full bg-zinc-400" />
                        </span>
                        {thinkingLabels[message.stage]}
                      </div>
                      {message.sources && message.sources.length > 0 && (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
                          <p className="font-medium text-zinc-800">Análise do contexto</p>
                          <p className="mt-1">Encontrei {message.sources.length} trecho(s) relevante(s) e estou elaborando a resposta com base neles.</p>
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {message.sources.map((source, sourceIndex) => (
                              <li className="rounded-md bg-white px-2 py-1 ring-1 ring-zinc-200" key={`${source.source}-${sourceIndex}`}>
                                {source.filename} · trecho {source.chunkIndex + 1}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {message.answer && message.answer.sources.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-medium text-zinc-500">Fontes consultadas</p>
                      <ul className="flex flex-wrap gap-2">
                        {message.answer.sources.map((source, sourceIndex) => (
                          <li className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600" key={`${source.source}-${sourceIndex}`}>
                            <span className="font-medium text-zinc-800">{source.filename}</span>
                            <span> · trecho {source.chunkIndex + 1}</span>
                            {source.page && <span> · p. {source.page}</span>}
                            <span> · {source.score.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}

        </section>
      </main>

      <footer className="fixed bottom-0 right-0 left-0 bg-gradient-to-t from-white via-white to-transparent pt-12 md:left-64">
        <form className="mx-auto flex w-full max-w-3xl items-center gap-2 px-5 pb-5 sm:px-8" onSubmit={submit}>
          <label className="sr-only" htmlFor="question">Pergunta</label>
          <div className="flex min-w-0 flex-1 items-end rounded-3xl border border-zinc-200 bg-white py-1 pl-5 pr-1 shadow-lg shadow-zinc-200/40 transition focus-within:border-zinc-300 focus-within:shadow-zinc-200/70">
            <textarea
              className="max-h-52 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-3 text-sm leading-5 text-zinc-950 outline-none placeholder:text-zinc-400"
              id="question"
              onChange={(event) => {
                setQuestion(event.target.value);
                resizeTextarea(event.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre seus documentos"
              ref={textareaRef}
              rows={4}
              value={question}
            />
            <button
              aria-label="Enviar pergunta"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-lg text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={isLoading || !question.trim()}
              type="submit"
            >
              ↑
            </button>
          </div>
        </form>
        <p className="px-5 pb-3 text-center text-xs text-zinc-400">As respostas podem conter erros. Confira as fontes.</p>
        {error && <p className="mx-auto max-w-3xl px-8 pb-3 text-center text-xs text-rose-600">{error}</p>}
      </footer>
    </div>
  );
}
