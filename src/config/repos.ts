export type RepoKey = 'infographic';

interface RepoConfig {
  url: string;
  workDir: string;
}

export const REPOS: Record<RepoKey, RepoConfig> = {
  infographic: {
    url: `https://${process.env.GITHUB_TOKEN}@github.com/Kyleschneiderx/ai-infographic-generator.git`,
    workDir: '/tmp/infographic-workspace',
  },
};

export function getRepoConfig(repo: RepoKey): RepoConfig {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN env var is required but not set');
  }

  return REPOS[repo];
}
