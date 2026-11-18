/**
 * Ejecuta una importación: por cada título del plan pide a TMDB su carátula, temporadas y
 * duración, arma el elemento de la biblioteca y lo entrega en tandas para guardarlo.
 *
 * Si un título ya está en tu lista no se vuelve a consultar: se toma lo que ya hay y se le
 * suma lo importado. Por eso, si la importación se corta, al repetirla avanza rápido.
 */

import type { ImportPlan, ImportedMovie, ImportedShow } from './import-wetrakr';
import { itemKey, newItemFromMovie, newItemFromTv } from './library-item';
import { getMovie, getTv, TmdbError } from './tmdb';
import { episodeKey, type CustomList, type LibraryItem, type ListEntry } from './types';

export type ImportProgress = {
  done: number;
  total: number;
  skipped: string[];
  /** Si TMDB no responde (sin sesión, sin token, sin red), se detiene y explica por qué. */
  error?: string;
};

type Task = { kind: 'movie'; data: ImportedMovie } | { kind: 'tv'; data: ImportedShow };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reintenta cuando TMDB pide calma (429) o hay un corte de red pasajero. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = e instanceof TmdbError ? e.status : undefined;
      if (status === 404 || status === 401 || attempt >= 4) throw e;
      await sleep(800 * 2 ** attempt);
    }
  }
}

function movieItem(base: LibraryItem, m: ImportedMovie, now: string): LibraryItem {
  return {
    ...base,
    status: m.status,
    watchedAt: m.status === 'completed' ? m.watchedAt : null,
    rating: m.rating,
    addedAt: m.addedAt,
    updatedAt: now,
  };
}

function showItem(base: LibraryItem, s: ImportedShow, now: string): LibraryItem {
  // Solo episodios de temporadas que existen (TMDB a veces renumera los especiales).
  const valid = new Set(base.seasons.map((x) => x.seasonNumber));
  const watchedEpisodes: Record<string, string> = {};
  for (const [k, at] of Object.entries(s.episodes)) {
    const [season, ep] = k.split(':').map(Number);
    const info = base.seasons.find((x) => x.seasonNumber === season);
    if (valid.has(season) && info && ep <= info.episodeCount) watchedEpisodes[episodeKey(season, ep)] = at;
  }
  return {
    ...base,
    status: s.status ?? 'planned',
    rating: s.rating,
    watchedEpisodes: watchedEpisodes as LibraryItem['watchedEpisodes'],
    addedAt: s.addedAt,
    updatedAt: now,
  };
}

export async function runImport(
  plan: ImportPlan,
  opts: {
    existing: Record<string, LibraryItem>;
    onBatch: (items: LibraryItem[]) => void;
    /** Listas armadas al final, con carátulas. */
    onLists?: (lists: CustomList[]) => void;
    onProgress: (p: ImportProgress) => void;
    isCancelled: () => boolean;
  },
): Promise<ImportProgress> {
  const tasks: Task[] = [
    // Primero las series (traen episodios vistos), después las películas.
    ...plan.shows.map((data) => ({ kind: 'tv' as const, data })),
    ...plan.movies.map((data) => ({ kind: 'movie' as const, data })),
  ];
  const progress: ImportProgress = { done: 0, total: tasks.length, skipped: [] };
  let buffer: LibraryItem[] = [];
  const favorites = new Set(plan.favorites);
  /** Carátula y año de todo lo importado, para armar las listas sin volver a consultar. */
  const known = new Map<string, { posterPath: string | null; year: string | null; title: string }>();
  for (const it of Object.values(opts.existing)) known.set(it.key, it);
  const flush = () => {
    if (buffer.length) {
      for (const it of buffer) {
        if (favorites.has(it.key)) it.favorite = true;
        known.set(it.key, it);
      }
      opts.onBatch(buffer);
    }
    buffer = [];
  };

  let next = 0;
  let failuresInRow = 0;
  const worker = async () => {
    while (next < tasks.length && !opts.isCancelled()) {
      const task = tasks[next++];
      const now = new Date().toISOString();
      const key = itemKey(task.kind, task.data.tmdbId);
      try {
        const known = opts.existing[key];
        if (task.kind === 'movie') {
          const base = known ?? newItemFromMovie(await withRetry(() => getMovie(task.data.tmdbId, false)), 'planned');
          buffer.push(movieItem(base, task.data, now));
        } else {
          const base = known ?? newItemFromTv(await withRetry(() => getTv(task.data.tmdbId, false)), 'planned');
          buffer.push(showItem(base, task.data, now));
        }
        failuresInRow = 0;
      } catch (e) {
        const status = e instanceof TmdbError ? e.status : undefined;
        if (status === 404) {
          progress.skipped.push(task.data.title || key);
        } else if (++failuresInRow >= 8) {
          // Muchos errores seguidos que no son "no existe": algo está mal con la conexión.
          progress.error = (e as Error).message;
          next = tasks.length;
        } else {
          progress.skipped.push(task.data.title || key);
        }
      }
      progress.done++;
      if (buffer.length >= 40) flush();
      if (progress.done % 10 === 0 || progress.done === progress.total) opts.onProgress({ ...progress });
    }
  };

  await Promise.all(Array.from({ length: 6 }, worker));
  flush();

  // Listas: los títulos que no están en tu historial se consultan solo para la carátula.
  if (plan.lists.length && opts.onLists && !opts.isCancelled() && !progress.error) {
    const missing = new Map<string, { type: 'movie' | 'tv'; id: number }>();
    for (const l of plan.lists)
      for (const e of l.entries) {
        const k = itemKey(e.mediaType, e.tmdbId);
        if (!known.has(k)) missing.set(k, { type: e.mediaType, id: e.tmdbId });
      }
    const queue = [...missing.entries()];
    progress.total += queue.length;
    let i = 0;
    const fetcher = async () => {
      while (i < queue.length && !opts.isCancelled()) {
        const [k, m] = queue[i++];
        try {
          if (m.type === 'movie') {
            const d = await withRetry(() => getMovie(m.id, false));
            known.set(k, { posterPath: d.poster_path, year: d.release_date?.slice(0, 4) || null, title: d.title });
          } else {
            const d = await withRetry(() => getTv(m.id, false));
            known.set(k, { posterPath: d.poster_path, year: d.first_air_date?.slice(0, 4) || null, title: d.name });
          }
        } catch {
          // Sin carátula: se agrega igual con el título del archivo.
        }
        progress.done++;
        if (progress.done % 10 === 0) opts.onProgress({ ...progress });
      }
    };
    await Promise.all(Array.from({ length: 6 }, fetcher));
    const now = new Date().toISOString();
    const lists: CustomList[] = plan.lists.map((l, n) => ({
      id: `w${Date.now().toString(36)}${n}`,
      name: l.name,
      description: l.description,
      createdAt: now,
      updatedAt: now,
      entries: l.entries.map((e): ListEntry => {
        const k = itemKey(e.mediaType, e.tmdbId);
        const info = known.get(k);
        return {
          key: k,
          tmdbId: e.tmdbId,
          mediaType: e.mediaType,
          title: info?.title || e.title,
          posterPath: info?.posterPath ?? null,
          year: info?.year ?? e.year,
          addedAt: now,
        };
      }),
    }));
    opts.onLists(lists);
  }

  opts.onProgress({ ...progress });
  return progress;
}
