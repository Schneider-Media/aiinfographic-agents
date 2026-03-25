import { commitAndPush } from '../tools/git.js';
import { openPullRequest } from '../tools/github.js';

export async function runDeployer(
  taskTitle: string,
  taskId: string,
  branchName: string,
): Promise<string> {
  try {
    commitAndPush('infographic', branchName, `agent: ${taskTitle}`);
    const prUrl = await openPullRequest(branchName, taskTitle, taskId);
    return prUrl;
  } catch (err) {
    throw new Error(`Deploy failed for task ${taskId}: ${(err as Error).message}`);
  }
}
