import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

  // Check if table exists
  const { data, error } = await supabase.from('agent_tasks').select('*').limit(5);
  console.log('data:', JSON.stringify(data, null, 2));
  console.log('error:', JSON.stringify(error, null, 2));
}

main().catch(console.error);
