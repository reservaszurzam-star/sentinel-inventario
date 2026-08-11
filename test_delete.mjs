import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = env.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: loc } = await supabase.from('locations').select('*').eq('name', 'ALMACEN GENERAL').single();
  
  if (loc) {
    const { error } = await supabase.from('locations').delete().eq('id', loc.id);
    console.log("Delete error:", error);
  } else {
    console.log("Location not found");
  }
}
main();
