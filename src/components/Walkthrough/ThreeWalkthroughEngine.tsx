// ─── Three.js 3D Walkthrough Engine for Phuket Old Town ─────────────────────
// Real-time procedural 3D streetscape with authentic Sino-Portuguese shophouses,
// five-footway covered arcades, louvered shutters, terracotta roofs, concrete utility
// poles, sagging catenary wires, vintage street lamps, parked tuk-tuks, and manga
// halftone screentone shader pipeline (inspired by Location Scout / どこでもロケハン).

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  createSinoPortugueseUnit,
  createUtilityPole,
  createCatenaryWire,
  createVintageStreetLamp,
  createPhuketTukTuk,
  createPoThongBus,
  PERANAKAN_PALETTE,
} from "./shophouse-generator";
import { createScreentoneMaterial } from "./manga-shaders";
import {
  WalkthroughPlace,
  RenderShaderStyle,
  TimeOfDay,
} from "@/lib/phuket-walkthrough-data";

export interface ThreeWalkthroughEngineProps {
  places: WalkthroughPlace[];
  selectedPlaceId?: string;
  onSelectPlace: (placeId: string) => void;
  shaderStyle: RenderShaderStyle;
  timeOfDay: TimeOfDay;
  focalLengthMm: number;
  onPlayerMove?: (state: {
    x: number;
    z: number;
    headingDeg: number;
    pitchDeg: number;
  }) => void;
}

// Landmark spatial anchors in local 3D coordinate space (meters)
export const LANDMARK_3D_COORDINATES: Record<string, { x: number; z: number; heading: number }> = {
  // Thalang Road
  "kopitiam-by-wilai": { x: -8, z: 2.2, heading: 0 }, // North side facing South
  "the-memory-at-on-on-hotel": { x: -28, z: 58, heading: 0 }, // Phang Nga Rd
  "tu-kab-khao": { x: 18, z: 58, heading: 0 }, // Phang Nga Rd
  // Soi Romanee Corridor
  "torrys-ice-cream": { x: 9.8, z: -24, heading: -Math.PI / 2 }, // Soi Romanee West side facing East
  // Dibuk Road
  "raya-restaurant": { x: 42, z: -58, heading: Math.PI },
  "lock-tien-food-court": { x: -36, z: -58, heading: 0 },
  "one-chun-cafe": { x: 30, z: -8, heading: 0 },
  "phuket-thai-hua-museum": { x: -55, z: 2.2, heading: 0 },
};

