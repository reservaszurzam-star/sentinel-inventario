import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = env.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: locs } = await supabase.from('locations').select('*').ilike('name', '%OPRA%');
  const binData = locs[0];
  console.log("BIN:", binData);

  const { data: stockData } = await supabase
    .from('stock_levels')
    .select('product_id, quantity')
    .eq('location_id', binData.id)
    .gt('quantity', 0);
    
  console.log("Stock in BIN:", stockData);
  
  if (stockData && stockData.length > 0) {
    const productIds = [...new Set(stockData.map(s => s.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('id, name, color, size')
      .in('id', productIds);
    console.log("Products:", products);
  }
}
main();
