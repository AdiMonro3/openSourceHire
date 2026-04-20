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
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        Testimonials
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((t) => (
          <li
            key={t.id}
            className="rounded-2xl border border-surface-border bg-white p-5 shadow-card"
          >
            <p className="text-sm leading-relaxed text-neutral-700">
              &ldquo;{t.body}&rdquo;
            </p>
            <div className="mt-3 text-xs text-neutral-500">
              <span className="font-medium text-neutral-800">{t.from_name}</span>
              {t.from_role ? <span> · {t.from_role}</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
