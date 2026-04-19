"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
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

export default function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [me, setMe] = useState<Me | null>(null);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingUnderstand, setLoadingUnderstand] = useState(true);
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
    api<Me>("/users/me")
      .then(setMe)
      .catch(() => {
        /* navbar handles missing user gracefully */
      });
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

  useEffect(() => {
    if (!issue) return;
    setLoadingUnderstand(true);
    api<Understanding>(`/issues/${id}/understand`)
      .then(setUnderstanding)
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoadingUnderstand(false));
  }, [id, issue]);

  return (
    <div className="min-h-screen">
      <Navbar user={me} />

      <main className="mx-auto max-w-4xl px-6 py-8 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition hover:text-neutral-100"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Back to feed
        </Link>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!issue && !error && (
          <div className="mt-6 h-40 rounded-2xl border border-surface-border bg-surface-raised shimmer" />
        )}

        {issue && (
          <>
            {/* Issue header */}
            <header className="mt-6 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                <span className="font-mono text-neutral-300">
                  {issue.repo.name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="h-3 w-3 text-amber-400" />
                  {issue.repo.stars.toLocaleString()}
                </span>
                {issue.repo.language && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    {issue.repo.language}
                  </span>
                )}
                {issue.repo.is_curated && (
                  <Badge tone="accent">curated</Badge>
                )}
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                {issue.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a href={issue.url} target="_blank" rel="noreferrer">
                  <Button
                    variant="secondary"
                    size="sm"
                    trailingIcon={<ExternalIcon className="h-3.5 w-3.5" />}
                  >
                    View on GitHub
                  </Button>
                </a>
                {issue.bounty_usd ? (
                  <Badge tone="green">${issue.bounty_usd} bounty</Badge>
                ) : null}
                {issue.labels.slice(0, 6).map((l) => (
                  <Badge key={l}>{l}</Badge>
                ))}
              </div>
            </header>

            {/* AI plan */}
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
                AI fix plan
              </div>

              {loadingUnderstand && (
                <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/60 p-6 text-sm text-neutral-500">
                  Reading the repo and drafting a plan… (usually 10–30s, cached
                  after)
                </div>
              )}

              {understanding && (
                <div className="space-y-5 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card animate-fade-in">
                  <div>
                    <Badge tone={DIFFICULTY_TONE[understanding.difficulty]}>
                      {understanding.difficulty}
                    </Badge>
                    <p className="mt-3 leading-relaxed text-neutral-200">
                      {understanding.plain_summary}
                    </p>
                  </div>

                  {understanding.approach.length > 0 && (
                    <PlanSection title="Approach">
                      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-neutral-300">
                        {understanding.approach.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </PlanSection>
                  )}

                  {understanding.likely_files.length > 0 && (
                    <PlanSection title="Likely files to touch">
                      <ul className="flex flex-wrap gap-1.5">
                        {understanding.likely_files.map((f) => (
                          <li key={f}>
                            <code className="rounded-md border border-surface-border bg-surface-muted px-2 py-1 font-mono text-xs text-neutral-300">
                              {f}
                            </code>
                          </li>
                        ))}
                      </ul>
                    </PlanSection>
                  )}

                  {understanding.gotchas.length > 0 && (
                    <PlanSection title="Gotchas">
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
                        {understanding.gotchas.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </PlanSection>
                  )}

                  {understanding.clarifying_questions.length > 0 && (
                    <PlanSection title="Ask the maintainer">
                      <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
                        {understanding.clarifying_questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </PlanSection>
                  )}
                </div>
              )}
            </section>

            {/* PR Coach */}
            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
                PR coach
              </div>
              <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
                <p className="text-sm text-neutral-400">
                  Describe what you changed in plain English. The coach drafts a
                  commit + PR description matching this repo&apos;s house style.
                  Nothing is submitted to GitHub.
                </p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. Fixed the null check in parse_config so missing env vars fall back to defaults instead of crashing…"
                  rows={5}
                  className="w-full resize-y rounded-lg border border-surface-border bg-surface-muted px-3 py-2 font-mono text-sm text-neutral-200 outline-none transition focus:border-violet-400/50"
                />
                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
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
                  <div className="space-y-5 border-t border-surface-border pt-5 animate-fade-in">
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
                        <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
                          {coach.checklist.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </PlanSection>
                    )}
                    {coach.questions_for_contributor.length > 0 && (
                      <PlanSection title="Open questions">
                        <ul className="list-disc space-y-1.5 pl-5 text-sm text-neutral-300">
                          {coach.questions_for_contributor.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </PlanSection>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Original body */}
            {issue.body && (
              <section className="mt-6">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Original issue
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-surface-border bg-surface-raised p-5 font-mono text-sm leading-relaxed text-neutral-300 shadow-card">
                  {issue.body}
                </pre>
              </section>
            )}
          </>
        )}
      </main>
    </div>
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
    } catch {
      /* clipboard may be blocked; user can still select text */
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100">{label}</h3>
        <button
          onClick={copy}
          className="text-xs text-neutral-400 transition hover:text-violet-300"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {multiline ? (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-surface-muted p-3 font-mono text-xs leading-relaxed text-neutral-200">
          {value}
        </pre>
      ) : (
        <code className="block rounded-lg border border-surface-border bg-surface-muted px-3 py-2 font-mono text-xs text-neutral-200">
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
    <div className="border-t border-surface-border pt-4 first:border-0 first:pt-0">
      <h3 className="mb-2 text-sm font-semibold text-neutral-100">{title}</h3>
      {children}
    </div>
  );
}
