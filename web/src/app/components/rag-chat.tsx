"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  getConversation,
  getConversations,
  getLibraryStats,
  startRagQuestion,
  subscribeToRag,
  type LibraryStats,
  type RagAnswer,
  type RagProgressStage,
} from "@/lib/api";
import { SourceGrid } from "./source-card";
import { ThinkingSteps } from "./thinking-steps";
import { AppIcon } from "./app-icon";

interface Message {
  id: string;
  question: string;
  answer?: RagAnswer;
  sources?: RagAnswer["sources"];
  stage: RagProgressStage;
  fresh?: boolean;
}

interface RagChatProps {
  restoreHistory?: boolean;
  conversationIdToRestore?: string;
  onConversationChange?: (conversationId: string) => void;
}

const SUGGESTIONS = [  {
    title: "Explique um conceito",
    prompt: "Explique os conceitos principais dos documentos com exemplos práticos",
  },
  {
    title: "Resuma o material",
    prompt: "Resuma os pontos mais importantes do material indexado",
  },
  {
    title: "Guia passo a passo",
    prompt: "Crie um passo a passo prático a partir do conteúdo dos documentos",
  },
  {
    title: "Teste meu entendimento",
    prompt: "Crie 3 perguntas para testar meu entendimento do conteúdo",
  },
];

