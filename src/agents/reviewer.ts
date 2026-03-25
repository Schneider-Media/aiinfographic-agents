import { query } from '@anthropic-ai/claude-agent-sdk';

interface ReviewResult {
  approved: boolean;
  confidence: number;
  feedback: string;
  issues: string[];
  suggestedFixes: string[];
}

const SYSTEM_PROMPT =
  'You are a senior code reviewer. Always start by running git diff to see what changed. ' +
  'Be critical but fair. Only approve if you are confident the change is correct and complete. ' +
  'Return only valid JSON with no markdown fences.';

async function callReviewer(taskDescription: string, workDir: string): Promise<string> {
  const prompt =
    `${SYSTEM_PROMPT}\n\n` +
    `Original task: ${taskDescription}\n\n` +
    'Instructions:\n' +
    '1. Run git diff using the Bash tool to see all changes made\n' +
    '2. Read any relevant files for full context\n' +
    '3. Review the changes against the original task description\n' +
    '4. Check for bugs, regressions, and code quality issues\n' +
    '5. Return a JSON object with exactly this shape:\n' +
    '   {\n' +
    '     "approved": boolean,\n' +
    '     "confidence": number between 1-10,\n' +
    '     "feedback": "summary of the review",\n' +
    '     "issues": ["specific problem 1", ...],\n' +
    '     "suggestedFixes": ["specific fix 1", ...]\n' +
    '   }\n' +
    '\n' +
    'Return ONLY the JSON object. No markdown, no explanation, no code fences.';

  const conversation = query({
    prompt,
    options: {
      cwd: workDir,
      allowedTools: ['Read', 'Bash', 'Glob', 'Grep'],
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

export async function runReviewer(
  taskDescription: string,
  workDir: string,
): Promise<ReviewResult> {
  let resultText = await callReviewer(taskDescription, workDir);

  try {
    return JSON.parse(resultText) as ReviewResult;
  } catch {
    console.warn('Reviewer returned invalid JSON, retrying...');
    resultText = await callReviewer(taskDescription, workDir);

    try {
      return JSON.parse(resultText) as ReviewResult;
    } catch {
      throw new Error(`Reviewer failed to return valid JSON after retry. Raw output:\n${resultText}`);
    }
  }
}
