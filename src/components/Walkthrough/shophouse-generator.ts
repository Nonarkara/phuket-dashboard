// ─── Sino-Portuguese Shophouse & Streetscape 3D Generator ────────────────────
// Procedural high-fidelity Sino-Portuguese architectural generator for Phuket
// Old Town (Thalang Rd, Soi Romanee, Dibuk Rd, Phang Nga Rd).
// Faithfully constructs five-footway covered arcades (Chintho), arched openings,
// louvered Peranakan shutters, terracotta gabled roofs, concrete utility poles,
// sagging overhead catenary cables, vintage street lamps, and parked vehicles.

import * as THREE from "three";
import { createScreentoneMaterial } from "./manga-shaders";

export interface ShophouseUnitConfig {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  stories: number;
  wallColor: string;
  shutterColor: string;
  hasArchway: boolean;
  hasLanterns: boolean;
  facing: "north" | "south" | "east" | "west";
  venueSign?: {
    text: string;
    subText?: string;
    color: string;
  };
}

// Authentic Phuket Old Town heritage pastel palette
export const PERANAKAN_PALETTE = {
  ochreYellow: "#E5A93B",
  romaneeCoral: "#DE7A7E",
  peranakanTurquoise: "#4D9B85",
  colonialCream: "#F5EFE1",
  powderIndigo: "#6286A0",
  sageOlive: "#879878",
  terracottaRoof: "#9E4738",
  teakWood: "#3A291E",
  emeraldShutter: "#1F5942",
  creamShutter: "#FAF6EB",
  curbStone: "#888782",
  asphaltRoad: "#2B2C30",
  concretePole: "#808285",
};

/**
 * Creates a complete Sino-Portuguese Shophouse building unit.
 */
