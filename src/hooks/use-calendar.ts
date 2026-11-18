/**
 * Calendario de lo que sigues: los próximos episodios de tus series y los estrenos de las
 * películas que tienes en "Quiero ver". Consulta TMDB una vez por sesión y título.
 */

import { useEffect, useMemo, useState } from 'react';

import { addDays, todayISO } from '@/lib/dates';
import { getMovie, getSeason, getTv } from '@/lib/tmdb';
import type { LibraryItem } from '@/lib/types';
import { useLibrary } from '@/store/library';

export type EpisodeKind = 'premiere' | 'finale' | 'standard';

export type CalendarEpisode = {
  key: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  season: number;
  episode: number;
  name: string | null;
  airDate: string;
  kind: EpisodeKind;
  /** Primer episodio de la serie que aún no sale. */
  isNext: boolean;
};

export type CalendarMovie = {
  key: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string;
};

/** Hasta dónde mirar hacia adelante. */
const HORIZON_DAYS = 120;

const showCache = new Map<number, { at: number; episodes: CalendarEpisode[]; recent: RecentEpisode | null }>();

/** El último episodio que salió, si fue en los últimos 7 días (para avisar que hay algo nuevo). */
export type RecentEpisode = { key: string; season: number; episode: number; airDate: string };
const recentCache = new Map<string, RecentEpisode>();
const movieCache = new Map<number, { at: number; date: string | null }>();
const TTL = 30 * 60 * 1000;

async function upcomingFor(item: LibraryItem): Promise<CalendarEpisode[]> {
  const hit = showCache.get(item.tmdbId);
  if (hit && Date.now() - hit.at < TTL) {
    if (hit.recent) recentCache.set(item.key, hit.recent);
    return hit.episodes;
  }
  const today = todayISO();
  const limit = addDays(today, HORIZON_DAYS);
  const tv = await getTv(item.tmdbId);
  const next = tv.next_episode_to_air;
  let episodes: CalendarEpisode[] = [];
  if (next?.air_date) {
    // La ficha solo trae el siguiente episodio; la temporada trae el resto con sus fechas.
    let season: Awaited<ReturnType<typeof getSeason>> | null = null;
    try {
      season = await getSeason(item.tmdbId, next.season_number);
    } catch {
      season = null;
    }
    const raw = season
      ? season.episodes.map((e) => ({
          s: e.season_number,
          e: e.episode_number,
          name: e.name,
          date: e.air_date,
          type: e.episode_type,
        }))
      : [
          {
            s: next.season_number,
            e: next.episode_number,
            name: next.name ?? null,
            date: next.air_date,
            type: next.episode_type,
          },
        ];
    const lastInSeason = Math.max(...raw.map((r) => r.e));
    episodes = raw
      .filter((r): r is typeof r & { date: string } => !!r.date && r.date >= today && r.date <= limit)
      .map((r) => ({
        key: item.key,
        tmdbId: item.tmdbId,
        title: item.title,
        posterPath: item.posterPath,
        season: r.s,
        episode: r.e,
        // TMDB pone "Episodio 3" cuando aún no hay nombre: no aporta nada.
        name: r.name && !/^(episodio|episode) \d+$/i.test(r.name) ? r.name : null,
        airDate: r.date,
        kind: r.e === 1 ? 'premiere' : r.type === 'finale' || r.e === lastInSeason ? 'finale' : 'standard',
        isNext: false,
      }));
    if (episodes[0]) episodes[0].isNext = true;
  }
  const last = tv.last_episode_to_air;
  const recent =
    last?.air_date && last.air_date >= addDays(today, -7) && last.air_date <= today
      ? { key: item.key, season: last.season_number, episode: last.episode_number, airDate: last.air_date }
      : null;
  if (recent) recentCache.set(item.key, recent);
  else recentCache.delete(item.key);
  showCache.set(item.tmdbId, { at: Date.now(), episodes, recent });
  return episodes;
}

