import { useEffect, useState } from 'react';
import { mountain, opposite, parseAngle } from './domain/direction';

export default function App() {
  const [angle,setAngle]=useState('');
  const [route,setRoute]=useState(location.hash.slice(1)||'/compass');
  useEffect(()=>{const update=()=>setRoute(location.hash.slice(1)||'/compass');window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  let result: number | null = null;
  try {result=parseAngle(angle);}catch{ /* 尚未完成有效输入 */ }
  return <div className="app-shell"><header><span className="brand">堪舆手记</span><span>现场罗盘</span></header><main id="main-content"><p className="eyebrow">记录方位 · 复核坐向</p><h1>{route==='/compass'?'现场罗盘':route==='/projects'?'现场项目':route.startsWith('/knowledge')?'堪舆资料':'使用设置'}</h1>{route==='/compass'?<section className="card"><label>向角（度）<input type="number" min="0" max="360" value={angle} onChange={e=>setAngle(e.target.value)} /></label>{result!=null?<p className="angle">{result.toFixed(1)}°<span>坐{mountain(opposite(result)).name}向{mountain(result).name}</span></p>:<p>填写实体罗盘读数，开始记录方位。</p>}</section>:<section className="card">正在建立现场工作流程。</section>}</main><nav aria-label="主要导航">{[['/compass','罗盘'],['/projects','项目'],['/knowledge','资料'],['/settings','设置']].map(([path,label])=><a key={path} href={`#${path}`} aria-current={route.startsWith(path)?'page':undefined}>{label}</a>)}</nav></div>;
}
