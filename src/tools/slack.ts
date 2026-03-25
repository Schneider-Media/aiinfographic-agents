import axios from 'axios';

function getSlackEnv(): { token: string; channel: string } {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;

  if (!token) {
    throw new Error('SLACK_BOT_TOKEN env var is required but not set');
  }
  if (!channel) {
    throw new Error('SLACK_CHANNEL_ID env var is required but not set');
  }

  return { token, channel };
}

export async function postToSlack(text: string): Promise<void> {
  const { token, channel } = getSlackEnv();

  const response = await axios.post(
    'https://slack.com/api/chat.postMessage',
    { channel, text },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.data.ok) {
    console.warn(`Slack API returned ok: false — ${response.data.error}`);
  }
}

export async function postThreadReply(text: string, threadTs: string): Promise<void> {
  const { token, channel } = getSlackEnv();

  const response = await axios.post(
    'https://slack.com/api/chat.postMessage',
    { channel, text, thread_ts: threadTs },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.data.ok) {
    console.warn(`Slack API returned ok: false — ${response.data.error}`);
  }
}
