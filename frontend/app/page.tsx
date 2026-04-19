export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">OpenSourceHire</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        Turn open-source contributions — not resumes — into verifiable income and hiring signal.
      </p>
      <a
        href="/login"
        className="inline-flex w-fit items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Sign in with GitHub
      </a>
    </main>
  );
}
