import Link from "next/link";
import { Button } from "@/components/Button";
import {
  CheckIcon,
  GitHubIcon,
  LogoMark,
  SparklesIcon,
} from "@/components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <div aria-hidden className="absolute inset-0 bg-hero-glow" />
      <div aria-hidden className="absolute inset-0 bg-dots opacity-40" />

      {/* Top bar */}
      <header className="relative z-10 border-b border-surface-border">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight text-ink">
              OpenSourceHire
            </span>
          </div>
          <Link href="/login">
            <Button variant="secondary" size="sm">
              Sign in
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-20 pt-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            <SparklesIcon className="h-3.5 w-3.5 text-violet-300" />
            AI-ranked issues, matched to what you&apos;ve shipped
          </span>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl md:text-6xl">
            <span className="whitespace-nowrap">Get hired for what you ship.</span>
            <br />
            <span className="whitespace-nowrap bg-title-gradient bg-clip-text text-transparent underline decoration-violet-400/50 underline-offset-8">
              Not what you claim.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">
            OpenSourceHire turns your GitHub history into a living skill graph,
            then surfaces the issues you&apos;re actually ready to close — with
            AI-drafted fix plans.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a href={`${API_URL}/auth/github/login`}>
              <Button
                size="lg"
                leadingIcon={<GitHubIcon className="h-5 w-5" />}
              >
                Continue with GitHub
              </Button>
            </a>
            <a href="#how">
              <Button size="lg" variant="secondary">
                See demo
              </Button>
            </a>
          </div>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-muted">
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-300" /> Read-only
              GitHub access
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-300" /> Nothing
              written to your repos
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-300" /> Free while
              in preview
            </li>
          </ul>
        </section>

        {/* Three-step strip */}
        <section id="how" className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-3">
            <StepCard
              step="01"
              title="Connect"
              body="Sign in with GitHub. We read your public activity to build a calibrated skill graph."
            />
            <StepCard
              step="02"
              title="Match"
              body="Our ranker surfaces live issues from curated repos that fit your shipped work — not keywords."
            />
            <StepCard
              step="03"
              title="Ship"
              body="Each issue comes with an AI fix plan: approach, likely files, gotchas. Start coding in minutes."
            />
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-surface-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-ink-subtle">
          <span>© {new Date().getFullYear()} OpenSourceHire</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card transition-colors hover:border-surface-border-strong hover:bg-surface-hover">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        {step}
      </div>
      <h3 className="mt-3 text-base font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
