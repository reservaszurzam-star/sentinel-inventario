import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.service', 'utf8');
const SUPABASE_URL = env.match(/SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const brand = 'BRAVOS';
  const modelName = 'PANTALON OPRA';
  
  const normalizedName = modelName.trim().replace(/\s+/g, ' ');

  const { data: pData, error: pError } = await supabase
    .from('products')
    .select('id, name')
    .eq('brand', brand)
    .ilike('name', normalizedName);
    
  console.log("pData ilike EXACT:", pData);
  
  let productsById = pData || [];
  if (productsById.length === 0 && modelName.trim()) {
    const compact = normalizedName.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/gi, '');
    const { data: all } = await supabase
      .from('products')
      .select('id, name')
      .eq('brand', brand);
    if (all) {
      productsById = all.filter(p =>
        !!p.name &&
        p.name.trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/gi, '') === compact
      ).map(p => ({ id: p.id, name: p.name }));
    }
  }
  
  console.log("productsById after fallback:", productsById);
  
  if (productsById && productsById.length > 0) {
    const productIds = productsById.map(p => p.id);
    const { data: sData, error: sError } = await supabase
      .from('stock_levels')
      .select('product_id, quantity')
      .in('product_id', productIds)
      .eq('brand', brand)
      .gt('quantity', 0);
    console.log("stockData:", sData);
  }
}
main();
