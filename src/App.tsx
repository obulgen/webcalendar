import { useEffect, useMemo, useState, ReactNode } from 'react';
import HOL from './holidays.json';
import { dbAll, dbPut, dbDel, dbClear } from './db';
import { Item, Kind, Holiday, KIND, HT, HN, MES, DIAS, REP, CATS, P, F, addD, today, nowTime, fmt, blank, occursOn, askPermission, notify, firedKey, downloadFile, toICS } from './lib';
import Editor from './Editor';

const HOLIDAYS_URL = ''; // URL de un JSON con el mismo formato que holidays.json, para actualizar feriados sin republicar
type Tab = 'inicio' | 'calendario' | 'recuerdos' | 'recordatorios' | 'perfil';
const ICONS: Record<Tab, ReactNode> = {
  inicio: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  recuerdos: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M9 8h6M9 12h6" /></>,
  recordatorios: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};
const LABEL: Record<Tab, string> = { inicio: 'Inicio', calendario: 'Calendario', recuerdos: 'Recuerdos', recordatorios: 'Recordatorios', perfil: 'Perfil' };

function Row({ it, onOpen, onToggle, showDate }: { it: Item; onOpen: (i: Item) => void; onToggle?: (i: Item) => void; showDate?: boolean }) {
  return (<div className={'row' + (it.done ? ' done' : '')}>
    {it.kind === 'reminder' ? <button className="chk" aria-label="Completar" style={{ borderColor: it.color, background: it.done ? it.color : 'transparent' }} onClick={() => onToggle?.(it)} /> : <i className="bar" style={{ background: it.color }} />}
    <button className="grow" style={{ textAlign: 'left' }} onClick={() => onOpen(it)}><div className="t">{it.title}</div>
      <div className="sub">{KIND[it.kind][0]}{it.kind !== 'memory' && it.time ? ` · ${it.time}` : ''}{showDate ? ` · ${fmt(it.date)}` : ''}{it.repeat !== 'none' ? ` · ${REP[it.repeat].toLowerCase()}` : ''}{it.kind === 'reminder' && it.priority === 3 ? ' · prioridad alta' : ''}</div></button>
    {it.photos[0] && <img className="thumb" src={it.photos[0]} alt="" />}
  </div>);
}
const Holi = ({ h }: { h: Holiday }) => (<div className="row"><i className="bar" style={{ background: HT[h.t] }} /><div className="grow"><div className="t">{h.n}</div>
  <div className="sub">{HN[h.t]}{h.s === 'calculado' ? ' · verificar decreto' : h.s === 'pendiente' ? ' · a confirmar' : ''}</div></div></div>);

