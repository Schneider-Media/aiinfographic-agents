import { type Task } from './queue.js';
import { runPlanner } from './agents/planner.js';
import { runCoder } from './agents/coder.js';
import { runReviewer } from './agents/reviewer.js';
import { runDeployer } from './agents/deployer.js';
import { cloneOrPullRepo, createBranch, resetToMain } from './tools/git.js';
import { postToSlack, postThreadReply } from './tools/slack.js';

const MAX_REVIEW_ATTEMPTS = 2;

function slackPost(text: string, threadTs?: string): Promise<void> {
  return threadTs ? postThreadReply(text, threadTs) : postToSlack(text);
}

export async function runAgentTeam(task: Task): Promise<string | null> {
  await slackPost(`🤖 Starting on: *${task.title}*`, task.thread_ts);

  let workDir: string;
  try {
    workDir = cloneOrPullRepo('infographic');
  } catch (err) {
    await slackPost(`❌ Failed to clone repo: ${(err as Error).message}`, task.thread_ts);
    throw err;
  }

  const branchName = `agent/${task.id.slice(0, 8)}`;
  createBranch('infographic', branchName);

  try {
    // Planner
    await slackPost('📋 Planner is analyzing the codebase...', task.thread_ts);
    let plan: { steps: string[]; notes: string };
    try {
      plan = await runPlanner(task.description, workDir);
    } catch (err) {
      await slackPost(`❌ Planner failed: ${(err as Error).message}`, task.thread_ts);
      throw err;
    }
    console.log(`[orchestrator] Plan: ${plan.steps.length} steps`);

    // Coder/Reviewer loop
    let review: Awaited<ReturnType<typeof runReviewer>> | undefined;

    for (let attempt = 1; attempt <= MAX_REVIEW_ATTEMPTS; attempt++) {
      await slackPost(
        `💻 Coder is writing changes (attempt ${attempt}/${MAX_REVIEW_ATTEMPTS})...`,
        task.thread_ts,
      );
      try {
        await runCoder(task.description, plan, workDir, review?.feedback);
      } catch (err) {
        await slackPost(`❌ Coder failed: ${(err as Error).message}`, task.thread_ts);
        throw err;
      }

      await slackPost('🔍 Reviewer is checking the changes...', task.thread_ts);
      try {
        review = await runReviewer(task.description, workDir);
      } catch (err) {
        await slackPost(`❌ Reviewer failed: ${(err as Error).message}`, task.thread_ts);
        throw err;
      }

      console.log(`[orchestrator] Review attempt ${attempt}: approved=${review.approved}, confidence=${review.confidence}`);

      if (review.approved) break;

      await slackPost(`⚠️ Issues found: ${review.feedback}`, task.thread_ts);
    }

    // Not approved after all attempts
    if (!review?.approved) {
      await slackPost(
        '🚨 Could not resolve after 2 attempts. Needs human review.',
        task.thread_ts,
      );
      const issuesList = (review?.issues ?? []).map((i) => `• ${i}`).join('\n');
      if (issuesList) {
        await slackPost(issuesList, task.thread_ts);
      }
      return null;
    }

    // Deploy
    await slackPost('🚀 Deployer is committing and pushing...', task.thread_ts);
    let prUrl: string;
    try {
      prUrl = await runDeployer(task.title, task.id, branchName);
    } catch (err) {
      await slackPost(`❌ Deployer failed: ${(err as Error).message}`, task.thread_ts);
      throw err;
    }

    await slackPost(`🎉 PR ready for review: ${prUrl}`, task.thread_ts);
    return prUrl;
  } finally {
    try {
      resetToMain('infographic');
    } catch (err) {
      console.error('[orchestrator] Failed to reset to main:', (err as Error).message);
    }
  }
}
