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
  if (!lang) return "bg-neutral-300";
  const map: Record<string, string> = {
    TypeScript: "bg-sky-500",
    JavaScript: "bg-amber-400",
    Python: "bg-blue-500",
    Go: "bg-cyan-500",
    Rust: "bg-orange-500",
    Java: "bg-red-500",
    C: "bg-neutral-500",
    "C++": "bg-pink-500",
    Ruby: "bg-rose-500",
    Swift: "bg-orange-400",
  };
  return map[lang] ?? "bg-violet-400";
}

function matchTone(score?: number): { text: string; ring: string } {
  if (score == null) return { text: "text-neutral-500", ring: "ring-neutral-200" };
  if (score >= 90) return { text: "text-violet-700", ring: "ring-violet-200" };
  if (score >= 80) return { text: "text-emerald-600", ring: "ring-emerald-200" };
  if (score >= 70) return { text: "text-sky-600", ring: "ring-sky-200" };
  return { text: "text-neutral-600", ring: "ring-neutral-200" };
}

export function IssueCard({ item }: { item: IssueCardData }) {
  const tone = matchTone(item.score);
  return (
    <Link
      href={`/dashboard/issues/${item.id}`}
      className="group block"
    >
      <article className="relative overflow-hidden rounded-2xl border border-surface-border bg-white p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              <span className="truncate font-mono text-neutral-700">
                {item.repo.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <StarIcon className="h-3 w-3 text-amber-500" />
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

            <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight text-neutral-900 group-hover:text-violet-700">
              {item.title}
            </h3>

            {item.reason && (
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                <span className="text-neutral-400">Why · </span>
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
              "flex shrink-0 flex-col items-center justify-center rounded-2xl border bg-white px-4 py-3 ring-1",
              "border-neutral-100",
              tone.ring,
            )}
          >
            <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
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
