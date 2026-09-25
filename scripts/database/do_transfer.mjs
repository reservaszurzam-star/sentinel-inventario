import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envService = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = envService.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envService.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: locations } = await supabase.from('locations').select('*');
  const almacenGeneral = locations.find(l => l.name.toUpperCase() === 'ALMACEN GENERAL');
  
  if (!almacenGeneral) {
    console.log("ALMACEN GENERAL not found");
    return;
  }
  
  const { data: stock } = await supabase.from('stock_levels').select('*, products(name, code)').eq('location_id', almacenGeneral.id).gt('quantity', 0);
  
  if (!stock || stock.length === 0) {
    console.log("No stock in ALMACEN GENERAL");
    return;
  }
  
  console.log(`Starting transfer for ${stock.length} products...`);
  
  for (const item of stock) {
    const { data: designation } = await supabase.from('product_locations').select('*').eq('product_id', item.product_id).single();
    
    if (designation) {
      const destLoc = locations.find(l => l.id === designation.location_id);
      console.log(`Transferring ${item.quantity} units of ${item.products.code} to ${destLoc ? destLoc.name : 'Unknown'}`);
      
      const { error } = await supabase.rpc('execute_transaction', {
        p_brand: item.brand,
        p_type: 'TRANSFER',
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_from_location_id: item.location_id,
        p_to_location_id: designation.location_id,
        p_reference: 'TRASLADO AUTOMATICO (REPARACIÓN DE UBICACIÓN)',
        p_user_name: 'Antigravity AI (Soporte Técnico)',
        p_contact_id: null,
        p_signature: null,
        p_serial_number: null,
        p_force_new_entry: false
      });
      
      if (error) {
        console.error(`Failed to transfer ${item.products.code}:`, error);
      } else {
        console.log(`Success: transferred ${item.products.code}.`);
      }
    } else {
      console.log(`Skipping ${item.products.code}: NO DESIGNATED LOCATION`);
    }
  }
  
  console.log("Transfer process complete.");
}
main();
