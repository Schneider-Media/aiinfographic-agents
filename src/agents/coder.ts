import { query } from '@anthropic-ai/claude-agent-sdk';

const SYSTEM_PROMPT =
  'You are a senior software engineer. Implement exactly what the plan says. ' +
  'Write clean production quality code. Make all changes directly to the files on disk. ' +
  'Do not explain.';

export async function runCoder(
  taskDescription: string,
  plan: { steps: string[]; notes: string },
  workDir: string,
  reviewFeedback?: string,
): Promise<void> {
  let prompt =
    `${SYSTEM_PROMPT}\n\n` +
    `Task: ${taskDescription}\n\n` +
    `Implementation plan:\n${plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
    `Notes: ${plan.notes}\n\n` +
    'Instructions:\n' +
    '1. Read the relevant files first to understand existing code\n' +
    '2. Follow the implementation steps exactly\n' +
    '3. Save all changes directly to disk using Edit/Write/MultiEdit\n' +
    '4. Do not explain anything, just implement';

  if (reviewFeedback) {
    prompt +=
      '\n\n--- REVIEW FEEDBACK (fix these issues) ---\n' +
      reviewFeedback;
  }

  const conversation = query({
    prompt,
    options: {
      cwd: workDir,
      allowedTools: ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'Bash'],
      permissionMode: 'acceptEdits',
    },
  });

  for await (const message of conversation) {
    if (message.type === 'assistant') {
      const content = (message as { type: 'assistant'; message: { content: unknown[] } }).message.content;
      for (const block of content) {
        if ((block as { type: string }).type === 'text') {
          console.log(`[coder] ${(block as { type: 'text'; text: string }).text}`);
        }
      }
    }
    if (message.type === 'result') {
      break;
    }
  }
}
