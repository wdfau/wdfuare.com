import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type V3 = [number, number, number];
type Shape = 'box' | 'soft' | 'cylinder' | 'orb' | 'cone' | 'ring' | 'handle' | 'flag';
type Tone = 'wood' | 'woodDark' | 'woodLight' | 'cream' | 'paper' | 'sage' | 'green' | 'pot' | 'cloth' | 'blue' | 'ink' | 'gold' | 'pink' | 'glass';
type Placement = { at: V3; size: V3; rotation: V3 };
type DetailBatch = { shape: Shape; tone: Tone; items: Placement[] };
const NO_RAYCAST = () => undefined;

function Instances({ geometry, material, items, name }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Placement[]; name: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D();
    items.forEach((item, index) => {
      object.position.set(...item.at);
      object.rotation.set(...item.rotation);
      object.scale.set(...item.size);
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [geometry, material, items]);
  return <instancedMesh ref={mesh} name={name} args={[geometry, material, items.length]} castShadow receiveShadow raycast={NO_RAYCAST} />;
}

function makeLife() {
  const batches = new Map<string, DetailBatch>();
  const add = (shape: Shape, tone: Tone, at: V3, size: V3, rotation: V3 = [0, 0, 0]) => {
    const key = `${shape}-${tone}`;
    if (!batches.has(key)) batches.set(key, { shape, tone, items: [] });
    batches.get(key)!.items.push({ at, size, rotation });
  };
  const box = (tone: Tone, at: V3, size: V3, rotation?: V3) => add('box', tone, at, size, rotation);
  const soft = (tone: Tone, at: V3, size: V3, rotation?: V3) => add('soft', tone, at, size, rotation);
  const cyl = (tone: Tone, at: V3, size: V3, rotation?: V3) => add('cylinder', tone, at, size, rotation);
  const orb = (tone: Tone, at: V3, size: V3, rotation?: V3) => add('orb', tone, at, size, rotation);
  const ring = (tone: Tone, at: V3, size: V3, rotation: V3 = [Math.PI / 2, 0, 0]) => add('ring', tone, at, size, rotation);
  const line = (tone: Tone, a: V3, b: V3, width: number) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
    cyl(tone, start.add(end).multiplyScalar(0.5).toArray() as V3, [width, direction.length(), width], [rotation.x, rotation.y, rotation.z]);
  };
  const book = (at: V3, size = 1, tone: Tone = 'sage', turn = 0) => {
    const [x, y, z] = at;
    soft('paper', [x, y, z], [0.25 * size, 0.045 * size, 0.19 * size], [0, turn, 0]);
    box(tone, [x, y - 0.027 * size, z], [0.27 * size, 0.012 * size, 0.205 * size], [0, turn, 0]);
    box(tone, [x, y + 0.027 * size, z], [0.27 * size, 0.012 * size, 0.205 * size], [0, turn, 0]);
    box('gold', [x - 0.08 * size, y + 0.035 * size, z], [0.018 * size, 0.008, 0.16 * size], [0, turn, 0]);
  };
  const openBook = (at: V3, size = 1) => {
    const [x, y, z] = at;
    box('woodDark', [x, y - 0.018, z], [0.43 * size, 0.018, 0.25 * size]);
    box('paper', [x - 0.106 * size, y + 0.008, z], [0.21 * size, 0.028, 0.24 * size], [0, 0, 0.09]);
    box('paper', [x + 0.106 * size, y + 0.008, z], [0.21 * size, 0.028, 0.24 * size], [0, 0, -0.09]);
    for (let i = 0; i < 4; i++) {
      box('sage', [x - 0.105 * size, y + 0.03, z - 0.075 * size + i * 0.045 * size], [0.13 * size, 0.003, 0.008 * size]);
      box('sage', [x + 0.105 * size, y + 0.03, z - 0.075 * size + i * 0.045 * size], [0.13 * size, 0.003, 0.008 * size]);
    }
  };
  const cup = ([x, y, z]: V3, tone: Tone = 'cream', size = 1) => {
    cyl(tone, [x, y + 0.055 * size, z], [0.095 * size, 0.11 * size, 0.095 * size]);
    cyl('woodDark', [x, y + 0.112 * size, z], [0.073 * size, 0.005, 0.073 * size]);
    add('ring', tone, [x + 0.064 * size, y + 0.065 * size, z], [0.075 * size, 0.075 * size, 0.075 * size], [0, 0, 0]);
  };
  const lantern = ([x, y, z]: V3, size = 1) => {
    soft('cream', [x, y + 0.12 * size, z], [0.16 * size, 0.21 * size, 0.16 * size]);
    box('woodDark', [x, y, z], [0.19 * size, 0.03, 0.19 * size]);
    add('cone', 'gold', [x, y + 0.255 * size, z], [0.23 * size, 0.1 * size, 0.23 * size]);
    add('handle', 'woodDark', [x, y + 0.31 * size, z], [0.12 * size, 0.12 * size, 0.12 * size]);
    for (const dx of [-0.07, 0.07]) box('woodDark', [x + dx * size, y + 0.12 * size, z + 0.08 * size], [0.012, 0.21 * size, 0.012]);
  };
  const pot = ([x, y, z]: V3, size = 1, tone: Tone = 'pot') => {
    cyl(tone, [x, y + 0.085 * size, z], [0.19 * size, 0.17 * size, 0.19 * size]);
    ring(tone, [x, y + 0.17 * size, z], [0.2 * size, 0.2 * size, 0.2 * size]);
    cyl('woodDark', [x, y + 0.17 * size, z], [0.145 * size, 0.006, 0.145 * size]);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.25;
      orb(i % 2 ? 'green' : 'sage', [x + Math.cos(a) * 0.045 * size, y + 0.27 * size, z + Math.sin(a) * 0.045 * size], [0.095 * size, 0.23 * size, 0.08 * size], [Math.cos(a) * 0.44, a, Math.sin(a) * 0.44]);
    }
  };
  const basket = ([x, y, z]: V3, size = 1) => {
    cyl('woodLight', [x, y + 0.1 * size, z], [0.28 * size, 0.2 * size, 0.28 * size]);
    ring('woodDark', [x, y + 0.2 * size, z], [0.29 * size, 0.29 * size, 0.29 * size]);
    add('handle', 'woodDark', [x, y + 0.19 * size, z], [0.29 * size, 0.29 * size, 0.29 * size]);
    for (let i = 0; i < 3; i++) ring('wood', [x, y + (0.045 + i * 0.05) * size, z], [0.285 * size, 0.285 * size, 0.285 * size]);
    soft('cloth', [x, y + 0.18 * size, z], [0.2 * size, 0.12 * size, 0.17 * size], [0.1, 0.3, 0.1]);
  };
  const crate = ([x, y, z]: V3, size = 1) => {
    box('woodDark', [x, y + 0.03 * size, z], [0.4 * size, 0.06 * size, 0.3 * size]);
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) box('wood', [x, y + (0.09 + i * 0.06) * size, z + side * 0.145 * size], [0.4 * size, 0.04 * size, 0.025]);
      for (const side of [-1, 1]) box('woodLight', [x + side * 0.19 * size, y + (0.09 + i * 0.06) * size, z], [0.025, 0.04 * size, 0.27 * size]);
    }
  };
  const table = ([x, y, z]: V3, width: number, depth: number, height: number) => {
    for (let i = 0; i < 4; i++) box('woodLight', [x - width / 2 + width * (i + 0.5) / 4, y + height, z], [width / 4 - 0.014, 0.065, depth]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('wood', [x + sx * width * 0.4, y + height / 2, z + sz * depth * 0.34], [0.065, height, 0.065]);
    box('woodDark', [x, y + height * 0.35, z], [width * 0.8, 0.055, 0.055]);
  };
  const stool = ([x, y, z]: V3, tone: Tone = 'woodLight') => {
    cyl(tone, [x, y + 0.32, z], [0.34, 0.065, 0.34]);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      line('woodDark', [x + Math.cos(a) * 0.11, y, z + Math.sin(a) * 0.11], [x + Math.cos(a) * 0.09, y + 0.3, z + Math.sin(a) * 0.09], 0.04);
    }
    soft('cloth', [x, y + 0.37, z], [0.27, 0.065, 0.27]);
  };
  const roll = ([x, y, z]: V3, size = 1) => {
    cyl('paper', [x, y, z], [0.09 * size, 0.3 * size, 0.09 * size], [0, 0, Math.PI / 2]);
    cyl('woodDark', [x + 0.152 * size, y, z], [0.036 * size, 0.003, 0.036 * size], [0, 0, Math.PI / 2]);
    ring('gold', [x, y, z], [0.095 * size, 0.095 * size, 0.095 * size], [0, Math.PI / 2, 0]);
  };

  // Arrival: a light garland and lanterns frame the path without occupying it.
  for (const x of [-1.12, 1.12]) {
    cyl('wood', [x, 1.03, 6.7], [0.09, 1.86, 0.09]);
    orb('gold', [x, 1.99, 6.7], [0.13, 0.13, 0.13]);
    lantern([x, 0.12, 6.7], 0.9);
  }
  const garland = Array.from({ length: 13 }, (_, i): V3 => {
    const f = i / 12;
    return [-1.12 + 2.24 * f, 1.94 - Math.sin(f * Math.PI) * 0.19, 6.7];
  });
  garland.slice(1).forEach((p, i) => line('woodDark', garland[i], p, 0.012));
  for (let i = 0; i < 7; i++) {
    const f = (i + 1) / 8;
    add('flag', i % 3 === 0 ? 'pink' : i % 2 ? 'cloth' : 'cream', [-1.12 + 2.24 * f, 1.94 - Math.sin(f * Math.PI) * 0.19, 6.7], [0.22, 0.24, 1], [0.08, 0, i % 2 ? 0.035 : -0.035]);
  }
  pot([1.48, 0.1, 6.84], 1.4, 'cream');
  basket([-1.48, 0.1, 6.4], 1.15);
  box('woodLight', [1.62, 0.42, 5.92], [0.45, 0.64, 0.4]);
  box('paper', [1.62, 0.77, 5.92], [0.32, 0.035, 0.25]);
  book([1.62, 0.81, 5.92], 0.8, 'sage', -0.12);

  // The research nook: a real arrangement of notes, books, tools and a stool.
  table([-2.8, 0.1, -5.0], 1.28, 0.66, 0.64);
  openBook([-2.95, 0.78, -4.98], 0.95);
  cup([-2.35, 0.77, -4.86], 'blue', 1.1);
  book([-2.42, 0.79, -5.16], 0.9, 'pink', 0.12);
  lantern([-3.25, 0.77, -5.12], 0.6);
  stool([-2.8, 0.1, -4.34]);
  for (const x of [-3.35, -2.25]) box('wood', [x, 1.0, -5.43], [0.05, 1.8, 0.05]);
  box('woodLight', [-2.8, 1.37, -5.43], [1.25, 0.76, 0.055]);
  for (let i = 0; i < 6; i++) {
    const x = -3.18 + (i % 3) * 0.37;
    const y = 1.57 - Math.floor(i / 3) * 0.31;
    box(i % 2 ? 'paper' : 'sage', [x, y, -5.39], [0.26, 0.22, 0.008], [0, 0, (i - 2) * 0.025]);
    orb('gold', [x, y + 0.08, -5.375], [0.025, 0.025, 0.018]);
    box('ink', [x, y, -5.377], [0.16, 0.008, 0.002]);
  }
  crate([-3.6, 0.1, -5.13], 1);
  for (let i = 0; i < 3; i++) book([-3.61, 0.18 + i * 0.058, -5.13], 0.75, i % 2 ? 'blue' : 'sage', i * 0.03);

  // A seedling cabinet and cold frame sit in the shade at the western edge.
  table([-9.8, 0.13, 1.0], 1.1, 0.68, 0.59);
  for (const x of [-10.29, -9.31]) for (const z of [0.72, 1.28]) box('wood', [x, 1.07, z], [0.04, 0.71, 0.04]);
  for (const y of [0.8, 1.39]) box('woodLight', [-9.8, y, 0.72], [1.07, 0.045, 0.045]);
  box('woodLight', [-9.8, 1.42, 1.0], [1.19, 0.045, 0.77], [0.08, 0, 0]);
  box('glass', [-9.8, 1.42, 1.0], [1.04, 0.018, 0.62], [0.08, 0, 0]);
  box('glass', [-9.8, 1.09, 0.735], [0.99, 0.54, 0.012]);
  for (let i = 0; i < 4; i++) pot([-10.13 + i * 0.22, 0.77, 0.97], 0.7, i % 2 ? 'cream' : 'pot');
  crate([-9.8, 0.16, 1.0], 0.95);
  cyl('pot', [-9.2, 0.19, 1.28], [0.16, 0.18, 0.16]);
  line('woodDark', [-9.2, 0.24, 1.28], [-9.12, 0.48, 1.28], 0.018);

  // Work-in-progress shelves beside the studio: tubes, samples and a toolbox.
  for (const x of [-3.51, -2.99]) box('wood', [x, 0.73, -2.15], [0.05, 1.26, 1.08]);
  for (let row = 0; row < 3; row++) {
    const y = 0.24 + row * 0.47;
    box('woodLight', [-3.25, y, -2.15], [0.56, 0.045, 1.1]);
    for (let i = 0; i < 3; i++) roll([-3.23, y + 0.08, -2.49 + i * 0.34], 0.82);
  }
  soft('sage', [-3.25, 1.4, -2.42], [0.37, 0.18, 0.3]);
  add('handle', 'woodDark', [-3.25, 1.5, -2.42], [0.2, 0.17, 0.2]);
  for (let i = 0; i < 4; i++) box(i % 2 ? 'paper' : 'blue', [-3.25, 1.37 + i * 0.022, -1.92], [0.44, 0.015, 0.34], [0, i * 0.03, 0]);

  // East herb stand, with a climbing frame, watering can and labelled pots.
  table([9.7, 0.1, -1.8], 1.05, 0.61, 0.58);
  for (let i = 0; i < 3; i++) {
    pot([9.38 + i * 0.3, 0.73, -1.77], 0.85, i === 1 ? 'cream' : 'pot');
    box('paper', [9.38 + i * 0.3, 0.95, -1.75], [0.055, 0.055, 0.008]);
  }
  for (let i = 0; i < 5; i++) box('wood', [9.3 + i * 0.2, 1.0, -2.08], [0.027, 1.48, 0.027]);
  for (let i = 0; i < 5; i++) box('woodLight', [9.7, 0.38 + i * 0.23, -2.08], [0.9, 0.025, 0.025]);
  for (let i = 0; i < 10; i++) orb(i % 3 ? 'green' : 'sage', [9.36 + (i % 3) * 0.23, 0.49 + Math.floor(i / 3) * 0.3, -2.055], [0.14, 0.23, 0.065], [0.1, 0.2, i % 2 ? -0.5 : 0.5]);
  cyl('blue', [10.15, 0.23, -1.48], [0.19, 0.25, 0.19]);
  add('handle', 'woodDark', [10.15, 0.42, -1.48], [0.22, 0.22, 0.22]);
  line('blue', [10.2, 0.28, -1.48], [10.38, 0.39, -1.48], 0.045);
  add('cone', 'blue', [10.42, 0.41, -1.48], [0.095, 0.07, 0.095], [0, 0, -Math.PI / 2]);

  // A postcard exchange cabinet belongs to the contact grove.
  box('wood', [4.6, 0.78, -6.0], [1.0, 1.3, 0.52]);
  box('cream', [4.6, 0.82, -5.73], [0.87, 1.12, 0.028]);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const x = 4.31 + col * 0.29, y = 0.49 + row * 0.31;
    box('woodDark', [x, y, -5.7], [0.245, 0.24, 0.02]);
    for (let paper = 0; paper < 3; paper++) box(paper === 2 ? 'sage' : 'paper', [x, y + paper * 0.018, -5.66 - paper * 0.008], [0.205, 0.075, 0.045], [0.1, 0, 0]);
    box('gold', [x, y - 0.075, -5.68], [0.06, 0.015, 0.01]);
  }
  box('woodLight', [4.6, 1.46, -6.0], [1.13, 0.06, 0.65]);
  pot([4.21, 1.5, -6.02], 0.8, 'cream');
  lantern([4.92, 1.5, -6.0], 0.65);
  crate([5.37, 0.1, -5.96], 1.1);

  // A little parasol reading terrace, kept clear of the coast's main path.
  cyl('wood', [5.7, 0.91, 6.7], [0.055, 1.62, 0.055]);
  add('cone', 'cream', [5.7, 1.78, 6.7], [1.75, 0.4, 1.75]);
  ring('wood', [5.7, 1.58, 6.7], [1.73, 1.73, 1.73]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    line('woodLight', [5.7, 1.98, 6.7], [5.7 + Math.cos(a) * 0.83, 1.58, 6.7 + Math.sin(a) * 0.83], 0.012);
  }
  cyl('woodDark', [5.7, 0.45, 6.7], [0.055, 0.68, 0.055]);
  cyl('woodLight', [5.7, 0.76, 6.7], [0.72, 0.065, 0.72]);
  openBook([5.72, 0.815, 6.73], 0.72);
  cup([5.46, 0.8, 6.57], 'blue', 0.8);
  stool([5.14, 0.1, 6.46]);
  stool([6.22, 0.1, 6.96]);
  basket([6.43, 0.1, 6.35], 0.9);

  // Picnic cushions, an open sketchbook, thermos and a woven basket.
  soft('cloth', [-6.0, 0.14, 7.25], [1.28, 0.045, 0.64]);
  for (let i = 0; i < 7; i++) box('cream', [-6.56 + i * 0.185, 0.166, 7.25], [0.038, 0.006, 0.61]);
  soft('pink', [-6.43, 0.22, 7.25], [0.29, 0.11, 0.28], [0, 0.15, 0]);
  soft('sage', [-5.56, 0.22, 7.25], [0.28, 0.11, 0.29], [0, -0.18, 0]);
  openBook([-6.01, 0.2, 7.25], 0.68);
  basket([-6.58, 0.1, 6.96], 0.9);
  cyl('blue', [-5.54, 0.31, 6.98], [0.09, 0.31, 0.09]);
  cyl('woodDark', [-5.54, 0.48, 6.98], [0.085, 0.025, 0.085]);
  cup([-5.76, 0.17, 7.05], 'cream', 0.65);

  // Small wind chimes, hung on the existing pergola rather than another building.
  for (let group = 0; group < 2; group++) {
    const x = -7.5 + group * 2.15;
    cyl('wood', [x, 1.78, 6.44], [0.21, 0.045, 0.21]);
    for (let i = 0; i < 4; i++) {
      const dx = (i - 1.5) * 0.055;
      line('woodDark', [x + dx, 1.76, 6.44], [x + dx, 1.51 - (i % 2) * 0.07, 6.44], 0.006);
      cyl('gold', [x + dx, 1.4 - (i % 2) * 0.07, 6.44], [0.025, 0.24, 0.025]);
    }
    orb('woodDark', [x, 1.39, 6.44], [0.04, 0.04, 0.04]);
  }

  // Three quiet little cats, made from the same small shared geometries.
  [[-8.3, 0.16, 3.1], [-5.0, 0.16, 2.12], [2.85, 0.16, -3.75]].forEach(([x, y, z], index) => {
    const tone: Tone = index === 1 ? 'cream' : 'woodLight';
    orb(tone, [x, y + 0.085, z], [0.34, 0.19, 0.2]);
    orb(tone, [x + 0.14, y + 0.15, z], [0.17, 0.17, 0.16]);
    for (const dz of [-0.048, 0.048]) {
      add('cone', tone, [x + 0.14, y + 0.255, z + dz], [0.072, 0.10, 0.065]);
      orb('ink', [x + 0.218, y + 0.17, z + dz * 0.85], [0.012, 0.019, 0.012]);
      soft(tone, [x + 0.095, y + 0.012, z + dz * 1.2], [0.14, 0.05, 0.055]);
    }
    orb('pink', [x + 0.23, y + 0.145, z], [0.017, 0.017, 0.017]);
    add('handle', tone, [x - 0.18, y + 0.06, z], [0.25, 0.2, 0.2], [Math.PI / 2, -0.5, 0]);
  });

  const result = [...batches.values()];
  return { batches: result, parts: result.reduce((sum, batch) => sum + batch.items.length, 0), vignetteCount: 9 };
}

