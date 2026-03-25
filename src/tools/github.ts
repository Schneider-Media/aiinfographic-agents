import axios from 'axios';

const REPO = 'Kyleschneiderx/ai-infographic-generator';
const API_BASE = `https://api.github.com/repos/${REPO}`;

function getHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN env var is required but not set');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };
}

interface TreeEntry {
  path: string;
  type: string;
}

export async function openPullRequest(
  branchName: string,
  taskTitle: string,
  taskId: string,
): Promise<string> {
  const response = await axios.post(
    `${API_BASE}/pulls`,
    {
      title: `[Agent] ${taskTitle}`,
      head: branchName,
      base: 'main',
      body: `Task ID: ${taskId}\n\nThis PR was created automatically by the AI agent team.`,
    },
    { headers: getHeaders() },
  );

  return response.data.html_url as string;
}

export async function getRepoTree(): Promise<string> {
  const response = await axios.get(
    `${API_BASE}/git/trees/main?recursive=1`,
    { headers: getHeaders() },
  );

  const paths = (response.data.tree as TreeEntry[])
    .filter((entry) => entry.type === 'blob')
    .map((entry) => entry.path);

  return paths.join('\n');
}