export function createSinoPortugueseUnit(
  config: ShophouseUnitConfig,
  toneMode: number = 0
): THREE.Group {
  const group = new THREE.Group();
  const {
    width,
    depth,
    height,
    wallColor,
    shutterColor,
    hasArchway,
    hasLanterns,
    venueSign,
  } = config;

  // Materials with manga screentone support
  const wallMat = createScreentoneMaterial({
    color: wallColor,
    shadowColor: 0x111116,
    dotScale: 5.5,
  });
  wallMat.uniforms.uToneMode.value = toneMode;

  const roofMat = createScreentoneMaterial({
    color: PERANAKAN_PALETTE.terracottaRoof,
    shadowColor: 0x150b0a,
    dotScale: 5.0,
  });
  roofMat.uniforms.uToneMode.value = toneMode;

  const darkWoodMat = createScreentoneMaterial({
    color: PERANAKAN_PALETTE.teakWood,
    shadowColor: 0x080605,
    dotScale: 5.0,
  });
  darkWoodMat.uniforms.uToneMode.value = toneMode;

  const shutterMat = createScreentoneMaterial({
    color: shutterColor,
    shadowColor: 0x0f1512,
    dotScale: 5.5,
  });
  shutterMat.uniforms.uToneMode.value = toneMode;

  const plasterWhiteMat = createScreentoneMaterial({
    color: 0xf5f3ee,
    shadowColor: 0x18181b,
    dotScale: 5.5,
  });
  plasterWhiteMat.uniforms.uToneMode.value = toneMode;

  // ─── 1. Main Upper Body (Solid Block from 3.6m to height) ─────────────
  const arcadeHeight = 3.6;
  const upperBodyHeight = height - arcadeHeight;
  const upperBodyGeo = new THREE.BoxGeometry(width, upperBodyHeight, depth);
  const upperBodyMesh = new THREE.Mesh(upperBodyGeo, wallMat);
  upperBodyMesh.position.set(0, arcadeHeight + upperBodyHeight / 2, -depth / 2);
  upperBodyMesh.castShadow = true;
  upperBodyMesh.receiveShadow = true;
  group.add(upperBodyMesh);

  // ─── 2. Five-Foot Way Covered Arcade (Ground Floor) ───────────────────
  const arcadeDepth = 1.8;
  const pillarW = 0.45;
  const pillarD = 0.45;

  if (hasArchway) {
    // Left & Right Front Arcade Pillars (Facing street)
    const pillarGeo = new THREE.BoxGeometry(pillarW, arcadeHeight, pillarD);
    const leftPillar = new THREE.Mesh(pillarGeo, plasterWhiteMat);
    leftPillar.position.set(-width / 2 + pillarW / 2, arcadeHeight / 2, -pillarD / 2);
    leftPillar.castShadow = true;
    group.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, plasterWhiteMat);
    rightPillar.position.set(width / 2 - pillarW / 2, arcadeHeight / 2, -pillarD / 2);
    rightPillar.castShadow = true;
    group.add(rightPillar);

    // Archway Spandrel & Molded Arch Beam (Top of arcade opening)
    const archBeamHeight = 0.65;
    const archBeamGeo = new THREE.BoxGeometry(width, archBeamHeight, pillarD);
    const archBeam = new THREE.Mesh(archBeamGeo, plasterWhiteMat);
    archBeam.position.set(0, arcadeHeight - archBeamHeight / 2, -pillarD / 2);
    group.add(archBeam);

    // Decorative Molded Arch Crown (Semi-circular arch cutout fill)
    const archWidth = width - pillarW * 2;
    const archCurveGeo = new THREE.CylinderGeometry(
      archWidth / 2,
      archWidth / 2,
      pillarD,
      16,
      1,
      false,
      0,
      Math.PI
    );
    archCurveGeo.rotateZ(Math.PI / 2);
    archCurveGeo.rotateX(Math.PI / 2);
    const archCurveMesh = new THREE.Mesh(archCurveGeo, plasterWhiteMat);
    archCurveMesh.position.set(0, arcadeHeight - archBeamHeight, -pillarD / 2);
    group.add(archCurveMesh);

    // Recessed Ground Floor Shop Front Wall (Set back behind arcade)
    const shopFrontW = width;
    const shopFrontGeo = new THREE.BoxGeometry(shopFrontW, arcadeHeight, 0.2);
    const shopFrontMesh = new THREE.Mesh(shopFrontGeo, wallMat);
    shopFrontMesh.position.set(0, arcadeHeight / 2, -arcadeDepth);
    group.add(shopFrontMesh);

    // Wooden Folding Shop Doors (Pintu Pagar / บานเฟี้ยม)
    const doorW = width * 0.55;
    const doorH = 2.4;
    const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.1);
    const doorMesh = new THREE.Mesh(doorGeo, darkWoodMat);
    doorMesh.position.set(0, doorH / 2, -arcadeDepth + 0.1);
    group.add(doorMesh);

    // Arcade Ceiling (Overhead covered walkway ceiling)
    const ceilingGeo = new THREE.BoxGeometry(width, 0.15, arcadeDepth);
    const ceilingMesh = new THREE.Mesh(ceilingGeo, plasterWhiteMat);
    ceilingMesh.position.set(0, arcadeHeight - 0.08, -arcadeDepth / 2);
    group.add(ceilingMesh);

    // Arcade Floor Tiling (Encaustic patterned walkway floor)
    const floorGeo = new THREE.BoxGeometry(width, 0.15, arcadeDepth);
    const floorMat = createScreentoneMaterial({
      color: 0x9c836e,
      shadowColor: 0x1a120c,
      dotScale: 4.5,
    });
    floorMat.uniforms.uToneMode.value = toneMode;
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, 0.08, -arcadeDepth / 2);
    floorMesh.receiveShadow = true;
    group.add(floorMesh);
  } else {
    // Solid ground floor if not an open arcade
    const groundGeo = new THREE.BoxGeometry(width, arcadeHeight, depth);
    const groundMesh = new THREE.Mesh(groundGeo, wallMat);
    groundMesh.position.set(0, arcadeHeight / 2, -depth / 2);
    group.add(groundMesh);
  }

  // ─── 3. Upper Floors: Peranakan Louvered Windows & Pilasters ─────────
  const numWindows = width > 5.5 ? 3 : 2;
  const windowSpacing = width / (numWindows + 1);
  const winW = 0.9;
  const winH = 1.7;

  // Floor 1 Windows (and Floor 2 if 3 stories)
  const windowYLevels = [arcadeHeight + 0.9];
  if (config.stories >= 3) {
    windowYLevels.push(arcadeHeight + 3.8);
  }

  for (const winY of windowYLevels) {
    for (let i = 1; i <= numWindows; i++) {
      const winX = -width / 2 + i * windowSpacing;

      // Window Frame & Recessed Opening
      const frameGeo = new THREE.BoxGeometry(winW, winH, 0.25);
      const frameMesh = new THREE.Mesh(frameGeo, darkWoodMat);
      frameMesh.position.set(winX, winY + winH / 2, 0.05);
      group.add(frameMesh);

      // Louvered Left Shutter
      const shutterW = winW * 0.44;
      const shutterGeo = new THREE.BoxGeometry(shutterW, winH * 0.94, 0.06);
      const leftShutter = new THREE.Mesh(shutterGeo, shutterMat);
      leftShutter.position.set(winX - winW * 0.24, winY + winH / 2, 0.15);
      leftShutter.rotation.y = -0.3; // Slightly swung open
      group.add(leftShutter);

      // Louvered Right Shutter
      const rightShutter = new THREE.Mesh(shutterGeo, shutterMat);
      rightShutter.position.set(winX + winW * 0.24, winY + winH / 2, 0.15);
      rightShutter.rotation.y = 0.3;
      group.add(rightShutter);

      // Classical Molded Pediment / Architrave above window
      const pedimentGeo = new THREE.BoxGeometry(winW * 1.25, 0.22, 0.2);
      const pedimentMesh = new THREE.Mesh(pedimentGeo, plasterWhiteMat);
      pedimentMesh.position.set(winX, winY + winH + 0.12, 0.12);
      group.add(pedimentMesh);

      // Decorative Window Sill
      const sillGeo = new THREE.BoxGeometry(winW * 1.2, 0.14, 0.2);
      const sillMesh = new THREE.Mesh(sillGeo, plasterWhiteMat);
      sillMesh.position.set(winX, winY - 0.07, 0.12);
      group.add(sillMesh);
    }

    // Molded String Course (Cornice separating stories)
    const corniceGeo = new THREE.BoxGeometry(width * 1.02, 0.24, 0.35);
    const corniceMesh = new THREE.Mesh(corniceGeo, plasterWhiteMat);
    corniceMesh.position.set(0, winY + winH + 0.35, 0.05);
    group.add(corniceMesh);
  }

  // Fluted Edge Pilasters (Decorative vertical classical columns on sides)
  const pilasterW = 0.3;
  const pilasterGeo = new THREE.BoxGeometry(pilasterW, upperBodyHeight, 0.2);
  const leftPilaster = new THREE.Mesh(pilasterGeo, plasterWhiteMat);
  leftPilaster.position.set(-width / 2 + pilasterW / 2, arcadeHeight + upperBodyHeight / 2, 0.05);
  group.add(leftPilaster);

  const rightPilaster = new THREE.Mesh(pilasterGeo, plasterWhiteMat);
  rightPilaster.position.set(width / 2 - pilasterW / 2, arcadeHeight + upperBodyHeight / 2, 0.05);
  group.add(rightPilaster);

  // ─── 4. Roof & Decorative Parapet / Firewall Gables ─────────────────
  // Parapet Wall along facade top
  const parapetH = 1.1;
  const parapetGeo = new THREE.BoxGeometry(width, parapetH, 0.3);
  const parapetMesh = new THREE.Mesh(parapetGeo, plasterWhiteMat);
  parapetMesh.position.set(0, height + parapetH / 2, -0.15);
  group.add(parapetMesh);

  // Decorative Pediment Crown / Cartouche in center of parapet
  const crownGeo = new THREE.BoxGeometry(width * 0.45, 0.55, 0.35);
  const crownMesh = new THREE.Mesh(crownGeo, plasterWhiteMat);
  crownMesh.position.set(0, height + parapetH + 0.22, -0.15);
  group.add(crownMesh);

  // Terracotta Pitched Roof (Sloping back from facade)
  const roofSlope = 0.4;
  const roofH = depth * roofSlope * 0.5;
  const roofGeo = new THREE.ConeGeometry(depth * 0.65, roofH, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.scale(width / (depth * 0.65), 1, 1);
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, height + roofH / 2, -depth / 2);
  roofMesh.castShadow = true;
  group.add(roofMesh);

  // ─── 5. Hanging Chinese Lanterns (Red paper lanterns with warm glow) ───
  if (hasLanterns) {
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xee2222 });
    const goldTasselMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    const lanternPositions = [-width * 0.28, width * 0.28];
    for (const lx of lanternPositions) {
      const lanternGeo = new THREE.SphereGeometry(0.24, 12, 10);
      lanternGeo.scale(1, 1.25, 1);
      const lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
      lanternMesh.position.set(lx, arcadeHeight - 0.75, -pillarD - 0.1);
      group.add(lanternMesh);

      // Gold tassel
      const tasselGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.25, 8);
      const tasselMesh = new THREE.Mesh(tasselGeo, goldTasselMat);
      tasselMesh.position.set(lx, arcadeHeight - 0.75 - 0.35, -pillarD - 0.1);
      group.add(tasselMesh);
    }
  }

  // ─── 6. Optional Venue Signboard (Vintage Teak or Painted Sign) ──────
  if (venueSign) {
    const signGeo = new THREE.BoxGeometry(width * 0.65, 0.5, 0.12);
    const signMat = createScreentoneMaterial({
      color: venueSign.color,
      shadowColor: 0x111116,
      dotScale: 5.0,
    });
    signMat.uniforms.uToneMode.value = toneMode;
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, arcadeHeight + 0.35, 0.15);
    group.add(signMesh);
  }

  // Set unit position & orientation
  group.position.set(config.x, 0, config.z);
  if (config.facing === "north") {
    group.rotation.y = Math.PI;
  } else if (config.facing === "east") {
    group.rotation.y = -Math.PI / 2;
  } else if (config.facing === "west") {
    group.rotation.y = Math.PI / 2;
  }

  return group;
}

