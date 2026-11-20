export type Rep = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type Kind = 'memory' | 'event' | 'reminder' | 'important';
export interface Item { id: string; kind: Kind; title: string; desc: string; date: string; time: string; repeat: Rep; priority: 1 | 2 | 3;
  color: string; notify: boolean; done: boolean; photos: string[]; place: string; people: string; }
export interface Holiday { d: string; n: string; t: 'nacional' | 'provincial' | 'nolaborable'; s: string; src: string; }

export const TZ = 'America/Argentina/Cordoba';
export const MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const KIND: Record<Kind, [string, string]> = { memory: ['Recuerdo', '#a855f7'], event: ['Evento', '#3b82f6'], reminder: ['Recordatorio', '#f59e0b'], important: ['Fecha importante', '#f43f5e'] };
export const HT = { nacional: '#22c55e', provincial: '#06b6d4', nolaborable: '#eab308' };
export const HN = { nacional: 'Feriado nacional', provincial: 'Feriado provincial', nolaborable: 'Día no laborable' };
export const CATS = ['#a855f7', '#3b82f6', '#22c55e', '#f59e0b', '#f43f5e', '#06b6d4'];
export const REP: Record<Rep, string> = { none: 'No', daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' };

const pad = (n: number) => String(n).padStart(2, '0');
export const F = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const P = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addD = (s: string, n: number) => { const d = P(s); d.setDate(d.getDate() + n); return F(d); };
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
export const nowTime = () => new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
export const fmt = (s: string) => { const d = P(s); return `${d.getDate()} de ${MES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const blank = (kind: Kind, date: string): Item => ({ id: uid(), kind, title: '', desc: '', date, time: '09:00', repeat: kind === 'important' ? 'yearly' : 'none', priority: 1,
  color: KIND[kind][1], notify: kind !== 'memory', done: false, photos: [], place: '', people: '' });

export function occursOn(it: Item, d: string): boolean {
  if (it.date === d) return true; if (it.date > d) return false;
  const a = P(it.date), b = P(d);
  switch (it.repeat) {
    case 'daily': return true;
    case 'weekly': return Math.round((+b - +a) / 864e5) % 7 === 0;
    case 'monthly': return a.getDate() === b.getDate();
    case 'yearly': return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    default: return false;
  }
}

export async function askPermission(): Promise<string> { return 'Notification' in window ? Notification.requestPermission() : 'unsupported'; }
export async function notify(title: string, body: string) {
  try { if ('Notification' in window && Notification.permission === 'granted') {
    const r = await navigator.serviceWorker?.ready; if (r) { await r.showNotification(title, { body, icon: './icon-192.png' }); return; } new Notification(title, { body }); } } catch {}
}
export const firedKey = (it: Item, d: string) => `${it.id}|${d}|${it.time}`;

export function downloadFile(name: string, mime: string, content: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
export function toICS(items: Item[]) {
  const R: Record<Rep, string> = { none: '', daily: 'RRULE:FREQ=DAILY', weekly: 'RRULE:FREQ=WEEKLY', monthly: 'RRULE:FREQ=MONTHLY', yearly: 'RRULE:FREQ=YEARLY' };
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memorias//ES', 'CALSCALE:GREGORIAN'];
  items.filter(i => i.kind !== 'memory').forEach(i => {
    const d = i.date.replace(/-/g, ''), t = i.time.replace(':', '') + '00';
    out.push('BEGIN:VEVENT', `UID:${i.id}@memorias`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
      i.kind === 'important' ? `DTSTART;VALUE=DATE:${d}` : `DTSTART;TZID=${TZ}:${d}T${t}`, `SUMMARY:${icsEsc(i.title)}`, ...(i.desc ? [`DESCRIPTION:${icsEsc(i.desc)}`] : []), ...(R[i.repeat] ? [R[i.repeat]] : []));
    if (i.notify) out.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(i.title)}`, 'TRIGGER:PT0S', 'END:VALARM');
    out.push('END:VEVENT');
  });
  out.push('END:VCALENDAR'); return out.join('\r\n');
}
export function compress(file: File): Promise<string> {
  return new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.75)); };
    img.onerror = rej; img.src = u; });
}
