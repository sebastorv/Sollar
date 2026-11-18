/**
 * Actividad: cada episodio y película vista como un evento con fecha. De aquí salen el
 * historial, la racha, las estadísticas y el resumen del año.
 */

import { toISO } from './dates';
import type { LibraryItem, MediaType } from './types';

export type WatchEvent = {
  at: string;
  /** Día local (AAAA-MM-DD). */
  day: string;
  key: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  season?: number;
  episode?: number;
  minutes: number;
  genres: string[];
  rewatch?: boolean;
};

export function eventsOf(items: LibraryItem[]): WatchEvent[] {
  const out: WatchEvent[] = [];
  for (const i of items) {
    const base = {
      key: i.key,
      tmdbId: i.tmdbId,
      mediaType: i.mediaType,
      title: i.title,
      posterPath: i.posterPath,
      minutes: i.runtime ?? 0,
      genres: i.genres,
    };
    if (i.mediaType === 'movie') {
      if (i.watchedAt) out.push({ ...base, at: i.watchedAt, day: toISO(new Date(i.watchedAt)) });
      for (const at of i.rewatches ?? []) out.push({ ...base, at, day: toISO(new Date(at)), rewatch: true });
    } else {
      for (const [k, at] of Object.entries(i.watchedEpisodes)) {
        const [season, episode] = k.split(':').map(Number);
        out.push({ ...base, at, day: toISO(new Date(at)), season, episode });
      }
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export type Totals = { minutes: number; episodes: number; movies: number; titles: number };

export function totalsOf(events: WatchEvent[]): Totals {
  let minutes = 0;
  let episodes = 0;
  let movies = 0;
  const titles = new Set<string>();
  for (const e of events) {
    minutes += e.minutes;
    if (e.mediaType === 'movie') movies++;
    else episodes++;
    titles.add(e.key);
  }
  return { minutes, episodes, movies, titles: titles.size };
}

/** Racha actual y la más larga (días seguidos con algo visto). */
export function streaks(events: WatchEvent[], today: string): { current: number; longest: number } {
  const days = [...new Set(events.map((e) => e.day))].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const set = new Set(days);
  let cur = 0;
  let d = set.has(today) ? today : shift(today, -1);
  while (set.has(d)) {
    cur++;
    d = shift(d, -1);
  }
  return { current: cur, longest };
}

function dayDiff(a: string, b: string) {
  return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000);
}
function shift(d: string, n: number) {
  const t = new Date(d + 'T12:00:00');
  t.setDate(t.getDate() + n);
  return toISO(t);
}

/** Suma de una métrica agrupada por una clave. Devuelve las primeras n, de mayor a menor. */
export function topBy<T extends string>(
  events: WatchEvent[],
  key: (e: WatchEvent) => T | T[] | null,
  n = 5,
  value: (e: WatchEvent) => number = () => 1,
): { name: T; value: number }[] {
  const m = new Map<T, number>();
  for (const e of events) {
    const k = key(e);
    if (k == null) continue;
    for (const one of Array.isArray(k) ? k : [k]) m.set(one, (m.get(one) ?? 0) + value(e));
  }
  return [...m.entries()]
    .map(([name, v]) => ({ name, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MONTHS = [
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
export const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "312 h" o "45 min". */
export function hours(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.round(minutes / 60);
  return `${h.toLocaleString('es-CO')} h`;
}

/** "13 días, 4 horas" para totales grandes. */
export function longDuration(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  if (d === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${d.toLocaleString('es-CO')} ${d === 1 ? 'día' : 'días'}, ${h} ${h === 1 ? 'hora' : 'horas'}`;
}
