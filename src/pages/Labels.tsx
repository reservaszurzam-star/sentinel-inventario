import React, { useState, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Search, Tag, MapPin, Check, SlidersHorizontal, CheckSquare, Square } from 'lucide-react';
import { TutorialModal, LABELS_TUTORIAL_STEPS } from '../components/TutorialModal';
import { cn } from '../lib/utils';

type LabelMode = 'products' | 'locations';
type LabelStyle = 'qr' | 'barcode' | 'both';

// Code128B encoder — returns array of bar/space widths as booleans (true=bar)
const CODE128B_TABLE: Record<string, number> = {
  ' ':0,'!':1,'"':2,'#':3,'$':4,'%':5,'&':6,"'":7,'(':8,')':9,'*':10,'+':11,
  ',':12,'-':13,'.':14,'/':15,'0':16,'1':17,'2':18,'3':19,'4':20,'5':21,
  '6':22,'7':23,'8':24,'9':25,':':26,';':27,'<':28,'=':29,'>':30,'?':31,
  '@':32,'A':33,'B':34,'C':35,'D':36,'E':37,'F':38,'G':39,'H':40,'I':41,
  'J':42,'K':43,'L':44,'M':45,'N':46,'O':47,'P':48,'Q':49,'R':50,'S':51,
  'T':52,'U':53,'V':54,'W':55,'X':56,'Y':57,'Z':58,'[':59,'\\':60,']':61,
  '^':62,'_':63,'`':64,'a':65,'b':66,'c':67,'d':68,'e':69,'f':70,'g':71,
  'h':72,'i':73,'j':74,'k':75,'l':76,'m':77,'n':78,'o':79,'p':80,'q':81,
  'r':82,'s':83,'t':84,'u':85,'v':86,'w':87,'x':88,'y':89,'z':90,
};

const CODE128_PATTERNS: string[] = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','1100011101011',
];

function encodeCode128B(text: string): boolean[] {
  const chars = text.toUpperCase().replace(/[^\x20-\x7E]/g, '');
  const values: number[] = [104]; // START B
  for (const ch of chars) {
    const idx = CODE128B_TABLE[ch] ?? CODE128B_TABLE[' '];
    values.push(idx);
  }
  // Checksum
  let check = values[0];
  for (let i = 1; i < values.length; i++) check = (check + i * values[i]) % 103;
  values.push(check);
  values.push(106); // STOP

  const bits: boolean[] = [];
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v] ?? CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      bits.push(pattern[i] === '1');
    }
  }
  // Trailing quiet zone
  for (let i = 0; i < 10; i++) bits.push(false);
  return bits;
}

const Barcode: React.FC<{ value: string; height?: number; className?: string }> = ({ value, height = 40, className }) => {
  const bits = encodeCode128B(value.slice(0, 30));
  const moduleW = 1.2;
  const width = bits.length * moduleW;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} xmlns="http://www.w3.org/2000/svg">
      {bits.map((dark, i) =>
        dark ? <rect key={i} x={i * moduleW} y={0} width={moduleW} height={height} fill="#141414" /> : null
      )}
    </svg>
  );
};

