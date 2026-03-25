export type RepoKey = 'infographic';

interface RepoConfig {
  url: string;
  workDir: string;
}

export function getRepoConfig(repo: RepoKey): RepoConfig {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN env var is required but not set');
  }

  const configs: Record<RepoKey, RepoConfig> = {
    infographic: {
      url: `https://${token}@github.com/Kyleschneiderx/ai-infographic-generator.git`,
      workDir: '/tmp/infographic-workspace',
    },
  };

  return configs[repo];
}
