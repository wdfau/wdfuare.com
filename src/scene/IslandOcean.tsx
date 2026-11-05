import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface IslandOceanProps {
  clay: boolean;
  reducedMotion: boolean;
  paused: boolean;
}

type V3 = [number, number, number];
type Instance = { position: V3; scale: V3; rotation?: V3 };

const waveFunctions = /* glsl */ `
  void addWave(inout vec3 field, vec2 p, vec2 direction, float frequency, float amplitude, float speed) {
    vec2 d = normalize(direction);
    float phase = dot(p, d) * frequency + uTime * speed;
    field.x += sin(phase) * amplitude;
    field.yz += cos(phase) * amplitude * frequency * d;
  }
  vec3 waveField(vec2 p) {
    vec3 field = vec3(0.0);
    addWave(field, p, vec2(0.88, 0.47), 0.52, 0.045, -0.32);
    addWave(field, p, vec2(-0.49, 0.87), 0.79, 0.021, 0.43);
    addWave(field, p, vec2(0.62, -0.78), 1.17, 0.012, 0.56);
    addWave(field, p, vec2(-0.93, -0.36), 1.90, 0.005, -0.71);
    return field;
  }
`;

const waterVertex = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  ${waveFunctions}
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorld.y += waveField(vWorld.xz).x;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform float uClay;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uViewDirection;
  uniform vec3 uSkyColor;
  uniform vec2 uCursor;
  uniform float uRippleStart;
  uniform float uRippleStrength;
  uniform vec2 uShore[32];
  varying vec3 vWorld;
  ${waveFunctions}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // Value and analytic derivative of smooth noise. Noise perturbs the normal,
  // never paints a visible pattern into the water's colour.
  vec3 noiseGradient(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 du = 6.0 * f * (1.0 - f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    float k = a - b - c + d;
    return vec3(a + (b-a)*u.x + (c-a)*u.y + k*u.x*u.y,
                ((b-a) + k*u.y) * du.x, ((c-a) + k*u.x) * du.y);
  }
  float shorelineDistance(vec2 p) {
    float distanceToShore = 1000.0;
    for (int i = 0; i < 32; i++) {
      vec2 a = uShore[i], b = uShore[i == 31 ? 0 : i + 1];
      vec2 edge = b - a;
      float t = clamp(dot(p - a, edge) / dot(edge, edge), 0.0, 1.0);
      distanceToShore = min(distanceToShore, length(p - a - edge*t));
    }
    return distanceToShore;
  }
  void main() {
    vec2 p = vWorld.xz;
    vec3 waves = waveField(p);
    vec3 broad = noiseGradient(p * 0.18 + vec2(uTime * 0.021, -uTime * 0.014));
    vec3 small = noiseGradient(p * 0.61 + vec2(-uTime * 0.032, uTime * 0.023));
    vec2 slope = waves.yz * 2.4 + broad.yz * 0.065 + small.yz * 0.038;

    // Mouse interaction bends only the surface normal. No rings are drawn.
    vec2 cursorDelta = p - uCursor;
    float radius = max(length(cursorDelta), 0.001);
    float age = max(uTime - uRippleStart, 0.0);
    float ripple = cos(radius * 5.5 - age * 3.1) * exp(-radius * 0.9) * uRippleStrength;
    slope += cursorDelta / radius * ripple * 0.024 * (1.0 - uClay);
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));
    // All fragments share the actual orthographic viewing direction.
    vec3 viewDirection = normalize(uViewDirection);
    vec3 lightDirection = normalize(vec3(-0.4, 0.8, 0.3));
    vec2 horizontalView = normalize(viewDirection.xz);
    vec2 acrossView = vec2(-horizontalView.y, horizontalView.x);
    // A broad sun opposite the viewing azimuth is reflected into a readable,
    // soft path; wave normals break that path organically rather than drawing it.
    vec3 reflectionSun = normalize(vec3(-viewDirection.x * 0.92, viewDirection.y + 0.13, -viewDirection.z * 0.92));
    vec3 halfDirection = normalize(viewDirection + reflectionSun);

    float coast = length(p / vec2(11.5, 8.8));
    float depth = 1.0 - smoothstep(0.92, 2.15, coast);
    vec3 body = mix(uDeep, uShallow, depth * 0.62);
    body *= 0.9 + max(dot(normal, lightDirection), 0.0) * 0.1;
    float fresnel = 0.025 + 0.975 * pow(1.0 - max(dot(normal, viewDirection), 0.0), 5.0);
    vec3 reflection = reflect(-viewDirection, normal);
    // Intersect reflected rays with a broad cloud layer. Changing normals move
    // the reflected cloud shapes across the surface instead of sliding a texture.
    vec2 reflectedSky = p + reflection.xz * (22.0 / max(reflection.y, 0.22));
    float cloudLow = noiseGradient(reflectedSky * 0.065 + vec2(uTime * 0.013, -uTime * 0.007)).x;
    float cloudHigh = noiseGradient(reflectedSky * 0.147 + vec2(-uTime * 0.011, uTime * 0.008)).x;
    float cloud = smoothstep(0.25, 0.83, cloudLow * 0.76 + cloudHigh * 0.24);
    vec3 skyReflection = mix(uSkyColor, uSunColor * 0.94, cloud * 0.88);
    float reflectionAmount = (0.18 + fresnel * 0.72) * mix(1.0, 0.24, uClay);
    vec3 color = mix(body, skyReflection, min(reflectionAmount, 0.48));

    vec3 mismatch = normal - halfDirection;
    float acrossSlope = dot(mismatch.xz, acrossView);
    float alongSlope = dot(mismatch.xz, horizontalView);
    float broadSun = exp(-pow(acrossSlope / 0.095, 2.0) - pow(alongSlope / 0.24, 2.0));
    float sunSparkle = exp(-pow(acrossSlope / 0.034, 2.0) - pow(alongSlope / 0.115, 2.0));
    vec2 sunCenter = -horizontalView * 31.0 + vec2(-2.0, 9.0);
    vec2 sunDelta = reflectedSky - sunCenter;
    float sunArea = exp(-pow(dot(sunDelta, acrossView) / 12.5, 2.0) - pow(dot(sunDelta, horizontalView) / 23.0, 2.0));
    color += uSunColor * sunArea * (broadSun * 0.075 + sunSparkle * 0.145) * (1.0 - uClay * 0.88);
    // Very soft near-shore refracted light follows the same moving wave field.
    float caustic = noiseGradient(p * 0.36 + slope * 2.6 + vec2(uTime * 0.047, -uTime * 0.027)).x;
    color *= 1.0 + (caustic - 0.5) * depth * 0.1 * (1.0 - uClay);

    // Thin, irregular white water is confined to the actual shore contour.
    if (coast > 0.82 && coast < 1.28) {
      float shore = shorelineDistance(p);
      float foam = exp(-pow((shore - 0.045 - waves.x * 0.23) * 20.0, 2.0));
      foam *= smoothstep(0.34, 0.72, noiseGradient(p * 0.88 + uTime * 0.024).x);
      color = mix(color, uFoam, foam * 0.22);
    }
    float contact = exp(-dot((p - vec2(-14.1, -1.4)) / vec2(1.65, 1.1), (p - vec2(-14.1, -1.4)) / vec2(1.65, 1.1)));
    contact += exp(-dot((p - vec2(5.2, 11.7)) / vec2(1.0, 0.64), (p - vec2(5.2, 11.7)) / vec2(1.0, 0.64))) * 0.4;
    color *= 1.0 - contact * 0.09;
    color = mix(color, uHorizon, smoothstep(32.0, 90.0, length(p)));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.filter = 'blur(12px)';
  [[112, 113, 98, 40], [223, 85, 123, 61], [337, 104, 111, 46], [403, 119, 62, 26]].forEach(([x, y, rx, ry]) => {
    context.save();
    context.translate(x, y);
    context.scale(rx, ry);
    const gradient = context.createRadialGradient(0, 0, 0.08, 0, 0, 1);
    gradient.addColorStop(0, 'rgba(255,255,255,0.64)');
    gradient.addColorStop(0.52, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(-1.1, -1.1, 2.2, 2.2);
    context.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Instances({ geometry, material, items, castShadow = true, name }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Instance[];
  castShadow?: boolean;
  name?: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    items.forEach((item, index) => {
      dummy.position.set(...item.position);
      dummy.rotation.set(...(item.rotation ?? [0, 0, 0]));
      dummy.scale.set(...item.scale);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [geometry, material, items]);
  return <instancedMesh ref={ref} name={name} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />;
}

export default function IslandOcean({ clay, reducedMotion, paused }: IslandOceanProps) {
  const { invalidate, camera } = useThree();
  const waterMesh = useRef<THREE.Mesh>(null);
  const boat = useRef<THREE.Group>(null);
  const buoy = useRef<THREE.Group>(null);
  const birds = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const clouds = useRef<THREE.Group>(null);
  const cloudMap = useMemo(cloudTexture, []);
  const frame = useRef(0);
  const birdTransform = useMemo(() => new THREE.Object3D(), []);
  const seaHit = useMemo(() => ({ plane: new THREE.Plane(), normal: new THREE.Vector3(), origin: new THREE.Vector3(), point: new THREE.Vector3(), normalMatrix: new THREE.Matrix3() }), []);

  const geometry = useMemo(() => {
    const hull = new THREE.Shape();
    hull.moveTo(0, 1.13);
    hull.quadraticCurveTo(0.58, 0.57, 0.47, -0.77);
    hull.quadraticCurveTo(0, -1.0, -0.47, -0.77);
    hull.quadraticCurveTo(-0.58, 0.57, 0, 1.13);
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute([
      0.02, 0.35, 0, 0.02, 2.18, 0, 1.04, 0.48, 0,
    ], 3));
    sail.computeVertexNormals();
    const smallSail = new THREE.BufferGeometry();
    smallSail.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.04, 0.4, 0, -0.04, 1.87, 0, -0.64, 0.53, 0,
    ], 3));
    smallSail.computeVertexNormals();
    const gull = new THREE.BufferGeometry();
    gull.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, -0.45, 0.15, -0.1, -0.12, -0.025, 0.065,
      0, 0, 0, 0.12, -0.025, 0.065, 0.45, 0.15, -0.1,
    ], 3));
    gull.computeVertexNormals();

    // A thin sandy cove follows the existing island surface; the dark natural
    // cliff below stays visible instead of becoming a bright vertical wall.
    const outline: [number, number][] = [
      [11.7, 0], [10.3, 4.7], [6, 8], [2.5, 8.45], [0, 7.98],
      [-2.8, 8.6], [-6, 7.8], [-10, 5.1], [-11.75, 0.15],
      [-10.3, -4.85], [-6, -7.8], [-0.45, -8.85], [5.4, -8.1], [10, -5.2],
    ];
    const shore = new THREE.CatmullRomCurve3(outline.map(([x, z]) => new THREE.Vector3(x * 0.973, 0, z * 0.973)), true, 'catmullrom', 0.25);
    const sandVertices: number[] = [];
    const sandColors: number[] = [];
    const sandIndices: number[] = [];
    const sandMarks: number[] = [];
    const samples = 20;
    const sandTint = [1.0, 0.94];
    function shoreAt(fraction: number) {
      const t = (1.03 + fraction * 0.94) / outline.length;
      const point = shore.getPoint(t);
      const tangent = shore.getTangent(t);
      const outward = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      return { point, outward };
    }
    for (let step = 0; step <= samples; step++) {
      const f = step / samples;
      const { point, outward } = shoreAt(f);
      const bayWidth = 0.03 + Math.pow(Math.sin(f * Math.PI), 0.85) * 0.97;
      const offsets = [-bayWidth * 1.35, -0.07];
      const heights = [0.128, 0.125];
      for (let row = 0; row < offsets.length; row++) {
        sandVertices.push(point.x + outward.x * offsets[row], heights[row], point.z + outward.z * offsets[row]);
        sandColors.push(sandTint[row], sandTint[row], sandTint[row]);
      }
      if (step < samples) for (let row = 0; row < 1; row++) {
        const a = step * 2 + row, b = a + 2;
        sandIndices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const beach = new THREE.BufferGeometry();
    beach.setAttribute('position', new THREE.Float32BufferAttribute(sandVertices, 3));
    beach.setAttribute('color', new THREE.Float32BufferAttribute(sandColors, 3));
    beach.setIndex(sandIndices);
    beach.computeVertexNormals();
    // Short, half-buried contour marks add texture without a separate image.
    for (let mark = 0; mark < 7; mark++) {
      const start = 0.17 + mark * 0.085;
      for (let segment = 0; segment < 3; segment++) {
        const a = shoreAt(start + segment * 0.014), b = shoreAt(start + (segment + 1) * 0.014);
        const inset = 0.18 + (mark % 3) * 0.13;
        sandMarks.push(a.point.x - a.outward.x * inset, 0.134, a.point.z - a.outward.z * inset,
                       b.point.x - b.outward.x * inset, 0.134, b.point.z - b.outward.z * inset);
      }
    }
    const beachMarks = new THREE.BufferGeometry();
    beachMarks.setAttribute('position', new THREE.Float32BufferAttribute(sandMarks, 3));
    return {
      box: new RoundedBoxGeometry(1, 1, 1, 2, 0.035),
      pole: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      rock: new THREE.IcosahedronGeometry(1, 0),
      hull: new THREE.ExtrudeGeometry(hull, { depth: 0.21, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.055, bevelThickness: 0.04, curveSegments: 14 }),
      ring: new THREE.TorusGeometry(1, 0.065, 6, 24),
      lifeRing: new THREE.TorusGeometry(1, 0.23, 8, 24),
      barrel: new THREE.CylinderGeometry(0.82, 0.73, 1, 10),
      shell: new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      pool: new THREE.CircleGeometry(1, 24),
      star: (() => {
        const shape = new THREE.Shape();
        for (let index = 0; index < 10; index++) {
          const angle = index / 10 * Math.PI * 2;
          const r = index % 2 ? 0.43 : 1;
          const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
          if (index === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        }
        shape.closePath();
        return new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.04, bevelThickness: 0.03 });
      })(),
      seaweed: (() => {
        const positions: number[] = [];
        for (let leaf = 0; leaf < 5; leaf++) {
          const angle = leaf * 2.399;
          const x = Math.cos(angle), z = Math.sin(angle);
          positions.push(-z * 0.035, 0, x * 0.035, z * 0.035, 0, -x * 0.035, x * 0.12, 0.2 + leaf % 2 * 0.07, z * 0.12,
                         z * 0.035, 0, -x * 0.035, x * 0.22, 0.31 + leaf % 2 * 0.1, z * 0.22, x * 0.12, 0.2 + leaf % 2 * 0.07, z * 0.12);
        }
        const blades = new THREE.BufferGeometry();
        blades.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        blades.computeVertexNormals();
        return blades;
      })(),
      dockRope: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.16, 0.7), new THREE.Vector3(0, 0, 1.4)]), 16, 0.016, 4, false),
      mooring: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.45, -0.17, 12.18), new THREE.Vector3(2.7, -0.68, 12.5), new THREE.Vector3(4.9, -0.51, 12.45)]), 20, 0.013, 4, false),
      sail, smallSail, gull, beach, beachMarks,
    };
  }, []);

  const material = useMemo(() => {
    const standard = (color: string, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });
    const sail = standard(clay ? '#e6e5dd' : '#fff3d8', 0.9);
    sail.side = THREE.DoubleSide;
    const wing = standard(clay ? '#e3e5df' : '#d5e0e3');
    wing.side = THREE.DoubleSide;
    const sand = new THREE.MeshStandardMaterial({ color: clay ? '#d9ddd5' : '#d7d3bf', roughness: 0.98, vertexColors: true, flatShading: true, side: THREE.DoubleSide });
    const sandMarks = new THREE.LineBasicMaterial({ color: clay ? '#aeb8b3' : '#b6b9ab', transparent: true, opacity: 0.42 });
    const glow = standard(clay ? '#e4e5dd' : '#ffedcb', 0.45);
    glow.emissive.set(clay ? '#000000' : '#ffddb1');
    glow.emissiveIntensity = clay ? 0 : 0.6;
    return {
      wood: standard(clay ? '#c4c9c5' : '#bca786'),
      pole: standard(clay ? '#aeb8bb' : '#7c8d80'),
      wall: standard(clay ? '#d8ddd8' : '#f3eddc'),
      blue: standard(clay ? '#a7b3b7' : '#86aaa6', 0.5),
      rock: standard(clay ? '#a3b0b6' : '#81988b'),
      rockTop: standard(clay ? '#bbc6c8' : '#adb5a1'),
      dark: standard(clay ? '#7b8e97' : '#5a706a'),
      rope: standard(clay ? '#c3c8c1' : '#bdb093'),
      cork: standard(clay ? '#c3c6bf' : '#d2c5a7'),
      barrel: standard(clay ? '#b9bfb8' : '#a48d68'),
      shell: standard(clay ? '#ecece3' : '#f1e8d1'),
      star: standard(clay ? '#c8c9bd' : '#c7a879'),
      wetStone: standard(clay ? '#aab7b3' : '#8c9f94', 0.45),
      seaweed: new THREE.MeshStandardMaterial({ color: clay ? '#a7b3a4' : '#788e6b', roughness: 0.88, side: THREE.DoubleSide }),
      pool: new THREE.MeshStandardMaterial({ color: clay ? '#b6c7c7' : '#82b9ad', roughness: 0.21, metalness: 0.06 }),
      sail, wing, glow, sand, sandMarks,
    };
  }, [clay]);

  const water = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    uniforms: {
      uTime: { value: 0 }, uClay: { value: clay ? 1 : 0 },
      uDeep: { value: new THREE.Color(clay ? '#acbfc3' : '#67afb5') },
      uShallow: { value: new THREE.Color(clay ? '#cbd7d7' : '#98d3c6') },
      uFoam: { value: new THREE.Color(clay ? '#e5eae5' : '#edf5e6') },
      uHorizon: { value: new THREE.Color(clay ? '#cbd8db' : '#c4dfe5') },
      uSunColor: { value: new THREE.Color('#fff1cf') },
      uSkyColor: { value: new THREE.Color('#79b6c4') },
      uViewDirection: { value: new THREE.Vector3(0.55, 0.51, 0.66) },
      uShore: { value: new THREE.CatmullRomCurve3([
        [11.7, 0], [10.3, 4.7], [6, 8], [2.5, 8.45], [0, 7.98],
        [-2.8, 8.6], [-6, 7.8], [-10, 5.1], [-11.75, 0.15],
        [-10.3, -4.85], [-6, -7.8], [-0.45, -8.85], [5.4, -8.1], [10, -5.2],
      ].map(([x, z]) => new THREE.Vector3(x * 0.973, 0, z * 0.973)), true, 'catmullrom', 0.25).getPoints(32).slice(0, 32).map((point) => new THREE.Vector2(point.x, point.z)) },
      uCursor: { value: new THREE.Vector2(50, 50) },
      uRippleStart: { value: -100 }, uRippleStrength: { value: 0 },
    },
    side: THREE.FrontSide,
  }), [clay]);

  const dock = useMemo(() => {
    const planks: Instance[] = [];
    const posts: Instance[] = [];
    const fittings: Instance[] = [];
    for (let index = 0; index < 18; index++) {
      planks.push({ position: [0, -0.27, 8.57 + index * 0.205], scale: [1.48, 0.14, 0.184] });
    }
    for (let index = 0; index < 9; index++) {
      planks.push({ position: [-1.44 + index * 0.36, -0.27, 12.16], scale: [0.335, 0.14, 1.04] });
    }
    [-0.66, 0.66].forEach((x) => [8.85, 10.25, 11.85].forEach((z) => {
      posts.push({ position: [x, -0.78, z], scale: [0.12, 1.65, 0.12] });
      fittings.push({ position: [x, 0.067, z], scale: [0.15, 0.08, 0.15] });
    }));
    [-1.35, 1.35].forEach((x) => {
      posts.push({ position: [x, -0.78, 12.25], scale: [0.14, 1.65, 0.14] });
      fittings.push({ position: [x, 0.067, 12.25], scale: [0.17, 0.08, 0.17] });
    });
    return { planks, posts, fittings };
  }, []);

  const details = useMemo(() => {
    const wood: Instance[] = [], metal: Instance[] = [], rope: Instance[] = [], glow: Instance[] = [];
    const coils: Instance[] = [], lifeRings: Instance[] = [], fenders: Instance[] = [], barrels: Instance[] = [], barrelBands: Instance[] = [];
    const shells: Instance[] = [], stars: Instance[] = [], stones: Instance[] = [], weed: Instance[] = [];
    const driftwood: Instance[] = [], pools: Instance[] = [], poolRims: Instance[] = [], poolBases: Instance[] = [];
    const lighthouseBoxes: Instance[] = [], lighthouseRods: Instance[] = [], lighthouseRings: Instance[] = [], lighthouseSteps: Instance[] = [], lighthouseGlow: Instance[] = [];
    const boatWood: Instance[] = [], boatRods: Instance[] = [], boatRopes: Instance[] = [], boatCoils: Instance[] = [], boatRings: Instance[] = [], boatSeams: Instance[] = [];
    function rod(a: V3, b: V3, radius: number): Instance {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
      const direction = end.sub(start);
      const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
      return { position: start.addScaledVector(direction, 0.5).toArray() as V3, scale: [radius * 2, direction.length(), radius * 2], rotation: [rotation.x, rotation.y, rotation.z] };
    }
    // Six proper T-shaped cleats, keeping the middle of the boardwalk clear.
    [-1, 1].forEach((side) => [9.2, 10.82, 12.42].forEach((z) => {
      metal.push({ position: [side * 0.52, -0.155, z], scale: [0.23, 0.055, 0.085] });
      metal.push({ position: [side * 0.52, -0.205, z], scale: [0.065, 0.08, 0.065] });
    }));
    [[-0.43, 9.7], [0.42, 11.25], [-1.15, 12.17]].forEach(([x, z]) => {
      for (let ring = 0; ring < 4; ring++) coils.push({ position: [x, -0.185 + ring * 0.003, z], scale: [0.095 + ring * 0.023, 0.095 + ring * 0.023, 0.095 + ring * 0.023], rotation: [-Math.PI / 2, 0, 0] });
    });
    [-1, 1].forEach((side) => {
      lifeRings.push({ position: [side * 0.76, -0.27, 10.28], scale: [0.205, 0.205, 0.205], rotation: [0, Math.PI / 2, 0] });
      [10.05, 11.77].forEach((z) => {
        fenders.push({ position: [side * 0.86, -0.51, z], scale: [0.155, 0.43, 0.155], rotation: [0, 0, side * 0.08] });
        rope.push(rod([side * 0.65, -0.13, z - 0.07], [side * 0.84, -0.3, z], 0.012));
      });
    });
    // Two oars resting outside the walkway, each with a clear wooden blade.
    [-1, 1].forEach((side) => {
      wood.push({ position: [side * 0.77, -0.13, 10.91], scale: [0.045, 0.045, 1.15], rotation: [0, side * 0.12, 0] });
      wood.push({ position: [side * 0.82, -0.12, 11.48], scale: [0.16, 0.035, 0.28], rotation: [0, side * 0.12, 0] });
    });
    [-1.1, 1.13].forEach((x) => {
      barrels.push({ position: [x, -0.015, 12.12], scale: [0.22, 0.37, 0.22] });
      [-0.145, 0.105].forEach((y) => barrelBands.push({ position: [x, y, 12.12], scale: [0.18, 0.18, 0.18], rotation: [-Math.PI / 2, 0, 0] }));
      wood.push({ position: [x, 0.175, 12.12], scale: [0.31, 0.025, 0.31] });
    });
    [[0.31, 9.37], [-0.35, 11.3]].forEach(([x, z]) => {
      wood.push({ position: [x, -0.055, z], scale: [0.33, 0.29, 0.34] });
      [-0.62, 0.62].forEach((angle) => wood.push({ position: [x, -0.05, z + 0.18], scale: [0.35, 0.035, 0.025], rotation: [0, 0, angle] }));
      metal.push({ position: [x, -0.005, z + 0.2], scale: [0.08, 0.04, 0.02] });
    });
    [[-0.66, 8.85], [0.66, 8.85], [1.35, 12.25]].forEach(([x, z]) => {
      glow.push({ position: [x, 0.2, z], scale: [0.13, 0.2, 0.13] });
      metal.push({ position: [x, 0.32, z], scale: [0.19, 0.045, 0.19] });
      metal.push({ position: [x, 0.085, z], scale: [0.19, 0.035, 0.19] });
      [-1, 1].forEach((side) => metal.push({ position: [x + side * 0.075, 0.2, z], scale: [0.022, 0.2, 0.15] }));
    });
    // A three-rung rope ladder over the front edge of the landing.
    [0.59, 0.99].forEach((x) => rope.push(rod([x, -0.16, 12.71], [x, -0.84, 12.77], 0.015)));
    [-0.27, -0.46, -0.65].forEach((y) => wood.push({ position: [0.79, y, 12.74], scale: [0.43, 0.055, 0.055] }));

    // Populate the sandy lip itself, not the open water around the island.
    const curve = new THREE.CatmullRomCurve3([
      [11.7, 0], [10.3, 4.7], [6, 8], [2.5, 8.45], [0, 7.98], [-2.8, 8.6], [-6, 7.8],
      [-10, 5.1], [-11.75, 0.15], [-10.3, -4.85], [-6, -7.8], [-0.45, -8.85], [5.4, -8.1], [10, -5.2],
    ].map(([x, z]) => new THREE.Vector3(x * 0.973, 0, z * 0.973)), true, 'catmullrom', 0.25);
    const shoreAt = (f: number, inset: number, y = 0.14): V3 => {
      const t = (1.03 + f * 0.94) / 14;
      const p = curve.getPoint(t), tangent = curve.getTangent(t);
      const n = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      return [p.x - n.x * inset, y, p.z - n.z * inset];
    };
    for (let index = 0; index < 10; index++) {
      const radius = 0.105 + index % 3 * 0.022;
      shells.push({ position: shoreAt(0.16 + index * 0.068, 0.18 + index % 3 * 0.18), scale: [radius, 0.045, radius * 0.78], rotation: [0, index * 1.41, 0] });
    }
    for (let index = 0; index < 5; index++) stars.push({ position: shoreAt(0.22 + index * 0.13, 0.31 + index % 2 * 0.2, 0.142), scale: [0.13, 0.13, 0.13], rotation: [-Math.PI / 2, 0, index * 0.6] });
    for (let index = 0; index < 8; index++) stones.push({ position: shoreAt(0.12 + index * 0.095, 0.09 + index % 2 * 0.13, 0.16), scale: [0.13 + index % 3 * 0.03, 0.065, 0.095 + index % 2 * 0.025], rotation: [0, index * 0.8, 0.2] });
    [0.26, 0.56, 0.77].forEach((f, index) => {
      const p = shoreAt(f, 0.58, 0.175);
      driftwood.push(rod([p[0] - 0.24, p[1], p[2] - 0.11], [p[0] + 0.24, p[1] + 0.025, p[2] + 0.12], 0.042));
      driftwood.push(rod([p[0], p[1], p[2]], [p[0] + 0.04, p[1] + 0.02, p[2] + 0.21 + index * 0.035], 0.021));
    });
    for (let index = 0; index < 5; index++) weed.push({ position: shoreAt(0.18 + index * 0.14, 0.68, 0.13), scale: [0.55, 0.55 + index % 2 * 0.12, 0.55], rotation: [0, index * 1.3, 0.28] });
    [[10.9, 5.95], [10.45, 6.8]].forEach(([x, z]) => {
      poolBases.push({ position: [x, -0.68, z], scale: [0.63, 0.16, 0.43], rotation: [0.05, 0.2, 0.04] });
      pools.push({ position: [x, -0.475, z], scale: [0.43, 0.28, 1], rotation: [-Math.PI / 2, 0, 0] });
      poolRims.push({ position: [x, -0.46, z], scale: [0.49, 0.32, 0.23], rotation: [-Math.PI / 2, 0, 0] });
    });

    // Local boat details inherit its gentle bobbing and roll.
    [-0.4, 0.5].forEach((z) => boatWood.push({ position: [0, 0.29, z], scale: [0.76, 0.075, 0.18] }));
    [-1, 1].forEach((side) => boatWood.push({ position: [side * 0.42, 0.25, -0.04], scale: [0.045, 0.065, 1.38], rotation: [0, side * -0.05, 0] }));
    boatRopes.push(rod([0, 2.35, -0.1], [-0.4, 0.3, 0.65], 0.009), rod([0, 2.35, -0.1], [0.28, 0.28, -0.79], 0.009));
    for (let ring = 0; ring < 3; ring++) boatCoils.push({ position: [-0.09, 0.265, -0.72], scale: [0.07 + ring * 0.018, 0.07 + ring * 0.018, 0.07 + ring * 0.018], rotation: [-Math.PI / 2, 0, 0] });
    boatRods.push(rod([-0.36, 0.31, -0.56], [0.6, 0.3, 0.78], 0.017));
    boatWood.push({ position: [0.61, 0.3, 0.8], scale: [0.15, 0.03, 0.29], rotation: [0, -0.65, 0] });
    boatRings.push({ position: [-0.45, 0.19, 0.22], scale: [0.14, 0.14, 0.14], rotation: [0, Math.PI / 2, 0] });
    boatWood.push({ position: [0.18, 0.34, -0.58], scale: [0.25, 0.14, 0.23], rotation: [0, 0.1, 0] });
    // Seams follow the sail's triangular plane, so the cloth remains readable.
    for (let index = 0; index < 4; index++) {
      const y = 0.61 + index * 0.31;
      const maxX = 1.04 * (2.18 - y) / (2.18 - 0.48);
      boatSeams.push(rod([0.055, y, 0.009], [maxX - 0.035, y + 0.006, 0.009], 0.006));
    }

    // Lighthouse details are local to its existing plinth and rotation.
    lighthouseBoxes.push({ position: [0, 0.42, 0.335], scale: [0.2, 0.45, 0.025] });
    lighthouseBoxes.push({ position: [0, 1.04, 0.27], scale: [0.12, 0.18, 0.025] }, { position: [0.265, 1.01, 0], scale: [0.025, 0.18, 0.12] });
    [0.42, 0.59, 0.76].forEach((z, index) => lighthouseSteps.push({ position: [0, -0.055 - index * 0.065, z], scale: [0.44 + index * 0.04, 0.12, 0.19] }));
    for (let index = 0; index < 10; index++) {
      const angle = index / 10 * Math.PI * 2;
      lighthouseRods.push(rod([Math.cos(angle) * 0.37, 1.59, Math.sin(angle) * 0.37], [Math.cos(angle) * 0.37, 1.82, Math.sin(angle) * 0.37], 0.011));
    }
    lighthouseRings.push({ position: [0, 1.82, 0], scale: [0.37, 0.37, 0.37], rotation: [-Math.PI / 2, 0, 0] });
    lighthouseRings.push({ position: [0, 2.04, 0], scale: [0.27, 0.27, 0.27], rotation: [-Math.PI / 2, 0, 0] });
    lighthouseBoxes.push({ position: [-0.17, 0.56, 0.33], scale: [0.06, 0.11, 0.07] });
    lighthouseGlow.push({ position: [-0.17, 0.56, 0.373], scale: [0.043, 0.075, 0.025] });
    lighthouseSteps.push({ position: [0.11, -0.2, 1.0], scale: [0.25, 0.08, 0.21], rotation: [0, 0.2, 0] });

    return { wood, metal, rope, glow, coils, lifeRings, fenders, barrels, barrelBands, shells, stars, stones, weed, driftwood, pools, poolRims, poolBases,
      lighthouseBoxes, lighthouseRods, lighthouseRings, lighthouseSteps, lighthouseGlow, boatWood, boatRods, boatRopes, boatCoils, boatRings, boatSeams };
  }, []);

  const reefs = useMemo<Instance[]>(() => [
    { position: [-14.1, -0.65, -1.4], scale: [1.3, 0.72, 1.02], rotation: [0.1, 0.4, 0.18] },
    { position: [-14.8, -0.73, -1.88], scale: [0.64, 0.47, 0.55], rotation: [0.3, -0.2, 0.2] },
    { position: [-13.8, -0.5, -0.8], scale: [0.62, 0.36, 0.53], rotation: [0.2, 0.8, 0.3] },
    { position: [11.8, -0.61, 5.8], scale: [0.86, 0.59, 0.64], rotation: [0.1, 0.4, 0.28] },
    { position: [12.6, -0.77, 5.1], scale: [0.46, 0.28, 0.39], rotation: [0.4, 0.2, 0] },
    { position: [-8.6, -0.61, 9.2], scale: [0.64, 0.41, 0.48], rotation: [0.2, 0.5, 0.16] },
    { position: [-9.25, -0.73, 9.4], scale: [0.3, 0.21, 0.26], rotation: [0.4, 0.1, 0.2] },
    { position: [7.8, -0.74, -10.3], scale: [0.55, 0.34, 0.46], rotation: [0.2, 0.6, 0.18] },
  ], []);

  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
  }, [geometry]);
  useEffect(() => () => Object.values(material).forEach((item) => item.dispose()), [material]);
  useEffect(() => () => water.dispose(), [water]);
  useEffect(() => () => cloudMap.dispose(), [cloudMap]);
  useEffect(() => { invalidate(); }, [clay, reducedMotion, paused, invalidate]);

  useFrame((_, delta) => {
    const active = !paused && !reducedMotion && !document.hidden;
    if (active) time.current += Math.min(delta, 0.05);
    const t = reducedMotion ? 0 : time.current;
    water.uniforms.uTime.value = t;
    camera.getWorldDirection(water.uniforms.uViewDirection.value).negate();
    if (clouds.current) clouds.current.position.x = Math.sin(t * 0.025) * 0.6;
    if (active) water.uniforms.uRippleStrength.value *= Math.exp(-Math.min(delta, 0.05) * 1.1);
    else water.uniforms.uRippleStrength.value = 0;
    if (boat.current) {
      boat.current.position.y = -0.59 + Math.sin(t * 0.73) * 0.045;
      boat.current.rotation.z = Math.sin(t * 0.63 + 0.6) * 0.026;
      boat.current.rotation.x = Math.sin(t * 0.47) * 0.017;
    }
    if (buoy.current) {
      buoy.current.position.y = -0.55 + Math.sin(t * 0.87 + 1.8) * 0.035;
      buoy.current.rotation.z = Math.sin(t * 0.68) * 0.045;
    }
    if (birds.current) {
      for (let index = 0; index < 3; index++) {
        const phase = index * 1.9;
        const angle = t * 0.075 + phase;
        birdTransform.position.set(-7.2 + Math.cos(angle) * (2.5 + index * 0.45), 4.8 + index * 0.34 + Math.sin(t * 0.5 + phase) * 0.15, -7 + Math.sin(angle) * 1.8);
        birdTransform.rotation.set(0.05, -angle + Math.PI / 2, Math.sin(t * 0.5 + phase) * 0.08);
        birdTransform.scale.setScalar(0.62 + index * 0.08);
        birdTransform.updateMatrix();
        birds.current.setMatrixAt(index, birdTransform.matrix);
      }
      birds.current.instanceMatrix.needsUpdate = true;
      if (frame.current++ === 0) birds.current.computeBoundingSphere();
    }
    if (active) invalidate();
  });

  // The animated displacement is only a few centimetres; a plane intersection
  // avoids testing every water triangle on every mouse move.
  function raycastWater(raycaster: THREE.Raycaster, intersections: THREE.Intersection[]) {
    const mesh = waterMesh.current;
    if (!mesh) return;
    seaHit.normal.set(0, 0, 1).applyNormalMatrix(seaHit.normalMatrix.getNormalMatrix(mesh.matrixWorld));
    seaHit.origin.set(0, 0, 0).applyMatrix4(mesh.matrixWorld);
    seaHit.plane.setFromNormalAndCoplanarPoint(seaHit.normal, seaHit.origin);
    if (!raycaster.ray.intersectPlane(seaHit.plane, seaHit.point)) return;
    const distance = raycaster.ray.origin.distanceTo(seaHit.point);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersections.push({ distance, point: seaHit.point.clone(), object: mesh });
  }

  function ripple(event: ThreeEvent<PointerEvent>) {
    if (reducedMotion || paused || event.pointerType === 'touch') return;
    water.uniforms.uCursor.value.set(event.point.x, event.point.z);
    water.uniforms.uRippleStart.value = time.current;
    water.uniforms.uRippleStrength.value = 0.85;
    invalidate();
  }

  return <group name="island-ocean">
    <mesh ref={waterMesh} position={[0, -0.8, 0]} rotation={[-Math.PI / 2, 0, 0]} material={water} raycast={raycastWater} onPointerMove={ripple}>
      <planeGeometry args={[180, 180, 128, 128]} />
    </mesh>
    <mesh geometry={geometry.beach} material={material.sand} receiveShadow />
    <lineSegments geometry={geometry.beachMarks} material={material.sandMarks} />
    <Instances geometry={geometry.rock} material={material.rockTop} items={[
      { position: [9.14, 0.22, 5.13], scale: [0.28, 0.17, 0.2], rotation: [0.1, 0.45, 0.05] },
      { position: [8.82, 0.17, 5.38], scale: [0.16, 0.11, 0.13], rotation: [0.2, 0.7, 0.1] },
      { position: [6.64, 0.17, 7.1], scale: [0.22, 0.13, 0.17], rotation: [0.2, 0.3, 0.15] },
    ]} />
    <Instances name="coastal-dock-deck" geometry={geometry.box} material={material.wood} items={dock.planks} />
    <Instances geometry={geometry.pole} material={material.pole} items={dock.posts} />
    <Instances geometry={geometry.box} material={material.blue} items={dock.fittings} />
    <Instances geometry={geometry.rock} material={material.rock} items={reefs} />
    <group name="coastal-detail-clusters" userData={{ detailCounts: { dock: 30, boat: 14, beach: 33, lighthouse: 10, total: 87 } }}>
      <Instances name="dock-storage-oars-and-ladder" geometry={geometry.box} material={material.wood} items={details.wood} />
      <Instances name="dock-cleats-and-lantern-frames" geometry={geometry.box} material={material.dark} items={details.metal} />
      <Instances name="dock-fender-and-ladder-cords" geometry={geometry.pole} material={material.rope} items={details.rope} />
      <Instances name="dock-coiled-ropes" geometry={geometry.ring} material={material.rope} items={details.coils} />
      <Instances name="dock-lifebuoys" geometry={geometry.lifeRing} material={material.cork} items={details.lifeRings} />
      <Instances name="dock-soft-fenders" geometry={geometry.pole} material={material.cork} items={details.fenders} />
      <Instances name="dock-wooden-barrels" geometry={geometry.barrel} material={material.barrel} items={details.barrels} />
      <Instances name="dock-barrel-bands" geometry={geometry.ring} material={material.dark} items={details.barrelBands} />
      <Instances name="dock-warm-lanterns" geometry={geometry.box} material={material.glow} items={details.glow} castShadow={false} />
      <Instances name="dock-sagging-guard-ropes" geometry={geometry.dockRope} material={material.rope} items={[
        { position: [-0.66, 0.045, 8.85], scale: [1, 1, 1] }, { position: [-0.66, 0.045, 10.25], scale: [1, 1, 1.14] },
        { position: [0.66, 0.045, 8.85], scale: [1, 1, 1] }, { position: [0.66, 0.045, 10.25], scale: [1, 1, 1.14] },
      ]} />
      <mesh name="boat-mooring-line" geometry={geometry.mooring} material={material.rope} />
      <Instances name="beach-clam-shells" geometry={geometry.shell} material={material.shell} items={details.shells} />
      <Instances name="beach-starfish" geometry={geometry.star} material={material.star} items={details.stars} />
      <Instances name="beach-wet-pebbles" geometry={geometry.rock} material={material.wetStone} items={details.stones} />
      <Instances name="beach-branched-driftwood" geometry={geometry.pole} material={material.barrel} items={details.driftwood} />
      <Instances name="beach-seaweed-tufts" geometry={geometry.seaweed} material={material.seaweed} items={details.weed} />
      <Instances name="beach-tidepool-rocks" geometry={geometry.rock} material={material.rockTop} items={details.poolBases} />
      <Instances name="beach-tidepool-water" geometry={geometry.pool} material={material.pool} items={details.pools} castShadow={false} />
      <Instances name="beach-tidepool-rims" geometry={geometry.ring} material={material.wetStone} items={details.poolRims} />
    </group>

    <group position={[-14.1, -0.27, -1.4]} rotation={[0, 0.2, 0]}>
      <Instances name="lighthouse-door-and-windows" geometry={geometry.box} material={material.dark} items={details.lighthouseBoxes} />
      <Instances name="lighthouse-gallery-balusters" geometry={geometry.pole} material={material.dark} items={details.lighthouseRods} />
      <Instances name="lighthouse-gallery-and-roof-bands" geometry={geometry.ring} material={material.dark} items={details.lighthouseRings} />
      <Instances name="lighthouse-entry-steps" geometry={geometry.box} material={material.rockTop} items={details.lighthouseSteps} />
      <Instances name="lighthouse-door-lantern" geometry={geometry.box} material={material.glow} items={details.lighthouseGlow} castShadow={false} />
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow><cylinderGeometry args={[0.66, 0.8, 0.16, 9]} /><meshStandardMaterial color={clay ? '#b8c4c8' : '#8ea3ab'} roughness={0.88} /></mesh>
      <mesh position={[0, 0.77, 0]} castShadow receiveShadow><cylinderGeometry args={[0.23, 0.38, 1.4, 10]} /><primitive object={material.wall} attach="material" /></mesh>
      <mesh position={[0, 1.22, 0]} castShadow><cylinderGeometry args={[0.257, 0.27, 0.27, 10]} /><primitive object={material.blue} attach="material" /></mesh>
      <mesh position={[0, 1.55, 0]} castShadow><cylinderGeometry args={[0.38, 0.38, 0.09, 12]} /><primitive object={material.dark} attach="material" /></mesh>
      <mesh position={[0, 1.8, 0]}><cylinderGeometry args={[0.21, 0.21, 0.4, 10]} /><primitive object={material.glow} attach="material" /></mesh>
      <mesh position={[0, 2.04, 0]} castShadow><coneGeometry args={[0.37, 0.27, 10]} /><primitive object={material.blue} attach="material" /></mesh>
      {[0, 1, 2, 3].map((index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * 0.23, 1.78, Math.sin(index * Math.PI / 2) * 0.23]} castShadow><cylinderGeometry args={[0.025, 0.025, 0.43, 6]} /><primitive object={material.dark} attach="material" /></mesh>)}
    </group>

    <group ref={boat} position={[5.2, -0.59, 11.7]} rotation={[0, -0.45, 0]}>
      <Instances name="boat-seats-gunwales-and-stowage" geometry={geometry.box} material={material.wood} items={details.boatWood} />
      <Instances name="boat-oar-shaft" geometry={geometry.pole} material={material.wood} items={details.boatRods} />
      <Instances name="boat-standing-rigging" geometry={geometry.pole} material={material.rope} items={details.boatRopes} />
      <Instances name="boat-bow-rope-coil" geometry={geometry.ring} material={material.rope} items={details.boatCoils} />
      <Instances name="boat-lifebuoy" geometry={geometry.lifeRing} material={material.cork} items={details.boatRings} />
      <mesh geometry={geometry.hull} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow><primitive object={material.blue} attach="material" /></mesh>
      <mesh geometry={geometry.box} position={[0, 0.21, -0.08]} scale={[0.69, 0.06, 1.25]} castShadow><primitive object={material.wall} attach="material" /></mesh>
      <mesh geometry={geometry.pole} position={[0, 1.24, -0.1]} scale={[0.045, 2.3, 0.045]} castShadow><primitive object={material.pole} attach="material" /></mesh>
      <group position={[0, 0.18, -0.1]} rotation={[0, 0.43, 0]}>
        <Instances name="boat-sail-panel-seams" geometry={geometry.pole} material={material.rope} items={details.boatSeams} castShadow={false} />
        <mesh geometry={geometry.sail} castShadow><primitive object={material.sail} attach="material" /></mesh>
        <mesh geometry={geometry.smallSail} castShadow><primitive object={material.wood} attach="material" /></mesh>
      </group>
      <mesh geometry={geometry.box} position={[0.08, 0.31, 0.67]} scale={[0.7, 0.07, 0.13]} castShadow><primitive object={material.wood} attach="material" /></mesh>
    </group>

    <group ref={buoy} position={[11.2, -0.55, -7.8]}>
      <mesh castShadow><cylinderGeometry args={[0.19, 0.32, 0.28, 12]} /><primitive object={material.blue} attach="material" /></mesh>
      <mesh position={[0, 0.37, 0]} castShadow><cylinderGeometry args={[0.045, 0.08, 0.6, 8]} /><primitive object={material.wall} attach="material" /></mesh>
      <mesh position={[0, 0.73, 0]}><sphereGeometry args={[0.095, 10, 8]} /><primitive object={material.glow} attach="material" /></mesh>
    </group>
    {!clay && <group ref={clouds}>
      <sprite position={[-24, 10, -22]} scale={[17, 5.5, 1]}><spriteMaterial map={cloudMap} color="#fff5df" transparent opacity={0.38} depthWrite={false} /></sprite>
      <sprite position={[22, 13, -31]} scale={[22, 7, 1]}><spriteMaterial map={cloudMap} color="#fdf4e4" transparent opacity={0.3} depthWrite={false} /></sprite>
    </group>}
    <instancedMesh ref={birds} args={[geometry.gull, material.wing, 3]} frustumCulled={false} />
  </group>;
}
