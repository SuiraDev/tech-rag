"use client";

import {
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppHeader } from "../components/app-header";
import { AppIcon } from "../components/app-icon";
import {
  ingestMarkdown,
  startPdfIndexing,
  subscribeToIndexing,
  type IndexingProgress,
  type IndexingStage,
} from "@/lib/api";

type Tab = "markdown" | "pdf";

const MAX_FILES = 10;

const SHORT_STAGE_LABEL: Record<IndexingStage, string> = {
  queued: "Na fila",
  extracting: "Extraindo",
  chunking: "Fragmentando",
  embedding: "Vetorizando",
  storing: "Salvando",
  completed: "Concluído",
  failed: "Falhou",
};

interface PdfQueueItem {
  id: string;
  file: File;
}

interface PdfJobState {
  itemId: string;
  filename: string;
  stage: IndexingStage;
  processed?: number;
  total?: number;
  indexedChunks?: number;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function jobPercentage(job: PdfJobState): number {
  if (job.total) {
    return Math.round(((job.processed ?? 0) / job.total) * 100);
  }
  return job.stage === "completed" ? 100 : 0;
}

function isTerminal(stage: IndexingStage): boolean {
  return stage === "completed" || stage === "failed";
}

export default function DocumentsPage() {
  const [tab, setTab] = useState<Tab>("pdf");
  const [filename, setFilename] = useState("minhas-notas.md");
  const [source, setSource] = useState("study/minhas-notas.md");
  const [content, setContent] = useState("");
  const [queue, setQueue] = useState<PdfQueueItem[]>([]);
  const [jobs, setJobs] = useState<PdfJobState[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const unsubscribers = useRef(new Map<string, () => void>());

  useEffect(() => {
    const subs = unsubscribers.current;
    return () => {
      subs.forEach((unsub) => unsub());
      subs.clear();
    };
  }, []);

  function resetFeedback() {
    setNotice(undefined);
    setError(undefined);
    setResult(undefined);
  }

  function addFiles(incoming: File[] | FileList) {
    const files = Array.from(incoming);
    const pdfs = files.filter((f) => f.type === "application/pdf");
    const rejected = files.length - pdfs.length;

    setQueue((current) => {
      const seen = new Set(current.map((i) => `${i.file.name}:${i.file.size}`));
      const fresh = pdfs.filter((f) => {
        const key = `${f.name}:${f.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const room = Math.max(0, MAX_FILES - current.length);
      const accepted = fresh.slice(0, room);

      const notes: string[] = [];
      if (rejected > 0) {
        notes.push(
          `${rejected} arquivo(s) ignorado(s) — apenas PDF é aceito.`,
        );
      }
      if (fresh.length - accepted.length > 0) {
        notes.push(`Limite de ${MAX_FILES} arquivos por lote.`);
      }
      setNotice(notes.length > 0 ? notes.join(" ") : undefined);
      setError(undefined);
      return [...current, ...accepted.map((file) => ({ id: crypto.randomUUID(), file }))];
    });
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeFile(id: string) {
    setQueue((current) => current.filter((item) => item.id !== id));
    setJobs((current) => current.filter((job) => job.itemId !== id));
  }

  function clearFinished() {
    setJobs((currentJobs) => {
      const finishedIds = new Set(
        currentJobs.filter((j) => isTerminal(j.stage)).map((j) => j.itemId),
      );
      setQueue((currentQueue) =>
        currentQueue.filter((item) => !finishedIds.has(item.id)),
      );
      return currentJobs.filter((j) => !isTerminal(j.stage));
    });
    setNotice(undefined);
  }

  function startJob(item: PdfQueueItem) {
    setJobs((current) => {
      if (current.some((j) => j.itemId === item.id && !isTerminal(j.stage))) {
        return current;
      }
      const rest = current.filter((j) => j.itemId !== item.id);
      return [
        ...rest,
        { itemId: item.id, filename: item.file.name, stage: "queued" },
      ];
    });

    startPdfIndexing(item.file).then(
      ({ jobId }) => {
        const unsubscribe = subscribeToIndexing(
          jobId,
          (next: IndexingProgress) => {
            setJobs((current) =>
              current.map((job) =>
                job.itemId === item.id
                  ? {
                      ...job,
                      stage: next.stage,
                      processed: next.processed,
                      total: next.total,
                      indexedChunks: next.indexedChunks,
                      error: next.error,
                    }
                  : job,
              ),
            );
            if (isTerminal(next.stage)) {
              unsubscribers.current.delete(item.id);
              unsubscribe();
            }
          },
          () => {
            setJobs((current) =>
              current.map((job) =>
                job.itemId === item.id && !isTerminal(job.stage)
                  ? { ...job, stage: "failed", error: "Conexão de progresso perdida." }
                  : job,
              ),
            );
            unsubscribers.current.delete(item.id);
          },
        );
        unsubscribers.current.set(item.id, unsubscribe);
      },
      () => {
        setJobs((current) =>
          current.map((job) =>
            job.itemId === item.id && !isTerminal(job.stage)
              ? {
                  ...job,
                  stage: "failed",
                  error: "Não foi possível iniciar. API ativa?",
                }
              : job,
          ),
        );
      },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();

    if (tab === "markdown") {
      setIsLoading(true);
      try {
        const ingestion = await ingestMarkdown(filename, source, content);
        setResult(
          `${ingestion.indexedChunks} trecho(s) de “${filename}” indexados com sucesso.`,
        );
        setContent("");
      } catch {
        setError(
          "Não foi possível indexar o documento. Verifique se a API NestJS está ativa.",
        );
      }
      setIsLoading(false);
      return;
    }

    const pending = queue.filter(
      (item) =>
        !jobs.some((j) => j.itemId === item.id && !isTerminal(j.stage)) &&
        !jobs.some((j) => j.itemId === item.id && j.stage === "completed"),
    );
    // Um job por arquivo, em paralelo — o backend isola cada um num job SSE próprio.
    pending.forEach(startJob);
  }

  function retryFile(itemId: string) {
    const item = queue.find((i) => i.id === itemId);
    if (item) startJob(item);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files);
    }
  }

  const activeJobs = jobs.filter((j) => !isTerminal(j.stage)).length;
  const finishedJobs = jobs.filter((j) => j.stage === "completed");
  const failedJobs = jobs.filter((j) => j.stage === "failed");
  const totalChunks = finishedJobs.reduce(
    (sum, j) => sum + (j.indexedChunks ?? 0),
    0,
  );
  const pendingCount = queue.filter(
    (item) =>
      !jobs.some((j) => j.itemId === item.id && !isTerminal(j.stage)) &&
      !jobs.some((j) => j.itemId === item.id && j.stage === "completed"),
  ).length;
  const canSubmit =
    tab === "markdown"
      ? !isLoading && !!content.trim()
      : pendingCount > 0;
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div className="bg-aurora flex min-h-dvh flex-col overflow-x-clip text-zinc-100 md:flex-row">
      <AppHeader
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
        open={sidebarOpen}
      />
      <main className="mx-auto w-full max-w-3xl min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-14">
        <section className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-400">
            <AppIcon className="size-3.5 text-accent" icon="lucide:library" />
            Biblioteca
          </p>
          <h1 className="font-display mt-5 text-3xl leading-[1.1] break-words text-zinc-50 sm:text-5xl sm:leading-[1.08]">
            Alimente sua base.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
            Envie PDFs com texto selecionável ou cole uma nota em Markdown.
            Tudo vira vetores pesquisáveis para as próximas conversas.
          </p>

          <ol className="mt-7 flex flex-wrap items-center gap-x-2 gap-y-3 text-xs text-zinc-500">
            {["Enviar", "Indexar", "Perguntar"].map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-white/[0.06] font-bold text-zinc-300 ring-1 ring-white/10">
                  {i + 1}
                </span>
                <span className="font-medium">{step}</span>
                {i < 2 && (
                  <span aria-hidden="true" className="mx-1 h-px w-6 bg-white/10 sm:w-10" />
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="animate-rise mt-8 overflow-hidden rounded-3xl border border-white/10 bg-panel/70 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div
            aria-label="Tipo de documento"
            className="grid grid-cols-2 gap-1 border-b border-white/[0.07] bg-white/[0.02] p-1.5"
            role="tablist"
          >
            {(["pdf", "markdown"] as Tab[]).map((option) => (
              <button
                key={option}
                aria-selected={tab === option}
                className={`flex min-w-0 items-center justify-center gap-2 rounded-2xl px-2 py-2.5 text-sm font-semibold transition sm:px-4 ${
                  tab === option
                    ? "bg-white/[0.09] text-zinc-50 shadow ring-1 ring-white/10"
                    : "text-zinc-500 hover:text-zinc-200"
                }`}
                onClick={() => {
                  setTab(option);
                  resetFeedback();
                }}
                role="tab"
                type="button"
              >
                <AppIcon
                  className="size-4"
                  icon={
                    option === "pdf" ? "lucide:files" : "lucide:pen-line"
                  }
                />
                {option === "pdf" ? "PDFs" : "Markdown"}
              </button>
            ))}
          </div>

          <form className="min-w-0 space-y-5 p-4 sm:p-8" onSubmit={submit}>
            {tab === "markdown" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-[13px] font-semibold text-zinc-300">
                    Nome do arquivo
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-base font-normal text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/40 sm:text-sm"
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="minhas-notas.md"
                      value={filename}
                    />
                  </label>
                  <label className="space-y-2 text-[13px] font-semibold text-zinc-300">
                    Origem
                    <input
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-base font-normal text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/40 sm:text-sm"
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="study/minhas-notas.md"
                      value={source}
                    />
                  </label>
                </div>
                <label className="block min-w-0 space-y-2 text-[13px] font-semibold text-zinc-300">
                  <span className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    Conteúdo Markdown
                    <span className="text-[11px] font-normal break-words text-zinc-600">
                      {content.length} caracteres, {lineCount} linhas
                    </span>
                  </span>
                  <textarea
                    className="min-h-40 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 font-mono text-base font-normal leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/40 sm:min-h-64 sm:text-[13px]"
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={"# Providers no NestJS\n\nProviders são classes injetáveis…"}
                    value={content}
                  />
                </label>

                <button
                  className="w-full rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-ink shadow-[0_8px_30px_rgba(190,242,100,0.25)] transition hover:bg-accent-soft active:scale-[0.995] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {isLoading ? "Indexando…" : "Indexar documento"}
                </button>
              </>
            ) : (
              <>
                <div
                  className={`relative rounded-2xl border-2 border-dashed p-5 text-center transition sm:p-10 ${
                    dragging
                      ? "border-accent/60 bg-accent/[0.05]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                  onDragLeave={() => setDragging(false)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDrop={handleDrop}
                >
                  <input
                    accept="application/pdf"
                    aria-label="Selecionar PDFs"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    multiple
                    onChange={(e) => {
                      if (e.target.files?.length) addFiles(e.target.files);
                    }}
                    ref={fileInput}
                    type="file"
                  />
                  <span
                    aria-hidden="true"
                    className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-300 ring-1 ring-white/10"
                  >
                    <AppIcon className="size-5" icon="lucide:upload" />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-zinc-100">
                    Arraste PDFs para cá ou clique para escolher
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Vários arquivos por vez, até 20 MB cada, máx. {MAX_FILES} por lote
                  </p>
                </div>

                {queue.length > 0 && (
                  <div aria-live="polite">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <p className="text-[11px] font-semibold text-zinc-500">
                        Fila ({queue.length})
                        {activeJobs > 0 && `, ${activeJobs} ativo(s)`}
                      </p>
                      {jobs.some((j) => isTerminal(j.stage)) && (
                        <button
                          className="text-[11px] font-semibold text-zinc-500 underline-offset-2 transition hover:text-zinc-200 hover:underline"
                          onClick={clearFinished}
                          type="button"
                        >
                          Limpar concluídos
                        </button>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {queue.map((item) => {
                        const job = jobs.find((j) => j.itemId === item.id);
                        const active = job && !isTerminal(job.stage);
                        const failed = job?.stage === "failed";
                        const done = job?.stage === "completed";

                        return (
                          <li
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span
                                aria-hidden="true"
                                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
                                  done
                                    ? "bg-accent/15 text-accent-soft ring-accent/30"
                                    : failed
                                      ? "bg-rose-400/10 text-rose-300 ring-rose-400/25"
                                      : "bg-white/[0.06] text-zinc-300 ring-white/10"
                                }`}
                              >
                                <AppIcon
                                  className="size-4"
                                  icon={
                                    done
                                      ? "lucide:check"
                                      : failed
                                        ? "lucide:triangle-alert"
                                        : "lucide:file-text"
                                  }
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold break-words text-zinc-100">
                                  {item.file.name}
                                </p>
                                <p className="truncate text-xs break-words text-zinc-500">
                                  {formatBytes(item.file.size)},{" "}
                                  {job ? (
                                    <span
                                      className={
                                        done
                                          ? "text-accent"
                                          : failed
                                            ? "text-rose-300"
                                            : "text-zinc-400"
                                      }
                                    >
                                      {done
                                        ? `${job.indexedChunks ?? 0} trecho(s) indexados`
                                        : SHORT_STAGE_LABEL[job.stage]}
                                      {active &&
                                        job.stage === "embedding" &&
                                        job.total != null &&
                                        `, ${job.processed ?? 0}/${job.total}`}
                                    </span>
                                  ) : (
                                    "aguardando envio"
                                  )}
                                </p>
                              </div>
                              {failed ? (
                                <button
                                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/[0.1]"
                                  onClick={() => retryFile(item.id)}
                                  title={job?.error ?? "Tentar novamente"}
                                  type="button"
                                >
                                  <AppIcon className="size-3.5" icon="lucide:rotate-ccw" />
                                  Repetir
                                </button>
                              ) : (
                                !active && (
                                  <button
                                    aria-label={`Remover ${item.file.name} da fila`}
                                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white/10 hover:text-zinc-200"
                                    onClick={() => removeFile(item.id)}
                                    type="button"
                                  >
                                    <AppIcon className="size-4" icon="lucide:x" />
                                  </button>
                                )
                              )}
                            </div>
                            {job && !isTerminal(job.stage) && (
                              <div
                                aria-hidden="true"
                                className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]"
                              >
                                <div
                                  className="h-full rounded-full bg-accent transition-all duration-300"
                                  style={{ width: `${jobPercentage(job)}%` }}
                                />
                              </div>
                            )}
                            {failed && job?.error && (
                              <p className="mt-2 text-xs text-rose-300/90">
                                {job.error}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <button
                  className="w-full rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-ink shadow-[0_8px_30px_rgba(190,242,100,0.25)] transition hover:bg-accent-soft active:scale-[0.995] disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {activeJobs > 0
                    ? `Indexando ${activeJobs}…`
                    : pendingCount > 0
                      ? `Indexar ${pendingCount} documento(s)`
                      : "Indexar documentos"}
                </button>

                {finishedJobs.length > 0 && failedJobs.length === 0 && jobs.every((j) => isTerminal(j.stage)) && (
                  <p
                    role="status"
                    className="flex items-start gap-2 rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-3 text-sm text-accent-soft"
                  >
                    <AppIcon className="mt-0.5 size-4 shrink-0" icon="lucide:check" />
                    {finishedJobs.length} documento(s) indexados, {totalChunks} trecho(s) no total.
                  </p>
                )}
                {failedJobs.length > 0 && jobs.every((j) => isTerminal(j.stage)) && (
                  <p
                    role="status"
                    className="flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-200"
                  >
                    <AppIcon
                      className="mt-0.5 size-4 shrink-0"
                      icon="lucide:triangle-alert"
                    />
                    {finishedJobs.length} concluído(s), {failedJobs.length} falharam — use Repetir em cada item.
                  </p>
                )}
              </>
            )}

            {tab === "markdown" && (
              <>
                {result && (
                  <p
                    role="status"
                    className="flex items-start gap-2 rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-3 text-sm text-accent-soft"
                  >
                    <AppIcon className="mt-0.5 size-4 shrink-0" icon="lucide:check" />
                    {result}
                  </p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
                  >
                    <AppIcon
                      className="mt-0.5 size-4 shrink-0"
                      icon="lucide:triangle-alert"
                    />
                    {error}
                  </p>
                )}
              </>
            )}

            {tab === "pdf" && (notice || error) && (
              <>
                {notice && (
                  <p role="status" className="text-center text-xs text-zinc-500">
                    {notice}
                  </p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
                  >
                    <AppIcon
                      className="mt-0.5 size-4 shrink-0"
                      icon="lucide:triangle-alert"
                    />
                    {error}
                  </p>
                )}
              </>
            )}
          </form>
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-zinc-600">
          Dica: trocar o modelo de embeddings exige reindexar — use uma nova
          coleção no Qdrant nesse caso.
        </p>
      </main>
    </div>
  );
}
