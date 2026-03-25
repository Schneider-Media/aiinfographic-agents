import 'dotenv/config';
import { insertTask } from '../src/queue.js';

async function main() {
  await insertTask(
    'Add hello world console.log',
    'Add a simple hello world console.log to the top of the main entry point file',
  );
  console.log('Task inserted!');
}

main().catch(console.error);
