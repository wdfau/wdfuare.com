import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import gsap from 'gsap';
import IslandBuildings from './IslandBuildings';
import IslandLandscape from './IslandLandscape';
import IslandOcean from './IslandOcean';
import IslandLife from './IslandLife';
import { islandMarkers, type MarkerLayout, type IslandView } from './islandPlan';

export type { IslandView } from './islandPlan';
export interface IslandSceneProps {
  view: { id: IslandView; revision: number };
  clay: boolean;
  autoRotate: boolean;
  showGrid: boolean;
  showMarkers: boolean;
  reducedMotion: boolean;
  paused: boolean;
  onReady: () => void;
  onError: () => void;
  onSelect: (view: IslandView) => void;
  onMarkerLayout: (positions: MarkerLayout[]) => void;
}

type CameraPreset = { position: [number, number, number]; target: [number, number, number]; zoom: number };
const PRESETS: Record<IslandView, CameraPreset> = {
  overview: { position: [24, 22, 29], target: [0, 0.1, 1], zoom: 1.08 },
  entry: { position: [14, 12, 27], target: [0, 0.35, 4.8], zoom: 1.42 },
  gallery: { position: [11, 8.5, 14], target: [0, 1.15, -1.2], zoom: 2.35 },
  studio: { position: [1.5, 8.8, 17], target: [-5.8, 0.9, 0.3], zoom: 2.7 },
  lab: { position: [18, 11, 17], target: [5.8, 1.1, 0.9], zoom: 2.8 },
  terminal: { position: [12, 13, 5], target: [2, 0.9, -5.3], zoom: 3 },
  coast: { position: [19, 13, 24], target: [2.2, -0.25, 9.6], zoom: 1.85 },
};

function MarkerProjection({ onLayout }: { onLayout: (positions: MarkerLayout[]) => void }) {
  const { scene, camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const layouts = useMemo<MarkerLayout[]>(() => islandMarkers.map(({ id }) => ({ id, x: 0, y: 0, visible: false })), []);
  useFrame(() => {
    const world = scene.getObjectByName('pointer-world');
    if (!world) return;
    world.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    islandMarkers.forEach((marker, index) => {
      point.fromArray(marker.position).applyMatrix4(world.matrixWorld).project(camera);
      layouts[index].x = (point.x + 1) * size.width / 2;
      layouts[index].y = (1 - point.y) * size.height / 2;
      layouts[index].visible = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < 1.04 && Math.abs(point.y) < 1.04;
    });
    onLayout(layouts);
  });
  return null;
}

function PointerWorld({ children, reducedMotion, paused }: { children: ReactNode; reducedMotion: boolean; paused: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const resumeAt = useRef(0);
  const { invalidate } = useThree();

  useEffect(() => {
    pointer.current = { x: 0, y: 0 };
    dragging.current = false;
    resumeAt.current = 0;
    if (group.current && (reducedMotion || paused)) {
      group.current.rotation.y = 0;
      group.current.position.set(0, 0, 0);
      if (!paused) invalidate();
    }
    if (reducedMotion || paused) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || dragging.current || event.buttons) return;
      pointer.current = {
        x: THREE.MathUtils.clamp(event.clientX / innerWidth * 2 - 1, -1, 1),
        y: THREE.MathUtils.clamp(event.clientY / innerHeight * 2 - 1, -1, 1),
      };
      invalidate();
    };
    const reset = () => { pointer.current = { x: 0, y: 0 }; invalidate(); };
    const down = () => { dragging.current = true; reset(); };
    const up = () => { dragging.current = false; resumeAt.current = performance.now() + 450; reset(); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    window.addEventListener('blur', up);
    document.documentElement.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
      document.documentElement.removeEventListener('pointerleave', reset);
    };
  }, [reducedMotion, paused, invalidate]);

  useFrame((_, delta) => {
    if (!group.current || reducedMotion || paused) return;
    const active = !dragging.current && performance.now() >= resumeAt.current;
    const x = active ? pointer.current.x : 0;
    const y = active ? pointer.current.y : 0;
    const ease = 1 - Math.exp(-Math.min(delta, 0.05) * 5.5);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, x * 0.045, ease);
    group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, x * 0.13, ease);
    group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, y * 0.07, ease);
    if (Math.abs(group.current.rotation.y - x * 0.045) > 0.00008 || Math.abs(group.current.position.z - y * 0.07) > 0.0001) invalidate();
  });

  return <group ref={group} name="pointer-world">{children}</group>;
}

