"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { IssueCard, type IssueCardData } from "@/components/IssueCard";
import { StatCard } from "@/components/StatCard";
import {
  BoltIcon,
  GitHubIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/Icons";

type Me = {
  id: number;
  github_login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type FeedItem = IssueCardData;
type Feed = { items: FeedItem[]; count: number };

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [authError, setAuthError] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"feed" | "profile" | null>(null);

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
      <div className="relative min-h-screen overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-hero-glow" />
        <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            You&apos;re not signed in
          </h1>
          <p className="text-sm text-neutral-400">
            Continue with GitHub to load your matched issues.
          </p>
          <a href="/login" className="mx-auto">
            <Button
              leadingIcon={<GitHubIcon className="h-4 w-4" />}
              size="lg"
            >
              Sign in with GitHub
            </Button>
          </a>
        </main>
      </div>
    );
  }

  const topItems = feed?.items ?? [];
  const avgScore =
    topItems.length > 0
      ? Math.round(
          topItems.reduce((s, i) => s + (i.score ?? 0), 0) / topItems.length,
        )
      : null;
  const bountyTotal = topItems.reduce(
    (s, i) => s + (i.bounty_usd ?? 0),
    0,
  );

  return (
    <div className="min-h-screen">
      <Navbar user={me} />

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        {/* Page header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your feed
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Issues ranked against your shipped work. Refresh to re-read your
              GitHub activity.
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

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main column */}
          <section className="order-2 lg:order-1">
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

            {feed && feed.items.length === 0 && busy !== "feed" && (
              <EmptyState
                title="No matches yet"
                body={
                  <>
                    Run{" "}
                    <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-neutral-300">
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
          </section>

          {/* Sidebar */}
          <aside className="order-1 space-y-4 lg:order-2">
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-4 shadow-card">
              <div className="flex items-center gap-3">
                {me?.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={me.avatar_url}
                    alt={me.github_login}
                    className="h-10 w-10 rounded-full ring-2 ring-surface-border"
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {me?.name ?? me?.github_login ?? "…"}
                  </div>
                  {me?.github_login && (
                    <div className="truncate text-xs text-neutral-500">
                      @{me.github_login}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <StatCard
                label="Ranked"
                value={feed?.count ?? 0}
                icon={<BoltIcon className="h-3.5 w-3.5 text-violet-300" />}
                hint="Issues in your feed"
              />
              <StatCard
                label="Avg match"
                value={avgScore ?? "—"}
                icon={<SparklesIcon className="h-3.5 w-3.5 text-violet-300" />}
                hint="Across top 10"
              />
              <StatCard
                label="Bounties"
                value={bountyTotal > 0 ? `$${bountyTotal}` : "—"}
                icon={<StarIcon className="h-3.5 w-3.5 text-amber-400" />}
                hint="Total in feed"
              />
            </div>
          </aside>
        </div>
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
    <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/60 p-8 text-center">
      <h3 className="text-base font-semibold text-neutral-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">{body}</p>
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
          className="h-32 rounded-xl border border-surface-border bg-surface-raised shimmer"
        />
      ))}
    </ul>
  );
}
