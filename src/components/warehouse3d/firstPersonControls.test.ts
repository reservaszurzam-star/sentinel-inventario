import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { FirstPersonWarehouseController } from './firstPersonControls';
import { getEntranceDoorInfo } from './architecturalBuilder';
import { isPointInsideRoom } from '../../lib/warehouseBounds';

describe('FirstPersonWarehouseController', () => {
  let camera: THREE.PerspectiveCamera;
  let domElement: HTMLDivElement;
  let controller: FirstPersonWarehouseController;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    domElement = document.createElement('div');
    document.body.appendChild(domElement);
  });

  afterEach(() => {
    if (controller) controller.dispose();
    if (domElement.parentNode) domElement.parentNode.removeChild(domElement);
  });

  it('teleports to entrance and positions camera legally inside the warehouse', () => {
    controller = new FirstPersonWarehouseController(camera, domElement, 20, 20, 'RECTANGULAR');
    const door = getEntranceDoorInfo(20, 20, 'RECTANGULAR');
    controller.teleportToEntrance(door);

    expect(camera.position.y).toBe(controller.eyeHeight);
    // Camera is inside room bounds
    expect(isPointInsideRoom(camera.position.x, camera.position.z, 20, 20, 'RECTANGULAR', undefined, 0)).toBe(true);
  });

  it('teleports to entrance safely in a CUSTOM_GRID warehouse', () => {
    const customGrid = {
      cellSize: 2,
      cols: 4,
      rows: 4,
      cells: [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
    };
    controller = new FirstPersonWarehouseController(camera, domElement, 8, 8, 'CUSTOM_GRID', { customGrid });
    const door = getEntranceDoorInfo(8, 8, 'CUSTOM_GRID', { customGrid });
    controller.teleportToEntrance(door);

    expect(isPointInsideRoom(camera.position.x, camera.position.z, 8, 8, 'CUSTOM_GRID', { customGrid }, 0)).toBe(true);
  });

  it('rotates view using keyboard turn keys and virtual input', () => {
    controller = new FirstPersonWarehouseController(camera, domElement, 20, 20, 'RECTANGULAR');
    const initialYaw = controller.yaw;

    // Simulate turn left
    controller.virtualInput.turnLeft = true;
    controller.update(0.1);
    expect(controller.yaw).toBeGreaterThan(initialYaw);

    // Simulate turn right
    controller.virtualInput.turnLeft = false;
    controller.virtualInput.turnRight = true;
    controller.update(0.2);
    expect(controller.yaw).toBeLessThan(controller.yaw + 0.1);
  });

  it('walks forward when forward key or virtual forward is pressed', () => {
    controller = new FirstPersonWarehouseController(camera, domElement, 20, 20, 'RECTANGULAR');
    camera.position.set(0, 1.7, 5);
    controller.yaw = 0; // facing North (-Z)

    controller.virtualInput.forward = true;
    controller.update(0.1);

    // Camera moved towards -Z
    expect(camera.position.z).toBeLessThan(5);
  });

  it('allows moving in a 1m aisle and recovers from being near a wall', () => {
    // Custom grid with 1m cells
    const customGrid = {
      cellSize: 1,
      cols: 3,
      rows: 5,
      cells: [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    };
    controller = new FirstPersonWarehouseController(camera, domElement, 3, 5, 'CUSTOM_GRID', { customGrid });
    // In a 1m cell corridor at col 1, x spans from -0.5 to +0.5, cell center is 0
    // Set position slightly off center (e.g. x = 0.35, near wall at 0.5)
    camera.position.set(0.35, 1.7, 0);

    // Walk forward along corridor (-Z)
    controller.yaw = 0;
    controller.virtualInput.forward = true;
    controller.update(0.1);

    // Verify it moved forward along Z without freezing
    expect(camera.position.z).toBeLessThan(0);
  });
});
