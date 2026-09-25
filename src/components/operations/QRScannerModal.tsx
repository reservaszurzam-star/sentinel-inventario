import React, { useState, useRef, useEffect } from 'react';
import { ScanLine, X } from 'lucide-react';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';

export interface QRScannerModalProps {
  onClose: () => void;
  onDetected: (productId: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    const reader = new BrowserQRCodeReader();

    const start = async () => {
      if (!videoRef.current) return;
      try {
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!active || !result) return;
            active = false;
            controlsRef.current?.stop();
            try {
              const data = JSON.parse(result.getText());
              if (data?.id) {
                onDetected(data.id);
              } else {
                setErrorMsg('QR no corresponde a un producto válido.');
                setStatus('error');
                active = true;
              }
            } catch {
              setErrorMsg('QR no reconocido. Usa un QR generado por Etiquetas.');
              setStatus('error');
              active = true;
            }
          },
        );
        if (active) setStatus('scanning');
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e?.message?.toLowerCase().includes('permission') ? 'Sin acceso a cámara.' : 'No se pudo iniciar la cámara.');
        setStatus('error');
      }
    };

    start();
    return () => { active = false; controlsRef.current?.stop(); };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-sm flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b-2 border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine size={15} />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase">ESCANEAR QR PRODUCTO</span>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
        <div className="relative bg-black">
          <video ref={videoRef} className="w-full" style={{ minHeight: 280 }} />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="font-mono text-[10px] text-white tracking-widest animate-pulse uppercase">INICIANDO CÁMARA...</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)]/20">
          {status === 'scanning' && <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-green-700 text-center animate-pulse">APUNTA AL QR DEL PRODUCTO</p>}
          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 text-center">{errorMsg}</p>
              <button onClick={onClose} className="w-full border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] py-2 font-mono text-[10px] font-bold tracking-widest uppercase">CERRAR</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
