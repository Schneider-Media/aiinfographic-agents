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

// Track processed Slack event IDs to prevent duplicate handling on retries
const processedEvents = new Set<string>();

// ── HEALTH CHECK ───────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({ status: 'ok', processing: isProcessing });
});

// ── SLACK WEBHOOK ──────────────────────────────────────

app.post('/slack/events', (req, res) => {
  const { body } = req;

  // URL verification (Slack setup handshake)
  if (body.type === 'url_verification') {
    console.log('[slack] URL verification challenge');
    res.json({ challenge: body.challenge });
    return;
  }

  // Respond 200 immediately so Slack doesn't retry
  res.status(200).send();

  // Deduplicate retried events
  const eventId: string | undefined = body.event_id;
  if (eventId) {
    if (processedEvents.has(eventId)) {
      console.log('[slack] Duplicate event ignored:', eventId);
      return;
    }
    processedEvents.add(eventId);
    // Clean up old entries to prevent memory leak
    if (processedEvents.size > 1000) {
      const first = processedEvents.values().next().value;
      if (first) processedEvents.delete(first);
    }
  }

  const event = body.event;
  if (!event || event.type !== 'message' || event.bot_id || event.subtype) {
    console.log('[slack] Ignored event:', event?.type, event?.subtype ?? '', event?.bot_id ? '(bot)' : '');
    return;
  }

  const text: string = event.text ?? '';
  console.log('[slack] Message text:', text);
  const match = text.match(/^task:\s*(.+)/is);
  if (!match) {
    console.log('[slack] No task: prefix found, ignoring');
    return;
  }

  const description = match[1].trim();
  const title = description.slice(0, 60);
  console.log('[slack] Inserting task:', title);

  // Handle async work in background — res already sent
  (async () => {
    try {
      await insertTask(title, description, event.ts);
      await postThreadReply('📥 Task received! Added to the queue.', event.ts);
      console.log('[slack] Task inserted and reply sent');
    } catch (err) {
      console.error('[slack] Failed to insert task:', (err as Error).message);
    }
  })();
});

// ── AGENT POLLING LOOP ─────────────────────────────────

async function agentLoop(): Promise<void> {
  // Wait for server to be fully ready before polling
  await new Promise((r) => setTimeout(r, 5_000));
  console.log('[agent] Polling loop started');

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
