import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = env.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: pData, error } = await supabase
    .from('products')
    .select('id, name, brand')
    .ilike('name', 'CLASICOS');
  console.log("Products matching 'CLASICOS':", pData);
}
main();
