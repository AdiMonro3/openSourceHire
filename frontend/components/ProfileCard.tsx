import { Badge } from "./Badge";
import { GitHubIcon } from "./Icons";

type Skill = { name: string; level: number; evidence?: string };

type Profile = {
  summary?: string;
  skills?: Skill[];
  interests?: string[];
};

type User = {
  github_login: string;
  name: string | null;
  avatar_url: string | null;
};

function initials(user: User) {
  const src = user.name ?? user.github_login;
  const parts = src.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "·";
}

export function ProfileCard({
  user,
  profile,
  compact = false,
}: {
  user: User;
  profile?: Profile | null;
  compact?: boolean;
}) {
  const topSkills = (profile?.skills ?? [])
    .slice()
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0))
    .slice(0, compact ? 5 : 10);

  return (
    <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card">
      <div className="flex flex-col items-start gap-4">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={user.github_login}
            className="h-16 w-16 rounded-full"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-lg font-semibold text-violet-700">
            {initials(user)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold tracking-tight text-neutral-900">
            {user.name ?? user.github_login}
          </h2>
          <a
            href={`https://github.com/${user.github_login}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-violet-700"
          >
            <GitHubIcon className="h-3.5 w-3.5" />@{user.github_login}
          </a>
        </div>
      </div>

      {profile?.summary && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-700">
          {profile.summary}
        </p>
      )}

      {topSkills.length > 0 && (
        <div className="mt-5 border-t border-surface-border pt-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Top skills
          </h3>
          <div className="space-y-3">
            {topSkills.map((s) => (
              <SkillRow key={s.name} skill={s} />
            ))}
          </div>
        </div>
      )}

      {profile?.interests && profile.interests.length > 0 && (
        <div className="mt-5 border-t border-surface-border pt-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Interests
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.interests.slice(0, 12).map((i) => (
              <Badge key={i} tone="accent">
                {i}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const level = Math.max(1, Math.min(5, skill.level ?? 1));
  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-neutral-800">
          {skill.name}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          L{level}/5
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={
              n <= level
                ? "h-1.5 flex-1 rounded-full bg-violet-500"
                : "h-1.5 flex-1 rounded-full bg-neutral-200"
            }
          />
        ))}
      </div>
      {skill.evidence && (
        <p className="mt-1 text-[11px] text-neutral-500 opacity-0 transition group-hover:opacity-100">
          {skill.evidence}
        </p>
      )}
    </div>
  );
}
