import Link from "next/link";
import clsx from "clsx";
import { Badge } from "./Badge";
import { StarIcon } from "./Icons";

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

function languageDot(lang?: string | null) {
  if (!lang) return "bg-white/20";
  const map: Record<string, string> = {
    TypeScript: "bg-sky-400",
    JavaScript: "bg-amber-300",
    Python: "bg-blue-400",
    Go: "bg-cyan-400",
    Rust: "bg-orange-400",
    Java: "bg-red-400",
    C: "bg-neutral-400",
    "C++": "bg-pink-400",
    Ruby: "bg-rose-400",
    Swift: "bg-orange-300",
  };
  return map[lang] ?? "bg-violet-400";
}

function matchTone(score?: number): { text: string; ring: string } {
  if (score == null)
    return { text: "text-ink-muted", ring: "ring-surface-border" };
  if (score >= 90)
    return { text: "text-violet-300", ring: "ring-violet-500/40" };
  if (score >= 80)
    return { text: "text-emerald-300", ring: "ring-emerald-500/40" };
  if (score >= 70) return { text: "text-sky-300", ring: "ring-sky-500/40" };
  return { text: "text-ink-muted", ring: "ring-surface-border" };
}

export function IssueCard({ item }: { item: IssueCardData }) {
  const tone = matchTone(item.score);
  return (
    <Link
      href={`/dashboard/issues/${item.id}`}
      className="group block"
    >
      <article className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-surface-border-strong hover:bg-surface-hover hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="truncate font-mono text-ink">
                {item.repo.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <StarIcon className="h-3 w-3 text-amber-400" />
                {(item.repo.stars >= 1000
                  ? `${Math.round(item.repo.stars / 1000)}k`
                  : item.repo.stars.toLocaleString())}
              </span>
              {item.repo.language && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={clsx(
                      "h-2 w-2 rounded-full",
                      languageDot(item.repo.language),
                    )}
                  />
                  {item.repo.language}
                </span>
              )}
              {item.repo.is_curated && (
                <Badge tone="accent">curated</Badge>
              )}
            </div>

            <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight text-ink group-hover:text-violet-300">
              {item.title}
            </h3>

            {item.reason && (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                <span className="text-ink-subtle">Why · </span>
                {item.reason}
              </p>
            )}

            {(item.labels.length > 0 || item.bounty_usd) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.labels.slice(0, 5).map((l) => (
                  <Badge key={l} tone="neutral">
                    {l}
                  </Badge>
                ))}
                {item.bounty_usd ? (
                  <Badge tone="green">${item.bounty_usd} bounty</Badge>
                ) : null}
              </div>
            )}
          </div>

          <div
            className={clsx(
              "flex shrink-0 flex-col items-center justify-center rounded-2xl border border-surface-border bg-surface px-4 py-3 ring-1",
              tone.ring,
            )}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-subtle">
              match
            </span>
            <span
              className={clsx(
                "font-mono text-2xl font-semibold tabular-nums",
                tone.text,
              )}
            >
              {item.score ?? "—"}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
