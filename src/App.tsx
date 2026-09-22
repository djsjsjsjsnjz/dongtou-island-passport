import { useEffect, useRef, useReducer, useState } from 'react';
import type { CSSProperties, Dispatch, FormEvent } from 'react';
import { Anchor, ArrowRight, BookOpen, Check, ChevronDown, Compass, Download, Fish, Flag, Gift, Heart, Home, Map, MapPin, Minus, Plus, RotateCcw, Shell, Soup, Ticket, Utensils, Waves, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { IslandScene, type SceneHandle } from './Scene';
import { POINTS, DISHES, SOURCE_URL, type Point, type PointId } from './data';
import { countStamps, isComplete, loadProgress, progressReducer, STORAGE_KEY, type Progress, type Action } from './progress';
import { createCard, downloadCard } from './card';

const ICONS: Record<PointId, LucideIcon> = { plaza: Fish, alley: Heart, beach: Shell, inn: Home, bistro: Utensils };
const accent = (color: string) => ({ '--accent': color }) as CSSProperties;
type View = PointId | 'passport' | 'rewards' | null;

function Stamp({ point, earned, small = false }: { point: Point; earned: boolean; small?: boolean }) {
  const Icon = ICONS[point.id];
  return <div className={`stamp ${earned ? 'earned' : 'locked'} ${small ? 'small' : ''}`} style={accent(point.color)}>
    <Icon size={small ? 23 : 33} strokeWidth={1.6} /><span>{point.stamp}</span>{!small && <small>{earned ? '东岙 · 已收藏' : '等待相遇'}</small>}
  </div>;
}

export default function App() {
  const [initial] = useState(loadProgress);
  const [progress, dispatch] = useReducer(progressReducer, initial.progress);
  const [warning, setWarning] = useState(initial.warning);
  const [view, setView] = useState<View>(null);
  const [listOpen, setListOpen] = useState(false);
  const [traveling, setTraveling] = useState<PointId | null>(null);
  const [fallback, setFallback] = useState(false);
  const [toast, setToast] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const scene = useRef<SceneHandle>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const cancelReset = useRef<HTMLButtonElement>(null);
  const resetTrigger = useRef<HTMLButtonElement>(null);
  const count = countStamps(progress);
  const previousCount = useRef(count);
  const point = POINTS.find(p => p.id === view);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
    catch { setWarning('浏览器未允许保存，本次仍可体验；刷新后进度可能丢失。'); }
    if (count > previousCount.current) setToast(count === 5 ? '五枚印章已集齐，洞头岛民纪念卡已解锁！' : '新印章已收入你的旅行护照');
    previousCount.current = count;
  }, [progress, count]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (view) heading.current?.focus({ preventScroll: true }); }, [view]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && !resetOpen) { setView(null); setListOpen(false); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [resetOpen]);
  useEffect(() => {
    if (resetOpen) { resetDialog.current?.showModal(); cancelReset.current?.focus(); }
    else if (resetDialog.current?.open) { resetDialog.current.close(); resetTrigger.current?.focus(); }
  }, [resetOpen]);
  const go = (id: PointId) => {
    setView(null); setListOpen(false); setTraveling(id);
    if (fallback) { setTraveling(null); setView(id); }
    else scene.current?.go(id);
  };
  const openView = (next: View) => { setView(next); setListOpen(false); };
  const reset = () => {
    dispatch({ type: 'reset' }); setResetOpen(false); setView(null); setTraveling(null);
    scene.current?.reset(); setToast('新的海岛旅程开始了');
  };
  return <main className={`app ${view ? 'panel-open' : ''} ${fallback ? 'fallback' : ''}`}>
    <IslandScene ref={scene} onArrive={id => { setTraveling(null); setView(id); }} onUnavailable={() => { setFallback(true); setTraveling(null); }} />
    {!fallback && <div className="map-pins" aria-label="地图目的地">{POINTS.map(p => {
      const Icon = ICONS[p.id], done = isComplete(progress, p.id);
      return <button id={`pin-${p.id}`} key={p.id} className={`map-pin ${done ? 'done' : ''} ${traveling === p.id ? 'active' : ''}`} style={accent(p.color)} onClick={() => go(p.id)} aria-label={`前往${p.name}${done ? '，已集章' : ''}`}>
        <span className="pin-icon">{done ? <Check size={19} /> : <Icon size={19} />}</span><span className="pin-label">{p.name}</span>
      </button>;
    })}</div>}

    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Waves size={27} /><span>洞头</span></div><div><div className="brand-title">海岛寻宝 <span className="demo-tag">概念演示</span></div><p>洞头数字旅行护照</p></div></div>
      <button className="progress-button" onClick={() => openView('passport')} aria-label={`旅行护照，已集齐${count}枚印章`}><BookOpen size={21} /><span><b>{count}</b><span className="progress-total"> / 5</span><small>海岛印章</small></span><span className="progress-dots">{POINTS.map(p => <i key={p.id} style={{ background: isComplete(progress, p.id) ? p.color : '#dbe5df' }} />)}</span></button>
    </header>

    <div className="place-heading"><span>DONG'AO VILLAGE</span><h1>东岙渔村</h1><p><MapPin size={13} /> 浙江 · 温州 · 洞头</p></div>
    <button className="route-toggle" onClick={() => { setListOpen(!listOpen); setView(null); }} aria-expanded={listOpen}><Flag size={16} /> 海岛目的地 <ChevronDown size={16} /></button>
    <aside className={`point-list ${listOpen || fallback ? 'visible' : ''}`} aria-label="海岛目的地列表">
      <div className="list-heading"><span>这一站，去哪里？</span><span>5 个相遇</span></div>
      {POINTS.map((p, i) => {
        const Icon = ICONS[p.id], done = isComplete(progress, p.id);
        return <button className="point-row" key={p.id} onClick={() => go(p.id)} aria-label={`探索${p.name}`} style={accent(p.color)}><span className={`point-symbol ${done ? 'complete' : ''}`}>{done ? <Check size={17} /> : <Icon size={19} />}</span><span className="point-text"><b>{p.name}</b><small>{done ? '印章已收入护照' : p.category}</small></span><span className="point-number">{done ? <Check size={14} /> : `0${i + 1}`}</span></button>;
      })}
      <div className="list-foot"><Anchor size={13} /><span>东岙海岸线 · 概念游线</span></div>
    </aside>

    {fallback && <div className="fallback-note" role="status"><Waves size={24} /><strong>海岛故事，继续出发</strong><p>当前设备暂不能显示三维海湾。选择目的地，仍可完成任务、集章和领取纪念卡。</p></div>}
    {!fallback && <div className="scene-tools" aria-label="地图视角控制"><button title="回到全景" aria-label="回到全景" onClick={() => scene.current?.home()}><Compass size={21} /></button><div className="zoom-tools"><button title="放大地图" aria-label="放大地图" onClick={() => scene.current?.zoom(1.2)}><Plus size={20} /></button><button title="缩小地图" aria-label="缩小地图" onClick={() => scene.current?.zoom(1 / 1.2)}><Minus size={20} /></button></div></div>}
    {traveling && <div className="travel-status" role="status"><span className="walking-dot" /><span>正沿海岸走向{POINTS.find(p => p.id === traveling)?.name}</span></div>}
    {warning && <div className="storage-warning" role="status">{warning}</div>}

    {view && <aside className="detail-panel" aria-label={point ? `${point.name}任务` : view === 'passport' ? '旅行护照' : '海岛奖励'}>
      <div className="panel-top"><span>{point ? point.category : view === 'passport' ? 'MY ISLAND PASSPORT' : 'A MEMORY TO KEEP'}</span><button className="icon-button" aria-label="关闭面板" title="关闭面板" onClick={() => setView(null)}><X size={21} /></button></div>
      <div className="panel-content"><h2 ref={heading} tabIndex={-1}>{point?.name || (view === 'passport' ? '我的旅行护照' : '把海风带回家')}</h2>
        {point && <Task key={point.id} point={point} progress={progress} dispatch={dispatch} onPassport={() => openView('passport')} />}
        {view === 'passport' && <><p className="panel-intro">每一枚印章，都是一次海岛相遇。</p><div className="passport-summary"><span>东岙 · 海岛漫游</span><b>{count}<small> / 5 枚</small></b></div><div className="passport-grid">{POINTS.map(p => <button key={p.id} onClick={() => go(p.id)} aria-label={`护照：${p.name}${isComplete(progress, p.id) ? '已完成' : '未完成'}`}><Stamp point={p} earned={isComplete(progress, p.id)} /><span>{p.name}</span></button>)}</div><div className="passport-bottom"><p>{count === 5 ? '五次相遇，换一个新的身份。' : `还有 ${5 - count} 份海岛记忆，等你收藏。`}</p><button className="primary" onClick={() => count === 5 ? openView('rewards') : go(POINTS.find(p => !isComplete(progress, p.id))!.id)}>{count === 5 ? '领取洞头岛民纪念卡' : '继续海岛探索'}<ArrowRight size={18} /></button></div></>}
        {view === 'rewards' && <Rewards progress={progress} dispatch={dispatch} capture={() => scene.current?.capture() ?? null} onContinue={() => go(POINTS.find(p => !isComplete(progress, p.id))!.id)} onMessage={setToast} />}
      </div>
    </aside>}

    <nav className="bottom-nav" aria-label="主要导航"><button aria-label="海岛地图" className={!view || !!point ? 'selected' : ''} onClick={() => openView(null)}><Map size={21} /><span>海岛地图</span></button><button aria-label="旅行护照" className={view === 'passport' ? 'selected' : ''} onClick={() => openView('passport')}><BookOpen size={21} /><span>旅行护照</span>{count > 0 && <i>{count}</i>}</button><button aria-label="海岛奖励" className={view === 'rewards' ? 'selected' : ''} onClick={() => openView('rewards')}><Gift size={21} /><span>海岛奖励</span>{count === 5 && !progress.redeemed && <span className="notice-dot" />}</button></nav>
    <footer className="map-footer"><span>概念化布局，非实景导航</span><button ref={resetTrigger} onClick={() => setResetOpen(true)} title="重新开始" aria-label="重新开始"><RotateCcw size={14} /><span>重新开始</span></button></footer>
    <div className={`toast ${toast ? 'shown' : ''}`} role="status">{toast && <><Check size={18} />{toast}</>}</div>
    <dialog ref={resetDialog} className="reset-dialog" onCancel={() => setResetOpen(false)}><RotateCcw size={28} /><h2>开始一段新旅程？</h2><p>本机的印章、任务进度、昵称和模拟兑换记录将被清除。</p><div className="dialog-actions"><button ref={cancelReset} className="secondary" onClick={() => setResetOpen(false)}>保留旅程</button><button className="primary" onClick={reset}>重新开始</button></div></dialog>
  </main>;
}

