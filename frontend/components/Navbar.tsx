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
  { href: "/dashboard", label: "Feed" },
  { href: "/dashboard/profile", label: "Profile" },
];

export function Navbar({ user }: { user?: User }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border/80 bg-surface/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-neutral-100 transition hover:opacity-90"
          >
            <LogoMark className="h-6 w-6" />
            <span className="text-sm font-semibold tracking-tight">
              OpenSourceHire
            </span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={clsx(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "text-neutral-50 bg-white/5"
                        : "text-neutral-400 hover:text-neutral-100 hover:bg-white/5",
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
          {user?.avatar_url ? (
            <Link
              href="/dashboard/profile"
              className="group flex items-center gap-2 rounded-full border border-surface-border bg-surface-raised py-1 pl-1 pr-3 transition hover:border-neutral-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.avatar_url}
                alt={user.github_login ?? "avatar"}
                className="h-6 w-6 rounded-full"
              />
              <span className="text-xs text-neutral-300 group-hover:text-neutral-100">
                {user.name ?? user.github_login}
              </span>
            </Link>
          ) : (
            <div className="h-7 w-24 rounded-full bg-surface-muted shimmer" />
          )}
        </div>
      </nav>
    </header>
  );
}
