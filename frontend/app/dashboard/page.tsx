"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";

type Me = {
  id: number;
  github_login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type FeedItem = {
  id: number;
  title: string;
  url: string;
  labels: string[];
  comments: number;
  bounty_usd: number | null;
  repo: {
    name: string;
    stars: number;
    language: string | null;
    topics: string[];
    reputation: number;
    is_curated: boolean;
  };
  score: number;
  reason: string;
};

type Feed = { items: FeedItem[]; count: number };

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);
  const [needsProfile, setNeedsProfile] = useState<boolean>(false);
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-16">
        <p className="text-neutral-600">You&apos;re not signed in.</p>
        <a
          href="/login"
          className="inline-flex w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Sign in with GitHub
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {me?.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.avatar_url}
              alt={me.github_login}
              className="h-10 w-10 rounded-full"
            />
          )}
          <div>
            <div className="font-semibold">{me?.name ?? me?.github_login ?? "…"}</div>
            {me?.github_login && (
              <div className="text-sm text-neutral-500">@{me.github_login}</div>
            )}
          </div>
        </div>
        <button
          onClick={refreshProfile}
          disabled={busy === "profile"}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {busy === "profile" ? "Analyzing profile…" : "Refresh skill profile"}
        </button>
      </header>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Issues for you</h1>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {busy === "feed" && (
        <div className="text-sm text-neutral-500">Ranking candidates…</div>
      )}

      {needsProfile && (
        <div className="rounded-lg border border-dashed p-6 text-neutral-600 dark:border-neutral-800">
          <p className="mb-2 font-medium">Build your skill profile first.</p>
          <p className="mb-4 text-sm">
            We need to read your GitHub activity to rank issues. This usually takes ~10 seconds.
          </p>
          <button
            onClick={refreshProfile}
            disabled={busy === "profile"}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy === "profile" ? "Analyzing…" : "Build skill profile"}
          </button>
        </div>
      )}

      {feed && feed.items.length === 0 && busy !== "feed" && (
        <div className="rounded-lg border border-dashed p-6 text-neutral-600 dark:border-neutral-800">
          <p className="mb-2 font-medium">No matches yet.</p>
          <p className="text-sm">
            Run <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">POST /admin/ingest?repos=5&amp;limit=5</code>{" "}
            to populate, then click <em>Refresh skill profile</em>.
          </p>
        </div>
      )}

      <ul className="space-y-4">
        {feed?.items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:underline"
                >
                  {item.title}
                </a>
                <div className="mt-1 text-sm text-neutral-500">
                  {item.repo.name}
                  {" · ★ "}
                  {item.repo.stars.toLocaleString()}
                  {item.repo.language ? ` · ${item.repo.language}` : ""}
                  {item.repo.is_curated ? " · curated" : ""}
                </div>
                {item.reason && (
                  <div className="mt-2 text-sm italic text-neutral-600 dark:text-neutral-400">
                    {item.reason}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.labels.slice(0, 6).map((l) => (
                    <span
                      key={l}
                      className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{item.score ?? "—"}</div>
                <div className="text-xs text-neutral-500">score</div>
                {item.bounty_usd ? (
                  <div className="mt-1 text-sm font-medium text-green-600">
                    ${item.bounty_usd}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
