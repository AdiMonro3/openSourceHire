"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ProfileCard } from "@/components/ProfileCard";
import { IssueCard, type IssueCardData } from "@/components/IssueCard";
import { SparklesIcon } from "@/components/Icons";

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

type Feed = { items: IssueCardData[]; count: number };

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
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
    api<Feed>("/feed?limit=6")
      .then(setFeed)
      .catch(() => {
        /* ignore — feed is supplementary on this page */
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
      const f = await api<Feed>("/feed?limit=6");
      setFeed(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!me) {
    return (
      <div className="min-h-screen">
        <Navbar user={me} />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <div className="h-48 rounded-2xl border border-surface-border bg-surface-raised shimmer" />
        </main>
      </div>
    );
  }

  const skills = (profile?.skills ?? [])
    .slice()
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));

  return (
    <div className="min-h-screen">
      <Navbar user={me} />

      <main className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Profile
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Your skill graph, derived from public GitHub activity.
            </p>
          </div>
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
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {needsProfile ? (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/60 p-10 text-center">
            <h3 className="text-base font-semibold">No profile yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
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
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside>
              <ProfileCard user={me} profile={profile} compact />
            </aside>

            <section className="space-y-6">
              {/* Skills grid */}
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-base font-semibold tracking-tight">
                    Skills
                  </h2>
                  <span className="text-xs text-neutral-500">
                    {skills.length} detected
                  </span>
                </div>

                {skills.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No skills detected yet.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {skills.map((s) => (
                      <SkillBar key={s.name} skill={s} />
                    ))}
                  </div>
                )}
              </div>

              {/* Interests */}
              {profile?.interests && profile.interests.length > 0 && (
                <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
                  <h2 className="mb-4 text-base font-semibold tracking-tight">
                    Interests
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((i) => (
                      <Badge key={i} tone="accent">
                        {i}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* CLI token */}
              <CliTokenPanel />

              {/* Matched issues */}
              <div>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-base font-semibold tracking-tight">
                    Matched issues
                  </h2>
                  <span className="text-xs text-neutral-500">
                    {feed?.count ?? 0} in feed
                  </span>
                </div>
                {feed && feed.items.length > 0 ? (
                  <ul className="grid gap-3">
                    {feed.items.map((item) => (
                      <li key={item.id}>
                        <IssueCard item={item} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-surface-border bg-surface-raised/60 p-6 text-sm text-neutral-500">
                    No matches yet — refresh your profile to rebuild the feed.
                  </p>
                )}
              </div>
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
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight">CLI token</h2>
        <code className="text-[10px] font-mono text-neutral-500">osh login</code>
      </div>
      <p className="mb-4 text-sm text-neutral-400">
        Generate a token to authenticate the{" "}
        <code className="font-mono text-neutral-300">osh</code> CLI. Generating
        again rotates the token; the old one stops working.
      </p>
      {token ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-surface-border bg-surface-muted px-3 py-2 font-mono text-xs text-neutral-200">
              {token}
            </code>
            <button
              onClick={copy}
              className="rounded-lg border border-surface-border bg-surface-muted px-3 py-2 text-xs text-neutral-300 transition hover:text-violet-300"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <p className="text-xs text-amber-300/80">
            Copy this now — it won&apos;t be shown again. Paste it into{" "}
            <code className="font-mono">osh login</code>.
          </p>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={generate} loading={busy}>
          Generate token
        </Button>
      )}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}

function SkillBar({ skill }: { skill: Skill }) {
  const level = Math.max(1, Math.min(5, skill.level ?? 1));
  const pct = (level / 5) * 100;
  return (
    <div className="rounded-xl border border-surface-border bg-surface-muted/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-neutral-100">
          {skill.name}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          L{level}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-accent-gradient transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {skill.evidence && (
        <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
          {skill.evidence}
        </p>
      )}
    </div>
  );
}
