import fs from 'fs';
const file = 'D:/LogixZazu/src/pages/Operations.tsx';
let content = fs.readFileSync(file, 'utf8');

const map = {
  '├ô': 'Ó',
  '├│': 'ó',
  '├í': 'á',
  '├¡': 'í',
  '├║': 'ú',
  '├ü': 'Á',
  '├ë': 'É',
  '├ì': 'Í',
  '┬┐': '¿',
  '┬í': '¡',
  '┬À': '·',
  'ÔÇö': '—',
  'ÔåÆ': '→',
  '├ù': '×'
};

for (const [k, v] of Object.entries(map)) {
  content = content.replaceAll(k, v);
}
fs.writeFileSync(file, content, 'utf8');
