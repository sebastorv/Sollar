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
import { episodeKey, type LibraryItem } from './types';

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
  const flush = () => {
    if (buffer.length) opts.onBatch(buffer);
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
  opts.onProgress({ ...progress });
  return progress;
}
