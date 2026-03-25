import { query } from '@anthropic-ai/claude-agent-sdk';

interface PlanResult {
  steps: string[];
  notes: string;
}

const SYSTEM_PROMPT =
  'You are a senior code planner. Explore the codebase thoroughly before planning. ' +
  'Do NOT write any code. Return only valid JSON with no markdown fences.';

async function callPlanner(taskDescription: string, workDir: string): Promise<string> {
  const prompt =
    `${SYSTEM_PROMPT}\n\n` +
    `Task: ${taskDescription}\n\n` +
    'Instructions:\n' +
    '1. Explore the codebase using Read, Glob, LS, and Grep tools\n' +
    '2. Understand the existing code structure, patterns, and conventions\n' +
    '3. Return a JSON object with exactly this shape:\n' +
    '   { "steps": ["step 1", "step 2", ...], "notes": "edge cases and warnings" }\n' +
    '\n' +
    'Return ONLY the JSON object. No markdown, no explanation, no code fences.';

  const conversation = query({
    prompt,
    options: {
      cwd: workDir,
      allowedTools: ['Read', 'Glob', 'LS', 'Grep'],
      permissionMode: 'acceptEdits',
    },
  });

  let resultText = '';

  for await (const message of conversation) {
    if (message.type === 'result') {
      resultText = (message as { type: 'result'; result: string }).result;
      break;
    }
  }

  return resultText;
}

export async function runPlanner(
  taskDescription: string,
  workDir: string,
): Promise<PlanResult> {
  let resultText = await callPlanner(taskDescription, workDir);

  try {
    return JSON.parse(resultText) as PlanResult;
  } catch {
    // Retry once if JSON parsing fails
    console.warn('Planner returned invalid JSON, retrying...');
    resultText = await callPlanner(taskDescription, workDir);

    try {
      return JSON.parse(resultText) as PlanResult;
    } catch {
      throw new Error(`Planner failed to return valid JSON after retry. Raw output:\n${resultText}`);
    }
  }
}
