import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface Task {
  id: string;
  title: string;
  description: string;
  repo: 'infographic';
  thread_ts?: string;
  status: 'pending' | 'in_progress' | 'review' | 'failed';
  pr_url?: string;
  error_log?: string;
  created_at: string;
}

const TABLE = 'agent_tasks';

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL env var is required but not set');
  }
  if (!key) {
    throw new Error('SUPABASE_KEY env var is required but not set');
  }

  return createClient(url, key);
}

export async function getNextPendingTask(): Promise<Task | null> {
  const supabase = getClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows found
    throw new Error(`Failed to fetch pending task: ${error.message}`);
  }

  return data as Task;
}

export async function markInProgress(id: string): Promise<void> {
  const supabase = getClient();

  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'in_progress' })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to mark task ${id} as in_progress: ${error.message}`);
  }
}

export async function markDone(id: string, prUrl: string): Promise<void> {
  const supabase = getClient();

  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'review', pr_url: prUrl })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to mark task ${id} as done: ${error.message}`);
  }
}

export async function markFailed(id: string, errorMsg: string): Promise<void> {
  const supabase = getClient();

  const { error } = await supabase
    .from(TABLE)
    .update({ status: 'failed', error_log: errorMsg })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to mark task ${id} as failed: ${error.message}`);
  }
}

export async function insertTask(
  title: string,
  description: string,
  threadTs?: string,
): Promise<void> {
  const supabase = getClient();

  const { error } = await supabase
    .from(TABLE)
    .insert({
      title,
      description,
      repo: 'infographic',
      status: 'pending',
      thread_ts: threadTs,
    });

  if (error) {
    throw new Error(`Failed to insert task: ${error.message}`);
  }
}
