import clsx from "clsx";

export type CalendarDay = { date: string; count: number };
export type CalendarWeek = CalendarDay[];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function bucket(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

const LEVEL_CLASS = [
  "bg-white/[0.04] ring-1 ring-inset ring-white/[0.03]",
  "bg-violet-500/30",
  "bg-violet-500/55",
  "bg-violet-400/85",
  "bg-violet-300",
];

export function ContributionHeatmap({
  weeks,
  total,
}: {
  weeks: CalendarWeek[];
  total: number;
}) {
  // Month labels: take the date of the first day of each week, find changes.
  const labels: { label: string; offset: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const first = week[0];
    if (!first?.date) return;
    const m = new Date(first.date).getUTCMonth();
    if (m !== lastMonth) {
      labels.push({ label: MONTHS[m], offset: wi });
      lastMonth = m;
    }
  });

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Contributions
        </h3>
        <span className="text-xs text-ink-muted">
          {total.toLocaleString()} in the last year
        </span>
      </div>

      <div className="relative mt-3 overflow-x-auto">
        <div className="inline-block">
          {/* month labels */}
          <div
            className="grid pl-1 pr-1 text-[10px] text-ink-subtle"
            style={{
              gridTemplateColumns: `repeat(${weeks.length}, 12px)`,
              columnGap: 3,
            }}
          >
            {weeks.map((_, wi) => {
              const label = labels.find((l) => l.offset === wi);
              return (
                <span key={wi} className="h-3 leading-3">
                  {label?.label ?? ""}
                </span>
              );
            })}
          </div>

          {/* grid */}
          <div
            className="mt-1 grid"
            style={{
              gridTemplateColumns: `repeat(${weeks.length}, 12px)`,
              columnGap: 3,
            }}
          >
            {weeks.map((week, wi) => (
              <div
                key={wi}
                className="grid"
                style={{
                  gridTemplateRows: "repeat(7, 12px)",
                  rowGap: 3,
                }}
              >
                {Array.from({ length: 7 }).map((_, di) => {
                  const day = week[di];
                  if (!day) return <span key={di} />;
                  const level = bucket(day.count);
                  return (
                    <span
                      key={di}
                      title={`${day.date}: ${day.count} contributions`}
                      className={clsx(
                        "h-3 w-3 rounded-sm",
                        LEVEL_CLASS[level],
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-ink-subtle">
        <span>Less</span>
        {LEVEL_CLASS.map((c, i) => (
          <span
            key={i}
            className={clsx("h-2.5 w-2.5 rounded-sm", c)}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
