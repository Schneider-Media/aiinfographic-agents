import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { type RepoKey, getRepoConfig } from '../config/repos.js';

function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`;
}

function run(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 60_000 }).trim();
  } catch (err) {
    throw new Error(`Git command failed: "${cmd}" in ${cwd}\n${(err as Error).message}`);
  }
}

export function cloneOrPullRepo(repo: RepoKey): string {
  const { url, workDir } = getRepoConfig(repo);

  if (!existsSync(workDir)) {
    try {
      execSync(`git clone ${shellEscape(url)} ${shellEscape(workDir)}`, {
        encoding: 'utf-8',
        timeout: 120_000,
      });
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
  run(`git checkout -b ${shellEscape(branchName)}`, workDir);
}

export function commitAndPush(repo: RepoKey, branchName: string, message: string): void {
  const { workDir } = getRepoConfig(repo);
  run('git add -A', workDir);
  run(`git commit -m ${shellEscape(message)}`, workDir);
  run(`git push origin ${shellEscape(branchName)}`, workDir);
}

export function resetToMain(repo: RepoKey): void {
  const { workDir } = getRepoConfig(repo);
  if (!existsSync(workDir)) return;
  run('git checkout main', workDir);
  run('git pull origin main', workDir);
}
