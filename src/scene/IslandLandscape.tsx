import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type Triple = [number, number, number];
type Placement = { position: Triple; scale?: Triple; rotation?: Triple };

function Batch({ geometry, material, items, castShadow = true }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    items.forEach((item, index) => {
      transform.position.set(...item.position);
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]));
      transform.scale.set(...(item.scale ?? [1, 1, 1]));
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry, material, items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />;
}

function WindBatch({ geometry, material, items, reducedMotion, foliage = false }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Placement[];
  reducedMotion: boolean;
  foliage?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    items.forEach((item, index) => {
      transform.position.set(...item.position);
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]));
      transform.scale.set(...(item.scale ?? [1, 1, 1]));
      transform.updateMatrix();
      ref.current?.setMatrixAt(index, transform.matrix);
    });
    if (ref.current) {
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    }
    invalidate();
  }, [geometry, material, items, reducedMotion, transform, invalidate]);
  useFrame((state) => {
    if (reducedMotion || !ref.current) return;
    const time = state.clock.elapsedTime;
    items.forEach((item, index) => {
      const rotation = item.rotation ?? [0, 0, 0];
      const breeze = Math.sin(time * 0.55 + index * 0.91);
      transform.position.set(...item.position);
      transform.rotation.set(rotation[0] + breeze * (foliage ? 0.008 : 0.035), rotation[1], rotation[2] + breeze * (foliage ? 0.012 : 0.045));
      transform.scale.set(...(item.scale ?? [1, 1, 1]));
      transform.updateMatrix();
      ref.current!.setMatrixAt(index, transform.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    state.invalidate();
  });
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={foliage} receiveShadow />;
}

function branch(a: Triple, b: Triple, diameter: number): Placement {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
  return {
    position: start.add(end).multiplyScalar(0.5).toArray() as Triple,
    scale: [diameter, direction.length(), diameter],
    rotation: [rotation.x, rotation.y, rotation.z],
  };
}

function islandShape(scale = 1) {
  const anchors = [
    [11.7, 0], [10.3, 4.7], [6, 8], [2.5, 8.45], [0, 7.98],
    [-2.8, 8.6], [-6, 7.8], [-10, 5.1], [-11.75, 0.15],
    [-10.3, -4.85], [-6, -7.8], [-0.45, -8.85], [5.4, -8.1], [10, -5.2],
  ];
  const curve = new THREE.CatmullRomCurve3(
    anchors.map(([x, z]) => new THREE.Vector3(x * scale, -z * scale, 0)),
    true, 'catmullrom', 0.25,
  );
  return new THREE.Shape(curve.getPoints(60).map((point) => new THREE.Vector2(point.x, point.y)));
}

function segment(a: [number, number], b: [number, number], width: number, y = 0.135, height = 0.07): Placement {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return {
    position: [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2],
    scale: [width, height, Math.hypot(dx, dz) + width * 0.25],
    rotation: [0, Math.atan2(dx, dz), 0],
  };
}

function grassGeometry() {
  const vertices: number[] = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = blade * Math.PI / 3;
    const x = Math.cos(angle) * 0.09;
    const z = Math.sin(angle) * 0.09;
    vertices.push(-x, 0, -z, x, 0, z, x * 0.7 + 0.035, 0.28 + blade * 0.035, z * 0.7);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function detailGeometry(kind: 'ribbon' | 'fern' | 'daisy' | 'bell' | 'spike' | 'leaf') {
  const vertices: number[] = [];
  const tri = (a: Triple, b: Triple, c: Triple) => vertices.push(...a, ...b, ...c);
  if (kind === 'ribbon') {
    for (let blade = 0; blade < 7; blade++) {
      const angle = blade * 2.399;
      const height = 0.3 + (blade % 3) * 0.11;
      const point = (t: number, side: number): Triple => {
        const width = 0.022 * (1 - t) * side;
        const bend = t * t * 0.16;
        return [Math.cos(angle) * bend - Math.sin(angle) * width, t * height, Math.sin(angle) * bend + Math.cos(angle) * width];
      };
      for (let segment = 0; segment < 3; segment++) {
        const a = segment / 3;
        const b = (segment + 1) / 3;
        tri(point(a, -1), point(a, 1), point(b, 1));
        tri(point(a, -1), point(b, 1), point(b, -1));
      }
    }
  } else if (kind === 'fern') {
    for (let frond = 0; frond < 6; frond++) {
      const angle = frond * Math.PI / 3;
      const place = (radius: number, y: number, side: number): Triple => [Math.cos(angle) * radius - Math.sin(angle) * side, y, Math.sin(angle) * radius + Math.cos(angle) * side];
      tri([0, 0, 0], place(0.48, 0.13, -0.012), place(0.48, 0.13, 0.012));
      for (let leaf = 1; leaf < 6; leaf++) {
        const t = leaf / 6;
        const radius = t * 0.48;
        const y = Math.sin(t * Math.PI * 0.8) * 0.2;
        [-1, 1].forEach((side) => {
          const reach = (1 - t * 0.65) * 0.12 * side;
          tri(place(radius - 0.025, y, 0), place(radius + 0.045, y + 0.018, reach), place(radius + 0.09, y - 0.015, reach * 0.75));
          tri(place(radius - 0.025, y, 0), place(radius + 0.09, y - 0.015, reach * 0.75), place(radius + 0.04, y - 0.018, 0));
        });
      }
    }
  } else if (kind === 'daisy') {
    for (let petal = 0; petal < 9; petal++) {
      const angle = petal * Math.PI * 2 / 9;
      const point = (r: number, tangent: number, y: number): Triple => [Math.cos(angle) * r - Math.sin(angle) * tangent, y, Math.sin(angle) * r + Math.cos(angle) * tangent];
      tri(point(0.015, 0, 0.015), point(0.11, -0.027, 0), point(0.165, 0, 0.012));
      tri(point(0.015, 0, 0.015), point(0.165, 0, 0.012), point(0.11, 0.027, 0));
    }
  } else if (kind === 'bell') {
    const rings = [[0.075, 0.012], [0.02, 0.025], [-0.045, 0.061], [-0.075, 0.065]];
    for (let ring = 0; ring < rings.length - 1; ring++) {
      for (let index = 0; index < 8; index++) {
        const point = (level: number, angle: number): Triple => [Math.cos(angle) * rings[level][1], rings[level][0], Math.sin(angle) * rings[level][1]];
        const a = index * Math.PI / 4;
        const b = (index + 1) * Math.PI / 4;
        tri(point(ring, a), point(ring + 1, a), point(ring + 1, b));
        tri(point(ring, a), point(ring + 1, b), point(ring, b));
      }
    }
  } else if (kind === 'spike') {
    for (let level = 0; level < 5; level++) {
      const radius = 0.075 * (1 - level * 0.14);
      const y = level * 0.075;
      for (let side = 0; side < 6; side++) {
        const a = side * Math.PI / 3 + level * 0.3;
        const b = a + Math.PI / 3;
        tri([Math.cos(a) * radius, y, Math.sin(a) * radius], [Math.cos(b) * radius, y, Math.sin(b) * radius], [Math.cos(a + 0.5) * radius * 0.3, y + 0.13, Math.sin(a + 0.5) * radius * 0.3]);
      }
    }
  } else {
    const middle: Triple = [0, 0.025, 0.02];
    const edge: Triple[] = [[0, 0, 0.2], [-0.065, 0, 0.035], [0, 0, -0.12], [0.065, 0, 0.035]];
    edge.forEach((point, index) => tri(point, edge[(index + 1) % 4], middle));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export default function IslandLandscape({ clay, reducedMotion = false }: { clay: boolean; reducedMotion?: boolean }) {
  const geometries = useMemo(() => ({
    base: new THREE.ExtrudeGeometry(islandShape(0.965), {
      depth: 1.05, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: 0.22, bevelThickness: 0.22, curveSegments: 3,
    }),
    rim: new THREE.ExtrudeGeometry(islandShape(0.965), {
      depth: 0.12, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: 0.15, bevelThickness: 0.11, curveSegments: 3,
    }),
    surface: new THREE.ExtrudeGeometry(islandShape(0.973), {
      depth: 0.06, bevelEnabled: true, bevelSegments: 3, steps: 1,
      bevelSize: 0.1, bevelThickness: 0.07, curveSegments: 3,
    }),
    box: new RoundedBoxGeometry(1, 1, 1, 2, 0.065),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 7),
    crown: new THREE.IcosahedronGeometry(1, 1),
    rock: new THREE.IcosahedronGeometry(1, 0),
    flame: new THREE.ConeGeometry(1, 1, 7),
    mushroom: new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    handle: new THREE.TorusGeometry(0.12, 0.012, 5, 12, Math.PI),
    nest: new THREE.TorusGeometry(0.15, 0.035, 5, 14),
    ribbon: detailGeometry('ribbon'),
    fern: detailGeometry('fern'),
    daisy: detailGeometry('daisy'),
    bell: detailGeometry('bell'),
    spike: detailGeometry('spike'),
    leaf: detailGeometry('leaf'),
    grass: grassGeometry(),
  }), []);

  const materials = useMemo(() => {
    const material = (color: string, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
    const accent = material(clay ? '#dce0db' : '#b9d4cc', 0.6);
    accent.emissive.set(clay ? '#000000' : '#c1d8b1');
    accent.emissiveIntensity = clay ? 0 : 0.22;
    const lamp = material(clay ? '#f1f0e9' : '#fff0d4', 0.4);
    lamp.emissive.set(clay ? '#000000' : '#ffe7bc');
    lamp.emissiveIntensity = clay ? 0 : 0.55;
    const grass = material(clay ? '#bcbfb7' : '#73995e');
    grass.side = THREE.DoubleSide;
    const freshGrass = material(clay ? '#c5c8be' : '#91b570');
    freshGrass.side = THREE.DoubleSide;
    const flower = material(clay ? '#e4e4db' : '#f0e6bd');
    flower.side = THREE.DoubleSide;
    const blossom = material(clay ? '#d5d6cd' : '#d9b9a0');
    blossom.side = THREE.DoubleSide;
    const leafGold = material(clay ? '#d5d7c9' : '#c9cf91');
    leafGold.side = THREE.DoubleSide;
    const ember = material(clay ? '#e3e0d4' : '#efc487', 0.8);
    ember.emissive.set(clay ? '#000000' : '#e9ae65');
    ember.emissiveIntensity = clay ? 0 : 0.4;
    return {
      base: material(clay ? '#b6b9b5' : '#697764'),
      rim: material(clay ? '#d3d5cf' : '#b5c69c'),
      surface: material(clay ? '#d3d5cd' : '#9fbd7e'),
      hill: material(clay ? '#c8cec3' : '#96b578'),
      path: material(clay ? '#f0f0e8' : '#ede8d2'),
      seam: material(clay ? '#c2c5bd' : '#c9c9af'),
      rock: material(clay ? '#bfc2bc' : '#9da68c'),
      trunk: material(clay ? '#aeb2a9' : '#9b8161'),
      leaf: material(clay ? '#c1c7bd' : '#bbd58f'),
      leafShade: material(clay ? '#b2b9af' : '#9cbd77'),
      shrub: material(clay ? '#c4cbbd' : '#a0bf7d'),
      metal: material(clay ? '#b5bab5' : '#8a8d73', 0.75),
      seat: material(clay ? '#e3e4da' : '#c0a277', 0.85),
      gravel: material(clay ? '#dce0d4' : '#d6d4b5'),
      screen: material(clay ? '#aeb4af' : '#879c83', 0.85),
      woodDark: material(clay ? '#a4a89e' : '#796b50'),
      leafGold,
      grass, freshGrass, flower, blossom, accent, lamp, ember,
    };
  }, [clay]);

  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  const layout = useMemo(() => {
    const paths: Placement[] = [
      segment([0, 1.02], [0, 7.6], 1.3),
      segment([-8.8, 3.75], [8.8, 3.75], 0.68),
      segment([-5.8, 1.88], [-5.8, 3.75], 0.82),
      segment([5.8, 2.57], [5.8, 3.75], 0.82),
      segment([-8.8, 3.75], [-8.8, -1.7], 0.54),
      segment([-8.8, -1.7], [-4.3, -2.9], 0.54),
      segment([-4.3, -2.9], [-4.3, -6.8], 0.54),
      segment([-4.3, -6.8], [6.8, -6.8], 0.54),
      segment([6.8, -6.8], [8.8, -3.8], 0.54),
      segment([8.8, -3.8], [8.8, 3.75], 0.54),
      segment([-4.3, -4.43], [8.3, -4.43], 0.5),
      segment([2, -4.43], [2, -4.52], 0.86),
      segment([-6.4, 3.75], [-6.4, 4.55], 0.7),
      segment([-3.7, 3.75], [-3.7, 5.85], 0.65),
      { position: [0, 0.035, 7.67], scale: [2.35, 0.22, 0.5] },
      { position: [0, -0.135, 8.02], scale: [2.35, 0.23, 0.5] },
      { position: [0, -0.315, 8.37], scale: [2.35, 0.23, 0.5] },
      { position: [0, 0.18, 1.05], scale: [2.1, 0.16, 0.36] },
      { position: [0, 0.27, 0.83], scale: [1.9, 0.1, 0.24] },
      { position: [-5.8, 0.19, 1.86], scale: [1.48, 0.18, 0.3] },
    ];
    const seams: Placement[] = [];
    for (let z = 1.7; z < 7.4; z += 0.52) {
      seams.push({ position: [0, 0.173, z], scale: [1.17, 0.006, 0.014] });
    }
    for (let x = -8.5; x < 8.6; x += 0.68) {
      if (Math.abs(x) < 1.0) continue;
      seams.push({ position: [x, 0.173, 3.75], scale: [0.012, 0.006, 0.55] });
    }
    const groundLights: Placement[] = [];
    [-1, 1].forEach((side) => {
      [1.8, 4.6, 6.0, 7.1].forEach((z) => groundLights.push({ position: [side * 0.8, 0.155, z], scale: [0.03, 0.025, 0.34] }));
      groundLights.push({ position: [side * 4.2, 0.155, 3.22], scale: [0.65, 0.025, 0.035] });
    });

    const mounds: Placement[] = [
      { position: [-7.6, -0.15, -4.6], scale: [2.65, 0.88, 2.05], rotation: [0, -0.1, 0] },
      { position: [-8.9, -0.15, -3.75], scale: [1.65, 0.55, 1.4], rotation: [0, 0.4, 0] },
      { position: [-6.5, -0.17, -5.7], scale: [1.6, 0.53, 1.5], rotation: [0, -0.2, 0] },
      { position: [-2.4, -0.12, 4.8], scale: [1.05, 0.32, 1.15] },
      { position: [3.2, -0.13, 6.1], scale: [1.35, 0.4, 1.25] },
      { position: [-9.75, -0.12, 1.5], scale: [0.5, 0.32, 0.9] },
      { position: [3.4, -0.1, -2.8], scale: [0.5, 0.3, 0.55] },
    ];
    const groundY = (x: number, z: number) => {
      let height = 0.1;
      mounds.forEach((mound) => {
        const [sx, sy, sz] = mound.scale!;
        const [mx, my, mz] = mound.position;
        const radius = ((x - mx) / sx) ** 2 + ((z - mz) / sz) ** 2;
        if (radius < 1) height = Math.max(height, my + Math.sqrt(1 - radius) * sy);
      });
      return height;
    };

    const treeData: Array<[number, number, number]> = [
      [-7.9, -4.8, 1.6], [-6.4, -5.35, 1.35], [-8.9, -3.5, 1.28], [-7.45, -3.5, 1.2],
      [-8.2, -6.0, 1.1], [-5.9, -6.55, 1.2], [-2.8, -7.65, 1.35], [-1.15, -7.75, 1.55],
      [0.9, -7.65, 1.35], [4.5, -7.5, 1.3], [7.4, -5.8, 1.15], [9.55, -3.65, 1.15],
      [-10.1, -0.2, 1.05], [10.0, 0.25, 1], [-9.6, 2.45, 0.9], [9.65, 2.5, 0.87],
      [-8.65, 4.85, 0.8], [-4.7, 7.15, 0.64], [-2.4, 6.85, 0.62], [3.65, 6.25, 0.6],
      [4.55, 5.0, 0.63], [-3.6, -0.45, 0.88], [3.75, -1.1, 0.85], [-1.7, -3.85, 1],
      [4.85, -2.65, 0.86], [-8.15, 1.9, 0.66], [7.8, 3.0, 0.66], [2.0, 4.8, 0.76],
      [-2.2, 2.85, 0.7],
    ];
    const trunks: Placement[] = [];
    const crowns: Placement[] = [];
    const sideCrowns: Placement[] = [];
    treeData.forEach(([x, z, size], index) => {
      const floor = groundY(x, z);
      const bend = (index % 2 ? 0.21 : -0.18) * size;
      const root: Triple = [x, floor, z];
      const middle: Triple = [x + bend * 0.3, floor + size * 0.48, z + size * 0.025];
      const top: Triple = [x + bend, floor + size * 1.1, z - size * 0.08];
      trunks.push(branch(root, middle, size * 0.17));
      trunks.push(branch(middle, top, size * 0.125));
      trunks.push(branch(middle, [x - size * 0.36, floor + size * 1.06, z + size * 0.2], size * 0.08));
      crowns.push({ position: [top[0], floor + size * 1.4, top[2]], scale: [size * 0.81, size * 0.63, size * 0.73], rotation: [0.08, index * 0.6, 0.1] });
      sideCrowns.push({ position: [x - size * 0.39, floor + size * 1.2, z + size * 0.21], scale: [size * 0.59, size * 0.48, size * 0.54], rotation: [0.1, index * 0.8, 0] });
      sideCrowns.push({ position: [x + size * 0.37, floor + size * 1.24, z - size * 0.24], scale: [size * 0.48, size * 0.44, size * 0.48], rotation: [0, index * 0.7, 0.1] });
    });

    const gardenCenters: Array<[number, number]> = [
      [-8.1, 3.0], [-9.7, 1.6], [-9.9, -1.1], [-8.6, -3.0],
      [-8.75, -5.2], [-6.2, -4.2], [-5.3, -5.6], [-3.7, -7.3],
      [-0.35, -7.5], [3.6, -7.2], [6.9, -5.7], [9.5, -2.8],
      [9.7, 1.5], [8.1, 2.9], [-2.65, 5.65], [2.7, 5.75],
      [-1.95, 7.15], [4.9, 6.55], [-4.2, 7.4], [-8.1, 5.95],
      [-3.35, 0.9], [3.4, 0.6], [-2.5, -3.65], [4.0, -3.35],
      [-6.8, 2.95], [7.65, -0.8],
    ];
    const shrubs: Placement[] = [];
    const grasses: Placement[] = [];
    gardenCenters.forEach(([x, z], index) => {
      const floor = groundY(x, z);
      shrubs.push({ position: [x, floor + 0.2, z], scale: [0.42 + (index % 3) * 0.07, 0.28, 0.34], rotation: [0, index * 0.6, 0] });
      shrubs.push({ position: [x + 0.31, floor + 0.14, z + 0.1], scale: [0.28, 0.19, 0.26] });
      for (let tuft = 0; tuft < 7; tuft++) {
        const angle = tuft * 2.399 + index * 0.65;
        const distance = 0.35 + (tuft % 3) * 0.14;
        const scale = 0.65 + (tuft % 3) * 0.13;
        const px = x + Math.cos(angle) * distance;
        const pz = z + Math.sin(angle) * distance;
        grasses.push({ position: [px, groundY(px, pz), pz], scale: [scale, scale, scale], rotation: [0, angle, 0] });
      }
    });

    const planterFrames: Placement[] = [];
    const planterSoil: Placement[] = [];
    const planters: Array<[number, number, number, number]> = [
      [-3.35, 2.05, 1.25, 0.66], [3.4, 2.45, 1.15, 0.64],
      [-7.95, 2.3, 1.1, 0.72], [8.15, 1.6, 1.05, 0.72],
      [-3.7, -5.4, 0.68, 1.4], [4.3, -4.95, 0.72, 1.2],
      [-2.7, 5.45, 1.3, 0.68], [3.25, 5.4, 1.25, 0.7],
    ];
    planters.forEach(([x, z, width, depth], index) => {
      planterFrames.push({ position: [x, 0.22, z], scale: [width, 0.24, depth] });
      planterSoil.push({ position: [x, 0.345, z], scale: [width - 0.14, 0.035, depth - 0.14] });
      shrubs.push({ position: [x - width * 0.18, 0.46, z], scale: [width * 0.27, 0.25, depth * 0.38] });
      shrubs.push({ position: [x + width * 0.22, 0.52, z], scale: [width * 0.25, 0.3, depth * 0.35] });
      if (index % 2 === 0) {
        planterFrames.push({ position: [x + width * 0.35, 0.31, z + depth * 0.27], scale: [width * 0.6, 0.42, depth * 0.55] });
        planterSoil.push({ position: [x + width * 0.35, 0.525, z + depth * 0.27], scale: [width * 0.6 - 0.12, 0.025, depth * 0.55 - 0.1] });
        shrubs.push({ position: [x + width * 0.35, 0.65, z + depth * 0.27], scale: [width * 0.25, 0.23, depth * 0.24] });
      }
    });

    const sideRocks: Placement[] = [];
    for (let index = 0; index < 28; index++) {
      const angle = index / 28 * Math.PI * 2;
      if (Math.sin(angle) > 0.82 && Math.abs(Math.cos(angle)) < 0.18) continue;
      sideRocks.push({
        position: [Math.cos(angle) * 10.85, -0.58 - (index % 3) * 0.1, Math.sin(angle) * 7.95],
        scale: [0.6 + (index % 3) * 0.16, 0.35 + (index % 2) * 0.08, 0.45 + (index % 4) * 0.08],
        rotation: [Math.sin(index) * 0.12, angle, Math.cos(index) * 0.13],
      });
    }
    const pebbles: Placement[] = [
      { position: [-9.35, 0.22, 3.2], scale: [0.47, 0.2, 0.29] },
      { position: [-9.75, 0.17, 3.3], scale: [0.24, 0.13, 0.21] },
      { position: [5.7, 0.2, 5.65], scale: [0.42, 0.21, 0.32] },
      { position: [6.05, 0.14, 5.8], scale: [0.21, 0.1, 0.17] },
      { position: [-3.5, 0.22, -6.2], scale: [0.38, 0.22, 0.25] },
      { position: [6.4, 0.19, -5.25], scale: [0.3, 0.16, 0.26] },
      { position: [-7.2, 0.65, -5.2], scale: [0.53, 0.27, 0.42] },
      { position: [-7.65, 0.69, -5.35], scale: [0.25, 0.18, 0.26] },
      { position: [-2.4, 0.19, 7.45], scale: [0.35, 0.17, 0.22] },
      { position: [2.0, 0.17, 7.15], scale: [0.23, 0.13, 0.19] },
      { position: [9.6, 0.22, -1.4], scale: [0.44, 0.22, 0.32] },
      { position: [9.95, 0.18, -1.65], scale: [0.26, 0.16, 0.2] },
    ];

    const railPosts: Placement[] = [];
    const railBars: Placement[] = [];
    const railingLines: Array<[[number, number], [number, number]]> = [
      [[-5.2, 7.15], [-2.6, 7.15]], [[-8.15, 6.75], [-6.9, 7.35]],
      [[2.8, 7.65], [5.2, 7.25]],
    ];
    railingLines.forEach(([a, b]) => {
      for (let index = 0; index < 5; index++) {
        const t = index / 4;
        railPosts.push({ position: [THREE.MathUtils.lerp(a[0], b[0], t), 0.32, THREE.MathUtils.lerp(a[1], b[1], t)], scale: [0.045, 0.44, 0.045] });
      }
      railBars.push(segment(a, b, 0.035, 0.53, 0.04));
    });

    const benchSeats: Placement[] = [];
    const benchFrames: Placement[] = [];
    const benches: Array<[number, number, number]> = [[-3.8, 6.65, 0], [-6.4, 5.95, 0], [3.5, 4.75, 0.12], [7.35, -2.85, -Math.PI / 2]];
    benches.forEach(([x, z, angle]) => {
      const local = (dx: number, y: number, dz: number): Triple => [x + Math.cos(angle) * dx + Math.sin(angle) * dz, y, z - Math.sin(angle) * dx + Math.cos(angle) * dz];
      for (let slat = 0; slat < 3; slat++) {
        benchSeats.push({ position: local(0, 0.48, -0.12 + slat * 0.12), scale: [1.25, 0.07, 0.095], rotation: [0, angle, 0] });
      }
      benchSeats.push({ position: local(0, 0.74, 0.21), scale: [1.25, 0.26, 0.065], rotation: [-0.1, angle, 0] });
      [-0.43, 0.43].forEach((offset) => {
        benchFrames.push({ position: local(offset, 0.29, 0), scale: [0.065, 0.38, 0.42], rotation: [0, angle, 0] });
        benchFrames.push({ position: local(offset, 0.55, 0.19), scale: [0.05, 0.55, 0.05], rotation: [0, angle, 0] });
      });
    });

    const lampPoles: Placement[] = [];
    const lampCaps: Placement[] = [];
    const lampGlows: Placement[] = [];
    [[-7.6, 4.35], [5.0, 4.35], [-3.65, -3.5], [5.1, -3.85], [-3.5, -6.3], [7.6, -5.15], [-1.5, 7.1]].forEach(([x, z]) => {
      lampPoles.push({ position: [x, 0.75, z], scale: [0.065, 1.3, 0.065] });
      lampCaps.push({ position: [x, 1.42, z], scale: [0.32, 0.06, 0.32] });
      lampGlows.push({ position: [x, 1.36, z], scale: [0.23, 0.06, 0.23] });
    });
    const terraces: Placement[] = [
      { position: [-6.4, 0.17, 5.6], scale: [3.35, 0.14, 2.3] },
      { position: [-3.8, 0.15, 6.5], scale: [3.05, 0.1, 1.35] },
      { position: [7.35, 0.13, -2.85], scale: [1.45, 0.06, 2.2] },
    ];
    const terraceSlats: Placement[] = [];
    for (let x = -7.9; x < -4.8; x += 0.19) {
      terraceSlats.push({ position: [x, 0.245, 5.6], scale: [0.14, 0.025, 2.12] });
    }
    for (let x = -5.15; x < -2.4; x += 0.2) {
      terraceSlats.push({ position: [x, 0.208, 6.5], scale: [0.15, 0.025, 1.15] });
    }
    const pergolaPosts: Placement[] = [];
    const pergolaRoof: Placement[] = [];
    [-1, 1].forEach((xSide) => [-1, 1].forEach((zSide) => {
      pergolaPosts.push({ position: [-6.4 + xSide * 1.4, 1.06, 5.6 + zSide * 0.83], scale: [0.1, 1.7, 0.1] });
    }));
    [-1, 1].forEach((side) => {
      pergolaRoof.push({ position: [-6.4, 1.94, 5.6 + side * 0.86], scale: [3.1, 0.15, 0.12] });
      pergolaRoof.push({ position: [-6.4 + side * 1.4, 1.94, 5.6], scale: [0.12, 0.15, 2.0] });
    });
    for (let index = 0; index < 9; index++) {
      pergolaRoof.push({ position: [-7.86 + index * 0.365, 2.04, 5.6], scale: [0.12, 0.1, 2.25] });
    }
    const steppingStones: Placement[] = [];
    for (let index = 0; index < 6; index++) {
      const x = -4.8 - index * 0.33;
      const z = -5.35 + Math.sin(index * 0.7) * 0.18;
      steppingStones.push({ position: [x, groundY(x, z) + 0.035, z], scale: [0.29, 0.12, 0.52], rotation: [0, -0.1 + index * 0.04, 0] });
    }

    const flowerHeads: Placement[] = [];
    const blossoms: Placement[] = [];
    const plantStems: Placement[] = [];
    [...gardenCenters, [-3.3, 2.05], [3.4, 2.45], [-2.7, 5.45], [3.25, 5.4]].forEach(([x, z], patch) => {
      const inPlanter = patch >= gardenCenters.length;
      for (let flower = 0; flower < 6; flower++) {
        const angle = flower * 2.399 + patch * 0.7;
        const distance = 0.13 + (flower % 3) * 0.12;
        const px = x + Math.cos(angle) * distance;
        const pz = z + Math.sin(angle) * distance;
        const floor = inPlanter ? 0.36 : groundY(px, pz);
        const height = 0.15 + (flower % 3) * 0.045;
        plantStems.push({ position: [px, floor + height * 0.5, pz], scale: [0.014, height, 0.014], rotation: [0.1, angle, 0] });
        for (let petal = 0; petal < 3; petal++) {
          const turn = petal * Math.PI * 2 / 3 + angle;
          const item: Placement = { position: [px + Math.cos(turn) * 0.035, floor + height, pz + Math.sin(turn) * 0.035], scale: [0.055, 0.027, 0.04], rotation: [0.1, turn, 0.1] };
          (patch % 3 === 0 ? blossoms : flowerHeads).push(item);
        }
      }
    });

    const mushroomStems: Placement[] = [];
    const mushroomCaps: Placement[] = [];
    [[-7.1, -4.0], [-6.55, -5.9], [-9.1, -2.9], [-2.6, -3.65], [4.0, -3.35], [-2.3, 6.95]].forEach(([x, z], patch) => {
      for (let index = 0; index < 4; index++) {
        const px = x + Math.cos(index * 2.2 + patch) * 0.23;
        const pz = z + Math.sin(index * 2.2 + patch) * 0.19;
        const height = 0.13 + (index % 3) * 0.055;
        const floor = groundY(px, pz);
        mushroomStems.push({ position: [px, floor + height * 0.5, pz], scale: [0.035, height, 0.035] });
        mushroomCaps.push({ position: [px, floor + height, pz], scale: [height * 0.58, height * 0.4, height * 0.58], rotation: [0, patch + index, 0] });
      }
    });
    const moss: Placement[] = pebbles.slice(0, 8).map((pebble, index) => ({
      position: [pebble.position[0], pebble.position[1] + (pebble.scale?.[1] ?? 0.2) * 0.7, pebble.position[2]],
      scale: [(pebble.scale?.[0] ?? 0.3) * 0.82, 0.055, (pebble.scale?.[2] ?? 0.2) * 0.72],
      rotation: [0.1, index, 0.05],
    }));

    const gardenRing: Placement[] = [];
    for (let index = 0; index < 32; index++) {
      const angle = index * Math.PI * 2 / 32;
      if (Math.abs(angle - Math.PI / 2) < 0.2) continue;
      gardenRing.push({ position: [5.8 + Math.cos(angle) * 2.16, 0.145, 0.9 + Math.sin(angle) * 2.16], scale: [0.39, 0.065, 0.29], rotation: [0, -angle, 0] });
    }
    const gardenBases: Placement[] = [
      { position: [8.0, 0.15, 1.1], scale: [0.86, 0.1, 0.86] },
      { position: [4.78, 0.15, 2.9], scale: [0.86, 0.1, 0.86] },
      { position: [4.62, 0.15, -0.97], scale: [0.86, 0.1, 0.86] },
    ];
    const propsWood: Placement[] = [];
    const propsStone: Placement[] = [];
    const propsCanvas: Placement[] = [];
    const propsLeaf: Placement[] = [];
    const propCylinders: Placement[] = [];
    const bookSpines: Placement[] = [];
    const lanternBodies: Placement[] = [];
    const lanternCaps: Placement[] = [];
    const lanternHandles: Placement[] = [];
    const fireStones: Placement[] = [];
    const embers: Placement[] = [];

    // Low presentation stands leave a clear route to the gallery entrance.
    [[-1.7, 1.9], [1.75, 1.8], [2.3, 2.9]].forEach(([x, z], index) => {
      propCylinders.push({ position: [x, 0.22, z], scale: [0.55, 0.24, 0.55] });
      propsWood.push({ position: [x, 0.48, z], scale: [0.07, 0.4, 0.07] });
      propsStone.push({ position: [x, 0.7, z], scale: [0.57, 0.055, 0.4], rotation: [0.16, index * 0.12, 0] });
      propsCanvas.push({ position: [x, 0.738, z], scale: [0.45, 0.012, 0.29], rotation: [0.16, index * 0.12, 0] });
      propsLeaf.push({ position: [x - 0.08, 0.755, z], scale: [0.1, 0.014, 0.18], rotation: [0.16, index * 0.12, 0] });
    });

    const addTable = (x: number, z: number, width: number, depth: number, floor: number) => {
      propsWood.push({ position: [x, floor + 0.62, z], scale: [width, 0.085, depth] });
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => propsWood.push({
        position: [x + sx * width * 0.4, floor + 0.31, z + sz * depth * 0.34], scale: [0.065, 0.62, 0.065],
      })));
    };
    // Workshop: a potting bench, material crates, an easel and a few books.
    addTable(-7.3, 2.65, 1.5, 0.62, 0.1);
    propsStone.push({ position: [-7.65, 0.79, 2.64], scale: [0.26, 0.12, 0.23] });
    propsLeaf.push({ position: [-7.65, 0.9, 2.64], scale: [0.23, 0.15, 0.19], rotation: [0, 0.4, 0.12] });
    for (let index = 0; index < 3; index++) {
      propsCanvas.push({ position: [-6.98, 0.79 + index * 0.045, 2.67], scale: [0.28, 0.035, 0.21], rotation: [0, 0.15 - index * 0.12, 0] });
      bookSpines.push({ position: [-6.98, 0.791 + index * 0.045, 2.775], scale: [0.27, 0.025, 0.012], rotation: [0, 0.15 - index * 0.12, 0] });
    }
    [[-7.6, 1.98], [-6.85, 2.08]].forEach(([x, z], index) => {
      propsWood.push({ position: [x, 0.31, z], scale: [0.5, 0.42, 0.43] });
      for (let slat = 0; slat < 3; slat++) {
        propsStone.push({ position: [x, 0.18 + slat * 0.12, z + 0.22], scale: [0.45, 0.025, 0.018] });
      }
      if (index === 0) propsCanvas.push({ position: [x, 0.55, z], scale: [0.38, 0.055, 0.33] });
    });
    propsWood.push({ position: [-4.62, 0.49, 2.43], scale: [0.05, 0.83, 0.05], rotation: [0, 0, -0.15] });
    propsWood.push({ position: [-4.35, 0.49, 2.43], scale: [0.05, 0.83, 0.05], rotation: [0, 0, 0.15] });
    propsWood.push({ position: [-4.49, 0.45, 2.25], scale: [0.045, 0.76, 0.045], rotation: [-0.35, 0, 0] });
    propsWood.push({ position: [-4.49, 0.48, 2.46], scale: [0.63, 0.06, 0.12] });
    propsCanvas.push({ position: [-4.49, 0.81, 2.44], scale: [0.52, 0.49, 0.045], rotation: [-0.08, 0, 0] });
    propsLeaf.push({ position: [-4.49, 0.83, 2.469], scale: [0.18, 0.29, 0.018], rotation: [-0.08, 0, -0.15] });

    // A shaded reading desk and a blank notice board on the forest approach.
    const readingFloor = groundY(-5.45, -4.8);
    addTable(-5.45, -4.8, 1.25, 0.62, readingFloor);
    propsCanvas.push({ position: [-5.45, readingFloor + 0.68, -4.77], scale: [0.42, 0.025, 0.28], rotation: [0, 0.12, 0] });
    bookSpines.push({ position: [-5.45, readingFloor + 0.697, -4.77], scale: [0.015, 0.005, 0.25], rotation: [0, 0.12, 0] });
    propsWood.push({ position: [-5.45, readingFloor + 0.3, -5.4], scale: [1.12, 0.11, 0.3] });
    [-0.4, 0.4].forEach((dx) => propsWood.push({ position: [-5.45 + dx, readingFloor + 0.15, -5.4], scale: [0.07, 0.3, 0.22] }));
    const boardFloor = groundY(-5.2, -3.45);
    [-0.34, 0.34].forEach((dx) => propsWood.push({ position: [-5.2 + dx, boardFloor + 0.6, -3.45], scale: [0.065, 1.2, 0.065] }));
    propsWood.push({ position: [-5.2, boardFloor + 1.05, -3.45], scale: [0.95, 0.62, 0.075] });
    propsCanvas.push({ position: [-5.4, boardFloor + 1.09, -3.402], scale: [0.22, 0.26, 0.018], rotation: [0, 0, 0.08] });
    propsCanvas.push({ position: [-5.05, boardFloor + 1.0, -3.402], scale: [0.25, 0.3, 0.018], rotation: [0, 0, -0.06] });

    // Warm lanterns and a quiet ember bowl make the seaside a resting place.
    [[-5.05, 6.85], [-2.65, 6.65], [-1.45, 6.15], [1.65, 6.9], [-5.15, -4.55]].forEach(([x, z], index) => {
      const floor = index === 4 ? readingFloor + 0.66 : 0.12;
      lanternBodies.push({ position: [x, floor + 0.3, z], scale: [0.2, 0.27, 0.2] });
      lanternCaps.push({ position: [x, floor + 0.155, z], scale: [0.25, 0.035, 0.25] });
      lanternCaps.push({ position: [x, floor + 0.445, z], scale: [0.25, 0.035, 0.25] });
      lanternHandles.push({ position: [x, floor + 0.475, z], scale: [0.65, 0.65, 0.65] });
    });
    [[-4.8, 6.0], [-2.95, 6.55], [1.8, 6.1]].forEach(([x, z]) => {
      propCylinders.push({ position: [x, 0.25, z], scale: [0.47, 0.3, 0.47] });
      propsWood.push({ position: [x, 0.42, z], scale: [0.49, 0.07, 0.43] });
    });
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      fireStones.push({ position: [-3.65 + Math.cos(angle) * 0.25, 0.3, 6.0 + Math.sin(angle) * 0.25], scale: [0.13, 0.09, 0.11], rotation: [0, angle, 0] });
    }
    propsWood.push({ position: [-3.65, 0.31, 6.0], scale: [0.36, 0.06, 0.065], rotation: [0, 0.7, 0] });
    propsWood.push({ position: [-3.65, 0.34, 6.0], scale: [0.32, 0.06, 0.065], rotation: [0, -0.6, 0] });
    embers.push({ position: [-3.65, 0.4, 6.0], scale: [0.11, 0.16, 0.1], rotation: [0, 0.3, 0] });
    embers.push({ position: [-3.58, 0.375, 6.015], scale: [0.07, 0.1, 0.07], rotation: [0, -0.4, 0.1] });

    const naturalCount = () => trunks.length + crowns.length + sideCrowns.length + shrubs.length + grasses.length + flowerHeads.length + blossoms.length + plantStems.length + mushroomStems.length + mushroomCaps.length + moss.length + mounds.length + pebbles.length + sideRocks.length + fireStones.length;
    const baselineNaturalCount = naturalCount();
    const baselineMushroomCount = mushroomCaps.length;
    const ribbonGrass: Placement[] = [];
    const meadowReeds: Placement[] = [];
    const ferns: Placement[] = [];
    const daisies: Placement[] = [];
    const lilyBells: Placement[] = [];
    const flowerSpikes: Placement[] = [];
    const greenLeaves: Placement[] = [];
    const goldLeaves: Placement[] = [];
    const goldenCrowns: Placement[] = [];
    const treeHollows: Placement[] = [];
    const barkRings: Placement[] = [];
    const cutEnds: Placement[] = [];
    const meadowTexture: Placement[] = [];
    const pathEdgeStones: Placement[] = [];

    const routes: Array<[[number, number], [number, number], number]> = [
      [[0, 1.02], [0, 7.6], 1.3], [[-8.8, 3.75], [8.8, 3.75], 0.68],
      [[-5.8, 1.88], [-5.8, 3.75], 0.82], [[5.8, 2.57], [5.8, 3.75], 0.82],
      [[-8.8, 3.75], [-8.8, -1.7], 0.54], [[-8.8, -1.7], [-4.3, -2.9], 0.54],
      [[-4.3, -2.9], [-4.3, -6.8], 0.54], [[-4.3, -6.8], [6.8, -6.8], 0.54],
      [[6.8, -6.8], [8.8, -3.8], 0.54], [[8.8, -3.8], [8.8, 3.75], 0.54],
      [[-4.3, -4.43], [8.3, -4.43], 0.5], [[-6.4, 3.75], [-6.4, 4.55], 0.7],
      [[-3.7, 3.75], [-3.7, 5.85], 0.65],
    ];
    const rectangles = [
      [-2.75, 2.75, -3.075, 0.675], [-7.24, -4.36, -1.08, 1.68], [1, 3, -5.95, -4.65],
      [-8.2, -4.6, 4.25, 6.85], [-5.4, -2.3, 5.75, 7.2], [-6.2, -4.65, -5.7, -3.2],
      [-8.2, -4.1, 1.75, 3.2], [6.5, 10, 4.5, 7.7], [-1.8, 1.8, 7.3, 10],
      [-10.45, -9.15, 0.5, 1.5], [-3.65, -2.85, -2.85, -1.45],
      [-3.5, -2.1, -5.6, -4.4], [9.1, 10.3, -2.25, -1.35],
      [4.0, 5.2, -6.425, -5.575], [4.6, 6.8, 5.6, 7.8], [-6.8, -5.2, 6.8, 7.7],
      [-1.7, 1.7, 1.15, 7.6],
    ];
    const roundClearances: Array<[number, number, number]> = [
      [5.8, 0.9, 1.65], [8, 1.1, 0.66], [4.78, 2.9, 0.66], [4.62, -0.97, 0.66],
      [-1.7, 1.9, 0.62], [1.75, 1.8, 0.62], [2.3, 2.9, 0.6], [-1.65, 6.25, 0.6],
      [3.5, 4.75, 0.85], [7.35, -2.85, 0.95], [1.8, 6.1, 0.5],
    ];
    const distanceToRoute = (x: number, z: number, a: [number, number], b: [number, number]) => {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    };
    const safeNatural = (x: number, z: number, margin = 0.1) => {
      if ((x / 10.65) ** 2 + (z / 7.9) ** 2 > 0.96) return false;
      if (rectangles.some(([left, right, back, front]) => x > left - margin && x < right + margin && z > back - margin && z < front + margin)) return false;
      if (roundClearances.some(([cx, cz, radius]) => Math.hypot(x - cx, z - cz) < radius + margin)) return false;
      if (Math.abs(Math.hypot(x - 5.8, z - 0.9) - 2.16) < 0.24 + margin) return false;
      return !routes.some(([a, b, width]) => distanceToRoute(x, z, a, b) < width / 2 + margin);
    };
    const beds: Array<[number, number]> = [
      [-3.2, 1.4], [-2.8, 3.0], [3.1, 1.25], [3.45, 3.0], [-7.65, -2.65], [-6.6, -6.2],
      [-3.3, -6], [0.1, -7.3], [5.1, -3.15], [9.5, 0.1], [3.15, 5.75], [-1.85, 4.9], [-8.8, 3.1],
    ];
    const samples = (count: number, seed: number, centers?: Array<[number, number]>, spread = 0.8, margin = 0.1) => {
      const result: Array<[number, number, number]> = [];
      for (let attempt = 0; result.length < count && attempt < count * 100; attempt++) {
        const phase = attempt + seed * 37;
        const a = (phase * 0.61803398875) % 1;
        const b = (phase * 0.41421356237 + 0.17) % 1;
        let x = (a - 0.5) * 20.9;
        let z = (b - 0.5) * 15.4;
        if (centers) {
          const center = centers[attempt % centers.length];
          x = center[0] + Math.cos(a * Math.PI * 2) * Math.sqrt(b) * spread;
          z = center[1] + Math.sin(a * Math.PI * 2) * Math.sqrt(b) * spread;
        }
        if (safeNatural(x, z, margin)) result.push([x, z, a * Math.PI * 2]);
      }
      return result;
    };

    [...samples(500, 3, beds, 1.2), ...samples(200, 4)].forEach(([x, z, angle], index) => ribbonGrass.push({ position: [x, groundY(x, z), z], scale: [0.55 + index % 4 * 0.11, 0.6 + index % 3 * 0.15, 0.55 + index % 4 * 0.11], rotation: [0, angle, 0] }));
    samples(240, 7, beds, 1.05).forEach(([x, z, angle], index) => meadowReeds.push({ position: [x, groundY(x, z), z], scale: [0.8, 0.95 + index % 3 * 0.16, 0.8], rotation: [0, angle, 0] }));
    samples(120, 11, [[-7.8, -4.3], [-6.9, -6], [-8.8, -2.7], [-3, -3.7], [4.7, -3.2], [-9.6, 0]], 1.1, 0.22).forEach(([x, z, angle], index) => ferns.push({ position: [x, groundY(x, z) + 0.015, z], scale: [0.6 + index % 3 * 0.13, 0.9, 0.6 + index % 3 * 0.13], rotation: [0, angle, 0] }));
    samples(150, 15).forEach(([x, z, angle], index) => meadowTexture.push({ position: [x, groundY(x, z) - 0.08, z], scale: [0.22 + index % 3 * 0.1, 0.13, 0.3 + index % 4 * 0.09], rotation: [0, angle, 0] }));
    const hedgeCount = 90;
    samples(hedgeCount, 19, beds, 0.95, 0.18).forEach(([x, z, angle], index) => shrubs.push({ position: [x, groundY(x, z) + 0.11, z], scale: [0.21 + index % 3 * 0.035, 0.18 + index % 2 * 0.04, 0.23], rotation: [0, angle, 0] }));

    samples(120, 23, beds, 0.72, 0.18).forEach(([x, z, angle], index) => {
      const floor = groundY(x, z);
      const height = 0.22 + index % 4 * 0.045;
      plantStems.push({ position: [x, floor + height / 2, z], scale: [0.016, height, 0.016] });
      daisies.push({ position: [x, floor + height, z], scale: [0.6 + index % 3 * 0.13, 1, 0.6 + index % 3 * 0.13], rotation: [0.12, angle, 0.08] });
      flowerHeads.push({ position: [x, floor + height + 0.025, z], scale: [0.029, 0.02, 0.029] });
    });
    samples(60, 29, [[-3.1, 1.4], [-2.7, -3.7], [-7.3, -3.0], [3.2, 5.7], [9.5, 0.2]], 0.7, 0.19).forEach(([x, z, angle], index) => {
      const floor = groundY(x, z);
      const height = 0.29 + index % 3 * 0.045;
      plantStems.push(branch([x, floor, z], [x + 0.045, floor + height, z], 0.018));
      for (let bell = 0; bell < 3; bell++) lilyBells.push({ position: [x + 0.06, floor + height - bell * 0.075, z + Math.sin(angle + bell) * 0.035], scale: [0.7 + bell * 0.08, 0.7 + bell * 0.08, 0.7 + bell * 0.08], rotation: [0, angle, -0.18] });
    });
    samples(90, 31, beds, 0.85, 0.18).forEach(([x, z, angle], index) => {
      const floor = groundY(x, z);
      plantStems.push({ position: [x, floor + 0.15, z], scale: [0.018, 0.3, 0.018] });
      flowerSpikes.push({ position: [x, floor + 0.23, z], scale: [0.7 + index % 3 * 0.12, 0.7 + index % 3 * 0.1, 0.7 + index % 3 * 0.12], rotation: [0.05, angle, 0.1] });
    });
    samples(70, 37, [[-7.8, -4], [-6.9, -6.2], [-3.1, -3.8], [-2, 4.8], [4.3, -3.3], [-9.5, 0]], 0.9, 0.16).forEach(([x, z, angle], index) => {
      const floor = groundY(x, z);
      const height = 0.12 + index % 5 * 0.045;
      const cap = height * (index % 3 === 0 ? 0.98 : 0.62);
      mushroomStems.push({ position: [x, floor + height * 0.5, z], scale: [height * 0.18, height, height * 0.18] });
      mushroomCaps.push({ position: [x, floor + height, z], scale: [cap, height * (index % 3 === 0 ? 0.27 : 0.5), cap], rotation: [0, angle, 0] });
      for (let spot = 0; spot < 2; spot++) flowerHeads.push({ position: [x + Math.cos(angle + spot * 2.7) * cap * 0.4, floor + height * 1.24, z + Math.sin(angle + spot * 2.7) * cap * 0.4], scale: [cap * 0.16, 0.012, cap * 0.13] });
    });
    samples(380, 41, beds, 1.2, 0.08).forEach(([x, z, angle], index) => {
      const item: Placement = { position: [x, groundY(x, z) + 0.018, z], scale: [0.3 + index % 4 * 0.12, 0.7, 0.3 + index % 4 * 0.12], rotation: [0.04, angle, 0.08] };
      (index < 240 ? greenLeaves : goldLeaves).push(item);
    });

    const rootsBefore = trunks.length;
    let nestCount = 0;
    treeData.forEach(([x, z, size], index) => {
      const floor = groundY(x, z);
      const bend = (index % 2 ? 0.21 : -0.18) * size;
      for (let root = 0; root < 4; root++) {
        const angle = root * Math.PI / 2 + index * 0.4;
        trunks.push(branch([x, floor + 0.13 * size, z], [x + Math.cos(angle) * size * 0.35, floor + 0.025, z + Math.sin(angle) * size * 0.35], size * 0.075));
        const tw = angle + 0.3;
        trunks.push(branch([x + bend * 0.8, floor + size * 1.0, z], [x + Math.cos(tw) * size * 0.57, floor + size * 1.32, z + Math.sin(tw) * size * 0.43], size * 0.032));
      }
      treeHollows.push({ position: [x + bend * 0.18, floor + size * 0.35, z + size * 0.082], scale: [size * 0.046, size * 0.1, size * 0.016] });
      barkRings.push({ position: [x + bend * 0.18, floor + size * 0.35, z + size * 0.088], scale: [size * 0.32, size * 0.67, size * 0.2] });
      if (index % 5 === 1) {
        const nestPosition: Triple = [x - size * 0.37, floor + size * 1.12, z + size * 0.24];
        barkRings.push({ position: nestPosition, scale: [size * 0.75, size * 0.75, size * 0.75], rotation: [-Math.PI / 2, 0, 0] });
        for (let egg = 0; egg < 3; egg++) flowerHeads.push({ position: [nestPosition[0] + (egg - 1) * 0.04, nestPosition[1] + 0.025, nestPosition[2] + egg % 2 * 0.035], scale: [0.026, 0.039, 0.026] });
        nestCount++;
      }
      if (index % 4 === 0) goldenCrowns.push({ position: [x + size * 0.28, floor + size * 1.45, z + size * 0.08], scale: [size * 0.25, size * 0.24, size * 0.28], rotation: [0, index, 0] });
    });
    const rootAndTwigCount = trunks.length - rootsBefore;

    const logs: Array<[number, number, number, number]> = [[-8.8, -2.8, 0.8, 1.25], [-3.1, -5.9, 0.2, 1.05], [3.8, 5.8, -0.4, 0.95], [8.4, -5.0, 0.7, 1.1], [-1.5, -6.1, -0.1, 0.85], [-9.7, -1.0, 0.25, 1.0]];
    logs.forEach(([x, z, angle, length], index) => {
      const floor = groundY(x, z);
      const dx = Math.cos(angle) * length * 0.5;
      const dz = Math.sin(angle) * length * 0.5;
      const a: Triple = [x - dx, floor + 0.14, z - dz];
      const b: Triple = [x + dx, floor + 0.14, z + dz];
      trunks.push(branch(a, b, 0.27));
      const direction = new THREE.Vector3(dx, 0, dz).normalize();
      const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction));
      [a, b].forEach((end) => {
        cutEnds.push(branch([end[0] - direction.x * 0.006, end[1], end[2] - direction.z * 0.006], [end[0] + direction.x * 0.006, end[1], end[2] + direction.z * 0.006], 0.245));
        barkRings.push({ position: end, scale: [0.51, 0.51, 0.18], rotation: [rotation.x, rotation.y, rotation.z] });
      });
      moss.push({ position: [x - 0.1, floor + 0.265, z], scale: [length * 0.31, 0.06, 0.12], rotation: [0, -angle, 0] });
      greenLeaves.push({ position: [x + 0.12, floor + 0.29, z], scale: [0.6, 0.6, 0.6], rotation: [0.1, angle, 0.1] });
      if (index % 2 === 0) mushroomCaps.push({ position: [x - 0.23, floor + 0.33, z], scale: [0.09, 0.05, 0.09] });
    });
    const stumps = samples(8, 47, [[-8.3, -3], [-6.6, -6], [-3.2, -6.1], [3.4, 5.8], [9.6, 0]], 0.65, 0.3);
    stumps.forEach(([x, z, angle], index) => {
      const floor = groundY(x, z);
      const diameter = 0.28 + index % 3 * 0.05;
      trunks.push({ position: [x, floor + 0.14, z], scale: [diameter, 0.28, diameter] });
      cutEnds.push({ position: [x, floor + 0.285, z], scale: [diameter * 0.9, 0.014, diameter * 0.9] });
      barkRings.push({ position: [x, floor + 0.295, z], scale: [diameter * 1.7, diameter * 1.7, 0.12], rotation: [-Math.PI / 2, 0, angle] });
      moss.push({ position: [x + diameter * 0.25, floor + 0.17, z], scale: [diameter * 0.35, 0.15, diameter * 0.4] });
    });

    let crackCount = 0;
    routes.forEach(([a, b, width], routeIndex) => {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const dx = (b[0] - a[0]) / length;
      const dz = (b[1] - a[1]) / length;
      const steps = Math.floor(length / 0.5);
      for (let step = 1; step < steps; step++) {
        const t = step / steps;
        const cx = THREE.MathUtils.lerp(a[0], b[0], t);
        const cz = THREE.MathUtils.lerp(a[1], b[1], t);
        [-1, 1].forEach((side) => {
          const offset = width * 0.5 + 0.14 + (step % 3) * 0.025;
          const x = cx - dz * offset * side;
          const z = cz + dx * offset * side;
          if (safeNatural(x, z, 0.07)) pathEdgeStones.push({ position: [x, groundY(x, z) + 0.025, z], scale: [0.14 + step % 2 * 0.035, 0.075, 0.1], rotation: [0.1, routeIndex + step * 0.3, 0.05] });
          const chipX = x - dz * 0.16 * side;
          const chipZ = z + dx * 0.16 * side;
          if (safeNatural(chipX, chipZ, 0.05)) pebbles.push({ position: [chipX, groundY(chipX, chipZ) + 0.015, chipZ], scale: [0.045 + step % 3 * 0.015, 0.025, 0.055], rotation: [0, step, 0.1] });
        });
        seams.push({ position: [cx + dz * 0.1, 0.174, cz - dx * 0.1], scale: [width * 0.24, 0.003, 0.009], rotation: [0, routeIndex * 0.6 + step * 0.9, 0] });
        crackCount++;
      }
    });
    planterSoil.push(segment([-9.16, -1.1], [-9.16, -0.1], 0.055, 0.112, 0.008));
    planterSoil.push(segment([-9.16, 1.9], [-9.16, 2.9], 0.055, 0.112, 0.008));

    const extraArrays = [ribbonGrass, meadowReeds, ferns, daisies, lilyBells, flowerSpikes, greenLeaves, goldLeaves, goldenCrowns, treeHollows, barkRings, cutEnds, meadowTexture];
    const addedNaturalCount = naturalCount() - baselineNaturalCount + extraArrays.reduce((sum, items) => sum + items.length, 0);
    const detailStats = {
      baselineNaturalInstances: baselineNaturalCount,
      addedNaturalInstances: addedNaturalCount,
      totalNaturalInstances: baselineNaturalCount + addedNaturalCount,
      grassClumps: ribbonGrass.length, tallMeadowClumps: meadowReeds.length, fernClumps: ferns.length,
      daisyPlants: daisies.length, lilyPlants: lilyBells.length / 3, lilyBells: lilyBells.length,
      spireFlowers: flowerSpikes.length, addedMushrooms: mushroomCaps.length - baselineMushroomCount,
      fallenLeaves: greenLeaves.length + goldLeaves.length, rootAndTwigSegments: rootAndTwigCount,
      treeHollows: treeHollows.length, nests: nestCount, warmCanopyLayers: goldenCrowns.length,
      meadowSurfacePatches: meadowTexture.length, hedgeShrubs: hedgeCount, fallenLogs: logs.length, stumps: stumps.length,
      pathEdgeStones: pathEdgeStones.length, pathCracks: crackCount,
    };

    const windCrowns = crowns.filter((_, index) => index % 5 === 0);
    const staticCrowns = crowns.filter((_, index) => index % 5 !== 0);
    const windGrass = grasses.filter((_, index) => index % 7 === 0);
    const staticGrass = grasses.filter((_, index) => index % 7 !== 0);
    return {
      seams, groundLights, mounds, trunks, crowns: staticCrowns, windCrowns, shrubs,
      grasses: staticGrass, windGrass, planterSoil, sideRocks, lampPoles, lampGlows, terraces,
      flowerHeads, blossoms, plantStems, mushroomCaps, gardenBases, propsCanvas, propsLeaf,
      lanternBodies, lanternCaps, lanternHandles, embers,
      ribbonGrass, meadowReeds, ferns, daisies, lilyBells, flowerSpikes,
      greenLeaves, goldLeaves, goldenCrowns, treeHollows, barkRings, cutEnds,
      meadowTexture, pathEdgeStones, detailStats,
      stoneBoxes: [...paths, ...planterFrames, ...pergolaPosts, ...steppingStones, ...propsStone],
      woodBoxes: [...terraceSlats, ...pergolaRoof, ...benchSeats, ...propsWood, ...bookSpines],
      metalBoxes: [...railPosts, ...railBars, ...benchFrames, ...lampCaps],
      stoneCylinders: [...mushroomStems, ...gardenRing, ...propCylinders],
      leafyCrowns: [...sideCrowns, ...moss],
      decorativeRocks: [...pebbles, ...fireStones],
    };
  }, []);

  return (
    <group name="island-landscape" userData={{
      groundY: 0.1,
      style: 'warm-meadow-island',
      terrainBounds: { x: [-11.54, 11.52], y: [-1.5, 0.1], z: [-8.76, 8.51] },
      pierConnection: [0, -0.2, 8.6],
      beachClearance: { x: [6.5, 10], z: [4.5, 7.7] },
      gardenStations: [[8, 0.15, 1.1], [4.78, 0.15, 2.9], [4.62, 0.15, -0.97]],
      activityZones: ['entry-rest', 'gallery-courtyard', 'workshop-garden', 'interaction-ring', 'forest-reading', 'seaside-lanterns'],
      treeCount: 29,
      detailStats: layout.detailStats,
      buildingClearances: [
        { name: 'gallery', x: [-2.75, 2.75], z: [-3.075, 0.675] },
        { name: 'studio', x: [-7.24, -4.36], z: [-1.08, 1.68] },
        { name: 'lab', center: [5.8, 0.9], radius: 1.47 },
        { name: 'terminal', x: [1, 3], z: [-5.95, -4.65] },
      ],
    }}>
      <mesh geometry={geometries.base} material={materials.base} position={[0, -1.28, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={geometries.rim} material={materials.rim} position={[0, -1.18, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={geometries.surface} material={materials.surface} position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <Batch geometry={geometries.rock} material={materials.base} items={layout.sideRocks} />
      <Batch geometry={geometries.crown} material={materials.hill} items={layout.mounds} />
      <Batch geometry={geometries.box} material={materials.path} items={layout.stoneBoxes} />
      <Batch geometry={geometries.box} material={materials.gravel} items={layout.terraces} />
      <Batch geometry={geometries.box} material={materials.seat} items={layout.woodBoxes} />
      <Batch geometry={geometries.box} material={materials.trunk} items={layout.planterSoil} />
      <Batch geometry={geometries.box} material={materials.seam} items={layout.seams} castShadow={false} />
      <Batch geometry={geometries.box} material={materials.accent} items={layout.groundLights} castShadow={false} />
      <Batch geometry={geometries.cylinder} material={materials.trunk} items={layout.trunks} />
      <Batch geometry={geometries.crown} material={materials.leaf} items={layout.crowns} />
      <WindBatch geometry={geometries.crown} material={materials.leaf} items={layout.windCrowns} reducedMotion={reducedMotion} foliage />
      <Batch geometry={geometries.crown} material={materials.leafShade} items={layout.leafyCrowns} />
      <Batch geometry={geometries.crown} material={materials.shrub} items={layout.shrubs} />
      <Batch geometry={geometries.grass} material={materials.grass} items={layout.grasses} castShadow={false} />
      <WindBatch geometry={geometries.grass} material={materials.grass} items={layout.windGrass} reducedMotion={reducedMotion} />
      <Batch geometry={geometries.cylinder} material={materials.grass} items={layout.plantStems} castShadow={false} />
      <Batch geometry={geometries.crown} material={materials.flower} items={layout.flowerHeads} castShadow={false} />
      <Batch geometry={geometries.crown} material={materials.blossom} items={layout.blossoms} castShadow={false} />
      <Batch geometry={geometries.mushroom} material={materials.seat} items={layout.mushroomCaps} />
      <Batch geometry={geometries.rock} material={materials.rock} items={layout.decorativeRocks} />
      <Batch geometry={geometries.box} material={materials.metal} items={layout.metalBoxes} />
      <Batch geometry={geometries.cylinder} material={materials.metal} items={layout.lampPoles} />
      <Batch geometry={geometries.box} material={materials.lamp} items={layout.lampGlows} castShadow={false} />
      <Batch geometry={geometries.cylinder} material={materials.path} items={layout.stoneCylinders} />
      <Batch geometry={geometries.cylinder} material={materials.gravel} items={layout.gardenBases} />
      <Batch geometry={geometries.box} material={materials.flower} items={layout.propsCanvas} />
      <Batch geometry={geometries.box} material={materials.leafShade} items={layout.propsLeaf} />
      <Batch geometry={geometries.cylinder} material={materials.lamp} items={layout.lanternBodies} castShadow={false} />
      <Batch geometry={geometries.cylinder} material={materials.seat} items={layout.lanternCaps} />
      <Batch geometry={geometries.handle} material={materials.metal} items={layout.lanternHandles} />
      <Batch geometry={geometries.flame} material={materials.ember} items={layout.embers} castShadow={false} />
      <Batch geometry={geometries.ribbon} material={materials.freshGrass} items={layout.ribbonGrass} castShadow={false} />
      <Batch geometry={geometries.ribbon} material={materials.grass} items={layout.meadowReeds} castShadow={false} />
      <Batch geometry={geometries.fern} material={materials.freshGrass} items={layout.ferns} castShadow={false} />
      <Batch geometry={geometries.daisy} material={materials.flower} items={layout.daisies} castShadow={false} />
      <Batch geometry={geometries.bell} material={materials.flower} items={layout.lilyBells} castShadow={false} />
      <Batch geometry={geometries.spike} material={materials.blossom} items={layout.flowerSpikes} castShadow={false} />
      <Batch geometry={geometries.leaf} material={materials.freshGrass} items={layout.greenLeaves} castShadow={false} />
      <Batch geometry={geometries.leaf} material={materials.leafGold} items={layout.goldLeaves} castShadow={false} />
      <Batch geometry={geometries.crown} material={materials.leafGold} items={layout.goldenCrowns} />
      <Batch geometry={geometries.crown} material={materials.woodDark} items={layout.treeHollows} castShadow={false} />
      <Batch geometry={geometries.nest} material={materials.woodDark} items={layout.barkRings} castShadow={false} />
      <Batch geometry={geometries.cylinder} material={materials.seat} items={layout.cutEnds} />
      <Batch geometry={geometries.crown} material={materials.hill} items={layout.meadowTexture} castShadow={false} />
      <Batch geometry={geometries.rock} material={materials.gravel} items={layout.pathEdgeStones} />
      <pointLight position={[-3.65, 0.55, 6]} color="#f0d2a2" intensity={clay ? 0 : 0.22} distance={1.8} decay={2} />
      <group position={[-1.65, 0.1, 6.25]} rotation={[0, -0.1, 0]}>
        <mesh geometry={geometries.box} material={materials.path} position={[0, 0.3, 0]} scale={[0.48, 0.6, 0.42]} castShadow receiveShadow />
        <group position={[0, 0.64, 0]} rotation={[0.24, 0, 0]}>
          <mesh geometry={geometries.box} material={materials.metal} scale={[0.83, 0.085, 0.6]} castShadow receiveShadow />
          <mesh geometry={geometries.box} material={materials.screen} position={[0, 0.046, 0]} scale={[0.72, 0.012, 0.5]} receiveShadow />
          <mesh geometry={geometries.box} material={materials.accent} position={[-0.12, 0.056, 0]} scale={[0.025, 0.012, 0.32]} receiveShadow />
          <mesh geometry={geometries.box} material={materials.accent} position={[0.045, 0.056, 0.05]} scale={[0.34, 0.012, 0.025]} receiveShadow />
        </group>
      </group>
    </group>
  );
}
