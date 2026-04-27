"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  ArrowLeftIcon,
  ExternalIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/Icons";

const FixWorkspace = dynamic(
  () => import("@/components/fix/FixWorkspace").then((m) => m.FixWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] items-center justify-center text-sm text-ink-subtle">
        Loading the browser editor…
      </div>
    ),
  },
);

type Tab = "plan" | "fix" | "coach";

type IssueDetail = {
  id: number;
  number: number;
  title: string;
  body: string | null;
  url: string;
  state: string;
  labels: string[];
  comments: number;
  bounty_usd: number | null;
  score?: number | null;
  reason?: string | null;
  repo: {
    name: string;
    description: string | null;
    stars: number;
    language: string | null;
    topics: string[];
    is_curated: boolean;
  };
};

type Understanding = {
  plain_summary: string;
  approach: string[];
  likely_files: string[];
  gotchas: string[];
  clarifying_questions: string[];
  difficulty: "easy" | "medium" | "hard";
};

type CoachOutput = {
  commit_title: string;
  commit_body: string;
  pr_title: string;
  pr_body: string;
  checklist: string[];
  questions_for_contributor: string[];
};

type Me = {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
};

const DIFFICULTY_TONE: Record<
  Understanding["difficulty"],
  "green" | "yellow" | "red"
> = {
  easy: "green",
  medium: "yellow",
  hard: "red",
};

function matchTone(score?: number | null) {
  if (score == null) return "text-ink-muted";
  if (score >= 90) return "text-violet-300";
  if (score >= 80) return "text-emerald-300";
  if (score >= 70) return "text-sky-300";
  return "text-ink-muted";
}

