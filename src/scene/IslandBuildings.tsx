import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RoundedBox, useCursor } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type IslandZone = 'gallery' | 'studio' | 'lab' | 'terminal';
type V3 = [number, number, number];

export interface IslandBuildingsProps {
  clay: boolean;
  reducedMotion?: boolean;
  onSelect?: (zone: IslandZone) => void;
}

const NO_RAYCAST = () => undefined;
const HIT_SIZE: Record<IslandZone, V3> = {
  gallery: [5.75, 3.7, 4.4], studio: [3.08, 2.65, 2.98],
  lab: [5.4, 2.8, 5.4], terminal: [2.33, 2.12, 1.87],
};

function dampProgress(current: number, target: number, delta: number) {
  const next = THREE.MathUtils.damp(current, target, 9, Math.min(delta, 0.05));
  return Math.abs(next - target) < 0.0003 ? target : next;
}

function HoverDetail({ at, rotation = [0, 0, 0], active, reducedMotion, lift = 0.06, turn = 0.3, scale = 1.04, children }: {
  at: V3; rotation?: V3; active: boolean; reducedMotion: boolean; lift?: number; turn?: number; scale?: number; children: ReactNode;
}) {
  const detail = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [active, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    if (!detail.current) return;
    const target = active && !reducedMotion ? 1 : 0;
    progress.current = reducedMotion ? 0 : dampProgress(progress.current, target, delta);
    detail.current.position.y = at[1] + lift * progress.current;
    detail.current.rotation.y = rotation[1] + turn * progress.current;
    detail.current.scale.setScalar(1 + (scale - 1) * progress.current);
    if (progress.current !== target) invalidate();
  });
  return <group ref={detail} position={at} rotation={rotation}>{children}</group>;
}

interface Palette {
  wall: string;
  stone: string;
  blue: string;
  dark: string;
  metal: string;
  wood: string;
  paper: string;
  glass: string;
  foliage: string;
}

const COLOR: Palette = {
  wall: '#f0e7d2', stone: '#c9c2a9', blue: '#9bbfc0', dark: '#667c70',
  metal: '#c0b18a', wood: '#c7a77f', paper: '#fff6df', glass: '#e2ca91', foliage: '#91ab85',
};
const CLAY: Palette = {
  wall: '#e4e3df', stone: '#bebfbc', blue: '#a5aaa9', dark: '#777f7f',
  metal: '#a2a8a6', wood: '#c3c0b8', paper: '#eeede8', glass: '#c9cfce', foliage: '#a9b0a8',
};

function Block({
  size, at = [0, 0, 0], rotation, color, glow = false, active = false,
}: {
  size: V3; at?: V3; rotation?: V3; color: string; glow?: boolean; active?: boolean;
}) {
  return (
    <RoundedBox
      args={size}
      position={at}
      rotation={rotation}
      radius={Math.min(0.065, ...size.map((value) => value * 0.23))}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={glow ? 0.36 : 0.68}
        metalness={glow ? 0.15 : 0.04}
        emissive={glow ? color : '#000000'}
        emissiveIntensity={glow ? active ? 0.36 : 0.055 : 0}
      />
    </RoundedBox>
  );
}

function Cylinder({
  radii, height, at, color, rotation, active = false, glow = false,
}: {
  radii: [number, number]; height: number; at: V3; color: string; rotation?: V3; active?: boolean; glow?: boolean;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[...radii, height, 48]} />
      <meshStandardMaterial color={color} roughness={0.58} metalness={0.12} emissive={glow ? color : '#000000'} emissiveIntensity={glow ? active ? 0.3 : 0.04 : 0} />
    </mesh>
  );
}

function StoneArch({ at, radius, opening, spring, depth, color, rotation }: {
  at: V3; radius: number; opening: number; spring: number; depth: number; color: string; rotation?: V3;
}) {
  const geometry = useMemo(() => {
    const outline = new THREE.Shape();
    outline.moveTo(-radius, -0.05);
    outline.lineTo(-radius, spring);
    outline.absarc(0, spring, radius, Math.PI, 0, true);
    outline.lineTo(radius, -0.05);
    outline.closePath();
    const aperture = new THREE.Path();
    aperture.moveTo(-opening, 0.025);
    aperture.lineTo(opening, 0.025);
    aperture.lineTo(opening, spring);
    aperture.absarc(0, spring, opening, 0, Math.PI, false);
    aperture.closePath();
    outline.holes.push(aperture);
    const arch = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 28 });
    arch.translate(0, 0, -depth / 2);
    return arch;
  }, [radius, opening, spring, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={at} rotation={rotation} castShadow receiveShadow>
    <meshStandardMaterial color={color} roughness={0.9} />
  </mesh>;
}

function Plant({ at, p, scale = 1 }: { at: V3; p: Palette; scale?: number }) {
  return <group position={at} scale={scale}>
    <Cylinder radii={[0.17, 0.13]} height={0.25} at={[0, 0.125, 0]} color={p.wood} />
    <mesh position={[0, 0.37, 0]} scale={[0.8, 1.2, 0.85]} castShadow>
      <icosahedronGeometry args={[0.2, 1]} /><meshStandardMaterial color={p.foliage} roughness={0.92} />
    </mesh>
    <mesh position={[0.1, 0.29, 0.035]} scale={[0.75, 1, 0.85]} castShadow>
      <icosahedronGeometry args={[0.135, 0]} /><meshStandardMaterial color={p.foliage} roughness={0.92} />
    </mesh>
  </group>;
}

function WarmLamp({ at, p, clay, active = false, scale = 1 }: { at: V3; p: Palette; clay: boolean; active?: boolean; scale?: number }) {
  return <group position={at} scale={scale}>
    <Cylinder radii={[0.13, 0.14]} height={0.035} at={[0, 0.018, 0]} color={p.metal} />
    <Cylinder radii={[0.018, 0.018]} height={0.35} at={[0, 0.2, 0]} color={p.wood} />
    <mesh position={[0, 0.43, 0]} castShadow>
      <coneGeometry args={[0.19, 0.2, 12]} /><meshStandardMaterial color={p.paper} roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.345, 0]}>
      <sphereGeometry args={[0.058, 12, 8]} />
      <meshStandardMaterial color={p.glass} emissive={clay ? '#000000' : '#e6bb70'} emissiveIntensity={clay ? 0 : active ? 1.1 : 0.7} roughness={0.6} />
    </mesh>
  </group>;
}

function CaseBoard({ at, p, active, variant = 0 }: { at: V3; p: Palette; active: boolean; variant?: number }) {
  return <group position={at}>
    <Block size={[1.62, 1.2, 0.095]} color={p.wood} />
    <Block size={[1.48, 1.06, 0.025]} at={[0, 0, 0.06]} color={p.paper} />
    <Block size={[0.74, 0.065, 0.025]} at={[-0.25, 0.37, 0.082]} color={p.dark} />
    <Block size={[0.5, 0.03, 0.025]} at={[-0.37, 0.23, 0.082]} color={p.stone} />
    <Block size={[0.62, 0.49, 0.025]} at={[-0.36, -0.14, 0.082]} color={variant ? p.foliage : p.blue} />
    <mesh position={[-0.36, -0.12, 0.115]}>
      <torusGeometry args={[0.15, 0.035, 8, 32]} />
      <meshStandardMaterial color={p.paper} roughness={0.7} />
    </mesh>
    <Block size={[0.43, 0.22, 0.025]} at={[0.31, -0.01, 0.082]} color={p.wall} />
    <Block size={[0.33, 0.035, 0.025]} at={[0.27, 0.035, 0.099]} color={p.wood} />
    <Block size={[0.22, 0.035, 0.025]} at={[0.215, -0.06, 0.099]} color={p.stone} />
    <Block size={[0.43, 0.15, 0.025]} at={[0.31, -0.28, 0.083]} color={p.glass} glow active={active} />
  </group>;
}

