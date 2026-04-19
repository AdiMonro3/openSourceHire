import Link from "next/link";
import { Badge } from "./Badge";
import { ExternalIcon, StarIcon } from "./Icons";

export type IssueCardData = {
  id: number;
  title: string;
  url: string;
  labels: string[];
  comments?: number;
  bounty_usd: number | null;
  repo: {
    name: string;
    stars: number;
    language: string | null;
    topics?: string[];
    is_curated?: boolean;
  };
  score?: number;
  reason?: string;
};

export function IssueCard({ item }: { item: IssueCardData }) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-surface-border bg-surface-raised p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-700 hover:bg-surface-hover">
      {/* Subtle accent strip on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent-gradient opacity-0 transition-opacity group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          {/* Repo meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            <span className="truncate font-mono text-neutral-300">
              {item.repo.name}
            </span>
            <span className="inline-flex items-center gap-1">
              <StarIcon className="h-3 w-3 text-amber-400" />
              {item.repo.stars.toLocaleString()}
            </span>
            {item.repo.language && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                {item.repo.language}
              </span>
            )}
            {item.repo.is_curated && <Badge tone="accent">curated</Badge>}
          </div>

          {/* Title */}
          <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight text-neutral-50">
            <Link
              href={`/dashboard/issues/${item.id}`}
              className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 hover:bg-[length:100%_1px]"
            >
              {item.title}
            </Link>
          </h3>

          {/* AI reason */}
          {item.reason && (
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              <span className="text-neutral-500">Why · </span>
              {item.reason}
            </p>
          )}

          {/* Labels */}
          {item.labels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.labels.slice(0, 6).map((l) => (
                <Badge key={l} tone="neutral">
                  {l}
                </Badge>
              ))}
            </div>
          )}

          {/* Footer link */}
          <div className="mt-4 flex items-center gap-3 text-xs">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-neutral-400 transition hover:text-neutral-100"
            >
              View on GitHub
              <ExternalIcon className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Score + bounty column */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl border border-surface-border bg-surface-muted">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              match
            </span>
            <span className="text-lg font-semibold tabular-nums text-neutral-50">
              {item.score ?? "—"}
            </span>
          </div>
          {item.bounty_usd ? (
            <Badge tone="green">${item.bounty_usd}</Badge>
          ) : null}
        </div>
      </div>
    </article>
  );
}
