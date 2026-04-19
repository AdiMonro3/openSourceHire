export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface Skill {
  name: string;
  level: SkillLevel;
  evidence: string[];
}

export interface SkillProfile {
  userId: string;
  githubLogin: string;
  skills: Skill[];
  interests: string[];
  updatedAt: string;
}

export interface Issue {
  id: string;
  repoFullName: string;
  number: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
  bountyUsd?: number;
  repoStars: number;
}

export interface RankedIssue extends Issue {
  score: number;
  reason: string;
}

export interface PRDraft {
  title: string;
  body: string;
  commitMessage: string;
  aiDisclosure: boolean;
}

export interface ContributionImpact {
  prUrl: string;
  repoFullName: string;
  repoStars: number;
  linesAdded: number;
  linesRemoved: number;
  mergedAt: string | null;
}