function Interactive({
  zone, at, onSelect, children, reducedMotion,
}: {
  zone: IslandZone; at: V3; onSelect?: (zone: IslandZone) => void; children: (active: boolean) => ReactNode; reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const visual = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const { invalidate } = useThree();
  const hitSize = HIT_SIZE[zone];
  useCursor(hovered && Boolean(onSelect));
  useEffect(() => { invalidate(); }, [hovered, reducedMotion, invalidate]);
  // The static hit volume is the only raycastable part. Moving geometry must not
  // move its own hover boundary and create an over/out/invalidate feedback loop.
  useLayoutEffect(() => {
    visual.current?.traverse((object) => { object.raycast = NO_RAYCAST; });
  });
  useFrame((_, delta) => {
    if (!visual.current) return;
    const target = hovered && !reducedMotion ? 1 : 0;
    progress.current = reducedMotion ? 0 : dampProgress(progress.current, target, delta);
    visual.current.position.y = progress.current * 0.12;
    visual.current.scale.setScalar(1 + progress.current * 0.015);
    if (progress.current !== target) invalidate();
  });
  const enter = (event: ThreeEvent<PointerEvent>) => {
    if (event.pointerType === 'touch' || event.buttons > 0) return;
    event.stopPropagation();
    setHovered(true);
  };
  const leave = () => setHovered(false);
  return (
    <group
      name={`island-${zone}`}
      userData={{ zone }}
      position={at}
    >
      <mesh
        name={`${zone}-stationary-hit-volume`}
        position={[0, hitSize[1] / 2, zone === 'gallery' ? 0.12 : 0]}
        onPointerOver={enter}
        onPointerOut={leave}
        onPointerDown={() => setHovered(false)}
        onClick={(event) => { if (event.delta > 4) return; event.stopPropagation(); onSelect?.(zone); }}
      >
        <boxGeometry args={hitSize} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
      <group ref={visual} raycast={NO_RAYCAST}>{children(hovered)}</group>
    </group>
  );
}


type DetailKind = 'box' | 'cylinder' | 'sphere' | 'torus' | 'cone';
type DetailPart = { kind: DetailKind; at: V3; size: V3; color: string; rotation?: V3 };
type DetailObject = { name: string; parts: DetailPart[] };
type DetailAssets = { geometry: Record<DetailKind, THREE.BufferGeometry>; material: THREE.MeshStandardMaterial };

function makeDetailLayout(zone: IslandZone, p: Palette) {
  const objects: DetailObject[] = [];
  const item = (kind: DetailKind, at: V3, size: V3, color: keyof Palette, rotation?: V3): DetailPart => ({ kind, at, size, color: p[color], rotation });
  const box = (at: V3, size: V3, color: keyof Palette, rotation?: V3) => item('box', at, size, color, rotation);
  const cylinder = (at: V3, size: V3, color: keyof Palette, rotation?: V3) => item('cylinder', at, size, color, rotation);
  const sphere = (at: V3, size: V3, color: keyof Palette, rotation?: V3) => item('sphere', at, size, color, rotation);
  const ring = (at: V3, size: V3, color: keyof Palette, rotation?: V3) => item('torus', at, size, color, rotation);
  const cone = (at: V3, size: V3, color: keyof Palette, rotation?: V3) => item('cone', at, size, color, rotation);
  const add = (name: string, ...parts: DetailPart[]) => objects.push({ name, parts });
  const rod = (a: V3, b: V3, width: number, color: keyof Palette) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
    return cylinder(start.add(end).multiplyScalar(0.5).toArray() as V3, [width, direction.length(), width], color, [rotation.x, rotation.y, rotation.z]);
  };
  const book = (name: string, at: V3, width: number, depth: number, height: number, color: keyof Palette, angle = 0) => {
    const [x, y, z] = at;
    add(name, box([x, y, z], [width, height, depth], color, [0, angle, 0]),
      box([x, y + height * 0.03, z + 0.006], [width * 0.93, height * 0.65, depth * 0.98], 'paper', [0, angle, 0]),
      box([x, y + height * 0.51, z], [width, 0.009, depth], color, [0, angle, 0]));
  };
  const envelope = (name: string, at: V3, angle = 0) => {
    const [x, y, z] = at;
    add(name, box(at, [0.2, 0.012, 0.13], 'paper', [0, angle, 0]),
      box([x - 0.035, y + 0.009, z], [0.11, 0.005, 0.006], 'wood', [0, -0.56 + angle, 0]),
      box([x + 0.035, y + 0.009, z], [0.11, 0.005, 0.006], 'wood', [0, 0.56 + angle, 0]));
  };
  const vine = (name: string, points: V3[]) => add(name,
    ...points.slice(1).map((point, index) => rod(points[index], point, 0.014, 'dark')),
    ...points.map(([x, y, z], index) => sphere([x + (index % 2 ? 0.035 : -0.035), y, z + 0.025], [0.11, 0.045, 0.075], 'foliage', [0.2, index * 0.8, 0.3])),
  );
  const lantern = (name: string, at: V3) => {
    const [x, y, z] = at;
    add(name, rod([x, y + 0.17, z], [x, y + 0.4, z], 0.012, 'wood'),
      cylinder(at, [0.15, 0.19, 0.15], 'glass'),
      cone([x, y + 0.13, z], [0.2, 0.075, 0.2], 'wood'),
      cylinder([x, y - 0.115, z], [0.18, 0.035, 0.18], 'wood'),
      ...[0, 1, 2, 3].map((index) => cylinder([x + Math.cos(index * Math.PI / 2) * 0.078, y, z + Math.sin(index * Math.PI / 2) * 0.078], [0.012, 0.22, 0.012], 'wood')));
  };

  if (zone === 'studio') {
    for (let index = 0; index < 7; index++) {
      add(`roof shingle ${index + 1}`, box([-0.91, 2.365, -1.08 + index * 0.36], [0.96, 0.026, 0.34], 'wood', [0, 0, 0.21]));
    }
    for (let index = 0; index < 6; index++) {
      const z = -1.04 + index * 0.43;
      add(`exposed roof tenon ${index + 1}`, box([-1.43, 2.11, z], [0.12, 0.1, 0.13], 'wood'), cylinder([-1.498, 2.11, z], [0.025, 0.025, 0.025], 'metal', [0, 0, Math.PI / 2]));
    }
    add('back-wall display shelf', box([-0.7, 1.83, -0.92], [0.77, 0.055, 0.22], 'wood'), box([-0.97, 1.74, -0.98], [0.035, 0.19, 0.15], 'wood'), box([-0.43, 1.74, -0.98], [0.035, 0.19, 0.15], 'wood'));
    for (let index = 0; index < 6; index++) {
      book(`workshop reference book ${index + 1}`, [-0.98 + index * 0.105, 1.96 + index % 2 * 0.018, -0.92], 0.075, 0.15, 0.21 + index % 3 * 0.025, index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'foliage' : 'paper');
    }
    add('open sketchbook', box([-0.58, 1.064, 0.005], [0.38, 0.023, 0.24], 'wood'),
      box([-0.674, 1.082, 0.005], [0.178, 0.012, 0.22], 'paper', [0, 0, -0.045]), box([-0.486, 1.082, 0.005], [0.178, 0.012, 0.22], 'paper', [0, 0, 0.045]),
      box([-0.675, 1.091, -0.025], [0.11, 0.004, 0.007], 'blue'), box([-0.48, 1.091, 0.025], [0.09, 0.004, 0.007], 'stone'));
    for (let index = 0; index < 6; index++) {
      const x = -0.99 + index % 3 * 0.19, y = 1.42 + Math.floor(index / 3) * 0.21;
      add(`pinned process note ${index + 1}`, box([x, y, -1.025], [0.15, 0.17, 0.012], index % 3 === 1 ? 'glass' : 'paper', [0, 0, (index % 2 ? 1 : -1) * 0.04]), sphere([x, y + 0.055, -1.011], [0.025, 0.025, 0.018], 'wood'), box([x, y - 0.01, -1.014], [0.08, 0.012, 0.008], 'stone'));
    }
    add('pencil cup', cylinder([0.37, 1.115, -0.61], [0.13, 0.15, 0.13], 'wall'), cylinder([0.37, 1.195, -0.61], [0.1, 0.012, 0.1], 'dark'));
    for (let index = 0; index < 5; index++) {
      const x = 0.335 + index * 0.018;
      add(`pencil ${index + 1}`, cylinder([x, 1.285 + index % 2 * 0.035, -0.625 + index % 2 * 0.035], [0.014, 0.21, 0.014], index % 2 ? 'blue' : 'wood', [0, 0, (index - 2) * 0.06]), cone([x + (2 - index) * 0.006, 1.402 + index % 2 * 0.035, -0.625 + index % 2 * 0.035], [0.014, 0.025, 0.014], 'dark'));
    }
    for (let index = 0; index < 2; index++) add(`paint brush ${index + 1}`, cylinder([0.36 + index * 0.045, 1.3, -0.57], [0.012, 0.23, 0.012], 'wood', [0.03, 0, 0.1 - index * 0.18]), sphere([0.35 + index * 0.067, 1.43, -0.57], [0.025, 0.07, 0.025], 'dark'));
    add('ruler with graduation marks', box([-0.6, 1.104, 0.074], [0.31, 0.009, 0.035], 'wood', [0, 0.08, 0]), ...Array.from({ length: 7 }, (_, index) => box([-0.73 + index * 0.04, 1.111, 0.071], [0.006, 0.004, index % 2 ? 0.013 : 0.022], 'dark')));
    for (let index = 0; index < 3; index++) add(`pigment bottle ${index + 1}`, cylinder([-0.75 + index * 0.105, 1.11, -0.59], [0.058, 0.09, 0.058], index % 2 ? 'blue' : 'foliage'), cylinder([-0.75 + index * 0.105, 1.17, -0.59], [0.042, 0.03, 0.042], 'paper'));
    add('tea mug', cylinder([0.24, 1.115, 0.005], [0.1, 0.12, 0.1], 'wall'), cylinder([0.24, 1.178, 0.005], [0.075, 0.008, 0.075], 'wood'), ring([0.3, 1.12, 0.005], [0.07, 0.08, 0.045], 'wall'));
    add('headphones on desk edge', ring([0.89, 1.18, -0.12], [0.16, 0.2, 0.15], 'dark', [0, Math.PI / 2, 0]), box([0.89, 1.11, -0.19], [0.08, 0.1, 0.06], 'wood'), box([0.89, 1.11, -0.05], [0.08, 0.1, 0.06], 'wood'));
    add('compact camera', box([-0.82, 1.145, -0.11], [0.18, 0.12, 0.09], 'dark'), cylinder([-0.82, 1.145, -0.045], [0.075, 0.055, 0.075], 'metal', [Math.PI / 2, 0, 0]), cylinder([-0.82, 1.145, -0.014], [0.052, 0.008, 0.052], 'dark', [Math.PI / 2, 0, 0]), box([-0.87, 1.214, -0.11], [0.035, 0.018, 0.03], 'glass'));
    add('woven rug under chair', box([0.21, 0.275, 0.72], [1.18, 0.014, 0.85], 'blue'), ...Array.from({ length: 9 }, (_, index) => box([-0.31 + index * 0.13, 0.285, 0.72], [0.017, 0.005, 0.79], 'paper')));
    add('open storage basket', box([1.05, 0.4, -0.08], [0.28, 0.25, 0.29], 'wood'), box([1.05, 0.53, -0.08], [0.23, 0.009, 0.23], 'dark'), ring([1.05, 0.46, 0.079], [0.14, 0.07, 0.04], 'wood'));
    for (let index = 0; index < 3; index++) add(`stored paper roll ${index + 1}`, cylinder([0.98 + index * 0.07, 0.61 + index % 2 * 0.035, -0.08], [0.047, 0.3, 0.047], 'paper'), ring([0.98 + index * 0.07, 0.765 + index % 2 * 0.035, -0.08], [0.04, 0.04, 0.04], 'wood', [Math.PI / 2, 0, 0]));
    add('canvas shoulder bag', box([1.19, 1.02, 1.02], [0.23, 0.29, 0.08], 'wood'), ring([1.19, 1.235, 1.02], [0.14, 0.19, 0.06], 'dark'), box([1.19, 1.03, 1.068], [0.12, 0.12, 0.018], 'paper'));
    add('wood and brass wind chime', cylinder([0.94, 1.95, 0.94], [0.15, 0.025, 0.15], 'wood'), rod([0.94, 1.96, 0.94], [0.94, 2.2, 0.94], 0.009, 'wood'), ...[0, 1, 2].map((index) => cylinder([0.89 + index * 0.05, 1.79 - index % 2 * 0.05, 0.94], [0.018, 0.2, 0.018], 'glass')), sphere([0.94, 1.64, 0.94], [0.06, 0.06, 0.06], 'glass'));
    add('tiny windowsill plant', cylinder([-1.01, 1.43, 0.57], [0.12, 0.12, 0.12], 'wall'), sphere([-1.01, 1.57, 0.57], [0.16, 0.2, 0.14], 'foliage'));
    for (let index = 0; index < 2; index++) add(`under-desk storage box ${index + 1}`, box([-0.51, 0.37 + index * 0.15, -0.36], [0.34, 0.13, 0.3], index ? 'wall' : 'wood'), box([-0.51, 0.38 + index * 0.15, -0.199], [0.1, 0.025, 0.02], 'metal'));
    for (let index = 0; index < 2; index++) add(`easel paper clamp ${index + 1}`, box([-1.11 + index * 0.39, 1.49, 0.79], [0.045, 0.055, 0.035], 'metal'));
  }

  if (zone === 'gallery') {
    for (let board = 0; board < 2; board++) {
      const x = board ? 0.91 : -1.01;
      for (let index = 0; index < 2; index++) add(`display ${board + 1} binder clip ${index + 1}`, box([x - 0.53 + index * 1.06, 2.14, -1.225], [0.08, 0.085, 0.06], 'metal'), ring([x - 0.53 + index * 1.06, 2.2, -1.225], [0.05, 0.07, 0.04], 'metal'));
      for (let index = 0; index < 4; index++) {
        const px = x - 0.66 + index % 2 * 1.32, py = 1.07 + Math.floor(index / 2) * 0.93;
        add(`display ${board + 1} raised pin ${index + 1}`, cylinder([px, py, -1.19], [0.025, 0.035, 0.025], 'metal', [Math.PI / 2, 0, 0]), sphere([px, py, -1.165], [0.04, 0.04, 0.025], 'glass'));
      }
      add(`display ${board + 1} inset mounting frame`, box([x, 2.125, -1.243], [1.51, 0.026, 0.024], 'metal'), box([x, 0.935, -1.243], [1.51, 0.026, 0.024], 'metal'));
    }
    for (let index = 0; index < 3; index++) add(`recessed exhibition light ${index + 1}`, box([-1.2 + index * 1.2, 2.755, -1.25], [0.64, 0.035, 0.08], 'wood'), box([-1.2 + index * 1.2, 2.731, -1.25], [0.54, 0.015, 0.052], 'glass'));
    add('small-sample display shelf', box([-2.05, 0.76, -0.42], [0.42, 0.07, 0.85], 'wood'), box([-2.05, 0.51, -0.42], [0.29, 0.45, 0.65], 'wall'));
    for (let index = 0; index < 3; index++) add(`small interface sample ${index + 1}`, box([-2.05, 1.03, -0.69 + index * 0.27], [0.3, 0.44, 0.045], 'wood', [0, -0.15 + index * 0.07, 0]), box([-2.05, 1.03, -0.66 + index * 0.27], [0.24, 0.36, 0.025], index % 2 ? 'blue' : 'paper'), box([-2.05, 0.93, -0.642 + index * 0.27], [0.13, 0.025, 0.015], 'glass'));
    for (let index = 0; index < 3; index++) add(`prototype storage case ${index + 1}`, box([-0.43 + index * 0.44, 0.43, -1.08], [0.34, 0.28, 0.31], index % 2 ? 'wood' : 'wall'), box([-0.43 + index * 0.44, 0.586, -1.08], [0.37, 0.035, 0.34], 'paper'), box([-0.43 + index * 0.44, 0.45, -0.916], [0.1, 0.035, 0.022], 'metal'));
    for (let index = 0; index < 3; index++) add(`work-sequence maquette ${index + 1}`, cylinder([2.12, 0.43, -0.69 + index * 0.47], [0.29, 0.28, 0.29], 'wall'), box([2.12, 0.69, -0.69 + index * 0.47], [0.18, 0.2 + index * 0.03, 0.16], index % 2 ? 'blue' : 'foliage', [0.1, index * 0.25, 0.1]));
    for (let index = 0; index < 3; index++) add(`prototype table tactile dial ${index + 1}`, cylinder([0.93 + index * 0.17, 1.038, 0.64], [0.065, 0.035, 0.065], 'glass'), box([0.93 + index * 0.17, 1.06, 0.64], [0.007, 0.005, 0.02], 'dark'));
    for (let index = 0; index < 4; index++) add(`prototype side button ${index + 1}`, box([1.57, 1.025, 0.03 + index * 0.13], [0.08, 0.022, 0.075], index === 0 ? 'blue' : 'paper'));
    add('swatch tray on bench', box([-1.59, 0.85, 0.65], [0.25, 0.035, 0.32], 'wood'), box([-1.59, 0.876, 0.55], [0.19, 0.016, 0.06], 'blue'), box([-1.59, 0.876, 0.65], [0.19, 0.016, 0.06], 'foliage'), box([-1.59, 0.876, 0.75], [0.19, 0.016, 0.06], 'glass'));
    for (let index = 0; index < 5; index++) {
      const angle = Math.PI / 6 + index * Math.PI / 6;
      add(`arch voussoir joint ${index + 1}`, box([Math.cos(angle) * 1.285, 1.54 + Math.sin(angle) * 1.285, 1.49], [0.014, 0.23, 0.014], 'stone', [0, 0, angle - Math.PI / 2]));
    }
    for (let side = -1; side <= 1; side += 2) for (let index = 0; index < 3; index++) add(`arch pier course ${side}-${index}`, box([side * 1.285, 0.55 + index * 0.31, 1.49], [0.25, 0.012, 0.014], 'stone'));
    for (let index = 0; index < 4; index++) add(`pergola pegged joint ${index + 1}`, cylinder([2.22, 2.73, -1.25 + index * 0.83], [0.045, 0.07, 0.045], 'metal', [0, 0, Math.PI / 2]));
    lantern('gallery hanging lantern', [2.14, 2.36, 0.89]);
    vine('left arch climbing vine', [[-2.34, 1.22, 0.78], [-2.35, 1.47, 0.82], [-2.35, 1.73, 0.77], [-2.34, 1.98, 0.6], [-2.32, 2.19, 0.4]]);
    vine('back pergola trailing vine', [[1.6, 2.86, -1.24], [1.76, 2.83, -1.24], [1.89, 2.72, -1.24], [1.99, 2.54, -1.24]]);
    for (let index = 0; index < 2; index++) add(`stone threshold inlay ${index + 1}`, box([-0.46 + index * 0.92, 0.086, 2.02], [0.24, 0.012, 0.27], 'paper'));
  }

  if (zone === 'terminal') {
    for (let index = 0; index < 8; index++) {
      const row = Math.floor(index / 4), x = -0.75 + index % 4 * 0.13;
      add(`reading-room book spine ${index + 1}`, box([x, 0.83 + row * 0.38, -0.31], [0.085, 0.25 + index % 2 * 0.035, 0.17], index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'paper' : 'foliage'), box([x, 0.84 + row * 0.38, -0.216], [0.055, 0.018, 0.008], 'glass'));
    }
    for (let index = 0; index < 5; index++) envelope(`unsent envelope ${index + 1}`, [-0.73 + index % 2 * 0.03, 1.46 + index * 0.013, -0.3], (index - 2) * 0.07);
    add('open reading book', box([-0.38, 0.7, 0.39], [0.37, 0.027, 0.24], 'blue'), box([-0.47, 0.72, 0.39], [0.17, 0.015, 0.22], 'paper', [0, 0, -0.05]), box([-0.29, 0.72, 0.39], [0.17, 0.015, 0.22], 'paper', [0, 0, 0.05]), box([-0.3, 0.73, 0.39], [0.014, 0.005, 0.24], 'glass'));
    for (let index = 0; index < 3; index++) add(`ribbon bookmark ${index + 1}`, box([-0.62 + index * 0.11, 1.45, -0.2], [0.025, 0.015, 0.16 + index * 0.02], index % 2 ? 'blue' : 'glass'));
    for (let index = 0; index < 2; index++) add(`letter storage box ${index + 1}`, box([-0.88, 0.34 + index * 0.19, 0.47], [0.25, 0.17, 0.28], index ? 'wall' : 'wood'), box([-0.88, 0.35 + index * 0.19, 0.618], [0.09, 0.025, 0.02], 'metal'));
    add('mailbox raised letter-slot border', box([0.58, 0.801, 0.586], [0.23, 0.045, 0.025], 'wood'), box([0.58, 0.801, 0.602], [0.18, 0.014, 0.012], 'dark'), box([0.59, 0.794, 0.62], [0.15, 0.012, 0.05], 'paper', [0.13, 0, 0]));
    for (let index = 0; index < 2; index++) add(`mailbox hinge ${index + 1}`, cylinder([0.41 + index * 0.34, 0.935, 0.36], [0.035, 0.07, 0.035], 'metal', [Math.PI / 2, 0, 0]));
    add('mailbox flag hinge washer', cylinder([0.813, 0.98, 0.442], [0.055, 0.027, 0.055], 'glass', [Math.PI / 2, 0, 0]));
    lantern('quiet-corner hanging lantern', [0.76, 1.4, 0.51]);
    for (let index = 0; index < 2; index++) add(`bench cushion piping ${index + 1}`, box([-0.55 + index * 0.34, 0.662, 0.37], [0.3, 0.038, 0.32], index ? 'wall' : 'foliage'), ...[-1, 1].map((side) => box([-0.55 + index * 0.34, 0.684, 0.37 + side * 0.14], [0.27, 0.007, 0.01], 'paper')));
    add('hanging fern pot', cylinder([-0.92, 1.43, 0.45], [0.16, 0.14, 0.16], 'wood'), rod([-0.99, 1.51, 0.45], [-0.92, 1.83, 0.45], 0.008, 'wood'), rod([-0.85, 1.51, 0.45], [-0.92, 1.83, 0.45], 0.008, 'wood'), ...[0, 1, 2, 3].map((index) => sphere([-0.92 + Math.cos(index * 1.6) * 0.08, 1.52, 0.45 + Math.sin(index * 1.6) * 0.08], [0.13, 0.09, 0.07], 'foliage', [0, index * 1.6, 0])));
    for (let index = 0; index < 2; index++) add(`notice-board paper tab ${index + 1}`, box([0.19 + index * 0.33, 1.17, -0.393], [0.13, 0.12, 0.018], index ? 'glass' : 'blue', [0, 0, index ? 0.09 : -0.08]), sphere([0.19 + index * 0.33, 1.205, -0.377], [0.024, 0.024, 0.019], 'wood'));
    for (let index = 0; index < 5; index++) add(`pergola front end cap ${index + 1}`, box([-0.9 + index * 0.45, 1.87, 0.776], [0.13, 0.14, 0.065], 'wall'), cylinder([-0.9 + index * 0.45, 1.87, 0.817], [0.025, 0.018, 0.025], 'wood', [Math.PI / 2, 0, 0]));
    for (let index = 0; index < 6; index++) add(`shelter mortise peg ${index + 1}`, cylinder([-0.91 + index % 2 * 1.82, 0.69 + Math.floor(index / 2) * 0.51, -0.52], [0.03, 0.026, 0.03], 'metal', [Math.PI / 2, 0, 0]));
    vine('shelter trailing vine', [[-0.82, 1.91, 0.61], [-0.66, 1.91, 0.64], [-0.54, 1.8, 0.65], [-0.54, 1.65, 0.65]]);
    add('spare paper scroll', cylinder([-0.73, 0.72, 0.4], [0.05, 0.22, 0.05], 'paper', [0, 0, Math.PI / 2]), ring([-0.844, 0.72, 0.4], [0.04, 0.04, 0.04], 'wood', [0, Math.PI / 2, 0]));
    add('woven entrance mat', box([0.07, 0.225, 0.7], [0.63, 0.015, 0.16], 'wood'), ...[0, 1, 2, 3, 4].map((index) => box([-0.17 + index * 0.12, 0.236, 0.7], [0.015, 0.005, 0.14], 'paper')));
    add('reading-corner cup', cylinder([-0.09, 0.7, 0.4], [0.07, 0.09, 0.07], 'wall'), ring([-0.045, 0.71, 0.4], [0.045, 0.06, 0.035], 'wall'));
  }

  if (zone === 'lab') {
    const stations: V3[] = [[2.2, 0.05, 0.2], [-1.02, 0.05, 2], [-1.18, 0.05, -1.87]];
    stations.forEach(([x, y, z], station) => {
      add(`station ${station + 1} engraved dial scale`, ...Array.from({ length: 8 }, (_, index) => {
        const angle = index * Math.PI / 4;
        return box([x + Math.cos(angle) * 0.345, y + 0.211, z + Math.sin(angle) * 0.345], [0.045, 0.008, 0.012], 'wood', [0, -angle, 0]);
      }));
      add(`station ${station + 1} front inset plate`, box([x, y + 0.11, z + 0.406], [0.23, 0.065, 0.017], 'wood'), box([x - 0.035, y + 0.11, z + 0.419], [0.1, 0.012, 0.009], 'paper'));
      for (let index = 0; index < 4; index++) {
        const angle = Math.PI / 4 + index * Math.PI / 2;
        add(`station ${station + 1} rim fastener ${index + 1}`, cylinder([x + Math.cos(angle) * 0.385, y + 0.215, z + Math.sin(angle) * 0.385], [0.027, 0.018, 0.027], 'metal'), box([x + Math.cos(angle) * 0.385, y + 0.227, z + Math.sin(angle) * 0.385], [0.015, 0.005, 0.004], 'dark', [0, angle, 0]));
      }
      for (let index = 0; index < 3; index++) add(`station ${station + 1} feedback button ${index + 1}`, sphere([x - 0.075 + index * 0.075, y + 0.145, z + 0.42], [0.035, 0.035, 0.023], index === station ? 'glass' : 'blue'));
      add(`station ${station + 1} cable groove`, box([x - 0.23, y + 0.1, z + 0.3], [0.025, 0.018, 0.19], 'dark', [0, -0.55, 0]), cylinder([x - 0.19, y + 0.1, z + 0.345], [0.032, 0.025, 0.032], 'wood', [Math.PI / 2, 0, 0]));
      add(`station ${station + 1} inset connector`, cylinder([x + 0.18, y + 0.1, z + 0.355], [0.052, 0.027, 0.052], 'metal', [Math.PI / 2, 0, 0]), cylinder([x + 0.18, y + 0.1, z + 0.375], [0.025, 0.009, 0.025], 'dark', [Math.PI / 2, 0, 0]));
      add(`station ${station + 1} stone corner bumper`, sphere([x + 0.29, y + 0.11, z - 0.25], [0.07, 0.09, 0.07], 'paper'));
    });
    add('elastic-ball seating ring', ring([2.2, 0.262, 0.2], [0.53, 0.53, 0.09], 'wood', [Math.PI / 2, 0, 0]));
    add('turntable index pointer', cone([-1.02, 0.285, 2.35], [0.065, 0.08, 0.055], 'glass', [Math.PI / 2, 0, 0]));
    add('lever pivot collar', ring([-1.18, 0.365, -1.87], [0.1, 0.1, 0.08], 'metal'), cylinder([-1.18, 0.365, -1.815], [0.045, 0.025, 0.045], 'glass', [Math.PI / 2, 0, 0]));
  }
  return { objects, parts: objects.flatMap((object) => object.parts) };
}

