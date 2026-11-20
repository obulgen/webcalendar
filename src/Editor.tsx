import { useState } from 'react';
import { Item, KIND, REP, CATS, Rep, addD, compress } from './lib';

export default function Editor({ init, isNew, onSave, onDelete, onClose }: { init: Item; isNew: boolean; onSave: (i: Item) => void; onDelete: (i: Item) => void; onClose: () => void }) {
  const [f, setF] = useState<Item>(init); const set = (p: Partial<Item>) => setF(s => ({ ...s, ...p }));
  const isM = f.kind === 'memory';
  const chips = <T,>(opts: [T, string][], v: T, on: (v: T) => void) => <div className="chips">{opts.map(([o, l]) => <button key={String(o)} className={'chip' + (o === v ? ' on' : '')} onClick={() => on(o)}>{l}</button>)}</div>;
  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => { const fs = Array.from(e.target.files || []); const ps = await Promise.all(fs.map(compress)); set({ photos: [...f.photos, ...ps] }); e.target.value = ''; };
  const ok = () => { if (!f.title.trim()) return alert('Falta el título.'); if (!f.date) return alert('Elegí una fecha.'); onSave({ ...f, title: f.title.trim() }); };
  return (<div className="sheet-bg" onClick={onClose}><div className="sheet" onClick={e => e.stopPropagation()}>
    <div className="nav"><button onClick={onClose} style={{ fontSize: 17 }}>Cancelar</button><b>{isNew ? 'Nuevo' : 'Editar'} {KIND[f.kind][0].toLowerCase()}</b><button onClick={ok} style={{ fontSize: 17, fontWeight: 700 }}>Guardar</button></div>
    <input className="inp" style={{ marginTop: 14, fontSize: 20, fontWeight: 700 }} placeholder="Título" value={f.title} onChange={e => set({ title: e.target.value })} autoFocus={isNew} />
    <textarea className="inp" placeholder={isM ? 'Contá qué pasó…' : 'Descripción'} value={f.desc} onChange={e => set({ desc: e.target.value })} />
    <p className="lbl">Fecha</p>
    <div style={{ display: 'flex', gap: 8 }}><button className="link" onClick={() => set({ date: addD(f.date, -1) })}>‹</button><input className="inp" type="date" value={f.date} onChange={e => set({ date: e.target.value })} /><button className="link" onClick={() => set({ date: addD(f.date, 1) })}>›</button></div>
    {!isM && <><p className="lbl">Hora</p><input className="inp" type="time" value={f.time} onChange={e => set({ time: e.target.value })} />
      <p className="lbl">Repetir</p>{chips(Object.entries(REP) as [Rep, string][], f.repeat, v => set({ repeat: v }))}
      <p className="lbl">Avisarme</p>{chips<boolean>([[true, 'Sí'], [false, 'No']], f.notify, v => set({ notify: v }))}</>}
    {f.kind === 'reminder' && <><p className="lbl">Prioridad</p>{chips<1 | 2 | 3>([[1, 'Baja'], [2, 'Media'], [3, 'Alta']], f.priority, v => set({ priority: v }))}</>}
    <p className="lbl">Categoría / color</p>
    <div className="chips" style={{ gap: 10 }}>{CATS.map(c => <button key={c} className={'sw' + (f.color === c ? ' on' : '')} style={{ background: c }} onClick={() => set({ color: c })} aria-label="color" />)}</div>
    {isM && <><input className="inp" placeholder="📍 Ubicación (opcional)" value={f.place} onChange={e => set({ place: e.target.value })} />
      <input className="inp" placeholder="👥 Personas (separadas por coma)" value={f.people} onChange={e => set({ people: e.target.value })} />
      <div className="photos">{f.photos.map((u, i) => <img key={i} src={u} alt="" onClick={() => confirm('¿Quitar esta foto?') && set({ photos: f.photos.filter((_, j) => j !== i) })} />)}
        <label style={{ width: 76, height: 76, flex: 'none', borderRadius: 12, background: 'var(--chip)', display: 'grid', placeItems: 'center', fontSize: 30, color: 'var(--blue)', cursor: 'pointer' }}>＋<input type="file" accept="image/*" multiple hidden onChange={addPhotos} /></label></div></>}
    {!isNew && <button className="danger" style={{ marginTop: 24 }} onClick={() => onDelete(f)}>Eliminar</button>}
  </div></div>);
}
