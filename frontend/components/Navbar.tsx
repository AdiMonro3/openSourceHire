"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
];

function initials(user: User) {
  const src = user?.name ?? user?.github_login ?? "";
  const parts = src.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "·";
}

export function Navbar({ user }: { user?: User }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-neutral-900 transition hover:opacity-90"
          >
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">
              OpenSourceHire
            </span>
          </Link>

          <ul className="hidden items-center gap-1 rounded-full border border-surface-border bg-white p-1 shadow-card md:flex">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-white text-neutral-900 shadow-card border border-surface-border"
                        : "text-neutral-500 hover:text-neutral-900",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-3">
          {user?.github_login ? (
            <Link
              href="/dashboard/profile"
              className="group flex items-center gap-2 rounded-full border border-surface-border bg-white py-1 pl-1 pr-3 transition hover:border-neutral-300 hover:shadow-card"
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.github_login ?? "avatar"}
                  className="h-6 w-6 rounded-full"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700">
                  {initials(user)}
                </span>
              )}
              <span className="text-xs text-neutral-700 group-hover:text-neutral-900">
                {user.github_login}
              </span>
            </Link>
          ) : (
            <div className="h-8 w-28 rounded-full bg-neutral-100 shimmer" />
          )}
        </div>
      </nav>
    </header>
  );
}
