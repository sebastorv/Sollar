/** Convierte respuestas de TMDB en elementos de la biblioteca y viceversa. */

import type {
  BackupFile,
  LibraryItem,
  MediaType,
  SeasonSummary,
  TmdbMovie,
  TmdbTv,
  WatchStatus,
} from './types';

export function itemKey(type: MediaType, id: number): string {
  return `${type}:${id}`;
}

export function seasonsFromTv(tv: TmdbTv): SeasonSummary[] {
  return tv.seasons
    .filter((s) => s.season_number > 0 && s.episode_count > 0)
    .map((s) => ({ seasonNumber: s.season_number, episodeCount: s.episode_count, name: s.name }));
}

function averageRuntime(tv: TmdbTv): number | null {
  const r = tv.episode_run_time.filter((n) => n > 0);
  return r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : null;
}

export function newItemFromMovie(m: TmdbMovie, status: WatchStatus): LibraryItem {
  const now = new Date().toISOString();
  return {
    key: itemKey('movie', m.id),
    tmdbId: m.id,
    mediaType: 'movie',
    title: m.title,
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    year: m.release_date ? m.release_date.slice(0, 4) : null,
    genres: m.genres.map((g) => g.name),
    status,
    rating: null,
    note: '',
    runtime: m.runtime,
    seasons: [],
    watchedEpisodes: {},
    watchedAt: status === 'completed' ? now : null,
    addedAt: now,
    updatedAt: now,
  };
}

export function newItemFromTv(tv: TmdbTv, status: WatchStatus): LibraryItem {
  const now = new Date().toISOString();
  return {
    key: itemKey('tv', tv.id),
    tmdbId: tv.id,
    mediaType: 'tv',
    title: tv.name,
    posterPath: tv.poster_path,
    backdropPath: tv.backdrop_path,
    year: tv.first_air_date ? tv.first_air_date.slice(0, 4) : null,
    genres: tv.genres.map((g) => g.name),
    status,
    rating: null,
    note: '',
    // Muchas series nuevas no traen episode_run_time; 40 min es una estimación razonable.
    runtime: averageRuntime(tv) ?? 40,
    seasons: seasonsFromTv(tv),
    watchedEpisodes: {},
    watchedAt: null,
    addedAt: now,
    updatedAt: now,
  };
}

/** Comprueba que un JSON importado tenga la forma de un respaldo de Butaca. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El texto no es un JSON válido.');
  }
  const b = data as Partial<BackupFile>;
  if (b?.app !== 'butaca' || b.version !== 1 || !Array.isArray(b.items)) {
    throw new Error('El archivo no es un respaldo de Butaca (versión 1).');
  }
  for (const it of b.items) {
    if (typeof it?.key !== 'string' || typeof it?.tmdbId !== 'number') {
      throw new Error('El respaldo tiene elementos incompletos.');
    }
  }
  return b as BackupFile;
}
