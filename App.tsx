import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Image, Alert, Share, useColorScheme, StyleSheet, SafeAreaView } from 'react-native';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import HOL from './holidays.json';

const HOLIDAYS_URL = ''; // URL de tu JSON con el mismo formato que holidays.json para actualizar sin republicar
const TZ = 'America/Argentina/Cordoba';
const MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIA = ['L','M','X','J','V','S','D'];
const KIND: any = { memory: ['Recuerdo','#AF52DE'], event: ['Evento','#0A84FF'], reminder: ['Recordatorio','#FF9F0A'], important: ['Fecha importante','#FF375F'] };
const HT: any = { nacional: '#30D158', provincial: '#64D2FF', nolaborable: '#FFD60A' };
const HN: any = { nacional: 'Feriado nacional', provincial: 'Feriado provincial', nolaborable: 'Día no laborable' };
const CATS = ['#AF52DE','#0A84FF','#30D158','#FF9F0A','#FF375F','#64D2FF'];
const REP: any = { none: 'No', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' };

const pad = (n: number) => String(n).padStart(2, '0');
const F = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const P = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (s: string, n: number) => { const d = P(s); d.setDate(d.getDate() + n); return F(d); };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const hourNow = () => Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
const fmt = (s: string) => { const d = P(s); return `${d.getDate()} de ${MES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`; };
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && F(P(s)) === s;
const validTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

async function schedule(it: any): Promise<string | undefined> {
  if (it.nid) await Notifications.cancelScheduledNotificationAsync(it.nid).catch(() => {});
  if (it.kind === 'memory' || it.done || !it.notify) return undefined;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') { Alert.alert('Notificaciones desactivadas', 'Activalas en Ajustes > Memorias para recibir avisos.'); return undefined; }
  const [h, m] = (it.time || '09:00').split(':').map(Number);
  const d = P(it.date); const b = { hour: h, minute: m };
  let trigger: any;
  switch (it.repeat) {
    case 'daily': trigger = { type: 'calendar', repeats: true, ...b }; break;
    case 'weekly': trigger = { type: 'calendar', repeats: true, weekday: d.getDay() + 1, ...b }; break;
    case 'monthly': trigger = { type: 'calendar', repeats: true, day: d.getDate(), ...b }; break;
    case 'yearly': trigger = { type: 'calendar', repeats: true, month: d.getMonth() + 1, day: d.getDate(), ...b }; break;
    default: { const w = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m); if (w <= new Date()) return undefined; trigger = { type: 'date', date: w }; }
  }
  return Notifications.scheduleNotificationAsync({ content: { title: it.title, body: it.desc || KIND[it.kind][0] }, trigger });
}

