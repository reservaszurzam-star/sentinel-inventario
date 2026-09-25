import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envService = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = envService.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envService.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: products } = await supabase.from('products').select('*');
  
  if (products && products.length > 0) {
    const bravos = products.filter(p => JSON.stringify(p).toLowerCase().includes('bravo'));
    const oversharks = products.filter(p => JSON.stringify(p).toLowerCase().includes('overshark'));
    
    if (bravos.length > 0 || oversharks.length > 0) {
      const allMatches = [...bravos, ...oversharks];
      const productIds = allMatches.map(p => p.id);
      const { data: stock } = await supabase.from('stock_levels').select('*').in('product_id', productIds);
      
      let bStock = 0;
      let oStock = 0;
      
      for (const p of bravos) {
        bStock += (stock || []).filter(s => s.product_id === p.id).reduce((acc, s) => acc + s.quantity, 0);
      }
      for (const p of oversharks) {
        oStock += (stock || []).filter(s => s.product_id === p.id).reduce((acc, s) => acc + s.quantity, 0);
      }
      
      console.log(`Bravos: ${bStock}`);
      console.log(`Overshark: ${oStock}`);
    } else {
      console.log("Found products, but no Bravos or Oversharks.");
    }
  } else {
    console.log("No products found.");
  }
}
main();
