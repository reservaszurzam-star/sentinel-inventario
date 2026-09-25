import * as THREE from 'three';
import { RoomShape, RoomConfig } from '../../types/warehouse3d';
import { isPointInsideRoom } from '../../lib/warehouseBounds';
import { EntranceDoorInfo, getEntranceDoorInfo } from './architecturalBuilder';

export interface VirtualControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  sprint: boolean;
}

export class FirstPersonWarehouseController {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private warehouseWidth: number;
  private warehouseLength: number;
  private roomShape: RoomShape | string;
  private roomConfig?: RoomConfig;

  // Parámetros de navegación
  public eyeHeight = 1.70; // Altura promedio humana
  public walkSpeed = 4.2; // m/s
  public sprintSpeed = 7.0; // m/s
  public mouseSensitivity = 0.0028;
  public keyTurnSpeed = 2.4; // rad/s para botones UI de giro

  // Orientación (ángulos en radianes)
  public yaw = 0; // Rotación horizontal
  public pitch = 0; // Rotación vertical (mirar arriba/abajo)

  // Estado del teclado y virtual
  private keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
    sprint: false,
  };

  public virtualInput: VirtualControlsState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
    sprint: false,
  };

  // Estado de arrastre del ratón
  private isPointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Cabeceo al caminar (Head Bobbing)
  private walkTimer = 0;
  public isMoving = false;

  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    warehouseWidth: number,
    warehouseLength: number,
    roomShape: RoomShape | string = 'RECTANGULAR',
    roomConfig?: RoomConfig
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.warehouseWidth = warehouseWidth;
    this.warehouseLength = warehouseLength;
    this.roomShape = roomShape;
    this.roomConfig = roomConfig;

    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnPointerDown = this.onPointerDown.bind(this);
    this.boundOnPointerMove = this.onPointerMove.bind(this);
    this.boundOnPointerUp = this.onPointerUp.bind(this);

    this.attach();
  }

  public updateDimensions(
    width: number,
    length: number,
    roomShape: RoomShape | string,
    roomConfig?: RoomConfig
  ) {
    this.warehouseWidth = width;
    this.warehouseLength = length;
    this.roomShape = roomShape;
    this.roomConfig = roomConfig;
  }

  public attach() {
    window.addEventListener('keydown', this.boundOnKeyDown);
    window.addEventListener('keyup', this.boundOnKeyUp);
    this.domElement.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
  }

  public dispose() {
    window.removeEventListener('keydown', this.boundOnKeyDown);
    window.removeEventListener('keyup', this.boundOnKeyUp);
    this.domElement.removeEventListener('pointerdown', this.boundOnPointerDown);
    window.removeEventListener('pointermove', this.boundOnPointerMove);
    window.removeEventListener('pointerup', this.boundOnPointerUp);
  }

  /**
   * Posiciona la cámara exactamente en el portón de entrada mirando hacia adentro del almacén.
   */
  public teleportToEntrance(doorInfo: EntranceDoorInfo) {
    let startX = doorInfo.center.x;
    let startZ = doorInfo.center.z - 1.0;

    // Probar candidatos de profundidad hacia el interior del almacén
    const testOffsets = [-1.0, -0.6, -0.4, -1.6, -2.2];
    let foundSafe = false;

    for (const offZ of testOffsets) {
      const candidateZ = doorInfo.center.z + offZ;
      if (
        isPointInsideRoom(
          startX,
          candidateZ,
          this.warehouseWidth,
          this.warehouseLength,
          this.roomShape,
          this.roomConfig,
          0.12
        )
      ) {
        startZ = candidateZ;
        foundSafe = true;
        break;
      }
    }

    // Si aún no es seguro (p. ej. entrada de esquina o celda estrecha en CUSTOM_GRID)
    if (!foundSafe) {
      if (this.roomShape === 'CUSTOM_GRID' && this.roomConfig?.customGrid) {
        const { cellSize, cols, rows, cells } = this.roomConfig.customGrid;
        const gridW = cols * cellSize;
        const gridL = rows * cellSize;
        const minX = -gridW / 2;
        const minZ = -gridL / 2;

        let bestDist = Infinity;
        let bestX = 0;
        let bestZ = 0;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (cells[r] && cells[r][c] === 1) {
              const cellCenterX = minX + (c + 0.5) * cellSize;
              const cellCenterZ = minZ + (r + 0.5) * cellSize;
              const dist = Math.hypot(cellCenterX - doorInfo.center.x, cellCenterZ - doorInfo.center.z);
              if (dist < bestDist) {
                bestDist = dist;
                bestX = cellCenterX;
                bestZ = cellCenterZ;
              }
            }
          }
        }
        if (bestDist < Infinity) {
          startX = bestX;
          startZ = bestZ;
          foundSafe = true;
        }
      } else {
        if (isPointInsideRoom(0, 0, this.warehouseWidth, this.warehouseLength, this.roomShape, this.roomConfig, 0.2)) {
          startX = 0;
          startZ = 0;
          foundSafe = true;
        }
      }
    }

    this.camera.position.set(startX, this.eyeHeight, startZ);
    // Mirando hacia el Norte (-Z)
    this.yaw = 0;
    this.pitch = 0;
    this.applyRotation();
  }

  private onKeyDown(e: KeyboardEvent) {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
        this.keys.left = true;
        break;
      case 'KeyD':
        this.keys.right = true;
        break;
      case 'KeyQ':
      case 'ArrowLeft':
        this.keys.turnLeft = true;
        break;
      case 'KeyE':
      case 'ArrowRight':
        this.keys.turnRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'KeyD':
        this.keys.right = false;
        break;
      case 'KeyQ':
      case 'ArrowLeft':
        this.keys.turnLeft = false;
        break;
      case 'KeyE':
      case 'ArrowRight':
        this.keys.turnRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false;
        break;
    }
  }

  private onPointerDown(e: PointerEvent) {
    // Clic principal para arrastrar y mirar
    if (e.button === 0) {
      this.isPointerDown = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.isPointerDown) return;

    const deltaX = e.clientX - this.lastPointerX;
    const deltaY = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    // Actualizar Yaw (giro horizontal) y Pitch (mirar arriba/abajo)
    this.yaw -= deltaX * this.mouseSensitivity;
    this.pitch -= deltaY * this.mouseSensitivity;

    // Limitar cabeceo vertical para no dar vuelta completa
    const maxPitch = Math.PI / 2.3; // ~78 grados
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.applyRotation();
  }

  private onPointerUp() {
    this.isPointerDown = false;
  }

  public rotateBy(deltaYaw: number, deltaPitch = 0) {
    this.yaw += deltaYaw;
    this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch + deltaPitch));
    this.applyRotation();
  }

  private applyRotation() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }

  /**
   * Actualización física frame a frame con detección de colisiones contra los muros.
   */
  public update(deltaTime: number) {
    // Giro de cámara con teclado (Q/E, Flechas Izq/Der) y botones táctiles UI
    const isTurningLeft = this.keys.turnLeft || this.virtualInput.turnLeft;
    const isTurningRight = this.keys.turnRight || this.virtualInput.turnRight;

    if (isTurningLeft) {
      this.yaw += this.keyTurnSpeed * deltaTime;
      this.applyRotation();
    }
    if (isTurningRight) {
      this.yaw -= this.keyTurnSpeed * deltaTime;
      this.applyRotation();
    }

    // Auto-recuperación si por alguna razón la cámara quedó fuera del plano
    if (!isPointInsideRoom(this.camera.position.x, this.camera.position.z, this.warehouseWidth, this.warehouseLength, this.roomShape, this.roomConfig, 0)) {
      const door = getEntranceDoorInfo(this.warehouseWidth, this.warehouseLength, this.roomShape, this.roomConfig);
      this.teleportToEntrance(door);
    }

    // Determinar entradas combinadas (teclado + virtual)
    const forwardInput = this.keys.forward || this.virtualInput.forward;
    const backwardInput = this.keys.backward || this.virtualInput.backward;
    const leftInput = this.keys.left || this.virtualInput.left;
    const rightInput = this.keys.right || this.virtualInput.right;
    const isSprinting = this.keys.sprint || this.virtualInput.sprint;

    const speed = isSprinting ? this.sprintSpeed : this.walkSpeed;

    let moveX = 0;
    let moveZ = 0;

    // Vector de avance en el plano X-Z
    // Cuando yaw = 0, mirar hacia -Z (Norte del almacén)
    const dirX = -Math.sin(this.yaw);
    const dirZ = -Math.cos(this.yaw);

    // Vector lateral derecho perpendicular
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    if (forwardInput) {
      moveX += dirX;
      moveZ += dirZ;
    }
    if (backwardInput) {
      moveX -= dirX;
      moveZ -= dirZ;
    }
    if (rightInput) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (leftInput) {
      moveX -= rightX;
      moveZ -= rightZ;
    }

    const inputLength = Math.hypot(moveX, moveZ);
    this.isMoving = inputLength > 0.01;

    if (this.isMoving) {
      // Normalizar para velocidad uniforme en diagonales
      moveX = (moveX / inputLength) * speed * deltaTime;
      moveZ = (moveZ / inputLength) * speed * deltaTime;

      const currentPos = this.camera.position;
      const targetX = currentPos.x + moveX;
      const targetZ = currentPos.z + moveZ;

      // Margen ergonómico de seguridad contra paredes (18cm, radio de hombros humano)
      const wallMargin = 0.18;
      let moved = false;

      // 1. Probar movimiento completo
      if (
        isPointInsideRoom(
          targetX,
          targetZ,
          this.warehouseWidth,
          this.warehouseLength,
          this.roomShape,
          this.roomConfig,
          wallMargin
        )
      ) {
        currentPos.x = targetX;
        currentPos.z = targetZ;
        moved = true;
      } else {
        // 2. Deslizamiento suave contra la pared: Probar X solo
        if (
          isPointInsideRoom(
            targetX,
            currentPos.z,
            this.warehouseWidth,
            this.warehouseLength,
            this.roomShape,
            this.roomConfig,
            wallMargin
          )
        ) {
          currentPos.x = targetX;
          moved = true;
        }

        // 3. Probar Z solo
        if (
          isPointInsideRoom(
            currentPos.x,
            targetZ,
            this.warehouseWidth,
            this.warehouseLength,
            this.roomShape,
            this.roomConfig,
            wallMargin
          )
        ) {
          currentPos.z = targetZ;
          moved = true;
        }
      }

      // 4. Sistema Anti-Stuck: Si el jugador quedó atrapado cerca de una pared o en un pasillo de 1m,
      // permitir moverse si la nueva posición está dentro de los límites legales con margen reducido (4cm)
      if (!moved) {
        const minMargin = 0.04;
        if (
          isPointInsideRoom(
            targetX,
            targetZ,
            this.warehouseWidth,
            this.warehouseLength,
            this.roomShape,
            this.roomConfig,
            minMargin
          )
        ) {
          currentPos.x = targetX;
          currentPos.z = targetZ;
          moved = true;
        } else if (
          isPointInsideRoom(
            targetX,
            currentPos.z,
            this.warehouseWidth,
            this.warehouseLength,
            this.roomShape,
            this.roomConfig,
            minMargin
          )
        ) {
          currentPos.x = targetX;
          moved = true;
        } else if (
          isPointInsideRoom(
            currentPos.x,
            targetZ,
            this.warehouseWidth,
            this.warehouseLength,
            this.roomShape,
            this.roomConfig,
            minMargin
          )
        ) {
          currentPos.z = targetZ;
          moved = true;
        }
      }

      // Animación de cabeceo realista (Head Bobbing) si hubo desplazamiento
      if (moved) {
        this.walkTimer += deltaTime * (isSprinting ? 14 : 9.5);
        const bobY = Math.sin(this.walkTimer) * 0.028;
        currentPos.y = this.eyeHeight + bobY;
      }
    } else {
      // Retorno suave a altura fija
      this.camera.position.y = this.eyeHeight;
      this.walkTimer = 0;
    }
  }
}