function DetailBatch({ geometry, material, parts }: { geometry: THREE.BufferGeometry; material: THREE.Material; parts: DetailPart[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    parts.forEach((part, index) => {
      transform.position.set(...part.at);
      transform.rotation.set(...(part.rotation ?? [0, 0, 0]));
      transform.scale.set(...part.size);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
      mesh.current!.setColorAt(index, color.set(part.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [geometry, material, parts]);
  return <instancedMesh ref={mesh} args={[geometry, material, parts.length]} raycast={NO_RAYCAST} castShadow receiveShadow />;
}

function BuildingDetails({ zone, p, assets }: { zone: IslandZone; p: Palette; assets: DetailAssets }) {
  const layout = useMemo(() => makeDetailLayout(zone, p), [zone, p]);
  const batches = useMemo(() => (Object.keys(assets.geometry) as DetailKind[]).map((kind) => ({ kind, parts: layout.parts.filter((part) => part.kind === kind) })), [assets, layout]);
  return <group name={`${zone}-fine-details`} userData={{ detailObjects: layout.objects.length, detailPrimitives: layout.parts.length, inventory: layout.objects.map((object) => object.name) }}>
    {batches.filter((batch) => batch.parts.length > 0).map((batch) => <DetailBatch key={batch.kind} geometry={assets.geometry[batch.kind]} material={assets.material} parts={batch.parts} />)}
  </group>;
}

function Gallery({ p, clay, active, reducedMotion }: { p: Palette; clay: boolean; active: boolean; reducedMotion: boolean }) {
  return <>
    <Block size={[5.5, 0.2, 3.75]} at={[0, 0.1, 0]} color={p.stone} />
    <Block size={[5.14, 0.08, 3.35]} at={[0, 0.24, 0]} color={p.wall} />
    <Block size={[3.0, 0.08, 0.48]} at={[0, 0.04, 2.02]} color={p.stone} />
    <StoneArch at={[0, 0.29, 1.31]} radius={1.42} opening={1.15} spring={1.25} depth={0.29} color={p.wall} />
    <StoneArch at={[-2.22, 0.29, -0.03]} radius={1.15} opening={0.9} spring={1.18} depth={0.24} rotation={[0, Math.PI / 2, 0]} color={p.wall} />
    <Block size={[0.4, 0.14, 0.37]} at={[0, 2.99, 1.31]} color={p.paper} />
    <Block size={[4.78, 1.51, 0.17]} at={[0, 1.035, -1.44]} color={p.wall} />
    <Block size={[4.8, 0.15, 0.25]} at={[0, 1.84, -1.44]} color={p.paper} />

    <Block size={[0.11, 2.51, 0.11]} at={[2.22, 1.54, 1.31]} color={p.wood} />
    <Block size={[0.11, 2.51, 0.11]} at={[2.22, 1.54, -1.32]} color={p.wood} />
    <Block size={[4.47, 0.14, 0.16]} at={[0.03, 2.84, -1.31]} color={p.wood} />
    <Block size={[0.16, 0.14, 2.96]} at={[2.22, 2.84, 0]} color={p.wood} />
    {[1.35, 1.63, 1.91].map((x) => <Block key={x} size={[0.065, 0.075, 2.87]} at={[x, 2.85, 0]} color={p.wood} />)}
    <Block size={[0.12, 0.69, 0.12]} at={[2.01, 2.52, 1.14]} rotation={[0, 0, -0.55]} color={p.wood} />

    <CaseBoard at={[-1.01, 1.53, -1.3]} p={p} active={active} />
    <CaseBoard at={[0.91, 1.53, -1.3]} p={p} active={active} variant={1} />
    <Block size={[0.07, 1.51, 0.07]} at={[-1.01, 1.01, -1.35]} color={p.wood} />
    <Block size={[0.07, 1.51, 0.07]} at={[0.91, 1.01, -1.35]} color={p.wood} />

    <Block size={[1.02, 0.13, 0.8]} at={[1.25, 0.95, 0.32]} color={p.wood} />
    <Block size={[0.68, 0.6, 0.54]} at={[1.25, 0.58, 0.32]} color={p.wall} />
    <HoverDetail at={[1.25, 1.49, 0.3]} rotation={[-0.14, -0.13, 0.03]} active={active} reducedMotion={reducedMotion} lift={0.06} turn={0.16} scale={1.035}>
      <Block size={[0.55, 0.87, 0.09]} color={p.paper} />
      <Block size={[0.45, 0.72, 0.025]} at={[0, 0.01, 0.06]} color={p.blue} />
      <Cylinder radii={[0.12, 0.12]} height={0.022} at={[0, 0.14, 0.085]} rotation={[Math.PI / 2, 0, 0]} color={p.paper} />
      <Block size={[0.27, 0.035, 0.025]} at={[0, -0.115, 0.08]} color={p.paper} />
      <Block size={[0.19, 0.03, 0.025]} at={[0, -0.2, 0.08]} color={p.paper} />
      <Block size={[0.2, 0.085, 0.025]} at={[0, -0.295, 0.08]} color={p.glass} glow active={active} />
    </HoverDetail>

    <Block size={[1.52, 0.13, 0.48]} at={[-1.05, 0.76, 0.64]} color={p.wood} />
    <Block size={[0.1, 0.39, 0.36]} at={[-1.59, 0.51, 0.64]} color={p.stone} />
    <Block size={[0.1, 0.39, 0.36]} at={[-0.5, 0.51, 0.64]} color={p.stone} />
    <group position={[-1.02, 0.85, 0.64]} rotation={[0, 0.12, 0]}>
      <Block size={[0.58, 0.035, 0.3]} color={p.foliage} />
      <Block size={[0.25, 0.02, 0.27]} at={[-0.13, 0.025, 0]} rotation={[0, 0, -0.035]} color={p.paper} />
      <Block size={[0.25, 0.02, 0.27]} at={[0.13, 0.025, 0]} rotation={[0, 0, 0.035]} color={p.paper} />
    </group>
    <Plant at={[-2.08, 0.28, 1.21]} p={p} scale={1.1} />
    <Plant at={[2.14, 0.28, 0.67]} p={p} scale={0.9} />
    <WarmLamp at={[-1.97, 1.93, -1.28]} p={p} clay={clay} active={active} scale={0.7} />
  </>;
}

function Studio({ p, clay, active, reducedMotion }: { p: Palette; clay: boolean; active: boolean; reducedMotion: boolean }) {
  return <>
    <Block size={[2.88, 0.18, 2.76]} at={[0, 0.09, 0]} color={p.stone} />
    <Block size={[2.61, 0.08, 2.46]} at={[0, 0.22, 0]} color={p.wood} />
    <Block size={[2.57, 1.67, 0.13]} at={[0, 1.09, -1.11]} color={p.wall} />
    <Block size={[0.13, 1.73, 2.28]} at={[-1.23, 1.12, -0.02]} color={p.wall} />
    {[-1.22, 0, 1.22].map((x) => <Block key={x} size={[0.09, 1.9, 0.11]} at={[x, 1.2, -1.02]} color={p.wood} />)}
    <Block size={[2.67, 0.13, 0.18]} at={[0, 2.18, -1.03]} color={p.wood} />
    <Block size={[0.1, 1.91, 0.1]} at={[1.23, 1.21, 1.08]} color={p.wood} />
    <Block size={[0.1, 0.13, 2.35]} at={[1.23, 2.2, -0.02]} color={p.wood} />
    <Block size={[1.03, 0.14, 2.58]} at={[-0.91, 2.25, -0.01]} rotation={[0, 0, 0.21]} color={p.wood} />
    <group position={[-0.91, 2.34, -0.01]} rotation={[0, 0, 0.21]}>
      {[-0.34, -0.17, 0, 0.17, 0.34].map((x) => <Block key={x} size={[0.018, 0.018, 2.46]} at={[x, 0, 0]} color={p.metal} />)}
    </group>

    <Block size={[1.79, 0.12, 0.74]} at={[0.03, 0.98, -0.32]} color={p.wood} />
    {[-0.7, 0.76].map((x) => <Block key={x} size={[0.075, 0.66, 0.56]} at={[x, 0.59, -0.32]} color={p.wood} />)}
    <Block size={[0.085, 0.18, 0.08]} at={[-0.13, 1.11, -0.53]} color={p.metal} />
    <Block size={[0.39, 0.035, 0.21]} at={[-0.13, 1.06, -0.5]} color={p.metal} />
    <Block size={[0.83, 0.56, 0.065]} at={[-0.13, 1.41, -0.55]} color={p.paper} />
    <Block size={[0.73, 0.46, 0.02]} at={[-0.13, 1.41, -0.505]} color={p.blue} />
    <Block size={[0.23, 0.33, 0.02]} at={[-0.34, 1.41, -0.49]} color={p.paper} />
    <Block size={[0.27, 0.04, 0.02]} at={[-0.015, 1.51, -0.49]} color={p.paper} />
    <Block size={[0.22, 0.035, 0.02]} at={[-0.04, 1.39, -0.49]} color={p.paper} />
    <Block size={[0.45, 0.03, 0.18]} at={[-0.1, 1.06, -0.04]} color={p.stone} />
    <WarmLamp at={[0.65, 1.04, -0.53]} p={p} clay={clay} active={active} scale={0.75} />

    <HoverDetail at={[0.59, 1.065, -0.02]} rotation={[0, -0.16, 0]} active={active} reducedMotion={reducedMotion} lift={0.035} turn={0.16}>
      <Block size={[0.27, 0.045, 0.26]} color={p.foliage} />
      <Block size={[0.24, 0.035, 0.23]} at={[0.01, 0.04, 0]} color={p.paper} />
      <Block size={[0.25, 0.025, 0.24]} at={[0.005, 0.075, -0.01]} rotation={[0, 0.09, 0]} color={p.glass} />
    </HoverDetail>
    <Cylinder radii={[0.044, 0.044]} height={0.33} at={[-0.64, 1.09, -0.25]} rotation={[0, 0, Math.PI / 2]} color={p.paper} />
    <Cylinder radii={[0.047, 0.047]} height={0.27} at={[-0.64, 1.1, -0.4]} rotation={[0, 0, Math.PI / 2]} color={p.wall} />

    <group position={[0.57, 1.55, -1.01]}>
      <Block size={[0.84, 0.67, 0.045]} color={p.wood} />
      <Block size={[0.28, 0.41, 0.025]} at={[-0.18, 0.025, 0.035]} rotation={[0, 0, -0.07]} color={p.paper} />
      <Block size={[0.25, 0.27, 0.025]} at={[0.17, 0.09, 0.04]} rotation={[0, 0, 0.06]} color={p.blue} />
      <Block size={[0.19, 0.14, 0.025]} at={[0.17, -0.15, 0.04]} color={p.foliage} />
    </group>

    <Cylinder radii={[0.26, 0.26]} height={0.1} at={[0.07, 0.62, 0.65]} color={p.foliage} />
    <Cylinder radii={[0.045, 0.045]} height={0.3} at={[0.07, 0.42, 0.65]} color={p.wood} />
    <Block size={[0.54, 0.055, 0.08]} at={[0.07, 0.29, 0.65]} color={p.wood} />
    <Block size={[0.08, 0.055, 0.51]} at={[0.07, 0.29, 0.65]} color={p.wood} />
    <Block size={[0.46, 0.46, 0.1]} at={[0.07, 0.9, 0.91]} rotation={[-0.1, 0, 0]} color={p.foliage} />

    <group position={[-0.91, 0.26, 0.76]} rotation={[0, -0.13, 0]}>
      <Block size={[0.045, 1.23, 0.045]} at={[-0.22, 0.62, 0]} rotation={[0, 0, -0.13]} color={p.wood} />
      <Block size={[0.045, 1.23, 0.045]} at={[0.22, 0.62, 0]} rotation={[0, 0, 0.13]} color={p.wood} />
      <Block size={[0.62, 0.055, 0.09]} at={[0, 0.4, 0.04]} color={p.wood} />
      <Block size={[0.61, 0.72, 0.045]} at={[0, 0.91, 0]} rotation={[-0.1, 0, 0]} color={p.paper} />
      <Block size={[0.27, 0.035, 0.025]} at={[-0.08, 1.1, 0.06]} color={p.blue} />
      <mesh position={[0, 0.89, 0.065]}>
        <torusGeometry args={[0.14, 0.025, 8, 28]} /><meshStandardMaterial color={p.glass} roughness={0.8} />
      </mesh>
    </group>
    <Plant at={[0.98, 0.27, 0.74]} p={p} scale={0.85} />
  </>;
}

function Laboratory({ p, clay, active, reducedMotion }: { p: Palette; clay: boolean; active: boolean; reducedMotion: boolean }) {
  const ball = useRef<THREE.Group>(null);
  const turntable = useRef<THREE.Group>(null);
  const lever = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const strength = useRef(0);
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [active, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    if (!ball.current || !turntable.current || !lever.current) return;
    if (reducedMotion) {
      ball.current.position.y = 0;
      ball.current.scale.set(1, 1, 1);
      turntable.current.rotation.y = 0;
      lever.current.rotation.z = -0.22;
      phase.current = 0;
      strength.current = 0;
      return;
    }
    strength.current = dampProgress(strength.current, active ? 1 : 0, delta);
    if (active || strength.current > 0) phase.current += Math.min(delta, 0.05);
    const bounce = Math.sin(phase.current * 3.1);
    ball.current.position.y = (bounce * 0.045 + 0.055) * strength.current;
    ball.current.scale.set(1 + bounce * 0.035 * strength.current, 1 - bounce * 0.055 * strength.current, 1 + bounce * 0.035 * strength.current);
    lever.current.rotation.z = -0.22 + Math.sin(phase.current * 2) * 0.27 * strength.current;
    const restAngle = Math.round(turntable.current.rotation.y / (Math.PI * 2)) * Math.PI * 2;
    if (active) turntable.current.rotation.y += Math.min(delta, 0.05) * 0.35;
    else turntable.current.rotation.y = dampProgress(turntable.current.rotation.y, restAngle, delta);
    if (active || strength.current > 0 || turntable.current.rotation.y !== restAngle) invalidate();
    else { phase.current = 0; turntable.current.rotation.y = 0; }
  });
  return <>
    {/* These collars sit on the three .86-wide pads supplied by the landscape. */}
    {([[2.2, 0.05, 0.2], [-1.02, 0.05, 2], [-1.18, 0.05, -1.87]] as V3[]).map((at, index) => <group key={index} position={at}>
      <Cylinder radii={[0.39, 0.41]} height={0.12} at={[0, 0.11, 0]} color={p.wall} />
      <Cylinder radii={[0.4, 0.4]} height={0.035} at={[0, 0.1875, 0]} color={p.paper} />
    </group>)}

    <group position={[2.2, 0.515, 0.2]}><group ref={ball}>
      <mesh castShadow>
        <sphereGeometry args={[0.26, 20, 14]} />
        <meshStandardMaterial color={p.blue} roughness={0.64} emissive={clay ? '#000000' : p.blue} emissiveIntensity={active ? 0.1 : 0.015} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.245, 0]}>
        <torusGeometry args={[0.18, 0.018, 8, 32]} /><meshStandardMaterial color={p.glass} roughness={0.65} />
      </mesh>
    </group></group>

    <group position={[-1.02, 0.285, 2]} ref={turntable}>
      <Cylinder radii={[0.34, 0.34]} height={0.06} at={[0, 0, 0]} color={p.wood} />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <torusGeometry args={[0.235, 0.022, 8, 40]} /><meshStandardMaterial color={p.glass} roughness={0.65} />
      </mesh>
      {[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * 0.23, 0.11, Math.sin(index * Math.PI / 2) * 0.23]} castShadow>
        <sphereGeometry args={[0.066, 10, 8]} /><meshStandardMaterial color={index % 2 ? p.foliage : p.paper} roughness={0.8} />
      </mesh>)}
      <Cylinder radii={[0.075, 0.075]} height={0.095} at={[0, 0.075, 0]} color={p.blue} />
    </group>

    <group position={[-1.18, 0.2875, -1.87]}>
      <Block size={[0.55, 0.065, 0.38]} color={p.wood} />
      <Block size={[0.21, 0.025, 0.27]} at={[0, 0.045, 0]} color={p.dark} />
      <group ref={lever} rotation={[0, 0, -0.22]} position={[0, 0.08, 0]}>
        <Cylinder radii={[0.025, 0.025]} height={0.31} at={[0, 0.155, 0]} color={p.metal} />
        <mesh position={[0, 0.33, 0]} castShadow>
          <sphereGeometry args={[0.085, 12, 8]} /><meshStandardMaterial color={p.glass} roughness={0.7} />
        </mesh>
      </group>
      <Block size={[0.06, 0.035, 0.08]} at={[0.19, 0.045, 0]} color={p.glass} glow active={active} />
    </group>
  </>;
}