export default function App() {
  const dark = useColorScheme() === 'dark';
  const C = dark ? { bg: '#000', fg: '#fff', sub: '#8E8E93', card: 'rgba(120,120,128,0.24)', line: 'rgba(255,255,255,0.12)' }
                 : { bg: '#F2F2F7', fg: '#000', sub: '#6C6C70', card: 'rgba(255,255,255,0.7)', line: 'rgba(0,0,0,0.08)' };
  const [items, setItems] = useState<any[]>([]);
  const [hol, setHol] = useState<any[]>(HOL.items);
  const [tab, setTab] = useState(0);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [sel, setSel] = useState(today());
  const [mode, setMode] = useState(0);
  const [q, setQ] = useState('');
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('items'); if (raw) setItems(JSON.parse(raw));
      loaded.current = true;
      const cached = await AsyncStorage.getItem('hol'); if (cached) setHol(JSON.parse(cached));
      if (HOLIDAYS_URL) try { const r = await fetch(HOLIDAYS_URL); const j = await r.json(); setHol(j.items); AsyncStorage.setItem('hol', JSON.stringify(j.items)); } catch {}
    })();
  }, []);
  useEffect(() => { if (loaded.current) AsyncStorage.setItem('items', JSON.stringify(items)); }, [items]);

  const holBy = useMemo(() => { const m: any = {}; hol.forEach(h => (m[h.d] = m[h.d] || []).push(h)); return m; }, [hol]);
  const on = (d: string) => items.filter(i => i.date === d || (i.repeat === 'yearly' && i.date.slice(5) === d.slice(5) && i.date < d)).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const save = async (it: any) => {
    const nid = await schedule(it); const n = { ...it, nid };
    setItems(p => p.some(x => x.id === n.id) ? p.map(x => x.id === n.id ? n : x) : [...p, n]);
    setEdit(null);
  };
  const del = (it: any) => Alert.alert('Eliminar', `¿Eliminar "${it.title}"?`, [{ text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: async () => { if (it.nid) await Notifications.cancelScheduledNotificationAsync(it.nid).catch(() => {}); setItems(p => p.filter(x => x.id !== it.id)); setEdit(null); } }]);
  const toggle = async (it: any) => { const n = { ...it, done: !it.done }; n.nid = await schedule(n); setItems(p => p.map(x => x.id === n.id ? n : x)); };
  const add = (kind: string, date = sel) => { setMenu(false); setEdit({ id: String(Date.now()), kind, title: '', desc: '', date, time: '09:00', repeat: kind === 'important' ? 'yearly' : 'none', priority: 1, color: KIND[kind][1], notify: kind !== 'memory', photos: [], place: '', people: '', isNew: true }); };

  const Glass = ({ children, style }: any) => (
    <BlurView intensity={40} tint={dark ? 'dark' : 'light'} style={[{ borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, padding: 14, marginBottom: 12 }, style]}>{children}</BlurView>);
  const T = ({ children, s = 15, w = '400', c = C.fg, style }: any) => <Text style={[{ fontSize: s, fontWeight: w, color: c }, style]}>{children}</Text>;
  const Item = ({ it, date }: any) => (
    <Pressable onPress={() => setEdit(it)} onLongPress={() => del(it)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      {it.kind === 'reminder' ? <Pressable onPress={() => toggle(it)} hitSlop={10} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: it.color, backgroundColor: it.done ? it.color : 'transparent', marginRight: 12 }} />
        : <View style={{ width: 6, height: 34, borderRadius: 3, backgroundColor: it.color || KIND[it.kind][1], marginRight: 12 }} />}
      <View style={{ flex: 1 }}>
        <T w="600" style={it.done && { textDecorationLine: 'line-through', opacity: 0.5 }}>{it.title}</T>
        <T s={12} c={C.sub}>{KIND[it.kind][0]}{it.kind !== 'memory' && it.time ? ` · ${it.time}` : ''}{date ? ` · ${fmt(it.date)}` : ''}{it.kind === 'reminder' && it.priority === 3 ? ' · ❗ alta' : ''}</T>
      </View>
      {it.photos?.[0] && <Image source={{ uri: it.photos[0] }} style={{ width: 40, height: 40, borderRadius: 10 }} />}
    </Pressable>);
  const Holi = ({ h }: any) => (<View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
    <View style={{ width: 6, height: 28, borderRadius: 3, backgroundColor: HT[h.t], marginRight: 12 }} />
    <View style={{ flex: 1 }}><T w="600">{h.n}</T><T s={12} c={C.sub}>{HN[h.t]}{h.s !== 'oficial' ? ` · ${h.s === 'pendiente' ? 'a confirmar' : 'verificar decreto'}` : ''}</T></View></View>);

  // ---------- INICIO ----------
  const Home = () => {
    const t = today(); const h = hourNow();
    const hi = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
    const d = P(t); const todays = on(t); const pend = todays.filter(i => i.kind === 'reminder' && !i.done).length;
    const up = items.filter(i => i.kind !== 'memory' && i.date > t && !i.done).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
    const nextH = hol.filter(x => x.d >= t).sort((a, b) => a.d.localeCompare(b.d)).slice(0, 3);
    const ago = items.filter(i => i.kind === 'memory' && i.date.slice(5) === t.slice(5) && i.date.slice(0, 4) < t.slice(0, 4));
    return (<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
      <T s={13} c={C.sub} w="600">{['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'][d.getDay()]} {d.getDate()} DE {MES[d.getMonth()].toUpperCase()}</T>
      <T s={34} w="800" style={{ marginBottom: 14 }}>{hi} 👋</T>
      <Glass><T s={13} c={C.sub} w="600">HOY</T>
        <T s={17} w="600" style={{ marginTop: 4 }}>{todays.length + (holBy[t]?.length || 0) === 0 ? 'Día libre de compromisos ✨' : `${todays.length} en agenda · ${pend} recordatorios pendientes`}</T>
        {(holBy[t] || []).map((x: any, i: number) => <Holi key={i} h={x} />)}{todays.map(i => <Item key={i.id} it={i} />)}</Glass>
      <Pressable onPress={() => add('memory', t)}><Glass style={{ backgroundColor: '#AF52DE' }}><T s={18} w="700" c="#fff">＋ Guardar un recuerdo</T><T s={13} c="#fff" style={{ opacity: 0.85 }}>¿Qué te pasó hoy?</T></Glass></Pressable>
      {ago.length > 0 && <Glass><T s={13} c={C.sub} w="600">UN DÍA COMO HOY</T>{ago.map(i => <View key={i.id}><Item it={i} date /><T s={12} c={C.sub}>Hace {Number(t.slice(0, 4)) - Number(i.date.slice(0, 4))} años</T></View>)}</Glass>}
      <Glass><T s={13} c={C.sub} w="600">PRÓXIMAMENTE</T>{up.length ? up.map(i => <Item key={i.id} it={i} date />) : <T c={C.sub}>Nada pendiente.</T>}</Glass>
      <Glass><T s={13} c={C.sub} w="600">FERIADOS CERCANOS</T>{nextH.map((x, i) => <View key={i}><Holi h={x} /><T s={12} c={C.sub} style={{ marginLeft: 18 }}>{fmt(x.d)}</T></View>)}</Glass>
    </ScrollView>);
  };

  // ---------- CALENDARIO ----------
  const Cal = () => {
    const cur = P(sel); const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1); const lead = (first.getDay() + 6) % 7; const dim = new Date(y, m + 1, 0).getDate();
    const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => F(new Date(y, m, i + 1)))];
    const mon = addD(sel, -((cur.getDay() + 6) % 7)); const week = Array.from({ length: 7 }, (_, i) => addD(mon, i));
    const goM = (n: number) => { const d = new Date(y, m + n, 1); setSel(F(d)); };
    const dots = (d: string) => { const c = new Set<string>(); on(d).forEach(i => c.add(i.color || KIND[i.kind][1])); (holBy[d] || []).forEach((h: any) => c.add(HT[h.t])); return [...c].slice(0, 3); };
    const Day = ({ d }: { d: string }) => { const s = d === sel, t = d === today(); return (
      <Pressable onPress={() => setSel(d)} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 4 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: s ? '#0A84FF' : 'transparent', borderWidth: t && !s ? 1.5 : 0, borderColor: '#0A84FF' }}>
          <T w={t ? '800' : '500'} c={s ? '#fff' : (holBy[d] ? HT[holBy[d][0].t] : C.fg)}>{P(d).getDate()}</T></View>
        <View style={{ flexDirection: 'row', height: 6, marginTop: 2 }}>{dots(d).map((c, i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c, marginHorizontal: 1 }} />)}</View></Pressable>); };
    const ev = on(sel); const hs = holBy[sel] || [];
    return (<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T s={28} w="800">{MES[m]} <T s={28} w="300" c={C.sub}>{y}</T></T>
        <View style={{ flexDirection: 'row' }}>{[['«', () => goM(-12)], ['‹', () => goM(-1)], ['Hoy', () => setSel(today())], ['›', () => goM(1)], ['»', () => goM(12)]].map(([l, f]: any, i) =>
          <Pressable key={i} onPress={f} style={{ paddingHorizontal: 9, paddingVertical: 6 }}><T s={18} w="600" c="#0A84FF">{l}</T></Pressable>)}</View></View>
      <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, padding: 2, marginVertical: 10 }}>
        {['Mes', 'Semana', 'Día'].map((l, i) => <Pressable key={l} onPress={() => setMode(i)} style={{ flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center', backgroundColor: mode === i ? (dark ? '#636366' : '#fff') : 'transparent' }}><T s={13} w="600">{l}</T></Pressable>)}</View>
      {mode < 2 && <Glass><View style={{ flexDirection: 'row' }}>{DIA.map(d => <View key={d} style={{ width: '14.28%', alignItems: 'center' }}><T s={11} c={C.sub} w="600">{d}</T></View>)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{mode === 0 ? cells.map((d, i) => d ? <Day key={d} d={d} /> : <View key={'e' + i} style={{ width: '14.28%' }} />) : week.map(d => <Day key={d} d={d} />)}</View></Glass>}
      {mode === 2 && <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><Pressable onPress={() => setSel(addD(sel, -1))}><T s={22} c="#0A84FF">‹</T></Pressable><T w="700">{fmt(sel)}</T><Pressable onPress={() => setSel(addD(sel, 1))}><T s={22} c="#0A84FF">›</T></Pressable></View>}
      <Glass>{mode < 2 && <T s={13} c={C.sub} w="600" style={{ marginBottom: 4 }}>{fmt(sel).toUpperCase()}</T>}
        {hs.map((h: any, i: number) => <Holi key={i} h={h} />)}{ev.map(i => <Item key={i.id} it={i} />)}
        {!hs.length && !ev.length && <T c={C.sub}>Sin acontecimientos.</T>}</Glass>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[...Object.entries(HT).map(([k, c]: any) => [HN[k], c]), ...Object.values(KIND).map((k: any) => [k[0], k[1]])].map(([l, c]: any) =>
        <View key={l} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c, marginRight: 4 }} /><T s={11} c={C.sub}>{l}</T></View>)}</View>
    </ScrollView>);
  };

  // ---------- LISTAS ----------
  const List = ({ kind, title }: any) => {
    const l = items.filter(i => (kind === 'reminder' ? ['reminder', 'important'].includes(i.kind) : i.kind === kind) && (q ? (i.title + i.desc + (i.people || '') + (i.place || '')).toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => kind === 'memory' ? b.date.localeCompare(a.date) : (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.date.localeCompare(b.date));
    return (<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
      <T s={34} w="800">{title}</T>
      <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={C.sub} style={{ backgroundColor: C.card, color: C.fg, borderRadius: 12, padding: 10, marginVertical: 12 }} />
      {l.length === 0 && <T c={C.sub}>{q ? 'Sin resultados.' : 'Todavía no hay nada. Tocá + para agregar.'}</T>}
      {l.map(i => <Glass key={i.id}><Item it={i} date />{i.desc ? <T s={13} c={C.sub} style={{ marginTop: 2 }} >{i.desc}</T> : null}{i.place ? <T s={12} c={C.sub}>📍 {i.place}</T> : null}{i.people ? <T s={12} c={C.sub}>👥 {i.people}</T> : null}
        {i.photos?.length > 1 && <ScrollView horizontal style={{ marginTop: 8 }}>{i.photos.map((u: string) => <Image key={u} source={{ uri: u }} style={{ width: 70, height: 70, borderRadius: 12, marginRight: 6 }} />)}</ScrollView>}</Glass>)}
    </ScrollView>);
  };

  // ---------- PERFIL ----------
  const Profile = () => (<ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
    <T s={34} w="800" style={{ marginBottom: 12 }}>Perfil</T>
    <Glass><T w="700">Apariencia</T><T c={C.sub} s={13}>Sigue el modo claro/oscuro de tu iPhone (Ajustes → Pantalla y brillo).</T></Glass>
    <Glass><T w="700">Zona horaria</T><T c={C.sub} s={13}>{TZ}</T></Glass>
    <Glass><T w="700">Privacidad</T><T c={C.sub} s={13}>Tus datos viven solo en este dispositivo. No hay cuentas ni servidores.</T></Glass>
    <Pressable onPress={async () => { const s = await Notifications.requestPermissionsAsync(); Alert.alert('Notificaciones', s.status === 'granted' ? 'Activadas ✅' : 'Desactivadas. Activalas en Ajustes.'); }}><Glass><T w="700" c="#0A84FF">Permisos de notificaciones</T></Glass></Pressable>
    <Pressable onPress={() => Share.share({ title: 'Memorias', message: JSON.stringify({ exportado: new Date().toISOString(), items }, null, 2) })}><Glass><T w="700" c="#0A84FF">Exportar recuerdos y eventos (JSON)</T><T c={C.sub} s={13}>{items.length} elementos guardados</T></Glass></Pressable>
    <Glass><T w="700">Feriados</T><T c={C.sub} s={13}>{hol.length} fechas cargadas. Las marcadas “verificar decreto” o “a confirmar” se calcularon por ley y deben confirmarse contra el decreto oficial.</T></Glass>
  </ScrollView>);

  // ---------- EDITOR ----------
  const Editor = () => {
    const [f, setF] = useState<any>(edit);
    const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
    const k = f.kind; const isM = k === 'memory';
    const inp = { backgroundColor: C.card, color: C.fg, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 16 } as any;
    const chips = (opts: [any, string][], val: any, on: (v: any) => void) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>{opts.map(([v, l]) =>
      <Pressable key={String(v)} onPress={() => on(v)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 6, marginBottom: 6, backgroundColor: val === v ? '#0A84FF' : C.card }}><T s={13} w="600" c={val === v ? '#fff' : C.fg}>{l}</T></Pressable>)}</View>;
    const pick = async () => { const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.7 }); if (!r.canceled) set('photos', [...f.photos, ...r.assets.map(a => a.uri)]); };
    const ok = () => { if (!f.title.trim()) return Alert.alert('Falta el título'); if (!validDate(f.date)) return Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.'); if (!isM && !validTime(f.time)) return Alert.alert('Hora inválida', 'Usá HH:MM (24 h).'); const { isNew, ...rest } = f; save(rest); };
    return (<Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEdit(null)}><View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 18 }}><Pressable onPress={() => setEdit(null)}><T c="#0A84FF" s={17}>Cancelar</T></Pressable><T w="700" s={17}>{f.isNew ? 'Nuevo' : 'Editar'} {KIND[k][0].toLowerCase()}</T><Pressable onPress={ok}><T c="#0A84FF" w="700" s={17}>Guardar</T></Pressable></View>
      <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled">
        <TextInput value={f.title} onChangeText={v => set('title', v)} placeholder="Título" placeholderTextColor={C.sub} style={{ ...inp, fontSize: 20, fontWeight: '700' }} />
        <TextInput value={f.desc} onChangeText={v => set('desc', v)} placeholder={isM ? 'Contá qué pasó…' : 'Descripción'} placeholderTextColor={C.sub} multiline style={{ ...inp, minHeight: isM ? 120 : 70 }} />
        <T s={12} c={C.sub} w="600" style={{ marginBottom: 4 }}>FECHA (AAAA-MM-DD)</T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Pressable onPress={() => validDate(f.date) && set('date', addD(f.date, -1))}><T s={26} c="#0A84FF">‹ </T></Pressable><TextInput value={f.date} onChangeText={v => set('date', v)} style={{ ...inp, flex: 1, textAlign: 'center' }} /><Pressable onPress={() => validDate(f.date) && set('date', addD(f.date, 1))}><T s={26} c="#0A84FF"> ›</T></Pressable></View>
        {!isM && <><T s={12} c={C.sub} w="600" style={{ marginBottom: 4 }}>HORA (HH:MM)</T><TextInput value={f.time} onChangeText={v => set('time', v)} style={inp} keyboardType="numbers-and-punctuation" />
          <T s={12} c={C.sub} w="600" style={{ marginBottom: 4 }}>REPETIR</T>{chips(Object.entries(REP) as any, f.repeat, v => set('repeat', v))}
          <T s={12} c={C.sub} w="600" style={{ marginBottom: 4 }}>NOTIFICAR</T>{chips([[true, 'Sí'], [false, 'No']], f.notify, v => set('notify', v)).valueOf()}</>}
        {k === 'reminder' && <><T s={12} c={C.sub} w="600" style={{ marginBottom: 4 }}>PRIORIDAD</T>{chips([[1, 'Baja'], [2, 'Media'], [3, 'Alta']], f.priority, v => set('priority', v))}</>}
        <T s={12} c={C.sub} w="600" style={{ marginBottom: 4 }}>CATEGORÍA / COLOR</T>
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>{CATS.map(c => <Pressable key={c} onPress={() => set('color', c)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, marginRight: 10, borderWidth: f.color === c ? 3 : 0, borderColor: C.fg }} />)}</View>
        {isM && <><TextInput value={f.place} onChangeText={v => set('place', v)} placeholder="📍 Ubicación (opcional)" placeholderTextColor={C.sub} style={inp} />
          <TextInput value={f.people} onChangeText={v => set('people', v)} placeholder="👥 Personas (separadas por coma)" placeholderTextColor={C.sub} style={inp} />
          <ScrollView horizontal>{f.photos.map((u: string) => <Pressable key={u} onPress={() => set('photos', f.photos.filter((x: string) => x !== u))}><Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 12, marginRight: 8 }} /></Pressable>)}
            <Pressable onPress={pick} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}><T s={28} c="#0A84FF">＋</T></Pressable></ScrollView>
          {f.photos.length > 0 && <T s={11} c={C.sub} style={{ marginTop: 4 }}>Tocá una foto para quitarla.</T>}</>}
        {!f.isNew && <Pressable onPress={() => del(f)} style={{ marginTop: 24 }}><T c="#FF453A" w="700" s={16}>Eliminar</T></Pressable>}
      </ScrollView></View></Modal>);
  };

  const tabs = [['Inicio', '◉'], ['Calendario', '▦'], ['Recuerdos', '✦'], ['Recordatorios', '✓'], ['Perfil', '☺']];
  return (<SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={{ flex: 1 }}>{tab === 0 ? Home() : tab === 1 ? Cal() : tab === 2 ? List({ kind: 'memory', title: 'Recuerdos' }) : tab === 3 ? List({ kind: 'reminder', title: 'Recordatorios' }) : Profile()}</View>
    <Pressable onPress={() => setMenu(true)} style={{ position: 'absolute', right: 20, bottom: 96, width: 58, height: 58, borderRadius: 29, backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}><T s={32} c="#fff" w="300">+</T></Pressable>
    <BlurView intensity={70} tint={dark ? 'dark' : 'light'} style={{ position: 'absolute', left: 12, right: 12, bottom: 18, borderRadius: 30, overflow: 'hidden', flexDirection: 'row', paddingVertical: 8, borderWidth: 0.5, borderColor: C.line }}>
      {tabs.map(([l, ic], i) => <Pressable key={l} onPress={() => { setTab(i); setQ(''); }} style={{ flex: 1, alignItems: 'center' }}><T s={20} c={tab === i ? '#0A84FF' : C.sub}>{ic}</T><T s={9} w="600" c={tab === i ? '#0A84FF' : C.sub}>{l}</T></Pressable>)}</BlurView>
    <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}><Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 16 }}>
      <BlurView intensity={80} tint={dark ? 'dark' : 'light'} style={{ borderRadius: 26, overflow: 'hidden', padding: 8, marginBottom: 20 }}>
        {Object.entries(KIND).map(([k, v]: any) => <Pressable key={k} onPress={() => add(k)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: v[1], marginRight: 14 }} /><T s={18} w="600">Nuevo {v[0].toLowerCase()}</T></Pressable>)}</BlurView></Pressable></Modal>
    {edit && <Editor key={edit.id} />}
  </SafeAreaView>);
}
