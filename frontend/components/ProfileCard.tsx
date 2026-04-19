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
    <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-raised shadow-card">
      <div className="absolute inset-x-0 top-0 h-24 bg-accent-gradient opacity-20" aria-hidden />
      <div className="relative p-6">
        <div className="flex items-start gap-4">
          {user.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt={user.github_login}
              className="h-16 w-16 rounded-full ring-2 ring-surface-border"
            />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {user.name ?? user.github_login}
            </h2>
            <a
              href={`https://github.com/${user.github_login}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-neutral-200"
            >
              <GitHubIcon className="h-3.5 w-3.5" />@{user.github_login}
            </a>
          </div>
        </div>

        {profile?.summary && (
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">
            {profile.summary}
          </p>
        )}

        {topSkills.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Skills
            </h3>
            <div className="space-y-2">
              {topSkills.map((s) => (
                <SkillRow key={s.name} skill={s} />
              ))}
            </div>
          </div>
        )}

        {profile?.interests && profile.interests.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
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
    </div>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const level = Math.max(1, Math.min(5, skill.level ?? 1));
  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-neutral-200">{skill.name}</span>
        <span className="text-[10px] text-neutral-500">L{level}</span>
      </div>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={
              n <= level
                ? "h-1 flex-1 rounded-full bg-accent-gradient"
                : "h-1 flex-1 rounded-full bg-white/5"
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
