"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

type Props = {
  username: string;
  open: boolean;
  onClose: () => void;
};

export function HireMeModal({ username, open, onClose }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStatus({ kind: "idle" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      from_name: String(data.get("from_name") ?? "").trim(),
      from_email: String(data.get("from_email") ?? "").trim(),
      from_company: String(data.get("from_company") ?? "").trim() || null,
      body: String(data.get("body") ?? "").trim(),
      website: String(data.get("website") ?? ""),
    };

    if (!payload.from_name) {
      setStatus({ kind: "error", message: "Please enter your name." });
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.from_email)) {
      setStatus({
        kind: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }
    if (payload.body.length < 20) {
      setStatus({
        kind: "error",
        message: "Message must be at least 20 characters.",
      });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      const res = await fetch(
        `${API_URL}/users/${encodeURIComponent(username)}/contact`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        let detail = `${res.status}`;
        try {
          const body = await res.json();
          if (Array.isArray(body?.detail)) {
            detail = body.detail
              .map((e: { loc?: unknown[]; msg?: string }) => {
                const field = Array.isArray(e.loc)
                  ? e.loc.slice(1).join(".")
                  : "field";
                return `${field}: ${e.msg ?? "invalid"}`;
              })
              .join("; ");
          } else if (typeof body?.detail === "string") {
            detail = body.detail;
          }
        } catch {
          /* ignore */
        }
        console.error("[HireMe] submit failed:", detail);
        setStatus({ kind: "error", message: detail });
        return;
      }
      setStatus({ kind: "sent" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hire-me-title"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-card-hover animate-fade-in">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2
              id="hire-me-title"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              Reach out to {username}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              They&apos;ll receive an email with your message and can reply
              directly.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ink-subtle hover:bg-white/5 hover:text-ink"
          >
            ×
          </button>
        </div>

        {status.kind === "sent" ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Message sent. They&apos;ll get back to you over email.
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={onSubmit} noValidate>
            <Field label="Your name" name="from_name" />
            <Field
              label="Email"
              name="from_email"
              placeholder="you@company.com"
            />
            <Field
              label="Company (optional)"
              name="from_company"
              placeholder="Acme Inc."
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Message
              </label>
              <textarea
                name="body"
                maxLength={4000}
                rows={5}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                placeholder="Hi — we're hiring for a backend role and your work on X caught our eye…"
              />
              <p className="mt-1 text-[11px] text-ink-subtle">
                Minimum 20 characters.
              </p>
            </div>

            {/* Honeypot — hidden from humans, filled by bots */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden="true"
            />

            {status.kind === "error" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                {status.message}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={status.kind === "sending"}
              >
                {status.kind === "sending" ? "Sending…" : "Send message"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
      />
    </div>
  );
}