export default function App() {
  const [items, setItems] = useState<Item[]>([]); const [ready, setReady] = useState(false);
  const [hol, setHol] = useState<Holiday[]>(HOL.items as Holiday[]);
  const [tab, setTab] = useState<Tab>('inicio'); const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState<{ it: Item; isNew: boolean } | null>(null);
  const [sel, setSel] = useState(today()); const [mode, setMode] = useState(0);
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [banner, setBanner] = useState<string[]>([]); const [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'unsupported');

  useEffect(() => { dbAll().then(a => { setItems(a); setReady(true); }).catch(() => setReady(true));
    try { const c = localStorage.getItem('hol'); if (c) setHol(JSON.parse(c)); } catch {}
    if (HOLIDAYS_URL) fetch(HOLIDAYS_URL).then(r => r.json()).then(j => { setHol(j.items); localStorage.setItem('hol', JSON.stringify(j.items)); }).catch(() => {}); }, []);

  // Avisos mientras la app está abierta (sin servidor no hay push con la app cerrada)
  useEffect(() => {
    if (!ready) return;
    const check = () => { const d = today(), t = nowTime(); let fired: Record<string, 1> = {}; try { fired = JSON.parse(localStorage.getItem('fired') || '{}'); } catch {}
      const due = items.filter(i => i.kind !== 'memory' && i.notify && !i.done && occursOn(i, d) && i.time <= t && !fired[firedKey(i, d)]);
      if (!due.length) return; due.forEach(i => { fired[firedKey(i, d)] = 1; notify(i.title, i.desc || KIND[i.kind][0]); });
      const keys = Object.keys(fired).slice(-300); const out: Record<string, 1> = {}; keys.forEach(k => (out[k] = 1)); localStorage.setItem('fired', JSON.stringify(out));
      setBanner(b => [...b, ...due.map(i => `${i.time} · ${i.title}`)]); };
    check(); const id = setInterval(check, 30000); return () => clearInterval(id);
  }, [items, ready]);

  const holBy = useMemo(() => { const m: Record<string, Holiday[]> = {}; hol.forEach(h => (m[h.d] ||= []).push(h)); return m; }, [hol]);
  const on = (d: string) => items.filter(i => occursOn(i, d)).sort((a, b) => a.time.localeCompare(b.time));

  const save = async (it: Item) => { await dbPut(it); setItems(p => p.some(x => x.id === it.id) ? p.map(x => x.id === it.id ? it : x) : [...p, it]); setEdit(null);
    if (it.notify && it.kind !== 'memory' && perm === 'default') setPerm(await askPermission()); };
  const del = async (it: Item) => { if (!confirm(`¿Eliminar "${it.title}"?`)) return; await dbDel(it.id); setItems(p => p.filter(x => x.id !== it.id)); setEdit(null); };
  const toggle = (it: Item) => save({ ...it, done: !it.done });
  const add = (k: Kind, d = sel) => { setMenu(false); setEdit({ it: blank(k, d), isNew: true }); };
  const open = (it: Item) => setEdit({ it, isNew: false });
  const go = (t: Tab) => { setTab(t); setQ(''); setCat(''); setFrom(''); setTo(''); };

  const Filters = ({ dates }: { dates?: boolean }) => (<>
    <input className="inp" type="search" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} style={{ marginTop: 4 }} />
    <div className="chips"><button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat('')}>Todas</button>{CATS.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}><i className="dot" style={{ background: c, display: 'inline-block' }} /></button>)}</div>
    {dates && <div style={{ display: 'flex', gap: 8 }}><input className="inp" type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Desde" /><input className="inp" type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Hasta" /></div>}</>);
  const pass = (i: Item) => (!q || (i.title + i.desc + i.people + i.place).toLowerCase().includes(q.toLowerCase())) && (!cat || i.color === cat) && (!from || i.date >= from) && (!to || i.date <= to);

  const Home = () => { const t = today(), h = Number(nowTime().slice(0, 2)), d = P(t), td = on(t);
    const hi = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const up = items.filter(i => i.kind !== 'memory' && !i.done && i.date > t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const nh = hol.filter(x => x.d >= t).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 3);
    const ago = items.filter(i => i.kind === 'memory' && i.date.slice(5) === t.slice(5) && i.date.slice(0, 4) < t.slice(0, 4)).sort((a, b) => b.date.localeCompare(a.date));
    const pend = td.filter(i => i.kind === 'reminder' && !i.done).length;
    return (<><p className="sub" style={{ fontWeight: 600, margin: 0 }}>{DIAS[d.getDay()]} {d.getDate()} de {MES[d.getMonth()].toLowerCase()}</p><h1>{hi} 👋</h1>
      <div className="glass"><p className="lbl">Hoy</p><div style={{ fontSize: 17, fontWeight: 600 }}>{td.length + (holBy[t]?.length || 0) === 0 ? 'Sin compromisos hoy ✨' : `${td.length} en agenda · ${pend} recordatorios pendientes`}</div>
        {(holBy[t] || []).map((x, i) => <Holi key={i} h={x} />)}{td.map(i => <Row key={i.id} it={i} onOpen={open} onToggle={toggle} />)}</div>
      <button className="glass hero" onClick={() => add('memory', t)}><div style={{ fontSize: 18, fontWeight: 700 }}>＋ Guardar un recuerdo</div><div style={{ opacity: .85, fontSize: 13 }}>¿Qué te pasó hoy?</div></button>
      {ago.length > 0 && <div className="glass"><p className="lbl">Un día como hoy</p>{ago.map(i => <div key={i.id}><Row it={i} onOpen={open} showDate /><div className="sub" style={{ marginLeft: 18 }}>Hace {Number(t.slice(0, 4)) - Number(i.date.slice(0, 4))} {Number(t.slice(0, 4)) - Number(i.date.slice(0, 4)) === 1 ? 'año' : 'años'}</div></div>)}</div>}
      <div className="glass"><p className="lbl">Próximamente</p>{up.length ? up.map(i => <Row key={i.id} it={i} onOpen={open} onToggle={toggle} showDate />) : <span className="sub">Nada pendiente.</span>}</div>
      <div className="glass"><p className="lbl">Feriados cercanos</p>{nh.map((x, i) => <div key={i}><Holi h={x} /><div className="sub" style={{ marginLeft: 18 }}>{fmt(x.d)}</div></div>)}</div></>); };

  const Cal = () => { const cur = P(sel), y = cur.getFullYear(), m = cur.getMonth(), lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
    const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => F(new Date(y, m, i + 1)))];
    const mon = addD(sel, -((cur.getDay() + 6) % 7)), week = Array.from({ length: 7 }, (_, i) => addD(mon, i));
    const goM = (n: number) => setSel(F(new Date(y, m + n, 1)));
    const dots = (d: string) => [...new Set([...on(d).map(i => i.color), ...(holBy[d] || []).map(h => HT[h.t])])].slice(0, 3);
    const Day = ({ d }: { d: string }) => (<button className={'day' + (d === sel ? ' sel' : '') + (d === today() ? ' today' : '')} onClick={() => setSel(d)}><span style={holBy[d] && d !== sel ? { color: HT[holBy[d][0].t] } : undefined}>{P(d).getDate()}</span><div className="dots">{dots(d).map((c, i) => <i key={i} style={{ background: c }} />)}</div></button>);
    return (<><div className="nav"><h1 style={{ margin: 0, fontSize: 28 }}>{MES[m]} <span style={{ fontWeight: 300, color: 'var(--sub)' }}>{y}</span></h1>
      <div><button onClick={() => goM(-12)}>«</button><button onClick={() => goM(-1)}>‹</button><button onClick={() => setSel(today())} style={{ fontSize: 15 }}>Hoy</button><button onClick={() => goM(1)}>›</button><button onClick={() => goM(12)}>»</button></div></div>
      <div className="seg">{['Mes', 'Semana', 'Día'].map((l, i) => <button key={l} className={mode === i ? 'on' : ''} onClick={() => setMode(i)}>{l}</button>)}</div>
      {mode < 2 && <div className="glass"><div className="grid">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="h">{d}</div>)}{mode === 0 ? cells.map((d, i) => d ? <Day key={d} d={d} /> : <div key={'e' + i} />) : week.map(d => <Day key={d} d={d} />)}</div></div>}
      {mode === 2 && <div className="nav"><button onClick={() => setSel(addD(sel, -1))}>‹</button><b>{fmt(sel)}</b><button onClick={() => setSel(addD(sel, 1))}>›</button></div>}
      <div className="glass">{mode < 2 && <p className="lbl">{fmt(sel)}</p>}{(holBy[sel] || []).map((h, i) => <Holi key={i} h={h} />)}{on(sel).map(i => <Row key={i.id} it={i} onOpen={open} onToggle={toggle} />)}
        {!(holBy[sel]?.length || on(sel).length) && <span className="sub">Sin acontecimientos. Tocá + para agregar.</span>}</div>
      <div className="legend">{[...Object.entries(HN).map(([k, l]) => [l, HT[k]]), ...Object.values(KIND).map(k => [k[0], k[1]])].map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div></>); };

  const List = ({ kind }: { kind: 'memory' | 'reminder' }) => { const l = items.filter(i => (kind === 'memory' ? i.kind === 'memory' : i.kind === 'reminder' || i.kind === 'important') && pass(i))
      .sort((a, b) => kind === 'memory' ? b.date.localeCompare(a.date) : Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
    return (<><h1>{kind === 'memory' ? 'Recuerdos' : 'Recordatorios'}</h1>{Filters({ dates: true })}{l.length === 0 && <p className="sub">{q || cat || from || to ? 'Sin resultados.' : 'Todavía no hay nada. Tocá + para agregar.'}</p>}
      {l.map(i => <div className="glass" key={i.id}><Row it={i} onOpen={open} onToggle={toggle} showDate />{i.desc && <div className="sub" style={{ whiteSpace: 'pre-wrap' }}>{i.desc}</div>}{i.place && <div className="sub">📍 {i.place}</div>}{i.people && <div className="sub">👥 {i.people}</div>}
        {i.photos.length > 0 && <div className="photos">{i.photos.map((u, k) => <img key={k} src={u} alt="" />)}</div>}</div>)}</>); };

  const Profile = () => (<><h1>Perfil</h1>
    <div className="glass"><b>Apariencia</b><div className="sub">Sigue el modo claro u oscuro de tu iPhone.</div></div>
    <div className="glass"><b>Zona horaria</b><div className="sub">America/Argentina/Cordoba</div></div>
    <div className="glass"><b>Privacidad</b><div className="sub">Tus recuerdos y fotos se guardan solo en este dispositivo. No hay cuentas ni servidores.</div></div>
    <button className="glass" style={{ width: '100%', textAlign: 'left' }} onClick={async () => setPerm(await askPermission())}><b className="link">Avisos del navegador</b><div className="sub">Estado: {perm === 'granted' ? 'activados' : perm === 'denied' ? 'bloqueados (cambialos en Ajustes)' : perm === 'unsupported' ? 'no disponibles en este navegador' : 'sin activar; tocá para activarlos'}. Solo suenan mientras la app está abierta.</div></button>
    <button className="glass" style={{ width: '100%', textAlign: 'left' }} onClick={() => downloadFile('memorias.json', 'application/json', JSON.stringify({ exportado: new Date().toISOString(), items }, null, 2))}><b className="link">Exportar todo (JSON)</b><div className="sub">{items.length} elementos, con fotos</div></button>
    <button className="glass" style={{ width: '100%', textAlign: 'left' }} onClick={() => downloadFile('memorias.ics', 'text/calendar', toICS(items))}><b className="link">Exportar al calendario (.ics)</b><div className="sub">Eventos, recordatorios y fechas importantes para Apple Calendar.</div></button>
    <label className="glass" style={{ display: 'block' }}><b className="link">Importar copia (JSON)</b><div className="sub">Restaura un archivo exportado antes.</div><input type="file" accept="application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { const j = JSON.parse(await f.text()); for (const i of j.items) await dbPut(i); setItems(await dbAll()); alert('Importado.'); } catch { alert('Archivo inválido.'); } e.target.value = ''; }} /></label>
    <button className="glass danger" style={{ width: '100%', textAlign: 'left' }} onClick={async () => { if (confirm('¿Borrar TODOS tus datos? No se puede deshacer.')) { await dbClear(); setItems([]); } }}>Borrar todos mis datos</button>
    <div className="glass"><b>Feriados</b><div className="sub">{hol.length} fechas cargadas. Las marcadas “verificar decreto” o “a confirmar” se calcularon por ley y deben contrastarse con el decreto oficial.</div></div></>);

  return (<div className="app">
    {banner.length > 0 && <div className="banner" onClick={() => setBanner([])}><b>🔔 Recordatorios</b>{banner.map((b, i) => <div key={i} className="sub">{b}</div>)}</div>}
    <main className="screen" key={tab}>{!ready ? <p className="sub">Cargando…</p> : tab === 'inicio' ? Home() : tab === 'calendario' ? Cal() : tab === 'recuerdos' ? List({ kind: 'memory' }) : tab === 'recordatorios' ? List({ kind: 'reminder' }) : Profile()}</main>
    <button className="fab" aria-label="Agregar" onClick={() => setMenu(true)}>+</button>
    <nav className="tabbar">{(Object.keys(LABEL) as Tab[]).map(t => <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => go(t)}><svg viewBox="0 0 24 24">{ICONS[t]}</svg>{LABEL[t]}</button>)}</nav>
    {menu && <div className="sheet-bg" onClick={() => setMenu(false)}><div className="sheet menu glass" onClick={e => e.stopPropagation()} style={{ background: 'var(--card)' }}>{(Object.keys(KIND) as Kind[]).map(k => <button key={k} onClick={() => add(k)}><i className="dot" style={{ background: KIND[k][1] }} />Nuevo {KIND[k][0].toLowerCase()}</button>)}</div></div>}
    {edit && <Editor key={edit.it.id} init={edit.it} isNew={edit.isNew} onSave={save} onDelete={del} onClose={() => setEdit(null)} />}
  </div>);
}