function Terminal({ p, clay, active }: { p: Palette; clay: boolean; active: boolean }) {
  return <>
    <Block size={[2.15, 0.15, 1.65]} at={[0, 0.075, 0]} color={p.stone} />
    <Block size={[1.96, 0.065, 1.45]} at={[0, 0.18, 0]} color={p.wall} />
    {[-0.91, 0.91].map((x) => <Block key={x} size={[0.075, 1.55, 0.075]} at={[x, 0.98, -0.57]} color={p.wood} />)}
    <Block size={[2.08, 0.13, 0.28]} at={[0, 1.81, -0.61]} color={p.wood} />
    <Block size={[2.08, 0.13, 0.28]} at={[0, 1.81, 0.61]} color={p.wood} />
    {[-0.9, -0.45, 0, 0.45, 0.9].map((x) => <Block key={x} size={[0.1, 0.11, 1.48]} at={[x, 1.87, 0]} color={p.wood} />)}
    <Block size={[0.075, 1.55, 0.075]} at={[0.91, 0.98, 0.57]} color={p.wood} />

    <group position={[-0.52, 0.23, -0.39]}>
      <Block size={[0.7, 1.21, 0.14]} at={[0, 0.61, -0.07]} color={p.wood} />
      {[-0.33, 0.33].map((x) => <Block key={x} size={[0.06, 1.23, 0.32]} at={[x, 0.62, 0.02]} color={p.wood} />)}
      {[0.07, 0.43, 0.82, 1.2].map((y) => <Block key={y} size={[0.7, 0.055, 0.37]} at={[0, y, 0.02]} color={p.wood} />)}
      {[0, 1, 2, 3, 4].map((index) => <Block key={index} size={[0.085, 0.24 + index % 2 * 0.045, 0.18]} at={[-0.24 + index * 0.12, 0.23, 0.06]} rotation={[0, 0, index === 4 ? -0.12 : 0]} color={index % 2 ? p.foliage : p.paper} />)}
      <Block size={[0.3, 0.05, 0.2]} at={[-0.12, 0.88, 0.06]} color={p.blue} />
      <Block size={[0.26, 0.04, 0.19]} at={[-0.1, 0.93, 0.06]} color={p.paper} />
    </group>
    <group position={[0.38, 1.13, -0.47]}>
      <Block size={[0.78, 0.66, 0.065]} color={p.wood} />
      <Block size={[0.29, 0.45, 0.02]} at={[-0.16, 0.01, 0.045]} rotation={[0, 0, -0.06]} color={p.paper} />
      <Block size={[0.28, 0.38, 0.02]} at={[0.16, -0.01, 0.055]} rotation={[0, 0, 0.08]} color={p.paper} />
      <Block size={[0.16, 0.025, 0.02]} at={[-0.16, 0.11, 0.065]} color={p.foliage} />
      <Block size={[0.15, 0.025, 0.02]} at={[0.16, 0.04, 0.075]} color={p.blue} />
    </group>

    <Block size={[0.83, 0.1, 0.43]} at={[-0.39, 0.58, 0.37]} color={p.wood} />
    {[-0.68, -0.1].map((x) => <Block key={x} size={[0.075, 0.33, 0.32]} at={[x, 0.37, 0.37]} color={p.wood} />)}
    <Block size={[0.44, 0.055, 0.35]} at={[-0.38, 0.655, 0.37]} color={p.foliage} />
    <Block size={[0.34, 0.35, 0.32]} at={[0.58, 0.73, 0.39]} color={p.wall} />
    <Block size={[0.39, 0.065, 0.36]} at={[0.58, 0.94, 0.39]} rotation={[0.06, 0, 0]} color={p.foliage} />
    <Block size={[0.18, 0.025, 0.025]} at={[0.58, 0.8, 0.565]} color={p.dark} />
    <Block size={[0.055, 0.31, 0.035]} at={[0.79, 0.93, 0.42]} color={p.wood} />
    <Block size={[0.14, 0.085, 0.035]} at={[0.85, 1.04, 0.42]} color={p.glass} glow active={active} />
    <WarmLamp at={[0.62, 1.48, -0.48]} p={p} clay={clay} scale={0.62} active={active} />
  </>;
}