export const ThreeWalkthroughEngine: React.FC<ThreeWalkthroughEngineProps> = ({
  places,
  selectedPlaceId,
  onSelectPlace,
  shaderStyle,
  timeOfDay,
  focalLengthMm,
  onPlayerMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Player position and orientation
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.65, 0)); // 1.65m eye level
  const playerYaw = useRef<number>(Math.PI * 1.5); // Looking down Thalang Rd (West)
  const playerPitch = useRef<number>(0); // Level horizon

  // Input state
  const keysPressed = useRef<Record<string, boolean>>({});
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startRotation = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  // Speed and motion
  const walkSpeed = 6.5; // m/s
  const turnSpeed = 1.8; // rad/s
  const lastTimeRef = useRef<number>(0);

  // UI state
  const [activeBubble, setActiveBubble] = useState<{
    id: string;
    name: string;
    sound: string;
    color: string;
    distanceM: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Map shader style to tone mode integer
  const getToneMode = useCallback((style: RenderShaderStyle): number => {
    switch (style) {
      case "screentone":
        return 0; // Pure manga line + tone
      case "comic-pop":
        return 1; // Manga color + tone
      case "architectural-ink":
        return 2; // White architectural model
      case "neon-noir":
        return 3; // Cyber neon noir
      default:
        return 0;
    }
  }, []);

  // Update camera FOV based on 35mm equivalent focal length
  useEffect(() => {
    if (!cameraRef.current) return;
    // 35mm film sensor height is 24mm: FOV = 2 * atan(24 / (2 * focalLength))
    const fov = 2 * Math.atan(24 / (2 * Math.max(12, focalLengthMm))) * (180 / Math.PI);
    cameraRef.current.fov = fov;
    cameraRef.current.updateProjectionMatrix();
  }, [focalLengthMm]);

  // Teleport to selected place if requested
  useEffect(() => {
    if (!selectedPlaceId) return;
    const target = LANDMARK_3D_COORDINATES[selectedPlaceId];
    if (target) {
      // Smoothly place camera right at doorstep looking at facade
      playerPos.current.set(target.x, 1.65, target.z);
      playerYaw.current = target.heading;
      playerPitch.current = 0.05;
    }
  }, [selectedPlaceId]);

  // Build the complete 3D scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─── 1. Setup Three.js Scene, Camera & Renderer ───────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = container.clientWidth / container.clientHeight;
    const initialFov =
      2 * Math.atan(24 / (2 * Math.max(12, focalLengthMm))) * (180 / Math.PI);
    const camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 800);
    camera.position.copy(playerPos.current);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // ─── 2. Environment Lighting & Sky ────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(40, 80, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    const d = 120;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Sky background color depending on style
    scene.background = new THREE.Color(
      shaderStyle === "screentone"
        ? 0xfaf9f6
        : shaderStyle === "neon-noir"
        ? 0x080910
        : 0xebf2f8
    );

    const toneMode = getToneMode(shaderStyle);

    // ─── 3. Street Ground & Sidewalk Networks ─────────────────────────────
    // Thalang Road (East-West corridor at z = 0, width 8.5m, length 240m)
    const roadMat = createScreentoneMaterial({
      color: PERANAKAN_PALETTE.asphaltRoad,
      shadowColor: 0x0f1012,
      dotScale: 5.5,
    });
    roadMat.uniforms.uToneMode.value = toneMode;

    const thalangRoadGeo = new THREE.PlaneGeometry(240, 8.5);
    thalangRoadGeo.rotateX(-Math.PI / 2);
    const thalangRoad = new THREE.Mesh(thalangRoadGeo, roadMat);
    thalangRoad.position.set(0, 0.01, 0);
    thalangRoad.receiveShadow = true;
    scene.add(thalangRoad);

    // White dashed center line along Thalang Road
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let x = -100; x <= 100; x += 6) {
      const dashGeo = new THREE.PlaneGeometry(3.5, 0.18);
      dashGeo.rotateX(-Math.PI / 2);
      const dash = new THREE.Mesh(dashGeo, lineMat);
      dash.position.set(x, 0.02, 0);
      scene.add(dash);
    }

    // Soi Romanee Road (North-South corridor at x = 10, connecting Thalang to Dibuk)
    const romaneeRoadGeo = new THREE.PlaneGeometry(6.5, 70);
    romaneeRoadGeo.rotateX(-Math.PI / 2);
    const romaneeRoad = new THREE.Mesh(romaneeRoadGeo, roadMat);
    romaneeRoad.position.set(10, 0.01, -35);
    romaneeRoad.receiveShadow = true;
    scene.add(romaneeRoad);

    // Dibuk Road (Parallel corridor at z = -60)
    const dibukRoadGeo = new THREE.PlaneGeometry(240, 8.5);
    dibukRoadGeo.rotateX(-Math.PI / 2);
    const dibukRoad = new THREE.Mesh(dibukRoadGeo, roadMat);
    dibukRoad.position.set(0, 0.01, -60);
    dibukRoad.receiveShadow = true;
    scene.add(dibukRoad);

    // Phang Nga Road (Parallel corridor at z = 60)
    const phangNgaRoadGeo = new THREE.PlaneGeometry(240, 8.5);
    phangNgaRoadGeo.rotateX(-Math.PI / 2);
    const phangNgaRoad = new THREE.Mesh(phangNgaRoadGeo, roadMat);
    phangNgaRoad.position.set(0, 0.01, 60);
    phangNgaRoad.receiveShadow = true;
    scene.add(phangNgaRoad);

    // Granite Curb Stones & Raised Sidewalks along Thalang Road
    const curbMat = createScreentoneMaterial({
      color: PERANAKAN_PALETTE.curbStone,
      shadowColor: 0x141416,
      dotScale: 5.0,
    });
    curbMat.uniforms.uToneMode.value = toneMode;

    const northSidewalkGeo = new THREE.BoxGeometry(240, 0.16, 2.0);
    const northSidewalk = new THREE.Mesh(northSidewalkGeo, curbMat);
    northSidewalk.position.set(0, 0.08, -5.25);
    northSidewalk.receiveShadow = true;
    scene.add(northSidewalk);

    const southSidewalkGeo = new THREE.BoxGeometry(240, 0.16, 2.0);
    const southSidewalk = new THREE.Mesh(southSidewalkGeo, curbMat);
    southSidewalk.position.set(0, 0.08, 5.25);
    southSidewalk.receiveShadow = true;
    scene.add(southSidewalk);

    // ─── 4. Procedural Sino-Portuguese Shophouses ─────────────────────────
    // Authentic palette array for randomized natural distribution
    const pastelColors = [
      PERANAKAN_PALETTE.ochreYellow,
      PERANAKAN_PALETTE.romaneeCoral,
      PERANAKAN_PALETTE.peranakanTurquoise,
      PERANAKAN_PALETTE.colonialCream,
      PERANAKAN_PALETTE.powderIndigo,
      PERANAKAN_PALETTE.sageOlive,
    ];

    const shutterColors = [
      PERANAKAN_PALETTE.emeraldShutter,
      PERANAKAN_PALETTE.creamShutter,
      PERANAKAN_PALETTE.teakWood,
    ];

    // North side of Thalang Road (facing South, z = -6.25)
    for (let x = -80; x <= 80; x += 5.0) {
      // Leave gap for Soi Romanee junction at x = 7 to 13
      if (x >= 6 && x <= 14) continue;

      const colorIdx = Math.abs(Math.floor(x * 7)) % pastelColors.length;
      const shutterIdx = Math.abs(Math.floor(x * 3)) % shutterColors.length;
      const isThreeStory = Math.abs(x) % 3 === 0;

      const unit = createSinoPortugueseUnit(
        {
          x,
          z: -6.25,
          width: 4.8,
          depth: 16,
          height: isThreeStory ? 11.2 : 8.8,
          stories: isThreeStory ? 3 : 2,
          wallColor: pastelColors[colorIdx],
          shutterColor: shutterColors[shutterIdx],
          hasArchway: true,
          hasLanterns: true,
          facing: "south",
          venueSign:
            Math.abs(x + 8) < 2
              ? { text: "โกปี๊เตี๊ยม", subText: "Kopitiam by Wilai", color: "#3A291E" }
              : undefined,
        },
        toneMode
      );
      scene.add(unit);
    }

    // South side of Thalang Road (facing North, z = 6.25)
    for (let x = -80; x <= 80; x += 5.0) {
      const colorIdx = Math.abs(Math.floor(x * 11)) % pastelColors.length;
      const shutterIdx = Math.abs(Math.floor(x * 5)) % shutterColors.length;
      const isThreeStory = Math.abs(x) % 4 === 0;

      const unit = createSinoPortugueseUnit(
        {
          x,
          z: 6.25,
          width: 4.8,
          depth: 16,
          height: isThreeStory ? 11.2 : 8.8,
          stories: isThreeStory ? 3 : 2,
          wallColor: pastelColors[colorIdx],
          shutterColor: shutterColors[shutterIdx],
          hasArchway: true,
          hasLanterns: true,
          facing: "north",
        },
        toneMode
      );
      scene.add(unit);
    }

    // Soi Romanee Shophouse Row (The iconic pink & turquoise pedestrian alley!)
    // West side of Soi Romanee (facing East, x = 6.75)
    for (let z = -12; z >= -54; z -= 4.8) {
      const isTorrys = Math.abs(z + 24) < 3;
      const wallColor = isTorrys
        ? PERANAKAN_PALETTE.romaneeCoral // Torry's famous pastel pink!
        : pastelColors[Math.abs(Math.floor(z * 3)) % pastelColors.length];

      const unit = createSinoPortugueseUnit(
        {
          x: 6.75,
          z,
          width: 4.6,
          depth: 14,
          height: 9.4,
          stories: 2,
          wallColor,
          shutterColor: PERANAKAN_PALETTE.emeraldShutter,
          hasArchway: true,
          hasLanterns: true, // Red celebration lanterns along Soi Romanee!
          facing: "east",
          venueSign: isTorrys
            ? { text: "TORRY'S ICE CREAM", subText: "ทอรร์รี่ ไอศกรีม", color: "#C84B50" }
            : undefined,
        },
        toneMode
      );
      scene.add(unit);
    }

    // East side of Soi Romanee (facing West, x = 13.25)
    for (let z = -12; z >= -54; z -= 4.8) {
      const colorIdx = Math.abs(Math.floor(z * 7)) % pastelColors.length;
      const unit = createSinoPortugueseUnit(
        {
          x: 13.25,
          z,
          width: 4.6,
          depth: 14,
          height: 9.4,
          stories: 2,
          wallColor: pastelColors[colorIdx],
          shutterColor: PERANAKAN_PALETTE.creamShutter,
          hasArchway: true,
          hasLanterns: true,
          facing: "west",
        },
        toneMode
      );
      scene.add(unit);
    }

    // ─── 5. Concrete Utility Poles & Sagging Catenary Cables ───────────────
    // Iconic Phuket streetscape infrastructure as seen in Location Scout!
    const poleCoords: [number, number][] = [
      [-60, -4.6],
      [-30, -4.6],
      [0, -4.6],
      [30, -4.6],
      [60, -4.6],
      [-45, 4.6],
      [-15, 4.6],
      [15, 4.6],
      [45, 4.6],
      // Soi Romanee poles
      [6.2, -20],
      [6.2, -40],
    ];

    const poleObjects: THREE.Group[] = [];
    for (const [px, pz] of poleCoords) {
      const pole = createUtilityPole(px, pz, 8.5, toneMode);
      scene.add(pole);
      poleObjects.push(pole);
    }

    // String multi-level sagging catenary cables between consecutive poles
    for (let i = 0; i < poleCoords.length - 1; i++) {
      const [x1, z1] = poleCoords[i];
      const [x2, z2] = poleCoords[i + 1];

      // Cable level 1 (high voltage top line)
      const p1 = new THREE.Vector3(x1, 8.1, z1);
      const p2 = new THREE.Vector3(x2, 8.1, z2);
      scene.add(createCatenaryWire(p1, p2, 0.7));

      // Cable level 2 (telecom bundle)
      const p3 = new THREE.Vector3(x1, 7.3, z1);
      const p4 = new THREE.Vector3(x2, 7.3, z2);
      scene.add(createCatenaryWire(p3, p4, 0.85));

      // Cable level 3 (fiber drop)
      const p5 = new THREE.Vector3(x1, 6.6, z1);
      const p6 = new THREE.Vector3(x2, 6.6, z2);
      scene.add(createCatenaryWire(p5, p6, 0.55));
    }

    // Cables crossing diagonally across Thalang Road
    scene.add(
      createCatenaryWire(
        new THREE.Vector3(-30, 8.0, -4.6),
        new THREE.Vector3(-15, 7.5, 4.6),
        0.9
      )
    );
    scene.add(
      createCatenaryWire(
        new THREE.Vector3(0, 7.8, -4.6),
        new THREE.Vector3(15, 7.4, 4.6),
        0.85
      )
    );

    // ─── 6. Vintage Street Lamps, Parked Tuk-Tuk & Po Thong Bus ───────────
    // Sino-Portuguese cast iron street lamps
    const lampCoords: [number, number][] = [
      [-50, -4.4],
      [-20, -4.4],
      [20, -4.4],
      [50, -4.4],
      [-35, 4.4],
      [-5, 4.4],
      [25, 4.4],
      [55, 4.4],
      [10, -18],
      [10, -38],
    ];
    for (const [lx, lz] of lampCoords) {
      scene.add(createVintageStreetLamp(lx, lz, toneMode));
    }

    // Classic red Phuket Tuk-Tuk parked on curb
    scene.add(createPhuketTukTuk(-14, -3.2, 0.05, toneMode));
    scene.add(createPhuketTukTuk(34, 3.2, Math.PI + 0.1, toneMode));

    // Classic Phuket blue wooden Po Thong bus parked near junction
    scene.add(createPoThongBus(-48, 3.1, Math.PI - 0.05, toneMode));

    // ─── 7. Render Loop & First-Person Walking Physics ────────────────────
    lastTimeRef.current = performance.now();
    const updatePhysics = (deltaSec: number) => {
      let forward = 0;
      let turn = 0;

      const keys = keysPressed.current;
      if (keys["KeyW"] || keys["ArrowUp"]) forward += 1;
      if (keys["KeyS"] || keys["ArrowDown"]) forward -= 1;
      if (keys["KeyA"] || keys["ArrowLeft"]) turn += 1;
      if (keys["KeyD"] || keys["ArrowRight"]) turn -= 1;

      // Smooth turning
      playerYaw.current += turn * turnSpeed * deltaSec;

      // Walking vectors
      if (forward !== 0) {
        const moveAngle = playerYaw.current;
        const dx = Math.sin(moveAngle) * forward * walkSpeed * deltaSec;
        const dz = Math.cos(moveAngle) * forward * walkSpeed * deltaSec;

        playerPos.current.x += dx;
        playerPos.current.z += dz;

        // Street corridor bounds check (keep on streets and under arcades)
        // Thalang corridor: z between -5.5 and +5.5; Soi Romanee: x between 7 and 13
        if (playerPos.current.z > -8 && playerPos.current.z < 8) {
          playerPos.current.x = Math.max(-95, Math.min(95, playerPos.current.x));
        } else if (playerPos.current.x > 6 && playerPos.current.x < 14) {
          playerPos.current.z = Math.max(-58, Math.min(5, playerPos.current.z));
        }
      }

      // Update camera orientation
      if (cameraRef.current) {
        cameraRef.current.position.copy(playerPos.current);

        const lookTarget = new THREE.Vector3(
          playerPos.current.x + Math.sin(playerYaw.current) * Math.cos(playerPitch.current),
          playerPos.current.y + Math.sin(playerPitch.current),
          playerPos.current.z + Math.cos(playerYaw.current) * Math.cos(playerPitch.current)
        );
        cameraRef.current.lookAt(lookTarget);
      }

      // Notify parent of player position for radar sync
      if (onPlayerMove) {
        const headingDeg =
          (((-playerYaw.current * 180) / Math.PI + 360) % 360 + 360) % 360;
        const pitchDeg = (playerPitch.current * 180) / Math.PI;
        onPlayerMove({
          x: playerPos.current.x,
          z: playerPos.current.z,
          headingDeg,
          pitchDeg,
        });
      }

      // Proximity check for nearest venue bubble
      let nearestPlace: WalkthroughPlace | null = null;
      let minDistance = Infinity;

      for (const place of places) {
        const coords = LANDMARK_3D_COORDINATES[place.id];
        if (!coords) continue;
        const dist = Math.hypot(
          playerPos.current.x - coords.x,
          playerPos.current.z - coords.z
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestPlace = place;
        }
      }

      if (nearestPlace && minDistance < 35 && cameraRef.current) {
        const coords = LANDMARK_3D_COORDINATES[nearestPlace.id];
        const venue3DPos = new THREE.Vector3(coords.x, 4.2, coords.z);
        venue3DPos.project(cameraRef.current);

        if (venue3DPos.z < 1) {
          const sx = ((venue3DPos.x + 1) * container.clientWidth) / 2;
          const sy = ((-venue3DPos.y + 1) * container.clientHeight) / 2;
          setActiveBubble({
            id: nearestPlace.id,
            name: nearestPlace.name,
            sound: nearestPlace.soundEffectRom,
            color: nearestPlace.comicBubbleColor,
            distanceM: Math.round(minDistance),
            screenX: sx,
            screenY: sy,
          });
        } else {
          setActiveBubble(null);
        }
      } else {
        setActiveBubble(null);
      }
    };

    const animate = (time: number) => {
      const deltaSec = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      updatePhysics(deltaSec);

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    // ─── 8. Input Event Handlers ──────────────────────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      startRotation.current = { yaw: playerYaw.current, pitch: playerPitch.current };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      playerYaw.current = startRotation.current.yaw - dx * 0.0035;
      playerPitch.current = Math.max(
        -Math.PI / 4,
        Math.min(Math.PI / 4, startRotation.current.pitch - dy * 0.0035)
      );
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("resize", handleResize);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [places, shaderStyle, timeOfDay, focalLengthMm, getToneMode, onPlayerMove]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#faf9f6]">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Dynamic Manga Onomatopoeia Bubble anchored in 3D space */}
      {activeBubble && (
        <div
          onClick={() => onSelectPlace(activeBubble.id)}
          style={{
            left: `${activeBubble.screenX}px`,
            top: `${activeBubble.screenY}px`,
            transform: "translate(-50%, -100%)",
          }}
          className="absolute z-20 cursor-pointer transition-transform hover:scale-105"
        >
          <div
            style={{ backgroundColor: activeBubble.color }}
            className="px-3 py-1.5 rounded-none border-2 border-black shadow-[3px_3px_0px_#000] text-black font-black uppercase text-xs tracking-wider flex items-center gap-1.5 animate-bounce"
          >
            <span className="text-[10px] bg-black text-white px-1 py-0.2">
              {activeBubble.distanceM}m
            </span>
            <span>{activeBubble.sound}!</span>
            <span className="font-bold opacity-90">{activeBubble.name}</span>
          </div>
          {/* Comic speech bubble tail */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black mx-auto" />
        </div>
      )}

      {/* First-person control overlay hint */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm border border-stone-800 px-3 py-1.5 text-[11px] font-mono text-stone-800 shadow-[2px_2px_0px_#000] flex items-center gap-3">
        <span className="font-bold bg-stone-900 text-white px-1.5 py-0.5">WASD / ARROWS</span>
        <span>Walk along street</span>
        <span className="text-stone-300">|</span>
        <span className="font-bold bg-stone-900 text-white px-1.5 py-0.5">DRAG</span>
        <span>Look 360°</span>
        <span className="text-stone-300">|</span>
        <span className="text-stone-500">1.65m Eye Level</span>
      </div>
    </div>
  );
};
