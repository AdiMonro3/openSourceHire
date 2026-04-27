"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { StarIcon } from "@/components/Icons";

type Me = {
  id: number;
  github_login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type PR = {
  title: string;
  url: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  repo: { name: string; stars: number; language: string | null };
};

type Portfolio = {
  user: { login: string; name: string | null; avatar_url: string | null };
  stats: {
    merged_prs: number;
    lines_added: number;
    lines_removed: number;
    active_repos: number;
  };
  merged_prs: PR[];
};

function fmtMonth(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en", {
    month: "short",
    year: "numeric",
  });
}

function languageDot(lang?: string | null) {
  if (!lang) return "bg-white/20";
  const map: Record<string, string> = {
    TypeScript: "bg-sky-400",
    JavaScript: "bg-amber-300",
    Python: "bg-blue-400",
    Go: "bg-cyan-400",
    Rust: "bg-orange-400",
    Java: "bg-red-400",
    Ruby: "bg-rose-400",
  };
  return map[lang] ?? "bg-violet-400";
}

export default function PortfolioPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();
  const autoPublishedRef = useRef(false);

  const publicUrl = me
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/profile/${me.github_login}`
    : "";

  async function onPublish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await api<{ generated_at: string }>(
        "/users/me/portfolio/publish",
        { method: "POST" },
      );
      setPublishedAt(res.generated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  async function onCopy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  useEffect(() => {
    if (!me || autoPublishedRef.current) return;
    if (searchParams?.get("first") !== "1") return;
    autoPublishedRef.current = true;
    onPublish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  useEffect(() => {
    api<Me>("/users/me")
      .then(setMe)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError(e.message ?? String(e));
      });
  }, []);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    api<Portfolio>("/users/me/portfolio")
      .then(setPortfolio)
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [me]);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={me} />

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Contribution portfolio
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Merged pull requests across open-source.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={onPublish}
              disabled={publishing || !me}
              className={clsx(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                publishing
                  ? "cursor-not-allowed border-surface-border bg-white/5 text-ink-subtle"
                  : "border-violet-500 bg-violet-500 text-white shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_28px_-8px_rgba(139,92,246,0.75)] hover:bg-violet-400",
              )}
            >
              {publishing ? "Publishing…" : publishedAt ? "Re-publish" : "Publish public profile"}
            </button>
            {me && (publishedAt || !publishing) && (
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Link
                  href={`/profile/${me.github_login}`}
                  target="_blank"
                  className="font-mono text-ink underline decoration-dotted hover:text-violet-300"
                >
                  /profile/{me.github_login}
                </Link>
                <button
                  onClick={onCopy}
                  className="rounded-md border border-surface-border bg-surface-raised px-2 py-0.5 transition hover:border-surface-border-strong hover:text-ink"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Merged PRs"
            value={portfolio?.stats.merged_prs ?? "—"}
          />
          <StatCard
            label="Lines added"
            value={
              portfolio
                ? `+${portfolio.stats.lines_added.toLocaleString()}`
                : "—"
            }
            tone="green"
          />
          <StatCard
            label="Lines removed"
            value={
              portfolio
                ? `−${portfolio.stats.lines_removed.toLocaleString()}`
                : "—"
            }
            tone="red"
          />
          <StatCard
            label="Active repos"
            value={portfolio?.stats.active_repos ?? "—"}
          />
        </div>

        {loading && !portfolio && (
          <ul className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-24 rounded-2xl border border-surface-border bg-surface-raised shimmer"
              />
            ))}
          </ul>
        )}

        {portfolio && portfolio.merged_prs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/40 p-10 text-center">
            <h3 className="text-base font-semibold text-ink">
              No merged PRs yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Once you merge a pull request on GitHub, it&apos;ll show up here
              with an evidence trail of impact.
            </p>
          </div>
        )}

        {portfolio && portfolio.merged_prs.length > 0 && (
          <ul className="grid gap-3 animate-fade-in">
            {portfolio.merged_prs.map((pr) => (
              <li key={pr.url}>
                <PrCard pr={pr} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function PrCard({ pr }: { pr: PR }) {
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className="group block"
    >
      <article className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-surface-border-strong hover:bg-surface-hover hover:shadow-card-hover">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="font-mono text-ink">{pr.repo.name}</span>
          <span className="inline-flex items-center gap-1">
            <StarIcon className="h-3 w-3 text-amber-400" />
            {pr.repo.stars >= 1000
              ? `${Math.round(pr.repo.stars / 1000)}k`
              : pr.repo.stars.toLocaleString()}
          </span>
          {pr.repo.language && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={clsx(
                  "h-2 w-2 rounded-full",
                  languageDot(pr.repo.language),
                )}
              />
              {pr.repo.language}
            </span>
          )}
          <Badge tone="green">merged</Badge>
          <span className="text-ink-subtle">{fmtMonth(pr.merged_at)}</span>
        </div>

        <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight text-ink group-hover:text-violet-300">
          {pr.title}
        </h3>

        <div className="mt-3 flex items-center gap-4 font-mono text-xs">
          <span className="text-emerald-300">+{pr.additions.toLocaleString()}</span>
          <span className="text-red-300">−{pr.deletions.toLocaleString()}</span>
          <span className="text-ink-subtle">
            · {pr.changed_files.toLocaleString()} file
            {pr.changed_files === 1 ? "" : "s"}
          </span>
        </div>
      </article>
    </a>
  );
}
