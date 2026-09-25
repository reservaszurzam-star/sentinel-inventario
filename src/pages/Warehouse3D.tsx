import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Rack3D, RackSlot3D, ViewMode3D, CameraPreset, Warehouse3DLayout } from '../types/warehouse3d';
import {
  loadWarehouse3DLayout,
  saveWarehouse3DLayout,
  hydrateRacksWithInventory,
  fetchWarehouse3DLayoutAsync,
} from '../services/warehouse3dStorage';
import { Warehouse3DCanvas } from '../components/warehouse3d/Warehouse3DCanvas';
import { RackInspectorDrawer } from '../components/warehouse3d/RackInspectorDrawer';
import { RackModalBuilder } from '../components/warehouse3d/RackModalBuilder';
import { RoomConfigModal } from '../components/warehouse3d/RoomConfigModal';
import { WarehouseBlueprintEditor } from '../components/warehouse3d/WarehouseBlueprintEditor';
import { findAvailableRoomPosition, clampRackPosition } from '../lib/warehouseBounds';
import { RoofDisplayMode } from '../components/warehouse3d/architecturalBuilder';
import {
  Box,
  Layers,
  Flame,
  Tag,
  Plus,
  Save,
  RotateCcw,
  Compass,
  Maximize,
  Maximize2,
  Minimize2,
  Search,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Eye,
  Sliders,
  Trash2,
  RotateCw,
  Copy,
  Grid,
  DoorOpen,
  DoorClosed,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Warehouse3D: React.FC = () => {
  const {
    activeBrand,
    locations,
    products,
    stockLevels,
    productLocations,
    assignProductLocation,
    addLocation,
  } = useAppContext();

  // Referencia al contenedor principal para Pantalla Completa
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Estado del layout 3D
  const [layout, setLayout] = useState<Warehouse3DLayout>(() => loadWarehouse3DLayout(activeBrand));
  const [activeView, setActiveView] = useState<'VIEW_3D' | 'BLUEPRINT_2D'>('VIEW_3D');
  const [isWalkInMode, setIsWalkInMode] = useState(false);
  const [roofMode, setRoofMode] = useState<RoofDisplayMode>('TRANSLUCENT');
  const [showKpiPanel, setShowKpiPanel] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode3D>('PRODUCTS');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>('ISOMETRIC');
  const [selectedRackId, setSelectedRackId] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Búsqueda y filtrado de productos en 3D
  const [searchQuery, setSearchQuery] = useState('');
  const [aisleFilter, setAisleFilter] = useState('ALL');

  // 1. Cargar layout físico (estanterías, sala, dimensiones) al montar o al cambiar de marca
  useEffect(() => {
    let isMounted = true;

    // Carga inicial sincrónica inmediata desde localStorage
    const local = loadWarehouse3DLayout(activeBrand);
    const hydratedRacks = hydrateRacksWithInventory(
      local.racks,
      locations,
      products,
      stockLevels,
      productLocations
    );
    setLayout({ ...local, racks: hydratedRacks });
    setSelectedRackId(null);
    setSelectedSlotKey(null);

    // Intentar sincronizar asíncronamente con Supabase en segundo plano
    fetchWarehouse3DLayoutAsync(activeBrand)
      .then(cloudLayout => {
        if (!isMounted) return;
        if (cloudLayout && cloudLayout.updatedAt && cloudLayout.updatedAt !== local.updatedAt) {
          setLayout(prev => {
            const hydrated = hydrateRacksWithInventory(
              cloudLayout.racks,
              locations,
              products,
              stockLevels,
              productLocations
            );
            return { ...cloudLayout, racks: hydrated };
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeBrand]);

  // 2. Sincronizar en vivo únicamente las existencias (unidades) y prendas asignadas en las baldas
  // cuando cambia el inventario (por el polling de 5s o transacciones),
  // pero NUNCA resetear posiciones, rotaciones, dimensiones de sala ni selecciones de rack.
  useEffect(() => {
    setLayout(prevLayout => {
      if (!prevLayout || !prevLayout.racks || prevLayout.racks.length === 0) return prevLayout;
      const updatedRacks = hydrateRacksWithInventory(
        prevLayout.racks,
        locations,
        products,
        stockLevels,
        productLocations
      );
      return {
        ...prevLayout,
        racks: updatedRacks,
      };
    });
  }, [locations, products, stockLevels, productLocations]);

  // Lista de pasillos únicos
  const aisles = useMemo(() => {
    return Array.from(new Set(layout.racks.map(r => r.aisle))).filter(Boolean);
  }, [layout.racks]);

  // Racks filtrados por pasillo o búsqueda
  const visibleRacks = useMemo(() => {
    return layout.racks.filter(r => {
      if (aisleFilter !== 'ALL' && r.aisle !== aisleFilter) return false;
      return true;
    });
  }, [layout.racks, aisleFilter]);

  // Rack seleccionado actualmente
  const selectedRack = useMemo(() => {
    return layout.racks.find(r => r.id === selectedRackId) || null;
  }, [layout.racks, selectedRackId]);

  // Estado para confirmación de eliminación rápida de rack
  const [rackToDelete, setRackToDelete] = useState<Rack3D | null>(null);

  // Alternar Modo Pantalla Completa
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      mainContainerRef.current?.requestFullscreen?.().catch(err => {
        console.warn('Error al solicitar pantalla completa:', err);
      });
    } else {
      document.exitFullscreen?.().catch(err => {
        console.warn('Error al salir de pantalla completa:', err);
      });
    }
  }, []);

  // Sincronizar estado de pantalla completa y forzar redibujado de Three.js
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 60);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Atajos de teclado: Delete para eliminar estante, F para pantalla completa
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRack && !rackToDelete) {
          e.preventDefault();
          setRackToDelete(selectedRack);
        }
      }

      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRack, rackToDelete, handleToggleFullscreen]);

  // Métricas globales del almacén 3D
  const stats = useMemo(() => {
    let totalSlots = 0;
    let totalStock = 0;
    let totalCapacity = 0;
    let occupiedSlots = 0;

    layout.racks.forEach(r => {
      const slotsList: RackSlot3D[] = Object.values(r.slots);
      slotsList.forEach(s => {
        totalSlots++;
        totalStock += s.stockUnits || 0;
        totalCapacity += s.capacity || 150;
        if (s.stockUnits > 0 || s.productId) occupiedSlots++;
      });
    });

    const occupancyRate = totalCapacity > 0 ? Math.round((totalStock / totalCapacity) * 100) : 0;
    return {
      racksCount: layout.racks.length,
      totalSlots,
      totalStock,
      totalCapacity,
      occupiedSlots,
      occupancyRate,
    };
  }, [layout.racks]);

  // Búsqueda de producto y resaltado en 3D
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    for (const r of layout.racks) {
      for (const [key, rawSlot] of Object.entries(r.slots)) {
        const slot = rawSlot as RackSlot3D;
        if (
          (slot.productName && slot.productName.toLowerCase().includes(q)) ||
          slot.code.toLowerCase().includes(q)
        ) {
          setSelectedRackId(r.id);
          setSelectedSlotKey(key);
          setFeedback({
            type: 'success',
            message: `Encontrado en ${r.name} · Balda ${slot.code}`,
          });
          setTimeout(() => setFeedback(null), 4000);
          return;
        }
      }
    }

    setFeedback({
      type: 'error',
      message: `No se encontró ubicación 3D para "${searchQuery}"`,
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Guardar layout
  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      await saveWarehouse3DLayout(layout);
      setFeedback({ type: 'success', message: '¡Diagramación 3D guardada con éxito!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al guardar layout 3D' });
    } finally {
      setSaving(false);
    }
  };

  // Crear nuevo Rack
  const handleCreateRack = (newRack: Rack3D) => {
    setLayout(prev => {
      const safePos = findAvailableRoomPosition(
        newRack,
        prev.warehouseWidth || 26,
        prev.warehouseLength || 30,
        prev.roomShape || 'RECTANGULAR',
        prev.roomConfig,
        prev.racks
      );
      const rackWithSafePos: Rack3D = { ...newRack, position: safePos };
      const updated: Warehouse3DLayout = {
        ...prev,
        racks: [...prev.racks, rackWithSafePos],
      };
      saveWarehouse3DLayout(updated).catch(() => {});
      return updated;
    });
    setShowAddModal(false);
    setSelectedRackId(newRack.id);
    setSelectedSlotKey('1-1');
    setFeedback({ type: 'success', message: `Rack ${newRack.name} creado dentro del almacén` });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Actualizar Rack
  const handleUpdateRack = (updatedRack: Rack3D) => {
    setLayout(prev => {
      const updated: Warehouse3DLayout = {
        ...prev,
        racks: prev.racks.map(r => (r.id === updatedRack.id ? updatedRack : r)),
      };
      saveWarehouse3DLayout(updated).catch(() => {});
      return updated;
    });
  };

  // Eliminar Rack
  const handleDeleteRack = (rackId: string) => {
    setLayout(prev => {
      const updated: Warehouse3DLayout = {
        ...prev,
        racks: prev.racks.filter(r => r.id !== rackId),
      };
      saveWarehouse3DLayout(updated).catch(() => {});
      return updated;
    });
    setSelectedRackId(null);
    setSelectedSlotKey(null);
    setFeedback({ type: 'success', message: 'Rack eliminado del almacén' });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Mover Rack directamente arrastrando en 3D
  const handleMoveRack = (rackId: string, newPosition: [number, number, number]) => {
    setLayout(prev => {
      const updated: Warehouse3DLayout = {
        ...prev,
        racks: prev.racks.map(r =>
          r.id === rackId ? { ...r, position: newPosition, updatedAt: new Date().toISOString() } : r
        ),
      };
      saveWarehouse3DLayout(updated).catch(() => {});
      return updated;
    });
  };

  // Duplicar Rack
  const handleDuplicateRack = (rackToDup: Rack3D) => {
    const dupId = `rack-${activeBrand.toLowerCase()}-${Date.now().toString(36)}`;
    setLayout(prev => {
      const [x, y, z] = rackToDup.position;
      const [safeX, safeZ] = clampRackPosition(
        x + 3,
        z,
        rackToDup,
        prev.warehouseWidth || 26,
        prev.warehouseLength || 30,
        prev.roomShape || 'RECTANGULAR',
        prev.roomConfig
      );
      const duplicated: Rack3D = {
        ...rackToDup,
        id: dupId,
        name: `${rackToDup.name} (COPIA)`,
        position: [safeX, y, safeZ],
        slots: { ...rackToDup.slots },
        updatedAt: new Date().toISOString(),
      };
      const updated: Warehouse3DLayout = {
        ...prev,
        racks: [...prev.racks, duplicated],
      };
      saveWarehouse3DLayout(updated).catch(() => {});
      return updated;
    });
    setSelectedRackId(dupId);
    setSelectedSlotKey('1-1');
  };

  // Actualizar configuración del plano (forma, dimensiones, zonas, obstáculos)
  const handleUpdateRoomConfig = (updatedFields: Partial<Warehouse3DLayout>) => {
    setLayout(prev => {
      const updated: Warehouse3DLayout = {
        ...prev,
        ...updatedFields,
        updatedAt: new Date().toISOString(),
      };
      saveWarehouse3DLayout(updated).catch(() => {});
      return updated;
    });
    setFeedback({ type: 'success', message: 'Plano del almacén actualizado con éxito' });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Garantizar ubicación en base de datos para un slot
  const handleEnsureLocation = async (slotKey: string): Promise<string> => {
    if (!selectedRack) throw new Error('No hay rack seleccionado');
    const slot = selectedRack.slots[slotKey];
    if (!slot) throw new Error('Slot inexistente');

    // Buscar si ya existe por nombre
    const existing = locations.find(
      l => l.name.toUpperCase().trim() === slot.code.toUpperCase().trim()
    );
    if (existing) return existing.id;

    // Crear ubicación tipo BIN en Supabase
    const tempId = `loc_${Date.now().toString(36)}`;
    addLocation({
      name: slot.code,
      type: 'BIN',
    });
    return tempId;
  };

  // Asignar producto a un slot (Slotting)
  const handleAssignProduct = async (slotKey: string, productId: string | null) => {
    if (!selectedRack) return;

    let locId = selectedRack.slots[slotKey]?.locationId;
    if (!locId) {
      locId = await handleEnsureLocation(slotKey);
    }

    // Actualizar product_locations
    if (productId) {
      await assignProductLocation(productId, locId);
    }

    // Actualizar estado local del slot
    const targetProd = productId ? products.find(p => p.id === productId) : null;
    const updatedRack = {
      ...selectedRack,
      slots: {
        ...selectedRack.slots,
        [slotKey]: {
          ...selectedRack.slots[slotKey],
          productId: targetProd ? targetProd.id : undefined,
          productName: targetProd ? targetProd.name : undefined,
          productColor: targetProd ? targetProd.color : undefined,
          productCategory: targetProd ? targetProd.category : undefined,
          locationId: locId,
        },
      },
    };

    handleUpdateRack(updatedRack);

    setFeedback({
      type: 'success',
      message: targetProd
        ? `Prenda "${targetProd.name}" asignada a ${selectedRack.slots[slotKey].code}`
        : 'Asignación de producto retirada de la balda',
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="flex flex-col h-full gap-3 select-none overflow-hidden">
      {/* Toast de Feedback */}
      {feedback && (
        <div
          className={cn(
            'fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2.5 font-mono text-xs font-bold animate-in slide-in-from-top-4 duration-200',
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500'
              : 'bg-red-950/90 text-red-300 border-red-500'
          )}
        >
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Compacto del Módulo */}
      <div className="flex items-center justify-between gap-2 shrink-0 py-0.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono text-[11px] font-black tracking-wider">
              M-14
            </span>
            <h1 className="font-mono text-sm md:text-base font-black tracking-tight text-white truncate flex items-center gap-2">
              <span>Almacén 3D</span>
              <span className="text-slate-500 font-normal">/</span>
              <span className="text-sky-400 font-bold">{activeBrand}</span>
            </h1>
          </div>

          {/* Micro-píldora de estadísticas en una sola línea */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="text-sky-400 font-bold">{stats.racksCount} racks</span>
            <span className="text-slate-600">•</span>
            <span>{stats.totalSlots} baldas</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-bold">{stats.occupiedSlots} con stock</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-bold">{stats.totalStock} unds</span>
            <span className="text-slate-600">•</span>
            <span className={stats.occupancyRate > 80 ? 'text-red-400 font-bold' : 'text-slate-400'}>
              {stats.occupancyRate}% ocup.
            </span>
          </div>

          {/* Botón para desplegar/colapsar KPIs detallados */}
          <button
            type="button"
            onClick={() => setShowKpiPanel(prev => !prev)}
            className={cn(
              "px-2 py-1 rounded-lg font-mono text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border",
              showKpiPanel
                ? "bg-sky-950/70 text-sky-300 border-sky-600/50"
                : "bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800"
            )}
            title="Ver/Ocultar tarjetas de KPIs"
          >
            <BarChart3 size={12} className="text-sky-400" />
            <span className="hidden sm:inline">KPIs</span>
            {showKpiPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Acciones de diseño y guardado */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowRoomModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Configurar forma de la sala (L, U, Rectángulo), dimensiones y zonas de piso"
          >
            <Compass size={14} className="text-amber-400" />
            <span className="hidden md:inline">Plano / Sala</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Nuevo Rack</span>
          </button>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Guardar posiciones y configuración en la nube"
          >
            <Save size={14} className={saving ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Colapsables (Opcionales para no consumir espacio vertical) */}
      {showKpiPanel && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0 animate-in slide-in-from-top-2 duration-150">
          <div className="p-2 rounded-xl border bg-slate-900/90 border-slate-800 flex flex-col">
            <span className="font-mono text-[9px] text-slate-400 uppercase">Estanterías Activas</span>
            <span className="font-mono text-base font-black text-sky-400">{stats.racksCount} racks</span>
          </div>
          <div className="p-2 rounded-xl border bg-slate-900/90 border-slate-800 flex flex-col">
            <span className="font-mono text-[9px] text-slate-400 uppercase">Total Baldas / Bins</span>
            <span className="font-mono text-base font-black text-slate-200">{stats.totalSlots} ranuras</span>
          </div>
          <div className="p-2 rounded-xl border bg-slate-900/90 border-slate-800 flex flex-col">
            <span className="font-mono text-[9px] text-slate-400 uppercase">Baldas con Stock</span>
            <span className="font-mono text-base font-black text-emerald-400">
              {stats.occupiedSlots} ({stats.totalSlots > 0 ? Math.round((stats.occupiedSlots / stats.totalSlots) * 100) : 0}%)
            </span>
          </div>
          <div className="p-2 rounded-xl border bg-slate-900/90 border-slate-800 flex flex-col">
            <span className="font-mono text-[9px] text-slate-400 uppercase">Prendas en Racks</span>
            <span className="font-mono text-base font-black text-amber-400">{stats.totalStock} unds</span>
          </div>
          <div className="p-2 rounded-xl border bg-slate-900/90 border-slate-800 flex flex-col">
            <span className="font-mono text-[9px] text-slate-400 uppercase">Nivel Saturación</span>
            <span className={`font-mono text-base font-black ${stats.occupancyRate > 80 ? 'text-red-400' : 'text-emerald-400'}`}>
              {stats.occupancyRate}% global
            </span>
          </div>
        </div>
      )}

      {/* Barra de Herramientas Unificada y Compacta */}
      <div
        className="px-2.5 py-1.5 rounded-xl border bg-slate-900/95 border-slate-800/90 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-lg"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Conmutador 3D vs Planilla 2D */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-800 bg-slate-950">
            <button
              type="button"
              onClick={() => setActiveView('VIEW_3D')}
              className={cn(
                'px-2.5 py-1 rounded-md font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                activeView === 'VIEW_3D'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Box size={13} /> 3D
            </button>
            <button
              type="button"
              onClick={() => setActiveView('BLUEPRINT_2D')}
              className={cn(
                'px-2.5 py-1 rounded-md font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                activeView === 'BLUEPRINT_2D'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Grid size={13} /> Plano 2D
            </button>
          </div>

          {/* Modos de visualización */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-800 bg-slate-950">
            <button
              type="button"
              onClick={() => setViewMode('PRODUCTS')}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer',
                viewMode === 'PRODUCTS'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Box size={12} /> <span className="hidden sm:inline">Prendas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('HEATMAP')}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer',
                viewMode === 'HEATMAP'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Flame size={12} /> <span className="hidden sm:inline">Calor</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CATEGORIES')}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer',
                viewMode === 'CATEGORIES'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Tag size={12} /> <span className="hidden sm:inline">Categorías</span>
            </button>
          </div>

          {/* Presets de Cámara y Controles de Arquitectura solo en 3D */}
          {activeView === 'VIEW_3D' && (
            <>
              {/* Presets de Cámara */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-800 bg-slate-950">
                <button
                  type="button"
                  onClick={() => setCameraPreset('ISOMETRIC')}
                  className="px-2 py-1 rounded text-[11px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  title="Vista Isométrica 3D"
                >
                  Iso
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('TOP_DOWN')}
                  className="px-2 py-1 rounded text-[11px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  title="Vista Cenital / Aérea"
                >
                  Cenital
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('FRONT')}
                  className="px-2 py-1 rounded text-[11px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  title="Vista Frontal"
                >
                  Frontal
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('RESET')}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Reiniciar Cámara"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              {/* Botón Caminar Adentro */}
              <button
                type="button"
                onClick={() => {
                  const next = !isWalkInMode;
                  setIsWalkInMode(next);
                  if (next) setRoofMode('SOLID');
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-mono text-[11px] font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer',
                  isWalkInMode
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
                )}
                title={isWalkInMode ? 'Salir del modo primera persona (ESC)' : 'Entra a caminar adentro del almacén'}
              >
                {isWalkInMode ? <DoorClosed size={13} /> : <DoorOpen size={13} />}
                <span>{isWalkInMode ? 'Salir (ESC)' : 'Caminar'}</span>
              </button>

              {/* Selector de Techo */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-slate-800 bg-slate-950 font-mono text-[10px]">
                <span className="px-1 text-slate-500 font-bold text-[9px]">TECHO:</span>
                <button
                  type="button"
                  onClick={() => setRoofMode('TRANSLUCENT')}
                  className={cn(
                    'px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer',
                    roofMode === 'TRANSLUCENT' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  )}
                  title="Techo de cristal translúcido"
                >
                  Cristal
                </button>
                <button
                  type="button"
                  onClick={() => setRoofMode('SOLID')}
                  className={cn(
                    'px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer',
                    roofMode === 'SOLID' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  )}
                  title="Techo cerrado opaco"
                >
                  Sólido
                </button>
                <button
                  type="button"
                  onClick={() => setRoofMode('HIDDEN')}
                  className={cn(
                    'px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer',
                    roofMode === 'HIDDEN' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  )}
                  title="Sin techo (corte cenital)"
                >
                  Oculto
                </button>
              </div>
            </>
          )}
        </div>

        {/* Buscador + Pantalla Completa a la derecha */}
        <div className="flex items-center gap-1.5">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar prenda..."
                className="pl-6 pr-2 py-1 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-[11px] font-mono outline-none focus:border-sky-500 w-28 sm:w-36 md:w-44 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold hover:bg-slate-700 hover:text-white cursor-pointer"
            >
              Ir
            </button>
          </form>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={cn(
              'px-2 py-1 rounded-lg font-mono text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer',
              isFullscreen
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40'
            )}
            title={isFullscreen ? 'Salir de pantalla completa (F o ESC)' : 'Activar pantalla completa (F)'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden xl:inline text-[11px]">{isFullscreen ? 'Salir' : 'Maximizar'}</span>
          </button>
        </div>
      </div>

      {/* Área Principal: Escenario 3D + Drawer Lateral */}
      <div
        ref={mainContainerRef}
        className={cn(
          "flex-1 flex overflow-hidden relative shadow-inner bg-slate-950 transition-all",
          isFullscreen ? "rounded-none fixed inset-0 z-50 w-screen h-screen" : "rounded-2xl border"
        )}
        style={{ borderColor: isFullscreen ? 'transparent' : 'var(--border)' }}
      >
        <div className="flex-1 h-full relative">
          {activeView === 'VIEW_3D' ? (
            <>
              {/* Barra Flotante de Acciones Rápidas del Estante Seleccionado */}
              {selectedRack && (
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-700 shadow-2xl backdrop-blur-md flex items-center gap-2.5 font-mono text-xs animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 pr-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                    <span className="font-black text-white uppercase tracking-tight">{selectedRack.name}</span>
                    <span className="text-[10px] text-slate-400">({selectedRack.aisle})</span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateRack({ ...selectedRack, rotationY: (selectedRack.rotationY + Math.PI / 2) % (Math.PI * 2) })}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Girar 90 grados"
                  >
                    <RotateCw size={13} className="text-sky-400" /> Girar 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateRack(selectedRack)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Duplicar este estante"
                  >
                    <Copy size={13} className="text-sky-400" /> Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRackToDelete(selectedRack)}
                    className="px-2.5 py-1 rounded-lg bg-red-600/25 hover:bg-red-600 text-red-300 hover:text-white text-[11px] font-black flex items-center gap-1.5 border border-red-500/40 cursor-pointer transition-all shadow-sm"
                    title="Eliminar este estante (o presiona la tecla Supr / Delete)"
                  >
                    <Trash2 size={13} /> Eliminar
                  </button>
                </div>
              )}

              <Warehouse3DCanvas
                racks={visibleRacks}
                warehouseWidth={layout.warehouseWidth}
                warehouseLength={layout.warehouseLength}
                roomShape={layout.roomShape}
                roomConfig={layout.roomConfig}
                zones={layout.zones}
                obstacles={layout.obstacles}
                viewMode={viewMode}
                selectedRackId={selectedRackId}
                selectedSlotKey={selectedSlotKey}
                cameraPreset={cameraPreset}
                isWalkInMode={isWalkInMode}
                onToggleWalkInMode={setIsWalkInMode}
                roofMode={roofMode}
                onRoofModeChange={setRoofMode}
                isFullscreen={isFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
                onSelectRack={setSelectedRackId}
                onSelectSlot={(rackId, slotKey) => {
                  setSelectedRackId(rackId);
                  setSelectedSlotKey(slotKey);
                }}
                onMoveRack={handleMoveRack}
                onResetCameraPreset={() => setCameraPreset(null)}
              />
            </>
          ) : (
            <WarehouseBlueprintEditor
              layout={layout}
              selectedRackId={selectedRackId}
              onSelectRack={setSelectedRackId}
              onMoveRack={handleMoveRack}
              onUpdateRack={handleUpdateRack}
              onDuplicateRack={handleDuplicateRack}
              onDeleteRack={handleDeleteRack}
              onUpdateRoomConfig={handleUpdateRoomConfig}
              onOpenAddModal={() => setShowAddModal(true)}
              onSwitchTo3D={() => setActiveView('VIEW_3D')}
            />
          )}
        </div>

        {/* Panel lateral del inspector de rack si está seleccionado */}
        {selectedRack && (
          <RackInspectorDrawer
            rack={selectedRack}
            selectedSlotKey={selectedSlotKey}
            products={products}
            locations={locations}
            stockLevels={stockLevels}
            onClose={() => {
              setSelectedRackId(null);
              setSelectedSlotKey(null);
            }}
            onSelectSlot={slotKey => setSelectedSlotKey(slotKey)}
            onUpdateRack={handleUpdateRack}
            onDeleteRack={handleDeleteRack}
            onDuplicateRack={handleDuplicateRack}
            onAssignProduct={handleAssignProduct}
            onEnsureLocation={handleEnsureLocation}
          />
        )}
      </div>

      {/* Modal para añadir nuevo Rack / Mueble */}
      {showAddModal && (
        <RackModalBuilder
          brand={activeBrand}
          existingRacksCount={layout.racks.length}
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreateRack}
        />
      )}

      {/* Modal para configurar plano / sala arquitectónica */}
      {showRoomModal && (
        <RoomConfigModal
          layout={layout}
          onClose={() => setShowRoomModal(false)}
          onSave={handleUpdateRoomConfig}
        />
      )}

      {/* Modal de Confirmación para Eliminar Estante */}
      {rackToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-2xl p-5 border shadow-2xl flex flex-col gap-3.5 text-slate-100 animate-in fade-in zoom-in-95 duration-100"
            style={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
          >
            <div className="flex items-center gap-2.5 text-red-400 font-mono font-black text-sm">
              <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <span className="block">¿Eliminar este estante?</span>
                <span className="font-mono text-[10px] text-slate-400 font-normal">Esta acción no se puede deshacer</span>
              </div>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              ¿Confirmas que deseas eliminar permanentemente <strong>{rackToDelete.name}</strong> ({rackToDelete.aisle}) con sus {rackToDelete.bays * rackToDelete.levels} casilleros?
            </p>
            <div className="flex gap-2 pt-1 border-t border-slate-800 justify-end">
              <button
                type="button"
                onClick={() => setRackToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 font-mono text-xs text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDeleteRack(rackToDelete.id);
                  setRackToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-mono text-xs font-black text-white cursor-pointer shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