/**
 * Creates concrete utility pole with crossarms, transformers, and sagging wires.
 */
export function createUtilityPole(
  x: number,
  z: number,
  height: number = 8.5,
  toneMode: number = 0
): THREE.Group {
  const pole = new THREE.Group();

  const poleMat = createScreentoneMaterial({
    color: PERANAKAN_PALETTE.concretePole,
    shadowColor: 0x18181b,
    dotScale: 5.0,
  });
  poleMat.uniforms.uToneMode.value = toneMode;

  const metalMat = createScreentoneMaterial({
    color: 0x333338,
    shadowColor: 0x0a0a0d,
    dotScale: 5.0,
  });
  metalMat.uniforms.uToneMode.value = toneMode;

  // Main square concrete pole shaft
  const shaftGeo = new THREE.BoxGeometry(0.32, height, 0.32);
  const shaftMesh = new THREE.Mesh(shaftGeo, poleMat);
  shaftMesh.position.set(0, height / 2, 0);
  shaftMesh.castShadow = true;
  pole.add(shaftMesh);

  // Top crossarm
  const crossarm1Geo = new THREE.BoxGeometry(2.4, 0.14, 0.14);
  const crossarm1 = new THREE.Mesh(crossarm1Geo, metalMat);
  crossarm1.position.set(0, height - 0.4, 0);
  pole.add(crossarm1);

  // Secondary lower crossarm
  const crossarm2Geo = new THREE.BoxGeometry(1.8, 0.12, 0.12);
  const crossarm2 = new THREE.Mesh(crossarm2Geo, metalMat);
  crossarm2.position.set(0, height - 1.2, 0);
  pole.add(crossarm2);

  // Cylindrical Transformer Box
  const transGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12);
  const transMesh = new THREE.Mesh(transGeo, metalMat);
  transMesh.position.set(0.45, height - 2.0, 0);
  pole.add(transMesh);

  pole.position.set(x, 0, z);
  return pole;
}

