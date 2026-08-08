const fs = require('fs');

try {
  let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

  // Replace State
  c = c.replace(
    "const [filterCategory, setFilterCategory] = useState('');",
    "const [filterFabric, setFilterFabric] = useState<string | null>(null);\n  const FABRIC_TYPES = ['WAFFLE', 'JERSEY', 'PIQUE', 'RUSTICO', 'FRENCH TERRY', 'FRANELA'];"
  );

  // Replace filtering logic
  c = c.replace(
    "const categoryMatch = filterCategory ? (p.category || 'SIN CATEGORIA') === filterCategory : true;",
    "const categoryMatch = filterFabric ? p.name.toUpperCase().includes(filterFabric) : true;"
  );
  
  // Remove uniqueCategories computation since we hardcode it now
  c = c.replace(
    "const uniqueCategories = Array.from(new Set(products.map(p => p.category || 'SIN CATEGORIA').filter(Boolean))).sort();",
    ""
  );

  // Replace UI Buttons
  c = c.replace(
    /onClick=\{\(\) => setFilterCategory\(""\)\}/g,
    'onClick={() => setFilterFabric(null)}'
  );
  c = c.replace(
    /!filterCategory/g,
    '!filterFabric'
  );
  c = c.replace(
    /uniqueCategories\.map\(c =>/g,
    'FABRIC_TYPES.map(c =>'
  );
  c = c.replace(
    /onClick=\{\(\) => setFilterCategory\(c\)\}/g,
    'onClick={() => setFilterFabric(c)}'
  );
  c = c.replace(
    /filterCategory === c/g,
    'filterFabric === c'
  );

  fs.writeFileSync('src/pages/Inventory.tsx', c);
  console.log("Successfully replaced category filter with fabric keywords filter!");
} catch (e) {
  console.error(e);
}
