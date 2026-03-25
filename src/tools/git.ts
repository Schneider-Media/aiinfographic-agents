import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { type RepoKey, getRepoConfig } from '../config/repos.js';

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8' }).trim();
  } catch (err) {
    throw new Error(`Git command failed: "${cmd}" in ${cwd}\n${(err as Error).message}`);
  }
}

export function cloneOrPullRepo(repo: RepoKey): string {
  const { url, workDir } = getRepoConfig(repo);

  if (!existsSync(workDir)) {
    try {
      execSync(`git clone ${url} ${workDir}`, { encoding: 'utf-8' });
    } catch (err) {
      throw new Error(`Git command failed: "git clone" into ${workDir}\n${(err as Error).message}`);
    }
    run('git config user.email "agent@aiinfographic.dev"', workDir);
    run('git config user.name "AI Agent"', workDir);
  } else {
    run('git checkout main', workDir);
    run('git pull origin main', workDir);
  }

  return workDir;
}

export function createBranch(repo: RepoKey, branchName: string): void {
  const { workDir } = getRepoConfig(repo);
  run(`git checkout -b ${branchName}`, workDir);
}

export function commitAndPush(repo: RepoKey, branchName: string, message: string): void {
  const { workDir } = getRepoConfig(repo);
  run('git add -A', workDir);
  run(`git commit -m "${message.replace(/"/g, '\\"')}"`, workDir);
  run(`git push origin ${branchName}`, workDir);
}

export function resetToMain(repo: RepoKey): void {
  const { workDir } = getRepoConfig(repo);
  run('git checkout main', workDir);
  run('git pull origin main', workDir);
}
