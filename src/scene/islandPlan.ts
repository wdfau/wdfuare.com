export type IslandView = 'overview' | 'entry' | 'gallery' | 'studio' | 'lab' | 'terminal' | 'coast';

export interface MarkerLayout { id: IslandView; x: number; y: number; visible: boolean }
export const islandMarkers: { id: IslandView; number: string; position: [number, number, number] }[] = [
  { id: 'gallery', number: '01', position: [0, 4, -1.2] },
  { id: 'studio', number: '02', position: [-5.8, 3.2, 0.3] },
  { id: 'lab', number: '03', position: [5.8, 2.55, 0.9] },
  { id: 'terminal', number: '04', position: [2, 2.8, -5.3] },
  { id: 'coast', number: '05', position: [0, 0.8, 11] },
];

export const islandPlan: Record<IslandView, { name: string; english: string; purpose: string; description: string }> = {
  overview: { name: '全岛总览', english: 'THE DESIGN JOURNEY', purpose: '一条清楚的设计动线', description: '先看作品，再走进过程，最后亲手体验交互。' },
  entry: { name: '入口导览', english: 'ARRIVAL', purpose: '从这里认识这座岛', description: '导览石、歇脚长凳与通向作品展庭的主石径。' },
  gallery: { name: '作品展庭', english: 'SELECTED WORK', purpose: '让作品先被看见', description: '完整案例、设计取舍与可运行原型，在这里展开。' },
  studio: { name: '设计手作坊', english: 'THE MAKING OF', purpose: '让思考过程看得见', description: '从观察、草图到方案推敲，留下设计发生的痕迹。' },
  lab: { name: '交互花园', english: 'PLAY & PROTOTYPE', purpose: '让细节可以亲手体验', description: '弹性、连续切换和明确反馈，藏在三座小装置里。' },
  terminal: { name: '关于与联系', english: 'A QUIET HELLO', purpose: '为进一步了解留一个入口', description: '关于、简历与联系的空间位置，安排在安静的林荫小亭。' },
  coast: { name: '休憩海岸', english: 'TAKE A BREATH', purpose: '给浏览留一点呼吸', description: '木栈道、灯笼与临海坐凳，让探索在这里慢下来。' },
};

export const explorationViews: { id: IslandView; number: string }[] = [
  { id: 'overview', number: '00' },
  { id: 'gallery', number: '01' },
  { id: 'studio', number: '02' },
  { id: 'lab', number: '03' },
  { id: 'terminal', number: '04' },
  { id: 'coast', number: '05' },
];
