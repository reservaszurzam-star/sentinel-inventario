const fs = require('fs');

try {
  let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

  // Replace FABRIC_TYPES
  c = c.replace(
    "const FABRIC_TYPES = ['WAFFLE', 'JERSEY', 'PIQUE', 'RUSTICO', 'FRENCH TERRY', 'FRANELA'];",
    `const FABRIC_TYPES = ['JERSEY', 'WAFFLE', 'CATANIA', 'FRENCH TERRY', 'BRATZ', 'PIQUE'];
  
  const PRODUCT_FABRICS: Record<string, string> = {
    'BABY TY': 'JERSEY',
    'BABY TY ESCOTADO MANGA': 'JERSEY',
    'BABY TY ESCOTE': 'JERSEY',
    'BABY TY MANGA': 'JERSEY',
    'CAMISERO JERSEY': 'JERSEY',
    'CLASICO': 'JERSEY',
    'CLASICOS DE REGALO': 'JERSEY',
    'OVERSIZE': 'JERSEY',
    'SLIM FIT': 'JERSEY',
    'JERSEY MANGA LARGA': 'JERSEY',
    'MEDIAS CORTAS': 'JERSEY',
    'MEDIAS LARGAS': 'JERSEY',
    
    'CAMISA WAFFLE': 'WAFFLE',
    'CUELLO CHINO WAFFLE': 'WAFFLE',
    'WAFFLE': 'WAFFLE',
    'WAFFLE CAMISERO': 'WAFFLE',
    'WAFFLE MANGA LARGA': 'WAFFLE',
    'TOP RIB': 'WAFFLE',
    'TOP RIB MANGA': 'WAFFLE',
    
    'PANTALON CATANIA': 'CATANIA',
    
    'POLERA NERU': 'FRENCH TERRY',
    'POLERA BOXYFIT': 'FRENCH TERRY',
    
    'PANTALON BRATZ': 'BRATZ',
    'PANTALON OPRA': 'BRATZ',
    
    'CAMISERO PIQUE': 'PIQUE',
    'CAMISERO PIQUE MANGA LARGA': 'PIQUE',
    'CUELLO CHINO': 'PIQUE'
  };`
  );

  // Replace categoryMatch logic
  const oldLogic = "const categoryMatch = filterFabric ? p.name.toUpperCase().includes(filterFabric) : true;";
  const newLogic = `let categoryMatch = true;
    if (filterFabric) {
      const explicitFabric = PRODUCT_FABRICS[p.name.toUpperCase()];
      if (explicitFabric) {
        categoryMatch = explicitFabric === filterFabric;
      } else {
        categoryMatch = p.name.toUpperCase().includes(filterFabric);
      }
    }`;
  
  c = c.replace(oldLogic, newLogic);

  fs.writeFileSync('src/pages/Inventory.tsx', c);
  console.log("Successfully implemented exact fabric mapping!");
} catch (e) {
  console.error(e);
}
