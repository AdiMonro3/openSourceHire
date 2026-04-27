import Link from "next/link";
import { Button } from "@/components/Button";
import {
  ArrowLeftIcon,
  CheckIcon,
  GitHubIcon,
  LogoMark,
} from "@/components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const oauthUrl = intent
    ? `${API_URL}/auth/github/login?intent=${encodeURIComponent(intent)}`
    : `${API_URL}/auth/github/login`;
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-6 py-12">
      <div aria-hidden className="absolute inset-0 bg-hero-glow" />
      <div aria-hidden className="absolute inset-0 bg-dots opacity-40" />

      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-xs text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark className="h-9 w-9" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Welcome to OpenSourceHire
          </h1>
          <p className="text-sm text-ink-muted">
            Connect your GitHub to get started
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card">
          <a href={oauthUrl} className="block">
            <Button
              className="w-full"
              size="lg"
              leadingIcon={<GitHubIcon className="h-5 w-5" />}
            >
              Continue with GitHub
            </Button>
          </a>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-ink-subtle">
            <div className="h-px flex-1 bg-surface-border" />
            <span>what we read</span>
            <div className="h-px flex-1 bg-surface-border" />
          </div>

          <ul className="space-y-2.5 text-sm text-ink-muted">
            <Scope>Public repos &amp; languages</Scope>
            <Scope>Merged pull requests</Scope>
            <Scope>Issue activity</Scope>
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-ink-subtle">
          We never write to your repositories.
        </p>
      </div>
    </div>
  );
}

function Scope({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      <span>{children}</span>
    </li>
  );
}
