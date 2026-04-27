"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { LogoMark } from "./Icons";

type User = {
  github_login?: string;
  name?: string | null;
  avatar_url?: string | null;
} | null;

const NAV = [
  { href: "/dashboard", label: "Feed", exact: true },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/portfolio", label: "Portfolio" },
  { href: "/dashboard/inbox", label: "Inbox", badge: "unread" as const },
];

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const LAST_VISIT_KEY = "osh:inbox:last_visit";

function useUnreadCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`${API_URL}/users/me/contacts?limit=100`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: {
          items: { created_at: string | null }[];
        } = await res.json();
        const lastVisit = (() => {
          try {
            return localStorage.getItem(LAST_VISIT_KEY);
          } catch {
            return null;
          }
        })();
        const cutoff = lastVisit ? new Date(lastVisit).getTime() : 0;
        const unread = data.items.filter((m) => {
          if (!m.created_at) return false;
          return new Date(m.created_at).getTime() > cutoff;
        }).length;
        if (!cancelled) setCount(unread);
      } catch {
        /* ignore */
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return count;
}

function initials(user: User) {
  const src = user?.name ?? user?.github_login ?? "";
  const parts = src.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "·";
}

export function Navbar({ user }: { user?: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const unreadCount = useUnreadCount(Boolean(user?.github_login));
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore — still redirect so the user isn't stuck */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-ink transition hover:opacity-90"
          >
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">
              OpenSourceHire
            </span>
          </Link>

          <ul className="hidden items-center gap-1 rounded-full border border-surface-border bg-surface-raised/70 p-1 shadow-card md:flex">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);
              const showBadge =
                item.badge === "unread" && unreadCount > 0 && !active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "relative rounded-full px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border border-surface-border-strong bg-surface-hover text-ink shadow-card"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                    {showBadge && (
                      <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-2">
          {user?.github_login ? (
            <>
              <Link
                href="/dashboard/profile"
                className="group flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised/70 py-1 pl-1 pr-3 transition hover:border-surface-border-strong hover:bg-surface-hover"
              >
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt={user.github_login ?? "avatar"}
                    className="h-6 w-6 rounded-full ring-1 ring-white/10"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-200">
                    {initials(user)}
                  </span>
                )}
                <span className="text-xs text-ink-muted group-hover:text-ink">
                  {user.github_login}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="rounded-full border border-surface-border bg-surface-raised/70 px-3 py-1.5 text-xs text-ink-muted transition hover:border-surface-border-strong hover:bg-surface-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <div className="h-8 w-28 rounded-full bg-white/5 shimmer" />
          )}
        </div>
      </nav>
    </header>
  );
}
