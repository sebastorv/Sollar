/**
 * Cálculos de progreso y estadísticas. Son funciones puras (sin red ni estado),
 * así se pueden probar fácilmente y reutilizar en el servidor más adelante.
 */

import { episodeKey, type LibraryItem, type SeasonSummary } from './types';

/** Total de episodios de las temporadas regulares. */
export function totalEpisodes(seasons: SeasonSummary[]): number {
  return seasons.reduce((sum, s) => sum + s.episodeCount, 0);
}

export function watchedCount(item: LibraryItem): number {
  return Object.keys(item.watchedEpisodes).length;
}

/** Progreso de 0 a 1. Para películas: 1 si está vista. */
export function progressOf(item: LibraryItem): number {
  if (item.mediaType === 'movie') return item.watchedAt ? 1 : 0;
  const total = totalEpisodes(item.seasons);
  return total === 0 ? 0 : Math.min(1, watchedCount(item) / total);
}

/**
 * Primer episodio sin ver, recorriendo temporadas en orden.
 * Devuelve null si la serie está al día (o si no hay datos de temporadas).
 */
export function nextEpisode(item: LibraryItem): { season: number; episode: number } | null {
  const ordered = [...item.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  for (const s of ordered) {
    for (let e = 1; e <= s.episodeCount; e++) {
      if (!item.watchedEpisodes[episodeKey(s.seasonNumber, e)]) {
        return { season: s.seasonNumber, episode: e };
      }
    }
  }
  return null;
}

export function formatEpisode(season: number, episode: number): string {
  return `T${season} · E${episode}`;
}

export type LibraryStats = {
  moviesWatched: number;
  episodesWatched: number;
  showsTracked: number;
  showsCompleted: number;
  minutesWatched: number;
  averageRating: number | null;
  topGenres: { name: string; count: number }[];
};

export function computeStats(items: LibraryItem[]): LibraryStats {
  let moviesWatched = 0;
  let episodesWatched = 0;
  let showsTracked = 0;
  let showsCompleted = 0;
  let minutesWatched = 0;
  const ratings: number[] = [];
  const genres = new Map<string, number>();

  for (const item of items) {
    if (item.rating != null) ratings.push(item.rating);

    if (item.mediaType === 'movie') {
      if (item.watchedAt) {
        moviesWatched++;
        minutesWatched += item.runtime ?? 0;
      }
    } else {
      showsTracked++;
      if (item.status === 'completed') showsCompleted++;
      const n = watchedCount(item);
      episodesWatched += n;
      minutesWatched += n * (item.runtime ?? 0);
    }

    const counts = item.watchedAt || watchedCount(item) > 0;
    if (counts) {
      for (const g of item.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
    }
  }

  const topGenres = [...genres.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    moviesWatched,
    episodesWatched,
    showsTracked,
    showsCompleted,
    minutesWatched,
    averageRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    topGenres,
  };
}

/** "3 d 4 h" o "45 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days === 0) return `${hours} h`;
  return hours ? `${days} d ${hours} h` : `${days} d`;
}