/**
 * Creates sagging catenary power and telecom wires between two poles.
 */
export function createCatenaryWire(
  start: THREE.Vector3,
  end: THREE.Vector3,
  sagAmount: number = 0.65
): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 20;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Linear interpolation
    const p = new THREE.Vector3().lerpVectors(start, end, t);
    // Catenary sag curve (parabolic approximation 4 * sag * t * (1 - t))
    const sag = 4.0 * sagAmount * t * (1.0 - t);
    p.y -= sag;
    points.push(p);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x111116,
    linewidth: 2,
  });

  return new THREE.Line(geometry, material);
}

/**
 * Creates classic cast-iron Sino-Portuguese street lamp post.
 */
export function createVintageStreetLamp(
  x: number,
  z: number,
  toneMode: number = 0
): THREE.Group {
  const lamp = new THREE.Group();
  const ironMat = createScreentoneMaterial({
    color: 0x1c1e22,
    shadowColor: 0x07080a,
    dotScale: 5.0,
  });
  ironMat.uniforms.uToneMode.value = toneMode;

  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe899 });

  // Post base
  const baseGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.8, 8);
  const baseMesh = new THREE.Mesh(baseGeo, ironMat);
  baseMesh.position.y = 0.4;
  lamp.add(baseMesh);

  // Slender fluted column
  const columnGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8);
  const columnMesh = new THREE.Mesh(columnGeo, ironMat);
  columnMesh.position.y = 2.4;
  lamp.add(columnMesh);

  // Lantern arm & crown
  const armGeo = new THREE.TorusGeometry(0.35, 0.04, 6, 12, Math.PI);
  armGeo.rotateZ(Math.PI / 2);
  const armMesh = new THREE.Mesh(armGeo, ironMat);
  armMesh.position.set(0.25, 4.0, 0);
  lamp.add(armMesh);

  // Glowing lantern glass
  const glassGeo = new THREE.OctahedronGeometry(0.22);
  const glassMesh = new THREE.Mesh(glassGeo, glowMat);
  glassMesh.position.set(0.5, 3.8, 0);
  lamp.add(glassMesh);

  lamp.position.set(x, 0, z);
  return lamp;
}

