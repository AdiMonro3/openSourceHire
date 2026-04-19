const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        OpenSourceHire reads your GitHub profile (public repos, merged PRs, languages) to build a
        skill graph and surface issues you&apos;re ready to ship.
      </p>
      <a
        href={`${API_URL}/auth/github/login`}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Continue with GitHub
      </a>
      <p className="text-xs text-neutral-500">
        We request <code>read:user</code>, <code>user:email</code>, <code>public_repo</code>.
        Nothing is written to your repos.
      </p>
    </main>
  );
}
