import Link from "next/link";
import { Button } from "@/components/Button";
import {
  ArrowLeftIcon,
  CheckIcon,
  GitHubIcon,
  LogoMark,
} from "@/components/Icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-6 py-12">
      <div aria-hidden className="absolute inset-0 bg-dots" />
      <div aria-hidden className="absolute inset-0 bg-hero-glow" />

      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-xs text-neutral-400 transition hover:text-neutral-100"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Back
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark className="h-10 w-10" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Sign in to OpenSourceHire
          </h1>
          <p className="max-w-sm text-sm text-neutral-400">
            Connect your GitHub to build a skill profile and unlock issues
            matched to what you&apos;ve shipped.
          </p>
        </div>

        <div className="rounded-2xl border border-surface-border bg-surface-raised/80 p-6 shadow-card backdrop-blur">
          <a href={`${API_URL}/auth/github/login`} className="block">
            <Button
              className="w-full"
              size="lg"
              leadingIcon={<GitHubIcon className="h-5 w-5" />}
            >
              Continue with GitHub
            </Button>
          </a>

          <div className="my-5 h-px bg-surface-border" />

          <ul className="space-y-2 text-xs text-neutral-400">
            <Scope>
              <code className="font-mono text-neutral-300">read:user</code> —
              your public profile
            </Scope>
            <Scope>
              <code className="font-mono text-neutral-300">user:email</code> —
              your primary email
            </Scope>
            <Scope>
              <code className="font-mono text-neutral-300">public_repo</code> —
              read public repositories
            </Scope>
          </ul>

          <p className="mt-5 rounded-lg border border-surface-border bg-surface-muted px-3 py-2 text-[11px] text-neutral-500">
            We never write to your repos. You can revoke access anytime from
            GitHub settings.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          By continuing you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}

function Scope({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
      <span>{children}</span>
    </li>
  );
}
