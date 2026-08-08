import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, RefreshCw } from 'lucide-react';
import { useAppContext } from '../store/AppContext';

type BinLocation = {
  id: string;
  brand: string;
  name: string;
  type: string;
};

export function QRs() {
  const { activeBrand } = useAppContext();
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .eq('brand', activeBrand)
      .eq('type', 'BIN')
      .order('name');
      
    if (!error && data) {
      setBins(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBins();
  }, [activeBrand]);

  const handlePrint = () => {
    window.print();
  };

  const getQRUrl = (modelName: string) => {
    // Generate a full URL based on the current origin
    const baseUrl = window.location.origin + window.location.pathname; // includes /index.html if present
    // Format model name for URL (URL safe)
    const safeModel = encodeURIComponent(modelName.trim());
    return `${baseUrl}#/q/${safeModel}?b=${activeBrand}`;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-widest text-[var(--ink)]">CÓDIGOS QR</h1>
          <p className="text-sm text-[var(--ink)]/50 tracking-widest uppercase mt-1">
            QRs para modelos en el almacén ({activeBrand})
          </p>
        </div>
        
        <div className="flex gap-4 no-print">
          <button 
            onClick={fetchBins}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded font-mono text-xs tracking-widest hover:bg-[var(--surface)] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            ACTUALIZAR
          </button>
          
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--bg)] rounded font-mono text-xs tracking-widest font-bold hover:brightness-110 transition-all"
          >
            <Printer size={14} />
            IMPRIMIR TODOS
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="animate-spin text-[var(--ink)]/20" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 print:grid-cols-3 print:gap-4 print:p-0">
          {bins.map((bin) => (
            <div 
              key={bin.id} 
              className="bg-[var(--surface)] border border-[var(--border)] rounded p-4 flex flex-col items-center text-center print:break-inside-avoid print:border-black print:text-black print:bg-white"
            >
              <h3 className="font-mono text-sm font-bold tracking-wider mb-4 line-clamp-2 min-h-[40px]">
                {bin.name}
              </h3>
              
              <div className="bg-white p-2 rounded mb-4">
                <QRCodeSVG 
                  value={getQRUrl(bin.name)} 
                  size={120}
                  level="Q"
                  includeMargin={false}
                />
              </div>
              
              <div className="font-mono text-[10px] tracking-widest opacity-50 break-all">
                {bin.id}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .print\\:grid-cols-3 {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:grid-cols-3 * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
