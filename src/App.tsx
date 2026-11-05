import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { islandMarkers, islandPlan, explorationViews as views, type MarkerLayout, type IslandView } from './scene/islandPlan';

const IslandScene = lazy(() => import('./scene/IslandScene'));

function Icon({ name, size = 18 }: { name: 'orbit' | 'cube' | 'reset' | 'grid' | 'pin' | 'arrow' | 'pause'; size?: number }) {
  const paths = {
    orbit: <><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-32 12 12)" /><circle cx="12" cy="12" r="5" /><circle cx="20" cy="7" r="2" fill="currentColor" stroke="none" /></>,
    cube: <><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10" /></>,
    reset: <><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7" /></>,
    grid: <><path d="m12 3 10 6-10 6L2 9zM2 14l10 6 10-6M7 6l10 6M7 12l10-6" /></>,
    pin: <><path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z" /><circle cx="12" cy="9" r="2" /></>,
    arrow: <><path d="M6 18 18 6M6 6h12v12" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

class ViewerBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
  const [view, setView] = useState<{ id: IslandView; revision: number }>({ id: 'overview', revision: 0 });
  const [clay, setClay] = useState(false);
  const [rotate, setRotate] = useState(false);
  const [grid, setGrid] = useState(false);
  const [markers, setMarkers] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(!document.hidden);
  const markerElements = useRef<Partial<Record<IslandView, HTMLButtonElement | null>>>({});
  const handleMarkerLayout = useCallback((positions: MarkerLayout[]) => {
    positions.forEach(({ id, x, y, visible: shown }) => {
      const element = markerElements.current[id];
      if (!element) return;
      element.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -50%)`;
      element.style.visibility = shown ? 'visible' : 'hidden';
    });
  }, []);
  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback(() => { setError(true); setReady(false); }, []);
  const selectView = useCallback((id: IslandView) => {
    setView((previous) => ({ id, revision: previous.revision + 1 }));
    setRotate(false);
  }, []);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    query.addEventListener('change', change);
    const visibility = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { query.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable]')) return;
      if (event.key === 'Escape' || event.key.toLowerCase() === 'r') selectView('overview');
      const preset = /^\d$/.test(event.key) ? views.find((item) => item.number === event.key.padStart(2, '0')) : undefined;
      if (preset) selectView(preset.id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectView]);

  return <main className={`model-viewer ${clay ? 'is-clay' : ''}`}>
    <div className="model-canvas" role="region" aria-label="可旋转的微缩设计岛模型，包含中央展馆、左侧工作室、右侧实验装置、步道、作品展庭、设计手作坊、交互花园、关于与联系小亭和休憩海岸">
      {!error && <ViewerBoundary key={retry} onError={handleError}><Suspense fallback={null}><IslandScene view={view} clay={clay} autoRotate={rotate && !reducedMotion} showGrid={grid} showMarkers={markers} reducedMotion={reducedMotion} paused={!visible} onReady={handleReady} onError={handleError} onSelect={selectView} onMarkerLayout={handleMarkerLayout} /></Suspense></ViewerBoundary>}
    </div>
    {markers && !error && <div className="zone-markers">{islandMarkers.map((marker) => <button key={marker.id} ref={(element) => { markerElements.current[marker.id] = element; }} className={`zone-marker ${view.id === marker.id ? 'is-active' : ''}`} aria-label={`${marker.number} ${islandPlan[marker.id].name}`} title={islandPlan[marker.id].description} style={{ visibility: 'hidden' }} onClick={() => selectView(marker.id)}><span className="zone-marker-number">{marker.number}</span><span className="zone-marker-label">{islandPlan[marker.id].name}</span></button>)}</div>}

    <header className="viewer-header">
      <div className="viewer-brand"><span className="brand-icon"><Icon name="cube" size={22} /></span><div><span className="brand-name">DESIGN SANCTUARY<span className="brand-dot">.</span></span><span className="brand-caption">A PLACE FOR IDEAS TO GROW</span></div></div>
      <div className="viewer-badge"><span className="status-light" /><span>一座生长中的作品岛</span><span className="badge-divider" /><span className="badge-version">VOL. 004</span></div>
    </header>

    <div className="island-sidebar"><aside className="scene-intro"><div className="scene-number"><span className="scene-number-line" />沿着石径 / 开始探索</div><h1>微光作品岛</h1><p>{islandPlan[view.id].description}</p><div className="scene-chips"><span>作品</span><span>思考</span><span>交互</span></div></aside>

    <nav className="camera-presets" aria-label="岛屿功能分区"><span className="presets-caption">EXPLORE THE ISLAND</span>{views.map((preset) => <button key={preset.id} className={view.id === preset.id ? 'is-active' : ''} onClick={() => selectView(preset.id)} aria-pressed={view.id === preset.id}><span className="preset-number">{preset.number}</span><span>{islandPlan[preset.id].name}</span><span className="preset-arrow"><Icon name="arrow" size={13} /></span></button>)}</nav><aside className="zone-purpose" aria-live="polite"><span>{islandPlan[view.id].english}</span><h2>{islandPlan[view.id].purpose}</h2><p>{view.id === 'overview' ? '作品展庭 → 设计手作坊 → 交互花园 → 关于与联系' : islandPlan[view.id].description}</p></aside></div>

    <div className="scene-corner scene-corner-tl" aria-hidden="true" /><div className="scene-corner scene-corner-br" aria-hidden="true" />
    <div className="scene-coordinates" aria-hidden="true"><span>DESIGN × CURIOSITY</span><span className="coordinate-line" /><span>{clay ? 'CLAY MODEL' : 'SOFT DAYLIGHT'}</span></div>

    {!ready && !error && <div className="viewer-loading" role="status"><span className="loading-ring" /><span>正在搭建小岛<span className="loading-ellipsis">…</span></span><small>准备几何、材质与光线</small></div>}
    {error && <div className="viewer-error" role="alert"><Icon name="cube" size={30} /><h2>暂时无法显示 3D 模型</h2><p>请使用支持 WebGL 的浏览器，并开启硬件加速。</p><button onClick={() => { setError(false); setReady(false); setRetry((value) => value + 1); }}>重新加载</button></div>}

    <footer className="viewer-footer"><div className="interaction-guide"><span className="mouse-icon" aria-hidden="true"><i /></span><span className="desktop-guide">移动鼠标探索<span className="guide-dot">·</span>拖动旋转<span className="guide-dot">·</span>滚轮缩放</span><span className="mobile-guide">单指旋转 · 双指缩放</span></div><span className="current-view"><span className="current-view-dot" />{islandPlan[view.id].name}</span></footer>

    <div className="model-toolbar" role="toolbar" aria-label="模型显示设置"><div className="material-options" role="group" aria-label="材质模式"><button className={!clay ? 'is-selected' : ''} onClick={() => setClay(false)} aria-pressed={!clay}><span className="material-dot material-color" />材质</button><button className={clay ? 'is-selected' : ''} onClick={() => setClay(true)} aria-pressed={clay}><span className="material-dot material-clay" />白模</button></div><span className="toolbar-divider" /><button className={`tool-button ${rotate ? 'is-enabled' : ''}`} onClick={() => setRotate((value) => !value)} aria-label={rotate ? '停止自动旋转' : '自动旋转'} aria-pressed={rotate} disabled={reducedMotion} title={reducedMotion ? '已跟随系统减少动效设置' : '自动旋转'}><Icon name={rotate ? 'pause' : 'orbit'} /><span>旋转</span></button><button className={`tool-button ${grid ? 'is-enabled' : ''}`} onClick={() => setGrid((value) => !value)} aria-label="显示网格" aria-pressed={grid} title="显示网格"><Icon name="grid" /><span>网格</span></button><button className={`tool-button ${markers ? 'is-enabled' : ''}`} onClick={() => setMarkers((value) => !value)} aria-label="显示地点标记" aria-pressed={markers} title="显示地点标记"><Icon name="pin" /><span>标记</span></button><span className="toolbar-divider" /><button className="tool-button reset-button" onClick={() => selectView('overview')} aria-label="重置视角" title="重置视角 · R"><Icon name="reset" /><span>复位</span></button></div>
  </main>;
}
