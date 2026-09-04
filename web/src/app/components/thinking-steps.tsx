import type { RagProgressStage, RagSource } from "@/lib/api";
import { AppIcon } from "./app-icon";

interface ThinkingStepsProps {
  stage: RagProgressStage;
  sources?: RagSource[];
}

const STEPS = [
  { id: "searching", label: "Buscando trechos relevantes" },
  { id: "answering", label: "Redigindo a resposta" },
] as const;

const ORDER: Record<RagProgressStage, number> = {
  queued: 0,
  searching: 1,
  answering: 2,
  completed: 3,
  failed: 3,
};

export function ThinkingSteps({ stage, sources }: ThinkingStepsProps) {
  const current = ORDER[stage];

  return (
    <div
      aria-live="polite"
      className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
    >
      <ol className="divide-y divide-white/[0.06]">
        {STEPS.map((step, index) => {
          const stepOrder = index + 1;
          const done = current > stepOrder || stage === "completed";
          const active =
            current === stepOrder && stage !== "completed" && stage !== "failed";

          return (
            <li key={step.id} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
              <span
                aria-hidden="true"
                className={
                  done
                    ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-ink"
                    : active
                      ? "size-5 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-accent"
                      : "size-5 shrink-0 rounded-full border border-zinc-700"
                }
              >
                {done ? <AppIcon className="size-3" icon="lucide:check" /> : null}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-[13px] font-medium ${
                    done || active ? "text-zinc-100" : "text-zinc-500"
                  }`}
                >
                  {step.label}
                </p>
                {active && step.id === "searching" && (
                  <p className="text-xs text-zinc-500">
                    Transformando sua pergunta em vetor…
                  </p>
                )}
                {active && step.id === "answering" && sources && sources.length > 0 && (
                  <p className="text-xs text-zinc-500">
                    {sources.length} trecho{sources.length > 1 ? "s" : ""} em
                    contexto — escrevendo com base neles.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {sources && sources.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1.5 border-t border-white/[0.06] px-3 py-3 sm:px-4">
          {sources.map((source, index) => (
            <span
              key={`${source.source}-${index}`}
              className="max-w-full truncate rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-zinc-300 ring-1 ring-white/10"
            >
              {source.filename}, trecho {source.chunkIndex + 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
