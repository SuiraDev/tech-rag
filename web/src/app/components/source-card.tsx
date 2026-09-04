import type { RagSource } from "@/lib/api";

export function SourceCard({
  source,
  index,
}: {
  source: RagSource;
  index: number;
}) {
  return (
    <li
      className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-accent/30 hover:bg-white/[0.05]"
      title={`Similaridade do trecho: ${source.score.toFixed(2)}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-[11px] font-bold text-accent-soft ring-1 ring-white/10"
        >
          F{index + 1}
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-100">
          {source.filename}
        </p>
        {typeof source.page === "number" && (
          <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold text-accent-soft ring-1 ring-accent/25">
            p. {source.page}
          </span>
        )}
      </div>
      {source.excerpt ? (
        <blockquote className="mt-2.5 line-clamp-3 break-words border-l border-accent/50 pl-3 text-[13px] leading-6 text-zinc-300">
          “{source.excerpt}”
        </blockquote>
      ) : null}
      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
        <span className="rounded-md bg-white/[0.05] px-2 py-0.5 ring-1 ring-white/[0.07]">
          Trecho {source.chunkIndex + 1}
        </span>
        <span
          className="max-w-full truncate rounded-md bg-white/[0.05] px-2 py-0.5 ring-1 ring-white/[0.07]"
          title={source.source}
        >
          {source.source}
        </span>
      </div>
    </li>
  );
}

export function SourceGrid({ sources }: { sources: RagSource[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="mt-6">
      <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-zinc-500">
        <span aria-hidden="true" className="h-px w-4 bg-accent/60" />
        Fontes consultadas ({sources.length})
      </p>
      <ul className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
        {sources.map((source, index) => (
          <SourceCard
            key={`${source.source}-${source.chunkIndex}-${index}`}
            index={index}
            source={source}
          />
        ))}
      </ul>
    </div>
  );
}
