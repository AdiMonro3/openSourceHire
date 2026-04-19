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

      {/* Top bar */}
      <header className="relative z-10 border-b border-surface-border/60">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight text-neutral-900">
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
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
            <SparklesIcon className="h-3.5 w-3.5 text-violet-600" />
            AI-ranked issues, matched to what you&apos;ve shipped
          </span>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl">
            <span className="whitespace-nowrap">Get hired for what you ship.</span>
            <br />
            <span className="whitespace-nowrap bg-title-gradient bg-clip-text text-transparent underline decoration-violet-300/70 underline-offset-8">
              Not what you claim.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
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

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-600">
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> Read-only
              GitHub access
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> Nothing
              written to your repos
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" /> Free while
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

      <footer className="relative z-10 border-t border-surface-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-neutral-500">
          <span>© {new Date().getFullYear()} OpenSourceHire</span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-neutral-900">
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
    <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card transition-colors hover:border-neutral-300">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
        {step}
      </div>
      <h3 className="mt-3 text-base font-semibold tracking-tight text-neutral-900">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}