function Task({ point, progress, dispatch, onPassport }: { point: Point; progress: Progress; dispatch: Dispatch<Action>; onPassport: () => void }) {
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [dish, setDish] = useState<number | null>(null);
  const complete = isComplete(progress, point.id);
  const taskRoot = useRef<HTMLDivElement>(null);
  useEffect(() => { if (complete) taskRoot.current?.closest('.panel-content')?.scrollTo({ top: 0 }); }, [complete]);
  const submitCode = (e: FormEvent) => { e.preventDefault(); if (code.trim() === '海风') { dispatch({ type: 'inn' }); setError(''); } else setError('口令不对，再试一次。演示口令是“海风”。'); };
  return <div ref={taskRoot} className="task" style={accent(point.color)}>
    <div className="task-title">{point.title}</div><p className="story">{point.story}</p>
    {point.id === 'alley' && <a className="source-link" href={SOURCE_URL} target="_blank" rel="noreferrer">民俗参考 · 洞头发布 <ArrowRight size={12} /></a>}
    {complete ? <div className="task-complete"><Stamp point={point} earned /><h3>{point.stamp}，已收藏</h3><p>这段海岛记忆，已经在你的护照里。</p>{point.id === 'bistro' && <div className="chosen-meal">旅行餐单 · {DISHES[progress.meal!].name}</div>}<button className="primary" onClick={onPassport}>翻开旅行护照<BookOpen size={18} /></button></div> : <>
      {point.id === 'plaza' && <><div className="task-meta"><span>点亮三盏渔灯</span><b>{progress.lanterns.length} / 3</b></div><div className="lantern-task">{['平安', '顺遂', '团圆'].map((label, i) => <button key={label} className={`lantern ${progress.lanterns.includes(i) ? 'lit' : ''}`} aria-label={`点亮${label}渔灯`} aria-pressed={progress.lanterns.includes(i)} onClick={() => dispatch({ type: 'lantern', index: i })}><span className="lantern-wire" /><Fish size={53} strokeWidth={1.35} /><span className="lantern-tassel" /><b>{label}</b>{progress.lanterns.includes(i) && <Check size={16} />}</button>)}</div></>}
      {point.id === 'alley' && <><div className="story-note"><Heart size={24} /><div><strong>七夕 · 做十六</strong><p>从被祝福的孩子，成为懂得感恩与担当的少年。</p></div></div><fieldset className="quiz"><legend>洞头七夕成人礼，也被称为什么？</legend>{['做十二', '做十六', '做十八'].map((a, i) => <button key={a} onClick={() => { if (i === 1) { dispatch({ type: 'quiz' }); setError(''); } else setError('再想一想，答案就藏在上面的民俗故事里。'); }}><span>{String.fromCharCode(65 + i)}</span>{a}<ArrowRight size={16} /></button>)}</fieldset></>}
      {point.id === 'beach' && <><div className="task-meta"><span>寻找沙滩上的三枚贝壳</span><b>{progress.shells.length} / 3</b></div><div className="shell-beach">{[0, 1, 2].map(i => <button className={`shell shell-${i} ${progress.shells.includes(i) ? 'found' : ''}`} aria-label={`收集第${i + 1}枚贝壳`} aria-pressed={progress.shells.includes(i)} key={i} onClick={() => dispatch({ type: 'shell', index: i })}>{progress.shells.includes(i) ? <Check size={32} /> : <Shell size={42} strokeWidth={1.5} />}</button>)}<Waves className="shore-wave" size={110} strokeWidth={0.65} /></div><p className="task-caption">只收藏记忆，不带走海滩上的生命。</p></>}
      {point.id === 'inn' && <form className="code-form" onSubmit={submitCode}><div className="inn-note"><Home size={35} strokeWidth={1.4} /><span>海风民宿<b>示范商户 · 虚构</b></span></div><label htmlFor="code">民宿打卡口令</label><div className="input-row"><input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="输入口令" autoComplete="off" maxLength={20} /><button className="primary" type="submit">打卡<Check size={17} /></button></div><p className="task-caption">本次演示口令：<strong>海风</strong></p></form>}
      {point.id === 'bistro' && <><div className="task-meta"><span>翻开三道海岛菜品</span><b>{progress.viewedDishes.length} / 3</b></div><div className="dish-tabs">{DISHES.map((d, i) => { const Icon = [Fish, Soup, Utensils][i]; return <button key={d.name} aria-pressed={dish === i} onClick={() => { setDish(i); dispatch({ type: 'viewDish', index: i }); }} className={dish === i ? 'active' : ''}><Icon size={28} strokeWidth={1.3} /><b>{d.name}</b><small>{progress.viewedDishes.includes(i) ? '已浏览' : '查看菜品'}</small></button>; })}</div>{dish !== null && <div className="dish-detail"><strong>{DISHES[dish].name}</strong><p>{DISHES[dish].note}</p><small>演示菜品 · 不提供点餐</small></div>}<button className="primary" disabled={progress.viewedDishes.length !== 3 || dish === null} onClick={() => { if (dish !== null) dispatch({ type: 'meal', index: dish }); }}>选入我的旅行餐单<Check size={18} /></button></>}
      {error && <p className="task-error" role="alert">{error}</p>}
      <div className="task-reward"><Stamp point={point} earned={false} small /><div><span>完成这一站</span><b>收藏一枚{point.stamp}</b></div></div>
    </>}
  </div>;
}

