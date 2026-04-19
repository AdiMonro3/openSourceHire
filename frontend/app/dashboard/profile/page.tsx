"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import {
  ContributionHeatmap,
  type CalendarWeek,
} from "@/components/ContributionHeatmap";
import { GitHubIcon, SparklesIcon } from "@/components/Icons";

type Me = {
  id: number;
  github_login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Skill = { name: string; level: number; evidence?: string };

type Profile = {
  summary?: string;
  skills?: Skill[];
  interests?: string[];
};

type Portfolio = {
  user: {
    login: string;
    name: string | null;
    bio: string | null;
    location: string | null;
    avatar_url: string | null;
    followers: number;
    repos: number;
  };
  stats: {
    merged_prs: number;
    lines_added: number;
    lines_removed: number;
    active_repos: number;
  };
  contributions: { total: number; weeks: CalendarWeek[] };
  merged_prs: {
    title: string;
    url: string;
    merged_at: string | null;
    additions: number;
    deletions: number;
    changed_files: number;
    repo: { name: string; stars: number; language: string | null };
  }[];
};

function initials(src: string) {
  const parts = src.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "·";
}

function fmtMonth(date: string | null) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("en", { month: "short", year: "numeric" });
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [busy, setBusy] = useState(false);

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
    api<Profile>("/users/me/profile")
      .then(setProfile)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNeedsProfile(true);
        else setError(e.message ?? String(e));
      });
    api<Portfolio>("/users/me/portfolio")
      .then(setPortfolio)
      .catch(() => {
        /* portfolio is supplementary on this page */
      });
  }, [me]);

  async function refresh() {
    setBusy(true);
    try {
      const p = await api<Profile>("/users/me/profile/refresh", {
        method: "POST",
      });
      setProfile(p);
      setNeedsProfile(false);
      setError(null);
      const pf = await api<Portfolio>("/users/me/portfolio");
      setPortfolio(pf);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar user={me} />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <div className="h-48 rounded-2xl border border-surface-border bg-white shimmer" />
        </main>
      </div>
    );
  }

  const skills = (profile?.skills ?? [])
    .slice()
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));

  const displayName = portfolio?.user.name ?? me.name ?? me.github_login;
  const avatar = portfolio?.user.avatar_url ?? me.avatar_url;
  const bio = portfolio?.user.bio ?? null;
  const location = portfolio?.user.location ?? null;

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={me} />

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            Profile
          </h1>
          <Button
            variant="secondary"
            onClick={refresh}
            loading={busy}
            leadingIcon={busy ? undefined : <SparklesIcon className="h-4 w-4" />}
          >
            {busy ? "Analyzing…" : "Refresh profile"}
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {needsProfile ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-white/60 p-10 text-center">
            <h3 className="text-base font-semibold text-neutral-900">
              No profile yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              Build your skill graph from your public GitHub history. Takes
              about 10 seconds.
            </p>
            <div className="mt-5 flex justify-center">
              <Button
                onClick={refresh}
                loading={busy}
                leadingIcon={<SparklesIcon className="h-4 w-4" />}
              >
                {busy ? "Analyzing…" : "Build profile"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            {/* Left column */}
            <aside className="space-y-5">
              <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
                <div className="flex flex-col items-start gap-3">
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt={me.github_login}
                      className="h-16 w-16 rounded-full"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-lg font-semibold text-violet-700">
                      {initials(displayName)}
                    </span>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">
                      {displayName}
                    </h2>
                    <a
                      href={`https://github.com/${me.github_login}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-violet-700"
                    >
                      <GitHubIcon className="h-3.5 w-3.5" />@{me.github_login}
                    </a>
                  </div>
                </div>

                {(profile?.summary || bio) && (
                  <p className="mt-4 text-sm leading-relaxed text-neutral-700">
                    {profile?.summary ?? bio}
                  </p>
                )}

                {location && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-neutral-500">
                    <span aria-hidden>📍</span>
                    {location}
                  </p>
                )}

                {portfolio && (
                  <dl className="mt-4 flex gap-6 border-t border-surface-border pt-4">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        followers
                      </dt>
                      <dd className="mt-0.5 font-mono text-base font-semibold text-neutral-900">
                        {portfolio.user.followers.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        repos
                      </dt>
                      <dd className="mt-0.5 font-mono text-base font-semibold text-neutral-900">
                        {portfolio.user.repos.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Top skills
                </h3>
                {skills.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No skills detected yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {skills.slice(0, 6).map((s) => (
                      <SkillRow key={s.name} skill={s} />
                    ))}
                  </div>
                )}
              </div>

              {profile?.interests && profile.interests.length > 0 && (
                <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Interests
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((i) => (
                      <Badge key={i} tone="accent">
                        {i}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            {/* Right column */}
            <section className="space-y-5">
              <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
                {portfolio ? (
                  <ContributionHeatmap
                    weeks={portfolio.contributions.weeks}
                    total={portfolio.contributions.total}
                  />
                ) : (
                  <div className="h-32 rounded-xl bg-neutral-50 shimmer" />
                )}
              </div>

              <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
                <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Latest merged PRs
                </h3>
                {portfolio?.merged_prs?.length ? (
                  <ul className="divide-y divide-surface-border">
                    {portfolio.merged_prs.slice(0, 6).map((pr) => (
                      <li key={pr.url} className="py-3 first:pt-0 last:pb-0">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex items-start justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 group-hover:text-violet-700">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                              <span className="truncate">{pr.title}</span>
                            </div>
                            <div className="ml-4 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                              <span className="font-mono">{pr.repo.name}</span>
                              <span>·</span>
                              <span>{fmtMonth(pr.merged_at)}</span>
                            </div>
                          </div>
                          <div className="shrink-0 font-mono text-xs tabular-nums">
                            <span className="text-emerald-600">
                              +{pr.additions}
                            </span>{" "}
                            <span className="text-red-500">
                              −{pr.deletions}
                            </span>
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-neutral-500">
                    No merged PRs found in your public history yet.
                  </p>
                )}
              </div>

              <CliTokenPanel />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function CliTokenPanel() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/auth/cli/token", {
        method: "POST",
      });
      setToken(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">
          CLI token
        </h2>
        <code className="font-mono text-[10px] text-neutral-400">osh login</code>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Generate a token to authenticate the{" "}
        <code className="font-mono text-neutral-700">osh</code> CLI. Generating
        again rotates the token; the old one stops working.
      </p>
      {token ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-surface-border bg-surface-muted px-3 py-2 font-mono text-xs text-neutral-800">
              {token}
            </code>
            <button
              onClick={copy}
              className="rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-neutral-700 transition hover:text-violet-700"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <p className="text-xs text-amber-700">
            Copy this now — it won&apos;t be shown again.
          </p>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={generate} loading={busy}>
          Generate token
        </Button>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const level = Math.max(1, Math.min(5, skill.level ?? 1));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-neutral-800">
          {skill.name}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          L{level}/5
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={
              n <= level
                ? "h-1.5 flex-1 rounded-full bg-violet-500"
                : "h-1.5 flex-1 rounded-full bg-neutral-200"
            }
          />
        ))}
      </div>
    </div>
  );
}
