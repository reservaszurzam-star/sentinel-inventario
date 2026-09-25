import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Rack3D,
  RackSlot3D,
  ViewMode3D,
  CameraPreset,
  RoomShape,
  RoomConfig,
  FunctionalZone,
  ArchitecturalObstacle,
} from '../../types/warehouse3d';
import { buildRackMesh, buildWarehouseFloor } from './rackMeshBuilder';
import { clampRackPosition } from '../../lib/warehouseBounds';
import {
  buildWarehouseArchitecture,
  getEntranceDoorInfo,
  RoofDisplayMode,
} from './architecturalBuilder';
import { FirstPersonWarehouseController } from './firstPersonControls';
import {
  Layers,
  Eye,
  Box,
  Maximize2,
  Minimize2,
  RotateCcw,
  Move,
  MousePointer,
  Info,
  DoorOpen,
  DoorClosed,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface Warehouse3DCanvasProps {
  racks: Rack3D[];
  warehouseWidth?: number;
  warehouseLength?: number;
  roomShape?: RoomShape;
  roomConfig?: RoomConfig;
  zones?: FunctionalZone[];
  obstacles?: ArchitecturalObstacle[];
  viewMode: ViewMode3D;
  selectedRackId: string | null;
  selectedSlotKey: string | null;
  cameraPreset?: CameraPreset | null;
  isWalkInMode?: boolean;
  onToggleWalkInMode?: (walkIn: boolean) => void;
  roofMode?: RoofDisplayMode;
  onRoofModeChange?: (mode: RoofDisplayMode) => void;
  wallHeight?: number;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onSelectRack: (rackId: string | null) => void;
  onSelectSlot: (rackId: string, slotKey: string | null) => void;
  onMoveRack?: (rackId: string, newPosition: [number, number, number]) => void;
  onResetCameraPreset?: () => void;
}

interface HoveredSlotInfo {
  rackName: string;
  aisle: string;
  level: number;
  bay: number;
  code: string;
  productName?: string;
  productColor?: string;
  stockUnits: number;
  capacity: number;
  x: number;
  y: number;
}

function disposeHierarchy(root: THREE.Object3D) {
  root.traverse((child: any) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: any) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    }
    if (child.isLight && child.dispose) {
      child.dispose();
    }
  });
}