function Butterflies({ geometry, material, reducedMotion }: { geometry: THREE.BufferGeometry; material: THREE.Material; reducedMotion: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const object = useMemo(() => new THREE.Object3D(), []);
  const time = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const sites: V3[] = useMemo(() => [[-9.6, 0.95, 1.5], [-2.4, 0.65, 5.6], [7.7, 0.8, 2.5], [4.7, 0.8, -5.6], [-6.1, 0.7, 7.1], [-3.1, 1.0, -5.0], [9.5, 1.1, -1.9], [1.7, 0.7, 5.8]], []);
  useLayoutEffect(() => { invalidate(); }, [geometry, material, reducedMotion, invalidate]);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (!reducedMotion) time.current += Math.min(delta, 0.05);
    const t = reducedMotion ? 0 : time.current;
    sites.forEach(([x, y, z], index) => {
      const a = t * 0.7 + index * 1.8;
      const flap = reducedMotion ? 0.38 : Math.sin(t * 5.2 + index) * 0.74;
      for (const side of [-1, 1]) {
        object.position.set(x + Math.cos(a) * 0.13 + side * 0.024, y + Math.sin(a * 1.4) * 0.055, z + Math.sin(a) * 0.12);
        object.rotation.set(0, a, side * (flap + 0.4));
        object.scale.set(0.09, 0.11, 0.09);
        object.updateMatrix();
        mesh.current!.setMatrixAt(index * 2 + (side === -1 ? 0 : 1), object.matrix);
      }
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (!reducedMotion) invalidate();
  });
  return <instancedMesh ref={mesh} name="garden-butterflies" args={[geometry, material, sites.length * 2]} frustumCulled={false} raycast={NO_RAYCAST} />;
}

export default function IslandLife({ clay, reducedMotion }: { clay: boolean; reducedMotion: boolean }) {
  const layout = useMemo(makeLife, []);
  const geometries = useMemo<Record<Shape, THREE.BufferGeometry>>(() => {
    const flag = new THREE.BufferGeometry();
    flag.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3));
    flag.computeVertexNormals();
    return { box: new THREE.BoxGeometry(1, 1, 1), soft: new RoundedBoxGeometry(1, 1, 1, 2, 0.07), cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), orb: new THREE.IcosahedronGeometry(0.5, 1), cone: new THREE.ConeGeometry(0.5, 1, 10), ring: new THREE.TorusGeometry(0.5, 0.055, 5, 18), handle: new THREE.TorusGeometry(0.5, 0.04, 5, 18, Math.PI), flag };
  }, []);
  const materials = useMemo<Record<Tone, THREE.MeshStandardMaterial>>(() => {
    const colors: Record<Tone, string> = { wood: '#b9a07a', woodDark: '#8c7559', woodLight: '#d5c09c', cream: '#f0ead4', paper: '#f5efd8', sage: '#9fb589', green: '#789667', pot: '#c59e7c', cloth: '#bcc8a4', blue: '#9dbbb2', ink: '#5e776c', gold: '#bda768', pink: '#dbb0a6', glass: '#d4e7dc' };
    const clayColors: Record<Tone, string> = { wood: '#b9bdb0', woodDark: '#8f9c90', woodLight: '#d0d3c6', cream: '#e8e9dd', paper: '#f1f0e7', sage: '#bec8b8', green: '#9faa99', pot: '#bdc0b3', cloth: '#c6cebf', blue: '#b7c6bf', ink: '#768e80', gold: '#c5c8b4', pink: '#d3d2c5', glass: '#d8e0d8' };
    return Object.fromEntries(Object.keys(colors).map((key) => {
      const tone = key as Tone;
      const material = new THREE.MeshStandardMaterial({ color: clay ? clayColors[tone] : colors[tone], roughness: tone === 'gold' ? 0.5 : 0.87, metalness: tone === 'gold' ? 0.22 : 0, side: THREE.DoubleSide });
      if (tone === 'glass' && !clay) { material.transparent = true; material.opacity = 0.2; material.depthWrite = false; material.roughness = 0.3; }
      material.side = THREE.DoubleSide;
      return [tone, material];
    })) as Record<Tone, THREE.MeshStandardMaterial>;
  }, [clay]);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  return <group name="island-life" userData={{ detailParts: layout.parts, vignetteCount: layout.vignetteCount }}>
    {layout.batches.map((batch) => <Instances key={`${batch.shape}-${batch.tone}`} geometry={geometries[batch.shape]} material={materials[batch.tone]} items={batch.items} name={`life-${batch.shape}-${batch.tone}`} />)}
    <Butterflies geometry={geometries.flag} material={materials.cream} reducedMotion={reducedMotion} />
  </group>;
}