async function releaseFor(item: LibraryItem): Promise<string | null> {
  const hit = movieCache.get(item.tmdbId);
  if (hit && Date.now() - hit.at < TTL) return hit.date;
  const m = await getMovie(item.tmdbId);
  const date = m.release_date || null;
  movieCache.set(item.tmdbId, { at: Date.now(), date });
  return date;
}

/** Ejecuta las consultas de a pocas, para no saturar la API. */
async function inBatches<T, R>(list: T[], size: number, fn: (t: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = [];
  for (let i = 0; i < list.length; i += size) {
    const part = await Promise.all(list.slice(i, i + size).map((t) => fn(t).catch(() => null)));
    out.push(...part);
  }
  return out;
}

export function useCalendar() {
  const { items, ready } = useLibrary();
  const list = items;

  // Series que tiene sentido vigilar. Con historiales grandes (cientos de series) no se
  // consultan todas: las que estás viendo o pausaste, las terminadas que viste en el último año
  // (por si vuelven) y las 60 por empezar agregadas más recientemente.
  const shows = useMemo(() => {
    const tv = list.filter((i) => i.mediaType === 'tv');
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const lastSeen = (i: (typeof tv)[number]) =>
      Object.values(i.watchedEpisodes).reduce((m: string, at) => (at > m ? at : m), i.addedAt);
    const active = tv.filter(
      (i) => i.status === 'watching' || i.status === 'paused' || (i.status === 'completed' && lastSeen(i) > yearAgo),
    );
    const planned = tv
      .filter((i) => i.status === 'planned')
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, 60);
    return [...active, ...planned];
  }, [list]);
  // Películas pendientes que podrían no haberse estrenado aún.
  const thisYear = new Date().getFullYear();
  const movies = useMemo(
    () =>
      list.filter((i) => i.mediaType === 'movie' && i.status === 'planned' && (!i.year || Number(i.year) >= thisYear)),
    [list, thisYear],
  );
  const signature = shows.map((s) => s.key).join(',') + '|' + movies.map((m) => m.key).join(',');

  const [episodes, setEpisodes] = useState<CalendarEpisode[]>([]);
  const [releases, setReleases] = useState<CalendarMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const today = todayISO();
    Promise.all([
      inBatches(shows, 6, upcomingFor),
      inBatches(movies, 6, async (m) => {
        const date = await releaseFor(m);
        return date && date >= today
          ? { key: m.key, tmdbId: m.tmdbId, title: m.title, posterPath: m.posterPath, releaseDate: date }
          : null;
      }),
    ]).then(([eps, rel]) => {
      if (cancelled) return;
      const flat = eps.flatMap((e) => e ?? []);
      flat.sort(
        (a, b) => a.airDate.localeCompare(b.airDate) || a.title.localeCompare(b.title) || a.episode - b.episode,
      );
      setEpisodes(flat);
      setReleases(
        rel.filter((r): r is CalendarMovie => r != null).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)),
      );
      setFailed(eps.length > 0 && eps.every((e) => e == null));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // La firma resume qué títulos hay que consultar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature]);

  /** El próximo episodio por serie, para avisar en Siguiendo cuándo sale. */
  const nextByKey = useMemo(() => {
    const map: Record<string, CalendarEpisode> = {};
    for (const e of episodes) if (e.isNext) map[e.key] = e;
    return map;
  }, [episodes]);

  /** Series con un episodio que salió esta semana y que aún no marcaste. */
  const fresh = useMemo(() => {
    if (loading) return [] as RecentEpisode[];
    return shows
      .map((s) => recentCache.get(s.key))
      .filter((r): r is RecentEpisode => !!r)
      .filter((r) => {
        const it = shows.find((s) => s.key === r.key);
        return it && !(it.watchedEpisodes as Record<string, string>)[`${r.season}:${r.episode}`];
      });
  }, [loading, shows]);

  // El ícono de la app muestra cuántas series tienen algo nuevo (iPhone, Android y computador).
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (fresh.length) nav.setAppBadge?.(fresh.length).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [fresh.length]);

  return { loading, failed, episodes, releases, nextByKey, fresh, watchedShows: shows.length };
}
