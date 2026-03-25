import 'dotenv/config';
import { postToSlack } from '../src/tools/slack.js';

async function main() {
  console.log('Posting test message to Slack...');
  await postToSlack('🧪 Test message from agent service');
  console.log('Done!');
}

main().catch(console.error);