export function IslandBuildings({ clay, onSelect, reducedMotion = false }: IslandBuildingsProps) {
  const p = clay ? CLAY : COLOR;
  const assets = useMemo<DetailAssets>(() => ({
    geometry: {
      box: new RoundedBoxGeometry(1, 1, 1, 1, 0.055),
      cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      sphere: new THREE.IcosahedronGeometry(0.5, 1),
      torus: new THREE.TorusGeometry(0.5, 0.055, 6, 20),
      cone: new THREE.ConeGeometry(0.5, 1, 8),
    },
    material: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0.025 }),
  }), []);
  useEffect(() => () => { Object.values(assets.geometry).forEach((geometry) => geometry.dispose()); assets.material.dispose(); }, [assets]);
  return <group name="island-buildings">
    <Interactive zone="gallery" at={[0, 0.1, -1.2]} onSelect={onSelect} reducedMotion={reducedMotion}>
      {(active) => <><Gallery p={p} clay={clay} active={active} reducedMotion={reducedMotion} /><BuildingDetails zone="gallery" p={p} assets={assets} /></>}
    </Interactive>
    <Interactive zone="studio" at={[-5.8, 0.1, 0.3]} onSelect={onSelect} reducedMotion={reducedMotion}>
      {(active) => <><Studio p={p} clay={clay} active={active} reducedMotion={reducedMotion} /><BuildingDetails zone="studio" p={p} assets={assets} /></>}
    </Interactive>
    <Interactive zone="lab" at={[5.8, 0.1, 0.9]} onSelect={onSelect} reducedMotion={reducedMotion}>
      {(active) => <><Laboratory p={p} clay={clay} active={active} reducedMotion={reducedMotion} /><BuildingDetails zone="lab" p={p} assets={assets} /></>}
    </Interactive>
    <Interactive zone="terminal" at={[2, 0.1, -5.3]} onSelect={onSelect} reducedMotion={reducedMotion}>
      {(active) => <><Terminal p={p} clay={clay} active={active} /><BuildingDetails zone="terminal" p={p} assets={assets} /></>}
    </Interactive>
  </group>;
}

export default IslandBuildings;