/**
 * Creates classic red Phuket Tuk-Tuk vehicle model.
 */
export function createPhuketTukTuk(
  x: number,
  z: number,
  heading: number = 0,
  toneMode: number = 0
): THREE.Group {
  const vehicle = new THREE.Group();

  const redBodyMat = createScreentoneMaterial({
    color: 0xd62828,
    shadowColor: 0x1a0606,
    dotScale: 5.5,
  });
  redBodyMat.uniforms.uToneMode.value = toneMode;

  const yellowCanopyMat = createScreentoneMaterial({
    color: 0xf4a261,
    shadowColor: 0x1f140a,
    dotScale: 5.5,
  });
  yellowCanopyMat.uniforms.uToneMode.value = toneMode;

  const chromeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  const tireMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

  // Lower chassis
  const chassisGeo = new THREE.BoxGeometry(1.4, 0.6, 2.6);
  const chassisMesh = new THREE.Mesh(chassisGeo, redBodyMat);
  chassisMesh.position.y = 0.55;
  vehicle.add(chassisMesh);

  // Open passenger cabin & yellow canvas canopy
  const canopyGeo = new THREE.BoxGeometry(1.45, 0.08, 2.7);
  const canopyMesh = new THREE.Mesh(canopyGeo, yellowCanopyMat);
  canopyMesh.position.y = 1.75;
  vehicle.add(canopyMesh);

  // 4 thin metal roof pillars
  const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6);
  const pillarCoords = [
    [-0.65, 0.95],
    [0.65, 0.95],
    [-0.65, -0.95],
    [0.65, -0.95],
  ];
  for (const [px, pz] of pillarCoords) {
    const pMesh = new THREE.Mesh(pillarGeo, chromeMat);
    pMesh.position.set(px, 1.2, pz);
    vehicle.add(pMesh);
  }

  // 4 wheels
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelCoords = [
    [-0.75, 0.28, 0.85],
    [0.75, 0.28, 0.85],
    [-0.75, 0.28, -0.85],
    [0.75, 0.28, -0.85],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
    wMesh.position.set(wx, wy, wz);
    vehicle.add(wMesh);
  }

  vehicle.position.set(x, 0, z);
  vehicle.rotation.y = heading;
  return vehicle;
}

/**
 * Creates classic blue wooden Po Thong bus (รถสองแถวไม้โพถ้อง) parked on street.
 */
export function createPoThongBus(
  x: number,
  z: number,
  heading: number = 0,
  toneMode: number = 0
): THREE.Group {
  const bus = new THREE.Group();

  const blueBodyMat = createScreentoneMaterial({
    color: 0x1d3557,
    shadowColor: 0x050c17,
    dotScale: 5.5,
  });
  blueBodyMat.uniforms.uToneMode.value = toneMode;

  const woodSlatsMat = createScreentoneMaterial({
    color: 0xb5835a,
    shadowColor: 0x1a1007,
    dotScale: 5.0,
  });
  woodSlatsMat.uniforms.uToneMode.value = toneMode;

  const tireMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });

  // Wooden passenger body
  const bodyGeo = new THREE.BoxGeometry(2.1, 1.4, 5.2);
  const bodyMesh = new THREE.Mesh(bodyGeo, blueBodyMat);
  bodyMesh.position.y = 1.35;
  bus.add(bodyMesh);

  // Traditional wooden side slats
  const slatsGeo = new THREE.BoxGeometry(2.15, 0.45, 3.8);
  const slatsMesh = new THREE.Mesh(slatsGeo, woodSlatsMat);
  slatsMesh.position.set(0, 1.25, -0.4);
  bus.add(slatsMesh);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelCoords = [
    [-1.05, 0.42, 1.6],
    [1.05, 0.42, 1.6],
    [-1.05, 0.42, -1.6],
    [1.05, 0.42, -1.6],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const wMesh = new THREE.Mesh(wheelGeo, tireMat);
    wMesh.position.set(wx, wy, wz);
    bus.add(wMesh);
  }

  bus.position.set(x, 0, z);
  bus.rotation.y = heading;
  return bus;
}
