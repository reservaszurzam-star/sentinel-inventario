import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envService = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = envService.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envService.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Get ID of "ALMACEN GENERAL"
  const { data: locations } = await supabase.from('locations').select('*');
  const almacenGeneral = locations.find(l => l.name.toUpperCase() === 'ALMACEN GENERAL');
  
  if (!almacenGeneral) {
    console.log("ALMACEN GENERAL not found");
    return;
  }
  
  // 2. Get stock in ALMACEN GENERAL
  const { data: stock } = await supabase.from('stock_levels').select('*, products(name, code)').eq('location_id', almacenGeneral.id).gt('quantity', 0);
  
  if (!stock || stock.length === 0) {
    console.log("No stock in ALMACEN GENERAL");
    return;
  }
  
  console.log(`Found ${stock.length} products in ALMACEN GENERAL:`);
  
  for (const item of stock) {
    // 3. Check designated location
    const { data: designation } = await supabase.from('product_locations').select('*').eq('product_id', item.product_id).single();
    
    if (designation) {
      const destLoc = locations.find(l => l.id === designation.location_id);
      console.log(`- ${item.products.name} (${item.products.code}): ${item.quantity} units -> SHOULD GO TO: ${destLoc ? destLoc.name : 'Unknown Location'}`);
    } else {
      console.log(`- ${item.products.name} (${item.products.code}): ${item.quantity} units -> NO DESIGNATED LOCATION SET YET`);
    }
  }
}
main();
