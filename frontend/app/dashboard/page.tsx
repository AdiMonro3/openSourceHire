"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { IssueCard, type IssueCardData } from "@/components/IssueCard";
import { StatCard } from "@/components/StatCard";
import { GitHubIcon, SparklesIcon } from "@/components/Icons";

type Me = {
  id: number;
  github_login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type FeedItem = IssueCardData;
type Feed = { items: FeedItem[]; count: number };

function relativeTime(date: Date | null): string {
  if (!date) return "just now";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [authError, setAuthError] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"feed" | "profile" | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    api<Me>("/users/me")
      .then(setMe)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) setAuthError(true);
        else setError(e.message ?? String(e));
      });
  }, []);

  useEffect(() => {
    if (!me) return;
    setBusy("feed");
    api<Feed>("/feed?limit=10")
      .then((f) => {
        setFeed(f);
        setNeedsProfile(false);
        setUpdatedAt(new Date());
        setError(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 409) setNeedsProfile(true);
        else setError(e.message ?? String(e));
      })
      .finally(() => setBusy(null));
  }, [me]);

  async function refreshProfile() {
    setBusy("profile");
    try {
      await api("/users/me/profile/refresh", { method: "POST" });
      const f = await api<Feed>("/feed?limit=10");
      setFeed(f);
      setUpdatedAt(new Date());
      setNeedsProfile(false);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(null);
    }
  }

  if (authError) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-surface">
        <div aria-hidden className="absolute inset-0 bg-hero-glow" />
        <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            You&apos;re not signed in
          </h1>
          <p className="text-sm text-neutral-500">
            Continue with GitHub to load your matched issues.
          </p>
          <a href="/login" className="mx-auto">
            <Button leadingIcon={<GitHubIcon className="h-4 w-4" />} size="lg">
              Sign in with GitHub
            </Button>
          </a>
        </main>
      </div>
    );
  }

  const items = feed?.items ?? [];
  const issuesMatched = feed?.count ?? 0;
  const skillScore =
    items.length > 0
      ? Math.round(
          items.reduce((s, i) => s + (i.score ?? 0), 0) / items.length,
        )
      : null;
  const bountyTotal = items.reduce(
    (s, i) => s + (i.bounty_usd ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={me} />

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              Your issue feed
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              AI-ranked by your skill graph · Updated {relativeTime(updatedAt)}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={refreshProfile}
            loading={busy === "profile"}
            leadingIcon={
              busy === "profile" ? undefined : (
                <SparklesIcon className="h-4 w-4" />
              )
            }
          >
            {busy === "profile" ? "Analyzing profile…" : "Refresh skill profile"}
          </Button>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Skill score"
            value={skillScore != null ? `${skillScore}/100` : "—"}
            tone="default"
          />
          <StatCard
            label="Issues matched"
            value={issuesMatched}
            tone="default"
          />
          <StatCard
            label="Bounty available"
            value={bountyTotal > 0 ? `$${bountyTotal}` : "$0"}
            tone="default"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {busy === "feed" && <FeedSkeleton />}

        {needsProfile && (
          <EmptyState
            title="Build your skill profile first"
            body="We need to read your GitHub activity to rank issues. This usually takes about 10 seconds."
            action={
              <Button
                onClick={refreshProfile}
                loading={busy === "profile"}
                leadingIcon={<SparklesIcon className="h-4 w-4" />}
              >
                {busy === "profile" ? "Analyzing…" : "Build skill profile"}
              </Button>
            }
          />
        )}

        {feed && feed.items.length === 0 && busy !== "feed" && !needsProfile && (
          <EmptyState
            title="No matches yet"
            body={
              <>
                Run{" "}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700">
                  POST /admin/ingest?repos=5&amp;limit=5
                </code>{" "}
                to populate, then refresh your skill profile.
              </>
            }
          />
        )}

        {feed && feed.items.length > 0 && (
          <ul className="grid gap-3 animate-fade-in">
            {feed.items.map((item) => (
              <li key={item.id}>
                <IssueCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-surface-border bg-white/60 p-10 text-center">
      <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <ul className="grid gap-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-32 rounded-2xl border border-surface-border bg-white shimmer"
        />
      ))}
    </ul>
  );
}