function formatIndexedCount(stats: LibraryStats): string {
  const docs = `${stats.indexedDocuments} documento${stats.indexedDocuments === 1 ? "" : "s"} indexado${stats.indexedDocuments === 1 ? "" : "s"}`;
  const chunks = `${stats.indexedChunks} trecho${stats.indexedChunks === 1 ? "" : "s"}`;
  return `${docs}, ${chunks}`;
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
  const [copiedId, setCopiedId] = useState<string>();
  const [libraryStats, setLibraryStats] = useState<LibraryStats>();
  const [libraryLoading, setLibraryLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const copyTimeout = useRef<number>(undefined);
  const activeSubRef = useRef<(() => void) | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoringHistory, setRestoringHistory] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Cancela o SSE em voo no unmount/troca de conversa: sem kill
      // silencioso e sem setState após unmount (guardas em mountedRef).
      mountedRef.current = false;
      activeSubRef.current?.();
      activeSubRef.current = null;
      activeMessageIdRef.current = null;
      window.clearTimeout(copyTimeout.current);
    };
  }, []);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "end",
    });
  }

  const lastMessage = messages.at(-1);
  const lastSignal = lastMessage
    ? `${lastMessage.id}:${lastMessage.stage}:${lastMessage.answer ? "resposta" : ""}`
    : "";

  useEffect(() => {
    // Só acompanha a resposta mais recente (mensagens novas desta sessão);
    // o histórico restaurado não dispara rolagem e o movimento reduzido
    // usa rolagem instantânea.
    if (lastMessage?.fresh) {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSignal]);

  useEffect(() => {
    if (!restoreHistory && !conversationIdToRestore) {
      return;
    }

    async function restoreLatestConversation() {
      setRestoringHistory(true);
      setRestoreFailed(false);
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

          const lastQuestion = restoredMessages.at(-1);
          if (lastQuestion) {
            lastQuestion.answer = {
              answer: message.content,
              sources: message.sources ?? [],
            };
            lastQuestion.sources = message.sources;
          }
        }

        setConversationId(conversation.id);
        onConversationChange?.(conversation.id);
        setMessages(restoredMessages);
        if (mountedRef.current) {
          setRestoreFailed(false);
        }
      } catch {
        if (mountedRef.current) {
          setRestoreFailed(true);
          setError(
            "Não foi possível restaurar o histórico de conversas. Tente de novo abaixo.",
          );
        }
      } finally {
        if (mountedRef.current) {
          setRestoringHistory(false);
        }
      }
    }

    void restoreLatestConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationIdToRestore, restoreHistory, restoreAttempt]);

  useEffect(() => {
    let cancelled = false;

    async function loadLibraryStats() {
      try {
        const stats = await getLibraryStats();
        if (!cancelled) {
          setLibraryStats(stats);
        }
      } catch {
        // Verificação falhou: assume a biblioteca pronta para não travar o
        // chat por uma oscilação do backend. O erro real aparece ao perguntar.
        if (!cancelled) {
          setLibraryStats(undefined);
        }
      } finally {
        if (!cancelled) {
          setLibraryLoading(false);
        }
      }
    }

    void loadLibraryStats();
    return () => {
      cancelled = true;
    };
  }, []);

  // Decisão explícita de gating: carregando ou zerado => trata como vazio e
  // bloqueia o ask (evita a primeira pergunta fadada ao fracasso sem fontes).
  // Falha de fetch => assume pronta (não bloqueia; o erro aparece ao perguntar).
  const libraryUnverified = !libraryLoading && libraryStats === undefined;
  const isLibraryEmpty =
    !libraryUnverified && (libraryStats?.indexedChunks ?? 0) === 0;

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || isLoading) {
      return;
    }
    if (isLibraryEmpty) {
      // Biblioteca vazia: não envia a pergunta; a UI (CTA + composer
      // desabilitado) já explica como indexar. Retorno silencioso de
      // propósito: o banner de erro segue reservado a falhas reais da API.
      return;
    }

    const messageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: messageId, question: trimmed, stage: "queued", fresh: true },
    ]);
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);
    setError(undefined);

    try {
      const job = await startRagQuestion(trimmed, conversationId);
      if (!mountedRef.current) {
        return;
      }
      setConversationId(job.conversationId);
      onConversationChange?.(job.conversationId);
      activeMessageIdRef.current = messageId;

      const finishTurn = () => {
        activeSubRef.current = null;
        activeMessageIdRef.current = null;
        if (mountedRef.current) {
          setIsLoading(false);
        }
      };

      const unsubscribe = subscribeToRag(
        job.jobId,
        (progress) => {
          if (!mountedRef.current) {
            return;
          }
          setMessages((current) =>
            current.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    stage: progress.stage,
                    answer: progress.answer ?? message.answer,
                    sources: progress.sources ?? message.sources,
                  }
                : message,
            ),
          );

          if (progress.stage === "completed") {
            finishTurn();
            scrollToBottom();
            unsubscribe();
          }

          if (progress.stage === "failed") {
            setError(progress.error ?? "Não foi possível gerar uma resposta.");
            finishTurn();
            unsubscribe();
          }
        },
        () => {
          if (!mountedRef.current) {
            return;
          }
          // Só marca erro de conexão se o turno ainda estiver ativo
          // (um Cancelar limpa activeMessageIdRef antes de fechar o SSE).
          if (activeMessageIdRef.current !== messageId) {
            return;
          }
          setError("A conexão com a resposta foi perdida.");
          finishTurn();
        },
      );
      activeSubRef.current = unsubscribe;
    } catch {
      if (!mountedRef.current) {
        return;
      }
      setError(
        "Não foi possível conversar com a API. Verifique se o NestJS está ativo.",
      );
      setIsLoading(false);
      activeMessageIdRef.current = null;
    }
  }

  function cancel() {
    activeSubRef.current?.();
    activeSubRef.current = null;
    const id = activeMessageIdRef.current;
    activeMessageIdRef.current = null;
    if (!mountedRef.current) {
      return;
    }
    // Marca o turno como falho sem destruir a pergunta: o bloco de
    // "falhou" preserva o retry via retry().
    if (id) {
      setMessages((current) =>
        current.map((message) =>
          message.id === id && !message.answer
            ? { ...message, stage: "failed" as RagProgressStage }
            : message,
        ),
      );
    }
    setIsLoading(false);
    setError("Resposta interrompida. Você pode tentar de novo.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  function retry() {
    const last = messages.at(-1);
    if (!last || last.answer) {
      return;
    }
    setMessages((current) => current.slice(0, -1));
    setIsLoading(false);
    setError(undefined);
    void ask(last.question);
  }

  function retryRestore() {
    setRestoreAttempt((current) => current + 1);
  }

  async function copyAnswer(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.clearTimeout(copyTimeout.current);
      copyTimeout.current = window.setTimeout(
        () => setCopiedId(undefined),
        1600,
      );
    } catch {
      setError(
        "Não foi possível copiar automaticamente. Selecione o texto da resposta e copie manualmente.",
      );
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

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col px-4 pb-8 pt-8 sm:px-8 sm:pt-14">
        {messages.length === 0 ? (
          <section className="animate-rise my-auto flex flex-col items-center pb-16 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-400">
              <span
                aria-hidden="true"
                className="size-1.5 animate-pulse rounded-full bg-accent"
              />
              RAG local e privado
            </p>
            <h1 className="font-display mt-6 max-w-xl text-[1.9rem] leading-[1.12] text-zinc-50 sm:text-[3.4rem] sm:leading-[1.1]">
              Estude com suas fontes.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-zinc-400">
              Pergunte sobre seus PDFs e notas. Cada resposta aponta para os
              trechos exatos que a sustentam.
            </p>

            {!isLibraryEmpty && !libraryLoading && libraryStats && (
              <p
                role="status"
                className="mx-4 mt-5 inline-flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1.5 text-center text-xs font-medium break-words text-accent-soft"
              >
                <AppIcon className="size-3.5" icon="lucide:library" />
                {formatIndexedCount(libraryStats)}
              </p>
            )}

            {isLibraryEmpty ? (
              <div
                role="status"
                className="mt-9 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left sm:p-7"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-ink">
                  <AppIcon
                    className="size-5"
                    icon={
                      libraryLoading
                        ? "lucide:loader-circle"
                        : "lucide:folder-plus"
                    }
                  />
                </span>
                <h2 className="mt-4 text-lg font-bold text-zinc-50">
                  {libraryLoading
                    ? "Verificando sua biblioteca…"
                    : "Sua biblioteca está vazia"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {libraryLoading
                    ? "Só um instante enquanto conferimos o que já foi indexado."
                    : "O Resenha responde apenas do que você indexou. Envie PDFs e notas para liberar as perguntas — leva menos de um minuto."}
                </p>
                {!libraryLoading && (
                  <Link
                    href="/documents"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-accent-soft active:scale-95"
                  >
                    <AppIcon className="size-4" icon="lucide:upload" />
                    Indexar documentos
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-9 grid w-full min-w-0 gap-2.5 text-left sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-white/[0.05]"
                    onClick={() => void ask(suggestion.prompt)}
                    title={suggestion.prompt}
                    type="button"
                  >
                    <span className="flex items-center justify-between text-sm font-semibold text-zinc-100">
                      {suggestion.title}
                      <AppIcon
                        className="size-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-accent"
                        icon="lucide:arrow-right"
                      />
                    </span>
                    <span className="mt-1 line-clamp-2 block min-w-0 text-xs leading-5 break-words text-zinc-500">
                      {suggestion.prompt}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <dl className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs text-zinc-500">
              {[
                ["lucide:quote", "Fontes citadas"],
                ["lucide:shield-check", "100% local"],
                ["lucide:history", "Lembra o contexto"],
              ].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <AppIcon
                    className="size-3.5 text-accent/80"
                    icon={icon}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <section className="flex min-w-0 flex-1 flex-col gap-8 sm:gap-10">
            {messages.map((message) => (
              <article
                key={message.id}
                className={message.fresh ? "animate-rise min-w-0 space-y-5" : "min-w-0 space-y-5"}
              >
                <div className="ml-auto w-fit max-w-[92%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm leading-6 break-words text-ink shadow-[0_8px_30px_rgba(190,242,100,0.15)] sm:max-w-[85%]">
                  {message.question}
                </div>

                <div className="min-w-0 max-w-full">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex size-6 items-center justify-center rounded-lg bg-accent text-ink"
                    >
                      <AppIcon className="size-3" icon="lucide:sparkles" />
                    </span>
                    <span className="text-[13px] font-bold text-zinc-100">
                      Resenha
                    </span>
                    {message.stage !== "completed" && (
                      <span className="text-xs text-zinc-500">
                        {message.stage === "failed"
                          ? "falhou"
                          : "pensando…"}
                      </span>
                    )}
                  </div>

                  {message.answer ? (
                    <div className="min-w-0 text-[15px] leading-7 break-words text-zinc-200">
                      <p className="whitespace-pre-wrap break-words">{message.answer.answer}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          aria-live="polite"
                          className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-white/10 transition hover:text-zinc-100"
                          onClick={() =>
                            void copyAnswer(message.id, message.answer!.answer)
                          }
                          type="button"
                        >
                          <AppIcon
                            className="size-3.5"
                            icon={
                              copiedId === message.id
                                ? "lucide:check"
                                : "lucide:copy"
                            }
                          />
                          {copiedId === message.id ? "Copiado" : "Copiar resposta"}
                        </button>
                      </div>
                      <SourceGrid sources={message.answer.sources} />
                    </div>
                  ) : message.stage === "failed" ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
                      Não consegui concluir esta resposta.
                      <button
                        className="ml-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-rose-100"
                        onClick={retry}
                        type="button"
                      >
                        <AppIcon className="size-3.5" icon="lucide:rotate-ccw" />
                        Tentar de novo
                      </button>
                    </div>
                  ) : (
                    <ThinkingSteps
                      sources={message.sources}
                      stage={message.stage}
                    />
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
        <div ref={bottomRef} aria-hidden="true" className="h-2" />
      </main>

      <footer className="sticky bottom-0 z-10 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pt-10">
        <form
          className="mx-auto w-full max-w-3xl min-w-0"
          onSubmit={submit}
        >
          <div className="rounded-3xl border border-white/10 bg-panel/90 p-2 pl-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur transition focus-within:border-white/25 sm:pl-5">
            <label className="sr-only" htmlFor="question">
              Pergunta
            </label>
            <textarea
              className="max-h-52 min-h-11 w-full resize-none bg-transparent py-2.5 text-base leading-6 text-zinc-50 outline-none placeholder:text-zinc-600 sm:text-sm"
              id="question"
              onChange={(event) => {
                setQuestion(event.target.value);
                resizeTextarea(event.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre seus documentos…"
              ref={textareaRef}
              rows={1}
              value={question}
            />
            <div className="flex min-w-0 items-center gap-2 pb-1 pr-1">
              <p className="min-w-0 flex-1 truncate pl-1 text-[11px] text-zinc-500 sm:hidden">
                Enter envia
              </p>
              <p className="hidden items-center gap-1.5 pl-1 text-[11px] text-zinc-600 sm:flex">
                <kbd className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-sans font-semibold text-zinc-400 ring-1 ring-white/10">
                  Enter
                </kbd>
                enviar
                <kbd className="ml-2 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-sans font-semibold text-zinc-400 ring-1 ring-white/10">
                  Shift + Enter
                </kbd>
                quebrar linha
              </p>
              {isLoading ? (
                <button
                  aria-label="Parar resposta"
                  className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-ink transition hover:bg-accent-soft active:scale-95 sm:size-9"
                  onClick={cancel}
                  title="Parar resposta"
                  type="button"
                >
                  <AppIcon className="size-4" icon="lucide:square" />
                </button>
              ) : (
                <button
                  aria-label="Enviar pergunta"
                  className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-ink transition hover:bg-accent-soft active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500 sm:size-9"
                  disabled={!question.trim() || isLibraryEmpty}
                  title={
                    isLibraryEmpty
                      ? "Indexe ao menos um documento antes de perguntar"
                      : undefined
                  }
                  type="submit"
                >
                  <AppIcon className="size-4" icon="lucide:arrow-up" />
                </button>
              )}
            </div>
          </div>
        </form>
        <div className="mx-auto w-full max-w-3xl min-w-0 px-2 pt-2.5 text-center">
          {error && (
            <div
              role="alert"
              className="mb-2 flex min-w-0 items-center justify-center gap-2.5 rounded-2xl border border-rose-400/25 bg-rose-400/[0.08] px-4 py-2.5 text-left"
            >
              <AppIcon
                className="size-4 shrink-0 text-rose-300"
                icon="lucide:circle-alert"
              />
              <p className="min-w-0 flex-1 text-[13px] font-medium leading-5 break-words text-rose-100">
                {error}
              </p>
              {restoreFailed && (
                <button
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-300/15 px-2.5 py-1 text-xs font-semibold text-rose-100 ring-1 ring-rose-300/30 transition hover:bg-rose-300/25 disabled:cursor-wait disabled:opacity-60"
                  disabled={restoringHistory}
                  onClick={retryRestore}
                  type="button"
                >
                  <AppIcon className="size-3.5" icon="lucide:rotate-ccw" />
                  {restoringHistory ? "Restaurando…" : "Tentar de novo"}
                </button>
              )}
            </div>
          )}
          {isLibraryEmpty && !libraryLoading && (
            <p role="status" className="pb-1.5 text-xs font-medium text-accent-soft">
              Sua biblioteca está vazia —{" "}
              <Link
                href="/documents"
                className="underline underline-offset-2 hover:text-accent-soft"
              >
                indexe PDFs e notas para começar
              </Link>
              .
            </p>
          )}
          <p className="text-[11px] text-zinc-600">
            As respostas podem conter erros. Confira sempre as fontes.
          </p>
        </div>
      </footer>
    </div>
  );
}
