/**
 * Fechas en formato AAAA-MM-DD (como las da TMDB), en la hora local del teléfono.
 * Se comparan como texto, sin zonas horarias, para que "hoy" sea el hoy de quien usa la app.
 */

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Días entre hoy y la fecha (negativo si ya pasó). */
export function daysFromToday(iso: string): number {
  return Math.round((fromISO(iso).getTime() - fromISO(todayISO()).getTime()) / 86400000);
}

/** "Hoy", "Mañana", "Jueves 20" o "20 de diciembre" si está lejos. */
export function dayLabel(iso: string): string {
  const n = daysFromToday(iso);
  const d = fromISO(iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n > 1 && n < 7) return `${capitalize(DAYS[d.getDay()])} ${d.getDate()}`;
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** "martes 17 de noviembre". */
export function longDate(iso: string): string {
  const d = fromISO(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function shortDay(iso: string): string {
  return DAYS_SHORT[fromISO(iso).getDay()];
}

/** "en 3 días", "mañana", "hoy". */
export function countdown(iso: string): string {
  const n = daysFromToday(iso);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n < 14) return `en ${n} días`;
  if (n < 60) return `en ${Math.round(n / 7)} semanas`;
  return `en ${Math.round(n / 30)} meses`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
