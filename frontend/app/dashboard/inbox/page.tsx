"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { GitHubIcon } from "@/components/Icons";

type Me = {
  github_login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type ContactRow = {
  id: number;
  from_name: string;
  from_email: string;
  from_company: string | null;
  body: string;
  created_at: string | null;
};

type Inbox = { total: number; items: ContactRow[] };

const LAST_VISIT_KEY = "osh:inbox:last_visit";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InboxPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [authError, setAuthError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    api<Inbox>("/users/me/contacts")
      .then((data) => {
        setInbox(data);
        try {
          localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
        } catch {
          /* storage disabled */
        }
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [me]);

  if (authError) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-surface">
        <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            You&apos;re not signed in
          </h1>
          <a href="/login" className="mx-auto">
            <Button leadingIcon={<GitHubIcon className="h-4 w-4" />} size="lg">
              Sign in with GitHub
            </Button>
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar user={me} />
      <main className="mx-auto max-w-3xl px-6 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Messages from people who viewed your public profile.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <ul className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-32 rounded-2xl border border-surface-border bg-surface-raised shimmer"
              />
            ))}
          </ul>
        )}

        {!loading && inbox && inbox.items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-surface-border bg-surface-raised/40 p-10 text-center">
            <h3 className="text-base font-semibold text-ink">
              No messages yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Share your public profile link to start receiving inbound.
            </p>
          </div>
        )}

        {!loading && inbox && inbox.items.length > 0 && (
          <ul className="grid gap-3">
            {inbox.items.map((msg) => (
              <li
                key={msg.id}
                className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-card"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {msg.from_name}
                      {msg.from_company && (
                        <span className="text-ink-muted">
                          {" "}
                          · {msg.from_company}
                        </span>
                      )}
                    </p>
                    <a
                      href={`mailto:${msg.from_email}`}
                      className="text-xs text-violet-300 hover:underline"
                    >
                      {msg.from_email}
                    </a>
                  </div>
                  <span className="text-[11px] text-ink-subtle">
                    {formatDate(msg.created_at)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                  {msg.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
