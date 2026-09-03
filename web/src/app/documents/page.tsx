"use client";

import { FormEvent, useState } from "react";
import { AppHeader } from "../components/app-header";
import {
  ingestMarkdown,
  startPdfIndexing,
  subscribeToIndexing,
  type IndexingProgress,
} from "@/lib/api";

export default function DocumentsPage() {
  const [filename, setFilename] = useState("minhas-notas.md");
  const [source, setSource] = useState("study/minhas-notas.md");
  const [content, setContent] = useState("");
  const [pdfFile, setPdfFile] = useState<File>();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<IndexingProgress>();
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(undefined);
    setResult(undefined);
    setProgress(undefined);

    try {
      if (pdfFile) {
        const { jobId } = await startPdfIndexing(pdfFile);
        let unsubscribe: () => void = () => {};

        unsubscribe = subscribeToIndexing(
          jobId,
          (nextProgress) => {
            setProgress(nextProgress);

            if (nextProgress.stage === "completed") {
              setResult(`${nextProgress.indexedChunks} chunk(s) indexado(s) com sucesso.`);
              setPdfFile(undefined);
              setIsLoading(false);
              unsubscribe();
            }

            if (nextProgress.stage === "failed") {
              setError(nextProgress.error ?? "Não foi possível indexar o PDF.");
              setIsLoading(false);
              unsubscribe();
            }
          },
          () => {
            setError("A conexão com o progresso da indexação foi perdida.");
            setIsLoading(false);
          },
        );
        return;
      }

      const ingestion = await ingestMarkdown(filename, source, content);
      setResult(`${ingestion.indexedChunks} chunk(s) indexado(s) com sucesso.`);
      setContent("");
      setIsLoading(false);
    } catch {
      setError("Não foi possível indexar o documento. Verifique se a API NestJS está ativa.");
      setIsLoading(false);
    }
  }

  const stageLabel = {
    queued: "Aguardando processamento",
    extracting: "Extraindo texto do PDF",
    chunking: "Dividindo o conteúdo em chunks",
    embedding: "Gerando embeddings",
    storing: "Salvando no Qdrant",
    completed: "Indexação concluída",
    failed: "Indexação interrompida",
  }[progress?.stage ?? "queued"];
  const progressPercentage = progress?.total
    ? Math.round(((progress.processed ?? 0) / progress.total) * 100)
    : 0;

  return (
    <div className="flex min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
        <p className="mb-2 text-sm font-medium text-zinc-500">Biblioteca</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Adicionar documento</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Indexe uma nota Markdown ou envie um PDF com texto selecionável para usá-los nas próximas conversas.
        </p>

        <form className="mt-8 space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm" onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-zinc-700">
              Nome do arquivo
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setFilename(event.target.value)} value={filename} />
            </label>
            <label className="space-y-2 text-sm font-medium text-zinc-700">
              Origem
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setSource(event.target.value)} value={source} />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium text-zinc-700">
            Conteúdo Markdown
            <textarea className="min-h-72 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-normal leading-6 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" onChange={(event) => setContent(event.target.value)} placeholder="# Providers no NestJS\n\nProviders são classes injetáveis..." value={content} />
          </label>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">ou</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm transition hover:border-zinc-400 hover:bg-zinc-100">
            <span className="text-zinc-600">{pdfFile ? pdfFile.name : "Selecionar um PDF"}</span>
            <span className="font-medium text-zinc-900">Escolher arquivo</span>
            <input accept="application/pdf" className="sr-only" onChange={(event) => setPdfFile(event.target.files?.[0])} type="file" />
          </label>
          <button className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300" disabled={isLoading || (!content.trim() && !pdfFile)} type="submit">
            {isLoading ? "Indexando" : "Indexar documento"}
          </button>
          {progress && (
            <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" aria-live="polite">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-zinc-800">{stageLabel}</span>
                {progress.total && <span className="text-zinc-500">{progress.processed ?? 0}/{progress.total}</span>}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
                <div className="h-full rounded-full bg-zinc-900 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                {progress.stage === "embedding" ? "Cada chunk está sendo transformado em vetor pelo modelo local." : "O progresso será atualizado automaticamente."}
              </p>
            </section>
          )}
          {result && <p className="text-sm text-emerald-700">{result}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      </main>
    </div>
  );
}