export const Labels: React.FC = () => {
  const { products, locations, stockLevels, activeBrand } = useAppContext();
  const [mode, setMode] = useState<LabelMode>('products');
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('qr');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showPrice, setShowPrice] = useState(true);
  const [showStock, setShowStock] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const QR_SIZE = { sm: 50, md: 70, lg: 100 };
  const BAR_H = { sm: 25, md: 35, lg: 50 };
  const LABEL_W = { sm: '140px', md: '180px', lg: '230px' };

  const filteredProducts = products.filter(p =>
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredLocations = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.type.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = (mode === 'products' ? filteredProducts : filteredLocations).map(x => x.id);
    setSelected(new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const stockForProduct = (id: string) =>
    stockLevels.filter(s => s.productId === id).reduce((sum, s) => sum + s.quantity, 0);

  const getQRValue = (item: { id: string }) => {
    if (mode === 'products') {
      const p = products.find(x => x.id === item.id);
      if (!p) return item.id;
      return JSON.stringify({ id: p.id, code: p.code, name: p.name, color: p.color, size: p.size, brand: activeBrand });
    } else {
      const l = locations.find(x => x.id === item.id);
      if (!l) return item.id;
      return JSON.stringify({ id: l.id, name: l.name, type: l.type, brand: activeBrand });
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Impresión de Etiquetas — ${activeBrand}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: white; color: black; }
        .grid { display: flex; flex-wrap: wrap; gap: 12px; padding: 20px; justify-content: center; }
        @media print { 
          body { padding: 0; } 
          .grid { gap: 8px; padding: 0; justify-content: flex-start; }
        }
      </style></head><body>
      <div class="grid">${content.innerHTML}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const renderLabel = (id: string) => {
    if (mode === 'products') {
      const p = products.find(x => x.id === id);
      if (!p) return null;
      const qrValue = getQRValue({ id });
      const barcodeValue = p.code;
      return (
        <div key={id} className="label-wrapper" style={{ 
          width: LABEL_W[labelSize],
          border: '2px solid #000',
          borderRadius: '12px',
          padding: '14px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#000',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
            {activeBrand.replace('_', ' ')}
          </div>
          
          {(labelStyle === 'qr' || labelStyle === 'both') && (
            <div style={{ padding: '6px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '8px' }}>
              <QRCodeSVG value={qrValue} size={QR_SIZE[labelSize]} level="Q" />
            </div>
          )}

          {(labelStyle === 'barcode' || labelStyle === 'both') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginBottom: '8px' }}>
              <Barcode value={barcodeValue} height={BAR_H[labelSize]} />
              <div style={{ fontSize: '8px', letterSpacing: '1px', opacity: 0.8 }}>{barcodeValue}</div>
            </div>
          )}

          <div style={{ fontSize: '13px', fontWeight: '900', textAlign: 'center', lineHeight: '1.1' }}>{p.code}</div>
          <div style={{ fontSize: '10px', textAlign: 'center', lineHeight: '1.2', marginTop: '4px', opacity: 0.9 }}>{p.name}</div>
          
          {(p.color || p.size) && (
            <div style={{ fontSize: '9px', fontWeight: '700', marginTop: '4px', backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
              {[p.color, p.size].filter(Boolean).join(' / ')}
            </div>
          )}
          
          {showCategory && p.category && (
            <div style={{ fontSize: '8px', opacity: 0.6, textTransform: 'uppercase', marginTop: '4px' }}>{p.category}</div>
          )}
          
          {showPrice && p.sellPrice != null && (
            <div style={{ fontSize: '12px', fontWeight: '900', marginTop: '6px', borderTop: '1px dashed #ccc', paddingTop: '4px', width: '100%', textAlign: 'center' }}>
              S/ {p.sellPrice.toFixed(2)}
            </div>
          )}
        </div>
      );
    } else {
      const l = locations.find(x => x.id === id);
      if (!l) return null;
      const qrValue = getQRValue({ id });
      return (
        <div key={id} className="label-wrapper" style={{ 
          width: LABEL_W[labelSize],
          border: '2px solid #000',
          borderRadius: '12px',
          padding: '14px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#000',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
            {activeBrand.replace('_', ' ')}
          </div>
          
          {(labelStyle === 'qr' || labelStyle === 'both') && (
            <div style={{ padding: '6px', border: '1px solid #eee', borderRadius: '8px', marginBottom: '8px' }}>
              <QRCodeSVG value={qrValue} size={QR_SIZE[labelSize]} level="Q" />
            </div>
          )}
          
          {(labelStyle === 'barcode' || labelStyle === 'both') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', marginBottom: '8px' }}>
              <Barcode value={l.name} height={BAR_H[labelSize]} />
              <div style={{ fontSize: '8px', letterSpacing: '1px', opacity: 0.8 }}>{l.name}</div>
            </div>
          )}
          
          <div style={{ fontSize: '14px', fontWeight: '900', textAlign: 'center', marginTop: '4px' }}>{l.name}</div>
          <div style={{ fontSize: '9px', fontWeight: '700', backgroundColor: '#000', color: '#fff', padding: '2px 8px', borderRadius: '4px', marginTop: '6px' }}>
            {l.type}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={LABELS_TUTORIAL_STEPS} title="Etiquetas" />

      {/* Module Header */}
      <ModuleInfo
        number="19"
        title="Generador de Etiquetas Físicas"
        description="Emisión de etiquetas con códigos QR y de barras para identificación física de prendas y gavetas de almacén."
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Main Controls Card */}
      <div className="modern-card p-6 rounded-3xl space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-[var(--border-soft)]">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-[var(--surface-alt)]/60 border border-[var(--border-soft)] rounded-2xl gap-1">
            <button
              onClick={() => { setMode('products'); clearSelection(); }}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all",
                mode === 'products'
                  ? "bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm"
                  : "text-[var(--ink)]/60 hover:text-[var(--ink)]"
              )}
            >
              <Tag size={14} />
              <span>Etiquetas de Productos</span>
            </button>
            <button
              onClick={() => { setMode('locations'); clearSelection(); }}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all",
                mode === 'locations'
                  ? "bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm"
                  : "text-[var(--ink)]/60 hover:text-[var(--ink)]"
              )}
            >
              <MapPin size={14} />
              <span>Etiquetas de Ubicaciones</span>
            </button>
          </div>

          {/* Size & Print Actions */}
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-alt)]/60 border border-[var(--border-soft)] rounded-xl">
              <span className="font-mono text-[10px] text-[var(--ink)]/50 px-2 uppercase font-bold">Tamaño:</span>
              {(['sm', 'md', 'lg'] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => setLabelSize(sz)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all",
                    labelSize === sz
                      ? "bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs"
                      : "text-[var(--ink)]/60 hover:text-[var(--ink)]"
                  )}
                >
                  {sz === 'sm' ? 'Chica' : sz === 'md' ? 'Mediana' : 'Grande'}
                </button>
              ))}
            </div>

            <button
              onClick={handlePrint}
              disabled={selected.size === 0}
              className="modern-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs shadow-xs disabled:opacity-50"
            >
              <Printer size={15} />
              <span>Imprimir ({selected.size})</span>
            </button>
          </div>
        </div>

        {/* Format Options & Toggles */}
        <div className="flex flex-wrap items-center gap-6 pt-1">
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink)]/50 tracking-wider block">
              Formato de Código
            </span>
            <div className="flex p-1 bg-[var(--surface-alt)]/60 border border-[var(--border-soft)] rounded-xl gap-1">
              {(['qr', 'barcode', 'both'] as LabelStyle[]).map(s => (
                <button
                  key={s}
                  onClick={() => setLabelStyle(s)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all",
                    labelStyle === s
                      ? "bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs"
                      : "text-[var(--ink)]/60 hover:text-[var(--ink)]"
                  )}
                >
                  {s === 'qr' ? 'Código QR' : s === 'barcode' ? 'Barras 128' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'products' && (
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink)]/50 tracking-wider block">
                Campos Visibles
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'price', label: 'Precio S/', value: showPrice, set: setShowPrice },
                  { key: 'stock', label: 'Stock Actual', value: showStock, set: setShowStock },
                  { key: 'cat', label: 'Categoría', value: showCategory, set: setShowCategory },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => opt.set(!opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl font-mono text-xs font-semibold border flex items-center gap-1.5 transition-all",
                      opt.value
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-bold"
                        : "bg-[var(--surface-alt)]/40 border-[var(--border-soft)] text-[var(--ink)]/50"
                    )}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${opt.value ? 'bg-blue-500' : 'bg-transparent border border-slate-400'}`} />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Bar + Batch Selectors */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border-soft)] flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre o tipo..."
              className="input-technical rounded-xl text-xs py-2 pl-10 pr-4 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-2 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
            >
              Seleccionar Todos
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-2 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
            >
              Limpiar
            </button>
            <span className="font-mono text-xs text-[var(--ink)]/50 ml-1">
              <strong>{selected.size}</strong> seleccionados
            </span>
          </div>
        </div>

        {/* Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {(mode === 'products' ? filteredProducts : filteredLocations).map(item => {
            const isSelected = selected.has(item.id);
            const label = mode === 'products'
              ? (() => { const p = item as typeof products[0]; return `${p.code} ${p.name} ${p.color || ''} ${p.size || ''}`.trim(); })()
              : item.name;

            return (
              <button
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={cn(
                  "text-left p-3 rounded-2xl border text-xs font-mono transition-all duration-150 flex flex-col justify-between",
                  isSelected
                    ? "bg-[var(--ink)] text-[var(--ink-inv)] border-transparent shadow-xs scale-[1.01]"
                    : "bg-[var(--surface-alt)]/30 border-[var(--border-soft)] text-[var(--ink)]/70 hover:border-[var(--ink)]/30 hover:bg-[var(--surface)]"
                )}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="font-bold truncate text-[11px] block">{label}</span>
                  {isSelected ? (
                    <CheckSquare size={13} className="shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <Square size={13} className="shrink-0 opacity-30 mt-0.5" />
                  )}
                </div>
                {mode === 'products' && (
                  <span className="text-[9px] opacity-60 uppercase truncate">
                    {(item as typeof products[0]).category || 'Sin categoría'}
                  </span>
                )}
                {mode === 'locations' && (
                  <span className="text-[9px] opacity-60 uppercase truncate">
                    {(item as typeof locations[0]).type}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview Section */}
      {selected.size > 0 ? (
        <div className="modern-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)]">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Previsualización de Impresión ({selected.size} etiquetas)
            </h3>
            <span className="font-mono text-[10px] text-[var(--ink)]/40">
              Formato optimizado para rollos térmicos o planchas A4
            </span>
          </div>
          <div ref={printRef} className="flex flex-wrap gap-4 justify-start">
            {[...selected].map(id => renderLabel(id))}
          </div>
        </div>
      ) : (
        <div className="modern-card p-12 rounded-3xl text-center space-y-2 font-mono text-xs uppercase tracking-wider text-[var(--ink)]/40">
          <Tag size={28} className="mx-auto mb-2 opacity-30" />
          <p>Selecciona productos o ubicaciones arriba para ver la hoja de etiquetas</p>
        </div>
      )}
    </div>
  );
};