function CameraRig({ view, autoRotate, reducedMotion, paused, onReady, onError }: Pick<IslandSceneProps, 'view' | 'autoRotate' | 'reducedMotion' | 'paused' | 'onReady' | 'onError'>) {
  const controls = useRef<OrbitControlsImpl>(null);
  const animation = useRef<gsap.core.Timeline | null>(null);
  const firstFrame = useRef(false);
  const readyFrame = useRef(0);
  const { camera, size, invalidate, gl } = useThree();
  const baseZoom = Math.min(size.width / (size.width < 760 ? 30 : 40), size.height / (size.width < 760 ? 32 : 27));

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onError(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onError]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const preset = PRESETS[view.id];
    const orthographic = camera as THREE.OrthographicCamera;
    animation.current?.kill();
    const duration = reducedMotion || !firstFrame.current ? 0 : 0.85;
    animation.current = gsap.timeline({ defaults: { duration, ease: 'power3.inOut' }, onUpdate: () => {
      orthographic.updateProjectionMatrix();
      orbit.update();
      invalidate();
    } });
    animation.current.to(camera.position, { x: preset.position[0], y: preset.position[1], z: preset.position[2] }, 0);
    animation.current.to(orbit.target, { x: preset.target[0], y: preset.target[1], z: preset.target[2] }, 0);
    animation.current.to(camera, { zoom: baseZoom * preset.zoom }, 0);
    invalidate();
    return () => { animation.current?.kill(); };
  }, [view, baseZoom, camera, reducedMotion, invalidate]);

  useEffect(() => { animation.current?.paused(paused); }, [paused]);

  useFrame((_, delta) => {
    if (controls.current && autoRotate) controls.current.autoRotateSpeed = 0.45 * Math.min(delta, 0.05) * 60;
    if (!firstFrame.current) {
      firstFrame.current = true;
      readyFrame.current = requestAnimationFrame(onReady);
    }
  }, -2);
  useEffect(() => () => { cancelAnimationFrame(readyFrame.current); animation.current?.kill(); }, []);

  return <OrbitControls ref={controls} makeDefault enabled={!paused} enableDamping dampingFactor={0.09} minPolarAngle={0.12} maxPolarAngle={Math.PI / 2 - 0.09} minZoom={baseZoom * 0.65} maxZoom={baseZoom * 4.7} rotateSpeed={0.62} zoomSpeed={0.8} panSpeed={0.7} autoRotate={autoRotate} autoRotateSpeed={0.45} onStart={() => { animation.current?.kill(); }} />;
}

function Stage({ clay, showGrid }: Pick<IslandSceneProps, 'clay' | 'showGrid'>) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = clay ? 1.05 : 1;
    invalidate();
  }, [clay, gl, invalidate]);
  return <>
    <color attach="background" args={[clay ? '#dce2df' : '#b8d9e2']} />
    <fog attach="fog" args={[clay ? '#dce2df' : '#c4dfe5', 48, 100]} />
    <hemisphereLight args={[clay ? '#fcfcf7' : '#effaf4', clay ? '#9ba39a' : '#799781', clay ? 1.65 : 1.35]} />
    <ambientLight intensity={clay ? 0.3 : 0.35} />
    <directionalLight position={[-12, 22, 10]} intensity={clay ? 2.5 : 2.8} color={clay ? '#fff9ed' : '#fff1cf'} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-23} shadow-camera-right={23} shadow-camera-top={23} shadow-camera-bottom={-23} shadow-camera-near={0.5} shadow-camera-far={70} shadow-bias={-0.0004} shadow-normalBias={0.035} shadow-radius={4} />
    <directionalLight position={[9, 9, -9]} intensity={0.65} color={clay ? '#e4ebe9' : '#c7e7ef'} />
    {showGrid && <gridHelper args={[65, 65, '#9eaea2', '#b2c3bb']} position={[0, -0.77, 0]} />}
  </>;
}

export default function IslandScene(props: IslandSceneProps) {
  return <Canvas orthographic shadows={{ type: THREE.PCFSoftShadowMap }} dpr={[1, 1.5]} camera={{ position: PRESETS.overview.position, zoom: 40, near: 0.1, far: 150 }} gl={{ alpha: false, antialias: true, powerPreference: 'high-performance', stencil: false }} frameloop={props.paused ? 'never' : props.autoRotate ? 'always' : 'demand'} fallback={<span>此浏览器不支持 Canvas。</span>} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = props.clay ? 1.05 : 1; }}>
    <Stage clay={props.clay} showGrid={props.showGrid} />
    <PointerWorld reducedMotion={props.reducedMotion} paused={props.paused}>
      <IslandOcean clay={props.clay} reducedMotion={props.reducedMotion} paused={props.paused} />
      <IslandLandscape clay={props.clay} reducedMotion={props.reducedMotion} />
      <IslandBuildings clay={props.clay} reducedMotion={props.reducedMotion} onSelect={props.onSelect} />
      <IslandLife clay={props.clay} reducedMotion={props.reducedMotion} />
    </PointerWorld>
    <CameraRig {...props} />
    {props.showMarkers && <MarkerProjection onLayout={props.onMarkerLayout} />}
  </Canvas>;
}
