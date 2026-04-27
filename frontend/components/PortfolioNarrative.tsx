import { Badge } from "./Badge";

type Strength = { label: string; evidence?: string };
type Highlight = { pr_url: string; impact: string; why_it_matters: string };

export type Narrative = {
  headline?: string;
  summary?: string;
  strengths?: Strength[];
  highlights?: Highlight[];
  recommended_next_steps?: string[];
};

type PR = {
  title: string;
  url: string;
  merged_at: string | null;
  repo: { name: string; stars: number; language: string | null };
};

function fmtMonth(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en", {
    month: "short",
    year: "numeric",
  });
}

export function PortfolioNarrative({
  narrative,
  merged_prs,
}: {
  narrative: Narrative;
  merged_prs: PR[];
}) {
  const prByUrl = new Map(merged_prs.map((p) => [p.url, p]));
  const highlights = (narrative.highlights ?? []).filter((h) => h.pr_url);

  return (
    <section className="space-y-8">
      {(narrative.headline || narrative.summary) && (
        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
          {narrative.headline && (
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              {narrative.headline}
            </h2>
          )}
          {narrative.summary && (
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {narrative.summary}
            </p>
          )}
        </div>
      )}

      {narrative.strengths && narrative.strengths.length > 0 && (
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Strengths
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {narrative.strengths.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-surface-border bg-surface-raised p-4 shadow-card"
              >
                <Badge tone="accent">{s.label}</Badge>
                {s.evidence && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {s.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {highlights.length > 0 && (
        <div>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Highlighted contributions
          </h3>
          <ul className="grid gap-3">
            {highlights.map((h) => {
              const pr = prByUrl.get(h.pr_url);
              return (
                <li key={h.pr_url}>
                  <a
                    href={h.pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block"
                  >
                    <article className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-surface-border-strong hover:bg-surface-hover hover:shadow-card-hover">
                      {pr && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                          <span className="font-mono text-ink">
                            {pr.repo.name}
                          </span>
                          {pr.repo.language && (
                            <span>{pr.repo.language}</span>
                          )}
                          <Badge tone="green">merged</Badge>
                          <span>{fmtMonth(pr.merged_at)}</span>
                        </div>
                      )}
                      <h4 className="mt-2 text-base font-semibold leading-snug tracking-tight text-ink group-hover:text-violet-300">
                        {pr?.title ?? h.pr_url}
                      </h4>
                      <p className="mt-2 text-sm text-ink-muted">
                        <span className="font-medium text-ink">Impact: </span>
                        {h.impact}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted">
                        <span className="font-medium text-ink">Why it matters: </span>
                        {h.why_it_matters}
                      </p>
                    </article>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {narrative.recommended_next_steps &&
        narrative.recommended_next_steps.length > 0 && (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/40 p-5">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              Recommended next steps
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted marker:text-ink-subtle">
              {narrative.recommended_next_steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        )}
    </section>
  );
}