function Rewards({ progress, dispatch, capture, onContinue, onMessage }: { progress: Progress; dispatch: Dispatch<Action>; capture: () => string | null; onContinue: () => void; onMessage: (text: string) => void }) {
  const count = countStamps(progress);
  const [sceneImage] = useState(capture);
  const [card, setCard] = useState<HTMLCanvasElement | null>(null);
  const [cardError, setCardError] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    if (count !== 5) return;
    let canceled = false;
    createCard(progress, sceneImage).then(result => { if (!canceled) { setCard(result); setCardError(''); } }).catch(() => { if (!canceled) setCardError('纪念卡生成失败，请关闭后重新打开。'); });
    return () => { canceled = true; };
  }, [progress, sceneImage, count]);
  if (count < 5) return <div className="locked-rewards"><div className="gift-seal"><Gift size={48} strokeWidth={1.2} /></div><h3>一张属于你的海岛纪念</h3><p>集齐五枚印章，成为“洞头岛民”。</p><div className="mini-stamps">{POINTS.map(p => <Stamp key={p.id} point={p} earned={isComplete(progress, p.id)} small />)}</div><p>已收藏 {count} / 5 枚</p><button className="primary" onClick={onContinue}>继续海岛探索<ArrowRight size={18} /></button><small>概念演示 · 无实际消费权益</small></div>;
  const download = async () => {
    setDownloading(true);
    try { const current = await createCard(progress, sceneImage); setCard(current); await downloadCard(current); onMessage('纪念卡已生成，下载已开始'); }
    catch { setCardError('下载未完成，请重试。'); }
    finally { setDownloading(false); }
  };
  return <><p className="panel-intro">五次相遇，今天你也是洞头岛民。</p><div className="card-preview">{card ? <img src={card.toDataURL('image/png')} alt={`${progress.nickname || '海风旅人'}的洞头岛民纪念卡，含全部五枚印章`} /> : <p>正在生成纪念卡…</p>}</div><label className="nickname-label" htmlFor="nickname">纪念卡上的名字<span>最多 12 个字</span></label><input id="nickname" className="nickname-input" placeholder="海风旅人" value={progress.nickname} onChange={e => dispatch({ type: 'nickname', value: e.target.value })} /><button className="primary download-button" disabled={downloading} onClick={download}><Download size={18} />{downloading ? '正在生成…' : '下载旅行纪念卡'}</button>{cardError && <p role="alert" className="task-error">{cardError}</p>}<section className="reward-ticket"><div className="ticket-heading"><Ticket size={21} /><strong>海岛相遇礼</strong><span>模拟兑换</span></div><p>示范奖励：海风明信片一张</p><div className="redeem-code">DEMO-DONGAO-005</div><button className={progress.redeemed ? 'redeemed-button' : 'secondary'} disabled={progress.redeemed} onClick={() => { dispatch({ type: 'redeem' }); onMessage('模拟核销成功，本次演示兑换已完成'); }}>{progress.redeemed ? <><Check size={17} />已模拟核销</> : '模拟核销一次'}</button><small>虚构奖励，无实际消费权益，不可线下兑换。</small></section></>;
}
