import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { ProfileCard } from "@/components/ProfileCard";
import { StatCard } from "@/components/StatCard";
import {
  ContributionHeatmap,
  type CalendarWeek,
} from "@/components/ContributionHeatmap";
import {
  PortfolioNarrative,
  type Narrative,
} from "@/components/PortfolioNarrative";
import {
  TestimonialsList,
  type Testimonial,
} from "@/components/TestimonialsList";
import { HireMeButton } from "@/components/HireMeButton";
import { LogoMark } from "@/components/Icons";

type PR = {
  title: string;
  url: string;
  merged_at: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  repo: { name: string; stars: number; language: string | null };
};

type PublicProfile = {
  user: {
    github_login: string;
    name: string | null;
    avatar_url: string | null;
  };
  narrative: Narrative;
  portfolio: {
    user?: {
      login?: string;
      name?: string | null;
      bio?: string | null;
      location?: string | null;
    };
    stats?: {
      merged_prs: number;
      lines_added: number;
      lines_removed: number;
      active_repos: number;
    };
    contributions?: { total: number; weeks: CalendarWeek[] };
    merged_prs?: PR[];
  };
  skill_profile: {
    summary?: string;
    skills?: { name: string; level: number; evidence?: string }[];
    interests?: string[];
  } | null;
  testimonials: Testimonial[];
  generated_at: string | null;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function loadProfile(username: string): Promise<PublicProfile | null> {
  const res = await fetch(
    `${API_URL}/users/${encodeURIComponent(username)}/public`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  return (await res.json()) as PublicProfile;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await loadProfile(username).catch(() => null);
  const name = data?.user.name ?? username;
  return {
    title: `${name} · OpenSourceHire`,
    description:
      data?.narrative?.summary ??
      `${name}'s open-source contribution portfolio.`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = await loadProfile(username);
  if (!data) notFound();

  const weeks = data.portfolio.contributions?.weeks ?? [];
  const total = data.portfolio.contributions?.total ?? 0;
  const stats = data.portfolio.stats;
  const prs = data.portfolio.merged_prs ?? [];

  return (
    <div className="relative min-h-screen bg-surface">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-hero-glow" />
      <header className="relative z-10 border-b border-surface-border bg-surface/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-ink transition hover:opacity-90"
          >
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">
              OpenSourceHire
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <HireMeButton username={data.user.github_login} />
            <Link
              href="/login?intent=publish"
              className="text-xs text-ink-muted transition hover:text-ink"
            >
              Get your own profile →
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:py-10 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <ProfileCard
            user={data.user}
            profile={data.skill_profile ?? undefined}
          />
          {weeks.length > 0 && (
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
              <ContributionHeatmap weeks={weeks} total={total} />
            </div>
          )}
        </aside>

        <div className="space-y-8 min-w-0">
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Merged PRs" value={stats.merged_prs} />
              <StatCard
                label="Lines added"
                value={`+${stats.lines_added.toLocaleString()}`}
                tone="green"
              />
              <StatCard
                label="Lines removed"
                value={`−${stats.lines_removed.toLocaleString()}`}
                tone="red"
              />
              <StatCard label="Active repos" value={stats.active_repos} />
            </div>
          )}

          <PortfolioNarrative
            narrative={data.narrative}
            merged_prs={prs}
          />

          <TestimonialsList items={data.testimonials} />

          {data.generated_at && (
            <p className="text-right text-[10px] text-ink-subtle">
              Last updated{" "}
              {new Date(data.generated_at).toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
