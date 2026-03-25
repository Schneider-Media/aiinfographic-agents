import 'dotenv/config';
import express from 'express';
import {
  getNextPendingTask,
  markInProgress,
  markDone,
  markFailed,
  insertTask,
} from './queue.js';
import { runAgentTeam } from './orchestrator.js';
import { postThreadReply } from './tools/slack.js';

const app = express();
app.use(express.json());

let isProcessing = false;

// ── HEALTH CHECK ───────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({ status: 'ok', processing: isProcessing });
});

// ── SLACK WEBHOOK ──────────────────────────────────────

app.post('/slack/events', async (req, res) => {
  const { body } = req;

  if (body.type === 'url_verification') {
    res.json({ challenge: body.challenge });
    return;
  }

  res.status(200).send();

  const event = body.event;
  if (!event || event.type !== 'message' || event.bot_id) return;

  const text: string = event.text ?? '';
  const match = text.match(/^task:\s*(.+)/is);
  if (!match) return;

  const description = match[1].trim();
  const title = description.slice(0, 60);

  try {
    await insertTask(title, description, event.ts);
    await postThreadReply('📥 Task received! Added to the queue.', event.ts);
  } catch (err) {
    console.error('Failed to insert task from Slack:', (err as Error).message);
  }
});

// ── AGENT POLLING LOOP ─────────────────────────────────

async function agentLoop(): Promise<void> {
  while (true) {
    try {
      if (!isProcessing) {
        const task = await getNextPendingTask();

        if (task) {
          isProcessing = true;
          console.log(`[agent] Starting task ${task.id}: ${task.title}`);

          try {
            await markInProgress(task.id);
            const prUrl = await runAgentTeam(task);

            if (prUrl) {
              await markDone(task.id, prUrl);
              console.log(`[agent] Task ${task.id} completed: ${prUrl}`);
            } else {
              await markFailed(task.id, 'Rejected after max review attempts');
              console.log(`[agent] Task ${task.id} failed: rejected after max attempts`);
            }
          } catch (err) {
            const errorMsg = (err as Error).message;
            await markFailed(task.id, errorMsg).catch(() => {});
            console.error(`[agent] Task ${task.id} error: ${errorMsg}`);
          } finally {
            isProcessing = false;
          }
        }
      }
    } catch (err) {
      console.error('[agent] Poll error:', (err as Error).message);
    }

    await new Promise((r) => setTimeout(r, 30_000));
  }
}

// ── STARTUP ────────────────────────────────────────────

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Agent service running on port ${PORT}`);
});

agentLoop();