export const Warehouse3DCanvas: React.FC<Warehouse3DCanvasProps> = ({
  racks,
  warehouseWidth = 26,
  warehouseLength = 30,
  roomShape = 'RECTANGULAR' as RoomShape,
  roomConfig,
  zones = [],
  obstacles = [],
  viewMode,
  selectedRackId,
  selectedSlotKey,
  cameraPreset,
  isWalkInMode = false,
  onToggleWalkInMode,
  roofMode = 'TRANSLUCENT',
  onRoofModeChange,
  wallHeight = 4.8,
  isFullscreen = false,
  onToggleFullscreen,
  onSelectRack,
  onSelectSlot,
  onMoveRack,
  onResetCameraPreset,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const racksGroupRef = useRef<THREE.Group | null>(null);
  const floorGroupRef = useRef<THREE.Group | null>(null);
  const archGroupRef = useRef<THREE.Group | null>(null);
  const fpControllerRef = useRef<FirstPersonWarehouseController | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const isWalkInModeRef = useRef<boolean>(isWalkInMode);
  isWalkInModeRef.current = isWalkInMode;

  const [hoveredSlot, setHoveredSlot] = useState<HoveredSlotInfo | null>(null);
  const [activeTool, setActiveTool] = useState<'SELECT' | 'DRAG'>('DRAG');
  const [liveCoords, setLiveCoords] = useState<{ name: string; x: number; z: number } | null>(null);

  // Estado del arrastre en 3D
  const dragRef = useRef<{
    isDragging: boolean;
    rackId: string | null;
    rackMesh: THREE.Object3D | null;
    hasMoved: boolean;
    startClient: { x: number; y: number };
    planeOffset: THREE.Vector3;
    lastSlotHitKey: string | null;
  }>({
    isDragging: false,
    rackId: null,
    rackMesh: null,
    hasMoved: false,
    startClient: { x: 0, y: 0 },
    planeOffset: new THREE.Vector3(),
    lastSlotHitKey: null,
  });

  // Atajo de teclado: ESC para salir del modo primera persona
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isWalkInMode && onToggleWalkInMode) {
        onToggleWalkInMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWalkInMode, onToggleWalkInMode]);

  // 1. Inicialización de la escena Three.js
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Escena con fondo moderno de showroom
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.012);
    sceneRef.current = scene;

    // Cámara
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(13, 14, 17);
    cameraRef.current = camera;

    // Renderer optimizado para laptops (máximo 1.5x pixel ratio para no saturar GPUs integradas)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL Context Lost protegido para evitar congelamiento de la laptop.');
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    container.appendChild(renderer.domElement);

    // Controles de órbita
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // No pasar debajo del piso
    controls.minDistance = 2;
    controls.maxDistance = 80;
    controls.target.set(0, 1.8, 0);
    controlsRef.current = controls;

    // Iluminación industrial hiper-eficiente (solo 3 luces globales, 0 sobrecarga de GPU)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x1e293b, 0.75);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.6);
    sunLight.position.set(18, 28, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 90;
    const d = 25;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Piso del almacén
    const floor = buildWarehouseFloor(warehouseWidth, warehouseLength, roomShape, roomConfig, zones, obstacles);
    scene.add(floor);
    floorGroupRef.current = floor;

    // Arquitectura (Muros, portón de entrada, techo y luminarias)
    const arch = buildWarehouseArchitecture(
      warehouseWidth,
      warehouseLength,
      roomShape,
      roomConfig,
      wallHeight,
      roofMode
    );
    scene.add(arch);
    archGroupRef.current = arch;

    // Grupo de racks
    const racksGroup = new THREE.Group();
    scene.add(racksGroup);
    racksGroupRef.current = racksGroup;

    // Loop de animación
    let lastTime = performance.now();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (isWalkInModeRef.current && fpControllerRef.current) {
        fpControllerRef.current.update(delta);
      } else if (controlsRef.current) {
        controlsRef.current.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (fpControllerRef.current) fpControllerRef.current.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  const roomConfigKey = JSON.stringify(roomConfig || {});

  // Actualizar piso dinámicamente cuando cambian las dimensiones, forma o zonas
  useEffect(() => {
    if (!sceneRef.current) return;
    if (floorGroupRef.current) {
      sceneRef.current.remove(floorGroupRef.current);
      disposeHierarchy(floorGroupRef.current);
    }
    const newFloor = buildWarehouseFloor(warehouseWidth, warehouseLength, roomShape, roomConfig, zones, obstacles);
    floorGroupRef.current = newFloor;
    sceneRef.current.add(newFloor);
  }, [warehouseWidth, warehouseLength, roomShape, roomConfigKey, zones, obstacles]);

  // Actualizar arquitectura (muros, portón y techo) cuando cambian dimensiones, forma o modo de techo
  useEffect(() => {
    if (!sceneRef.current) return;
    if (archGroupRef.current) {
      sceneRef.current.remove(archGroupRef.current);
      disposeHierarchy(archGroupRef.current);
    }
    const newArch = buildWarehouseArchitecture(
      warehouseWidth,
      warehouseLength,
      roomShape,
      roomConfig,
      wallHeight,
      roofMode
    );
    archGroupRef.current = newArch;
    sceneRef.current.add(newArch);

    if (fpControllerRef.current) {
      fpControllerRef.current.updateDimensions(
        warehouseWidth,
        warehouseLength,
        roomShape,
        roomConfig
      );
    }
  }, [warehouseWidth, warehouseLength, roomShape, roomConfigKey, wallHeight, roofMode]);

  // Manejo de activación/desactivación del Modo Ingresar (Recorrido en Primera Persona)
  useEffect(() => {
    if (!cameraRef.current || !rendererRef.current) return;
    const camera = cameraRef.current;
    const domElement = rendererRef.current.domElement;

    if (isWalkInMode) {
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
      const door = getEntranceDoorInfo(warehouseWidth, warehouseLength, roomShape, roomConfig);
      const controller = new FirstPersonWarehouseController(
        camera,
        domElement,
        warehouseWidth,
        warehouseLength,
        roomShape,
        roomConfig
      );
      controller.teleportToEntrance(door);
      fpControllerRef.current = controller;
    } else {
      if (fpControllerRef.current) {
        fpControllerRef.current.dispose();
        fpControllerRef.current = null;
      }
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
        camera.position.set(16, 18, 22);
        controlsRef.current.target.set(0, 1.8, 0);
        controlsRef.current.update();
      }
    }

    return () => {
      if (fpControllerRef.current) {
        fpControllerRef.current.dispose();
        fpControllerRef.current = null;
      }
    };
  }, [isWalkInMode]);

  // 2. Reconstruir los meshes de los Racks cuando cambian
  useEffect(() => {
    const racksGroup = racksGroupRef.current;
    if (!racksGroup) return;

    // Limpiar meshes anteriores con liberación de memoria GPU
    while (racksGroup.children.length > 0) {
      const child = racksGroup.children[0];
      racksGroup.remove(child);
      disposeHierarchy(child);
    }

    // Construir cada rack 3D
    racks.forEach(rack => {
      const isSelected = rack.id === selectedRackId;
      const highlightSlot = isSelected ? selectedSlotKey : null;
      const mesh = buildRackMesh(rack, viewMode, isSelected, highlightSlot);
      racksGroup.add(mesh);
    });
  }, [racks, viewMode, selectedRackId, selectedSlotKey]);

  // 3. Manejo de Presets de Cámara (solo en modo órbita)
  useEffect(() => {
    if (isWalkInMode) return;
    if (!cameraPreset || !cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const maxDim = Math.max(warehouseWidth, warehouseLength);

    switch (cameraPreset) {
      case 'ISOMETRIC':
        camera.position.set(maxDim * 0.54, maxDim * 0.60, maxDim * 0.68);
        controls.target.set(0, 1.4, 0);
        break;
      case 'TOP_DOWN':
        camera.position.set(0, maxDim * 1.15, 0.01);
        controls.target.set(0, 0, 0);
        break;
      case 'FRONT':
        camera.position.set(0, 2.5, maxDim * 0.78);
        controls.target.set(0, 1.4, 0);
        break;
      case 'SIDE_LEFT':
        camera.position.set(-maxDim * 1.05, 3, 0);
        controls.target.set(0, 1.8, 0);
        break;
      case 'SIDE_RIGHT':
        camera.position.set(maxDim * 1.05, 3, 0);
        controls.target.set(0, 1.8, 0);
        break;
    }
    controls.update();

    if (onResetCameraPreset) {
      onResetCameraPreset();
    }
  }, [cameraPreset, warehouseWidth, warehouseLength, isWalkInMode, onResetCameraPreset]);

  // 4. MOUSE DOWN: Detección de clic o inicio de arrastre
  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isWalkInMode) return; // En primera persona, FirstPersonController maneja el arrastre para mirar
    if (e.button !== 0) return; // Solo clic izquierdo
    if (!mountRef.current || !cameraRef.current || !racksGroupRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(racksGroupRef.current.children, true);

    if (intersects.length > 0) {
      let topHit = intersects[0].object;
      let rackId: string | null = null;
      let slotKey: string | null = null;
      let rackMesh: THREE.Object3D | null = null;

      let curr: THREE.Object3D | null = topHit;
      while (curr && curr !== racksGroupRef.current) {
        if (curr.userData && curr.userData.rackId) {
          rackId = curr.userData.rackId;
          rackMesh = curr;
          if (curr.userData.isSlot) {
            slotKey = curr.userData.slotKey;
          }
        }
        curr = curr.parent;
      }

      if (rackId && rackMesh) {
        onSelectRack(rackId);
        onSelectSlot(rackId, slotKey);

        if (activeTool === 'DRAG') {
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const planeHit = new THREE.Vector3();
          raycaster.ray.intersectPlane(groundPlane, planeHit);

          const planeOffset = new THREE.Vector3().subVectors(rackMesh.position, planeHit);
          planeOffset.y = 0;

          dragRef.current = {
            isDragging: true,
            rackId,
            rackMesh,
            hasMoved: false,
            startClient: { x: e.clientX, y: e.clientY },
            planeOffset,
            lastSlotHitKey: slotKey,
          };
        }
      }
    } else {
      if (activeTool === 'SELECT') {
        onSelectRack(null);
        onSelectSlot('', null);
      }
    }
  }, [activeTool, onSelectRack, onSelectSlot, isWalkInMode]);

  // 5. MOUSE MOVE: Arrastre de estante o Tooltip
  const handlePointerMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current || !cameraRef.current || !racksGroupRef.current) return;

    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    // --- MODO ARRASTRE ACTIVO ---
    if (!isWalkInMode && dragRef.current.isDragging && dragRef.current.rackMesh && dragRef.current.rackId) {
      const deltaX = Math.abs(e.clientX - dragRef.current.startClient.x);
      const deltaY = Math.abs(e.clientY - dragRef.current.startClient.y);

      if (deltaX > 4 || deltaY > 4 || dragRef.current.hasMoved) {
        dragRef.current.hasMoved = true;

        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }

        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const planeHit = new THREE.Vector3();
        const hasHit = raycaster.ray.intersectPlane(groundPlane, planeHit);

        if (hasHit) {
          const targetX = planeHit.x + dragRef.current.planeOffset.x;
          const targetZ = planeHit.z + dragRef.current.planeOffset.z;

          const snappedX = Math.round(targetX * 2) / 2;
          const snappedZ = Math.round(targetZ * 2) / 2;

          const rObj = racks.find(r => r.id === dragRef.current.rackId);
          let finalX = snappedX;
          let finalZ = snappedZ;

          if (rObj) {
            const [cx, cz] = clampRackPosition(
              snappedX,
              snappedZ,
              rObj,
              warehouseWidth,
              warehouseLength,
              roomShape,
              roomConfig
            );
            finalX = cx;
            finalZ = cz;
          }

          dragRef.current.rackMesh.position.set(finalX, 0, finalZ);

          setLiveCoords({
            name: rObj?.name || 'Estante de Madera',
            x: finalX,
            z: finalZ,
          });
        }
        return;
      }
    }

    // --- MODO HOVER (TOOLTIP) ---
    const intersects = raycaster.intersectObjects(racksGroupRef.current.children, true);
    for (const hit of intersects) {
      const u = hit.object.userData;
      if (u && u.isSlot && u.slot) {
        const slot: RackSlot3D = u.slot;
        const rack = racks.find(r => r.id === u.rackId);
        setHoveredSlot({
          rackName: rack?.name || 'ESTANTE DE MADERA',
          aisle: rack?.aisle || 'Pasillo',
          level: u.level,
          bay: u.bay,
          code: slot.code,
          productName: slot.productName,
          productColor: slot.productColor,
          stockUnits: slot.stockUnits,
          capacity: slot.capacity,
          x: e.clientX - rect.left + 16,
          y: e.clientY - rect.top + 16,
        });
        return;
      }
    }

    setHoveredSlot(null);
  }, [racks, warehouseWidth, warehouseLength, roomShape, roomConfig, isWalkInMode]);

  // 6. MOUSE UP: Finalizar arrastre y guardar nueva posición
  const handlePointerUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isWalkInMode) return;

    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    if (dragRef.current.isDragging) {
      const { rackId, rackMesh, hasMoved, lastSlotHitKey } = dragRef.current;

      if (hasMoved && rackId && rackMesh && onMoveRack) {
        const [x, y, z] = [rackMesh.position.x, rackMesh.position.y, rackMesh.position.z];
        onMoveRack(rackId, [x, y, z]);
      } else if (!hasMoved && rackId) {
        onSelectRack(rackId);
        onSelectSlot(rackId, lastSlotHitKey);
      }

      dragRef.current.isDragging = false;
      dragRef.current.rackId = null;
      dragRef.current.rackMesh = null;
      dragRef.current.hasMoved = false;
      setLiveCoords(null);
    }
  }, [onMoveRack, onSelectRack, onSelectSlot, isWalkInMode]);

  return (
    <div
      ref={mountRef}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={() => {
        if (controlsRef.current && !isWalkInMode) {
          controlsRef.current.enabled = true;
        }
        dragRef.current.isDragging = false;
        setHoveredSlot(null);
        setLiveCoords(null);
      }}
      className={cn(
        "w-full h-full relative select-none overflow-hidden",
        isWalkInMode
          ? "cursor-crosshair"
          : activeTool === 'DRAG'
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-default"
      )}
    >
      {/* Banner de Arrastre en Vivo con Coordenadas */}
      {liveCoords && !isWalkInMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-sky-950/90 border border-sky-400 text-sky-200 shadow-2xl backdrop-blur-md flex items-center gap-3 font-mono text-xs font-bold animate-in fade-in duration-100">
          <Move size={16} className="text-sky-400 animate-pulse" />
          <span>Moviendo <strong>{liveCoords.name}</strong></span>
          <span className="opacity-40">|</span>
          <span className="text-white">X: {liveCoords.x}m · Z: {liveCoords.z}m</span>
        </div>
      )}

      {/* Selector de Herramientas de Interacción (Modo Órbita) */}
      {!isWalkInMode && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl backdrop-blur-md shadow-xl font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTool('DRAG')}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              activeTool === 'DRAG'
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            )}
            title="Arrastra con el ratón directamente cualquier estante sobre el suelo"
          >
            <Move size={13} /> Mover Estante
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('SELECT')}
            className={cn(
              "px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer",
              activeTool === 'SELECT'
                ? "bg-sky-600 text-white shadow-xs"
                : "text-slate-400 hover:text-white"
            )}
            title="Modo inspección de baldas y prendas"
          >
            <MousePointer size={13} /> Inspeccionar
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HUD OVERLAY EN MODO PRIMERA PERSONA (WALK-IN) */}
      {/* ========================================================================= */}
      {isWalkInMode && (
        <>
          {/* Retículo / Mira Central Sutil */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-white/80 bg-sky-400/40 shadow-sm" />
          </div>

          {/* Barra Superior Informativa y Botón de Salida */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-slate-900/90 border border-amber-500/70 shadow-2xl backdrop-blur-md flex items-center gap-3.5 font-mono text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-black text-amber-300 uppercase tracking-wider">
                ADENTRO DEL ALMACÉN (RECORRIDO 3D)
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <span className="text-slate-300 text-[11px]">Altura de ojos: <strong>1.70m</strong></span>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={() => onToggleWalkInMode?.(false)}
              className="px-3 py-1 rounded-xl bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/50 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Salir a la vista general exterior (o presiona la tecla ESC)"
            >
              <DoorClosed size={14} /> Salir a Órbita (ESC)
            </button>
          </div>

          {/* Cruceta Virtual D-Pad en Pantalla (Ideal para mouse/touch/laptop) */}
          <div className="absolute bottom-4 left-4 z-40 p-3 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl backdrop-blur-md flex flex-col items-center gap-1.5 font-mono select-none">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Marcha</span>
            
            {/* Botón Adelante */}
            <button
              type="button"
              onPointerDown={() => {
                if (fpControllerRef.current) fpControllerRef.current.virtualInput.forward = true;
              }}
              onPointerUp={() => {
                if (fpControllerRef.current) fpControllerRef.current.virtualInput.forward = false;
              }}
              onPointerLeave={() => {
                if (fpControllerRef.current) fpControllerRef.current.virtualInput.forward = false;
              }}
              className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-sky-600 active:bg-sky-500 border border-slate-700 text-white font-black flex items-center justify-center shadow-md cursor-pointer transition-all"
              title="Avanzar (W o Flecha Arriba)"
            >
              <ChevronUp size={22} />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Botón Girar Izquierda */}
              <button
                type="button"
                onPointerDown={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.turnLeft = true;
                }}
                onPointerUp={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.turnLeft = false;
                }}
                onPointerLeave={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.turnLeft = false;
                }}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-sky-600 active:bg-sky-500 border border-slate-700 text-white font-black flex items-center justify-center shadow-md cursor-pointer transition-all"
                title="Girar a la izquierda (Q o Flecha Izq)"
              >
                <ChevronLeft size={22} />
              </button>

              {/* Botón Retroceder */}
              <button
                type="button"
                onPointerDown={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.backward = true;
                }}
                onPointerUp={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.backward = false;
                }}
                onPointerLeave={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.backward = false;
                }}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-sky-600 active:bg-sky-500 border border-slate-700 text-white font-black flex items-center justify-center shadow-md cursor-pointer transition-all"
                title="Retroceder (S o Flecha Abajo)"
              >
                <ChevronDown size={22} />
              </button>

              {/* Botón Girar Derecha */}
              <button
                type="button"
                onPointerDown={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.turnRight = true;
                }}
                onPointerUp={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.turnRight = false;
                }}
                onPointerLeave={() => {
                  if (fpControllerRef.current) fpControllerRef.current.virtualInput.turnRight = false;
                }}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-sky-600 active:bg-sky-500 border border-slate-700 text-white font-black flex items-center justify-center shadow-md cursor-pointer transition-all"
                title="Girar a la derecha (E o Flecha Der)"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>

          {/* Guía en pantalla inferior derecha */}
          <div className="absolute bottom-4 right-4 z-40 hidden sm:flex flex-col gap-1 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-sky-400 font-bold">
              <Navigation size={14} /> Controles de Recorrido:
            </div>
            <span>• <strong>W, S</strong> o <strong>Flechas Arriba/Abajo</strong> para avanzar y retroceder</span>
            <span>• <strong>A, D</strong> para desplazarte a los lados (strafe)</span>
            <span>• <strong>Q, E</strong> o <strong>Flechas Izq/Der</strong> para girar la mirada</span>
            <span>• <strong>Arrastra el ratón</strong> para mirar en 360° libremente</span>
            <span>• <strong>Shift</strong> para trotar más rápido</span>
          </div>
        </>
      )}

      {/* HUD Tooltip en Hover */}
      {hoveredSlot && !liveCoords && (
        <div
          className="absolute z-30 pointer-events-none p-3.5 rounded-xl border backdrop-blur-md shadow-2xl flex flex-col gap-1 min-w-[220px] animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: Math.min(hoveredSlot.x, (mountRef.current?.clientWidth || 800) - 250),
            top: Math.min(hoveredSlot.y, (mountRef.current?.clientHeight || 600) - 160),
            background: 'rgba(15, 23, 42, 0.94)',
            borderColor: '#38bdf8',
            color: '#f8fafc',
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
            <span className="font-mono text-[10px] font-black uppercase text-sky-400 tracking-wider">
              {hoveredSlot.rackName}
            </span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 font-bold">
              {hoveredSlot.code}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-slate-400 font-mono text-[10px]">PISO {hoveredSlot.level} · COL {hoveredSlot.bay}</span>
            <span className="text-[10px] font-mono text-slate-400">{hoveredSlot.aisle}</span>
          </div>

          {hoveredSlot.productName ? (
            <div className="flex flex-col gap-0.5 mt-0.5 pt-1 border-t border-slate-700/40">
              <span className="font-bold text-xs truncate text-amber-300">
                {hoveredSlot.productName}
              </span>
              {hoveredSlot.productColor && (
                <span className="text-[10px] text-slate-300 font-mono">
                  Color: <strong className="text-white">{hoveredSlot.productColor}</strong>
                </span>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 italic mt-0.5">
              Sin prenda asignada en esta balda
            </div>
          )}

          <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-700/60 font-mono text-[11px]">
            <span className="text-slate-400">Stock Actual:</span>
            <span className={`font-black ${hoveredSlot.stockUnits > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {hoveredSlot.stockUnits} / {hoveredSlot.capacity} unds
            </span>
          </div>
        </div>
      )}

      {/* Mini Guía de Navegación 3D (Solo en modo órbita) */}
      {!isWalkInMode && (
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-slate-400 backdrop-blur-xs">
          <span>🖐️ <strong>Clic y arrastrar:</strong> Mover estante</span>
          <span>·</span>
          <span>🖱️ <strong>Clic der:</strong> Desplazar vista</span>
          <span>·</span>
          <span>🔄 <strong>Rueda:</strong> Zoom</span>
          <span>·</span>
          <span>🎯 <strong>Clic:</strong> Inspeccionar</span>
        </div>
      )}
    </div>
  );
};
