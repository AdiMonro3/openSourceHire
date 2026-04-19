import Link from "next/link";
import { Button } from "@/components/Button";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  GitHubIcon,
  LogoMark,
  SparklesIcon,
  StarIcon,
} from "@/components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      {/* Backdrop layers */}
      <div aria-hidden className="absolute inset-0 bg-dots" />
      <div aria-hidden className="absolute inset-0 bg-hero-glow" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      {/* Top bar */}
      <header className="relative z-10">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">
              OpenSourceHire
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                leadingIcon={<GitHubIcon className="h-4 w-4" />}
              >
                Continue with GitHub
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised/70 px-3 py-1 text-xs text-neutral-300 backdrop-blur">
            <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
            AI-ranked issues, matched to what you&apos;ve actually shipped
          </span>

          <h1 className="mt-6 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
            Get hired for what you ship.
            <br />
            <span className="bg-accent-gradient bg-clip-text text-transparent">
              Not what you claim.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400">
            OpenSourceHire turns your GitHub history into a living skill graph,
            then surfaces the open-source issues you&apos;re actually ready to
            close — with AI-drafted fix plans so you can start shipping in
            minutes.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a href={`${API_URL}/auth/github/login`}>
              <Button
                size="lg"
                leadingIcon={<GitHubIcon className="h-5 w-5" />}
                trailingIcon={<ArrowRightIcon className="h-4 w-4" />}
              >
                Continue with GitHub
              </Button>
            </a>
            <a href="#how" className="sm:ml-2">
              <Button size="lg" variant="secondary">
                How it works
              </Button>
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-500">
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> Read-only
              GitHub access
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> Nothing
              written to your repos
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> Free while
              in preview
            </li>
          </ul>
        </section>

        {/* Feature strip */}
        <section
          id="how"
          className="mx-auto max-w-6xl px-6 pb-24"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              icon={<GitHubIcon className="h-4 w-4" />}
              title="Connect"
              body="Sign in with GitHub. We read your public activity — repos, PRs, languages — to build a calibrated skill graph."
            />
            <FeatureCard
              icon={<SparklesIcon className="h-4 w-4" />}
              title="Match"
              body="Our ranker surfaces live issues from curated repos that fit your shipped work, not a résumé keyword."
            />
            <FeatureCard
              icon={<BoltIcon className="h-4 w-4" />}
              title="Ship"
              body="Each issue comes with an AI fix plan: approach, likely files, gotchas. Start coding in minutes."
            />
          </div>

          {/* Social proof row */}
          <div className="mt-10 flex items-center justify-center gap-3 text-xs text-neutral-500">
            <StarIcon className="h-3.5 w-3.5 text-amber-400" />
            <span>
              Built on the same stack top open-source maintainers use every day
            </span>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-surface-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-neutral-500">
          <span>© {new Date().getFullYear()} OpenSourceHire</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-neutral-300">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-surface-border bg-surface-raised/70 p-6 backdrop-blur-sm transition-colors hover:border-neutral-700">
      <div
        aria-hidden
        className="absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-accent-gradient opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-20"
      />
      <div className="relative">
        <div className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-surface-muted text-violet-300">
          {icon}
        </div>
        <h3 className="text-base font-semibold tracking-tight text-neutral-100">
          {title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{body}</p>
      </div>
    </div>
  );
}
