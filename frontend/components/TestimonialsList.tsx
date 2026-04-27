export type Testimonial = {
  id: number;
  from_name: string;
  from_role: string | null;
  body: string;
  created_at: string | null;
};

export function TestimonialsList({ items }: { items: Testimonial[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        Testimonials
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((t) => (
          <li
            key={t.id}
            className="rounded-2xl border border-surface-border bg-surface-raised p-5 shadow-card"
          >
            <p className="text-sm leading-relaxed text-ink-muted">
              &ldquo;{t.body}&rdquo;
            </p>
            <div className="mt-3 text-xs text-ink-subtle">
              <span className="font-medium text-ink">{t.from_name}</span>
              {t.from_role ? <span> · {t.from_role}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