export default function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const issueIdNum = Number(id);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab =
    tabParam === "fix" || tabParam === "coach" ? tabParam : "plan";

  const setTab = (t: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (t === "plan") params.delete("tab");
    else params.set("tab", t);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [me, setMe] = useState<Me | null>(null);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingUnderstand, setLoadingUnderstand] = useState(true);
  const [understandError, setUnderstandError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [coach, setCoach] = useState<CoachOutput | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  async function runCoach() {
    if (!draft.trim()) return;
    setLoadingCoach(true);
    setCoachError(null);
    try {
      const result = await api<CoachOutput>(`/issues/${id}/pr-coach`, {
        method: "POST",
        body: JSON.stringify({ draft }),
      });
      setCoach(result);
    } catch (e) {
      setCoachError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCoach(false);
    }
  }

  useEffect(() => {
    api<Me>("/users/me").then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    api<IssueDetail>(`/issues/${id}`)
      .then(setIssue)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError(e.message ?? String(e));
      });
  }, [id]);

  const fetchUnderstanding = useCallback(() => {
    setLoadingUnderstand(true);
    setUnderstandError(null);
    api<Understanding>(`/issues/${id}/understand`)
      .then((u) => {
        setUnderstanding(u);
        setUnderstandError(null);
      })
      .catch((e) =>
        setUnderstandError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLoadingUnderstand(false));
  }, [id]);

  useEffect(() => {
    if (!issue) return;
    fetchUnderstanding();
  }, [issue, fetchUnderstanding]);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={me} />

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-ink"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to feed
        </Link>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!issue && !error && (
          <div className="mt-6 h-40 rounded-2xl border border-surface-border bg-surface-raised shimmer" />
        )}

        {issue && (
          <>
            {/* Issue header */}
            <header className="mt-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                <span className="font-mono text-ink">
                  {issue.repo.name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="h-3 w-3 text-amber-400" />
                  {(issue.repo.stars >= 1000
                    ? `${Math.round(issue.repo.stars / 1000)}k`
                    : issue.repo.stars.toLocaleString())}
                </span>
                <span className="font-mono text-ink-subtle">
                  #{issue.number}
                </span>
                {issue.labels.slice(0, 4).map((l) => (
                  <Badge key={l}>{l}</Badge>
                ))}
                {issue.bounty_usd ? (
                  <Badge tone="green">${issue.bounty_usd} bounty</Badge>
                ) : null}
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
                {issue.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {issue.score != null && (
                  <div className="inline-flex items-center gap-3 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">
                      match
                    </span>
                    <span
                      className={clsx(
                        "font-mono text-lg font-semibold tabular-nums",
                        matchTone(issue.score),
                      )}
                    >
                      {issue.score}
                    </span>
                  </div>
                )}
                {issue.reason && (
                  <p className="text-sm text-ink-muted">
                    <span className="text-ink-subtle">Why you · </span>
                    {issue.reason}
                  </p>
                )}
                <a href={issue.url} target="_blank" rel="noreferrer">
                  <Button
                    variant="secondary"
                    size="sm"
                    trailingIcon={<ExternalIcon className="h-3.5 w-3.5" />}
                  >
                    View on GitHub
                  </Button>
                </a>
              </div>
            </header>

            {/* Tabs */}
            <div className="mt-6 flex items-center gap-1 border-b border-surface-border">
              <TabButton
                active={activeTab === "plan"}
                onClick={() => setTab("plan")}
              >
                Plan
              </TabButton>
              <TabButton
                active={activeTab === "fix"}
                onClick={() => setTab("fix")}
                accent
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                Fix in browser
                <Badge tone="accent">new</Badge>
              </TabButton>
              <TabButton
                active={activeTab === "coach"}
                onClick={() => setTab("coach")}
              >
                PR coach
              </TabButton>
            </div>

            {activeTab === "fix" && (
              <div className="mt-6">
                <FixWorkspace issueId={issueIdNum} />
              </div>
            )}

            {activeTab === "plan" && (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Issue description
                </div>
                {issue.body ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                    {issue.body}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-ink-subtle">
                    No description provided.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                    <SparklesIcon className="h-3.5 w-3.5" />
                    AI fix plan
                  </div>
                  {understanding && (
                    <Badge tone={DIFFICULTY_TONE[understanding.difficulty]}>
                      {understanding.difficulty}
                    </Badge>
                  )}
                </div>

                {loadingUnderstand && (
                  <p className="mt-4 text-sm text-ink-subtle">
                    Reading the repo and drafting a plan… (usually 10–30s,
                    cached after).
                  </p>
                )}

                {!loadingUnderstand && understandError && !understanding && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 animate-fade-in">
                    <p className="text-sm text-red-300">
                      Couldn&apos;t draft the AI fix plan.
                    </p>
                    <p className="mt-1 break-words text-xs text-red-300/80">
                      {understandError}
                    </p>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={fetchUnderstanding}
                        loading={loadingUnderstand}
                        leadingIcon={<SparklesIcon className="h-3.5 w-3.5" />}
                      >
                        Retry AI fix plan
                      </Button>
                    </div>
                  </div>
                )}

                {understanding && (
                  <div className="mt-4 space-y-5 animate-fade-in">
                    {understanding.plain_summary && (
                      <p className="text-sm leading-relaxed text-ink-muted">
                        {understanding.plain_summary}
                      </p>
                    )}

                    {understanding.approach.length > 0 && (
                      <PlanSection title="Approach">
                        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
                          {understanding.approach.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </PlanSection>
                    )}

                    {understanding.likely_files.length > 0 && (
                      <PlanSection title="Key files">
                        <ul className="space-y-1.5 text-sm text-ink-muted">
                          {understanding.likely_files.map((f) => (
                            <li
                              key={f}
                              className="flex items-start gap-2 leading-relaxed"
                            >
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
                              <code className="rounded-md border border-surface-border bg-surface px-1.5 py-0.5 font-mono text-xs text-ink">
                                {f}
                              </code>
                            </li>
                          ))}
                        </ul>
                      </PlanSection>
                    )}

                    {understanding.gotchas.length > 0 && (
                      <PlanSection title="Watch-outs">
                        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
                          {understanding.gotchas.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </PlanSection>
                    )}

                    {understanding.clarifying_questions.length > 0 && (
                      <PlanSection title="Ask the maintainer">
                        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
                          {understanding.clarifying_questions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </PlanSection>
                    )}
                  </div>
                )}
              </section>
            </div>
            )}

            {activeTab === "coach" && (
            <section className="mt-6 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
              <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                <SparklesIcon className="h-3.5 w-3.5" />
                PR coach
              </div>
              <p className="text-sm text-ink-muted">
                Describe what you changed in plain English. The coach drafts a
                commit + PR description matching this repo&apos;s house style.
                Nothing is submitted to GitHub.
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Fixed the null check in parse_config so missing env vars fall back to defaults instead of crashing…"
                rows={5}
                className="mt-4 w-full resize-y rounded-lg border border-surface-border bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-subtle outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
              />
              <div className="mt-3 flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={runCoach}
                  loading={loadingCoach}
                  disabled={!draft.trim()}
                >
                  Draft PR
                </Button>
                {coachError && (
                  <span className="text-xs text-red-300">{coachError}</span>
                )}
              </div>

              {coach && (
                <div className="mt-5 space-y-5 border-t border-surface-border pt-5 animate-fade-in">
                  <CoachField label="Commit title" value={coach.commit_title} />
                  {coach.commit_body && (
                    <CoachField
                      label="Commit body"
                      value={coach.commit_body}
                      multiline
                    />
                  )}
                  <CoachField label="PR title" value={coach.pr_title} />
                  <CoachField label="PR body" value={coach.pr_body} multiline />

                  {coach.checklist.length > 0 && (
                    <PlanSection title="Before you open the PR">
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
                        {coach.checklist.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </PlanSection>
                  )}
                  {coach.questions_for_contributor.length > 0 && (
                    <PlanSection title="Open questions">
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
                        {coach.questions_for_contributor.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </PlanSection>
                  )}
                </div>
              )}
            </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  accent = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition",
        active
          ? accent
            ? "border-violet-400 text-violet-200"
            : "border-ink text-ink"
          : "border-transparent text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function CoachField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <button
          onClick={copy}
          className="text-xs text-ink-muted transition hover:text-violet-300"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {multiline ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-surface p-3 font-mono text-xs leading-relaxed text-ink">
          {value}
        </pre>
      ) : (
        <code className="block rounded-lg border border-surface-border bg-surface px-3 py-2 font-mono text-xs text-ink">
          {value}
        </code>
      )}
    </div>
  );
}

function PlanSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}
